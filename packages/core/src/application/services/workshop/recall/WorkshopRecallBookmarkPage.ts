/**
 * The Bookmarks screen's page of saved sessions (ADR 2026-11-05 D8, PR #214
 * F-02): a writer-facing read, as `positionsOf` serves the memory manager.
 * It is never a persona's: the model-facing `transcript.bookmarks` keeps its
 * own bounds, and nothing here enters a prompt.
 *
 * - **The page is the store's.** `listPage` walks every session file in one
 *   stable order and bounds each page by files and bytes, so every session
 *   it takes is read here: cached documents are free, cold ones go through
 *   the loader, under the call's scope.
 * - **The open room is left out** (it is read through the live port), and
 *   so is a second file claiming an id already read, which counts as
 *   unreadable: an exact read could not tell the two apart.
 * - **Every session is accounted for:** read, unreadable (named when its
 *   summary was readable), or not yet read (`remaining`, after `next`).
 * - Rows are recall's bookmarks (WorkshopRecallBookmarks): field by field,
 *   the message as the transcript projects it. Pure but for `load`.
 */

import type { WorkshopRecallBookmark } from '@/application/services/workshop/recall/WorkshopRecallBookmarks';
import type { WorkshopRecallLoadedDocuments } from '@/application/services/workshop/recall/WorkshopRecallDocumentLoader';
import type { WorkshopRecallSessionSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';

/** One file of a page, as the corpus port's `listPage` returns it. */
export interface WorkshopRecallSessionPageEntry {
  readonly cursor: string;
  /** Absent when the store could not read the file's summary. */
  readonly summary?: WorkshopRecallSessionSummary;
}

/** What the corpus port's `listPage` returns. */
export interface WorkshopRecallSessionPage {
  readonly entries: readonly WorkshopRecallSessionPageEntry[];
  readonly next?: string;
  readonly remaining: number;
}

/** A saved session the page read that holds bookmarks. */
export interface WorkshopRecallBookmarkPageSession {
  readonly sessionId: string;
  readonly title: string;
  /** When it was last saved. */
  readonly savedAt: string;
  /** Its own IANA timezone: what its dates are days in. */
  readonly timezone: string;
  /** Thread order. */
  readonly bookmarks: readonly WorkshopRecallBookmark[];
}

export interface WorkshopRecallBookmarkPage {
  readonly available: true;
  readonly outcome: 'bookmark-page';
  /** Sessions read that hold at least one bookmark, in walk order. */
  readonly sessions: readonly WorkshopRecallBookmarkPageSession[];
  /** Saved sessions this page read (with bookmarks or not). */
  readonly read: number;
  /** Files this page could not read; `unreadableSessions` names those it can. */
  readonly unreadable: number;
  readonly unreadableSessions: ReadonlyArray<{ readonly sessionId: string; readonly title: string }>;
  /** Files after this page, not yet read. */
  readonly remaining: number;
  /** The cursor for the next page; absent once every file was walked. */
  readonly next?: string;
  readonly cacheHits: number;
  readonly parsedBytes: number;
}

/**
 * Read one page. `load` reads the given sessions in order (cached ones free)
 * under the call's scope; the store has already bounded the page.
 */
export async function workshopRecallBookmarkPage(
  page: WorkshopRecallSessionPage,
  liveSessionId: string,
  load: (sessions: readonly WorkshopRecallSessionSummary[]) => Promise<WorkshopRecallLoadedDocuments>
): Promise<WorkshopRecallBookmarkPage> {
  const seen = new Set<string>();
  const wanted: WorkshopRecallSessionSummary[] = [];
  const unreadableSessions: Array<{ sessionId: string; title: string }> = [];
  let unnamed = 0;
  for (const { summary } of page.entries) {
    if (!summary) {
      unnamed += 1;
    } else if (summary.sessionId === liveSessionId) {
      continue;
    } else if (seen.has(summary.sessionId)) {
      unreadableSessions.push({ sessionId: summary.sessionId, title: summary.title });
    } else {
      seen.add(summary.sessionId);
      wanted.push(summary);
    }
  }
  const loaded = await load(wanted);
  const sessions: WorkshopRecallBookmarkPageSession[] = [];
  loaded.outcomes.forEach((outcome, index) => {
    if (outcome.kind !== 'loaded') {
      unreadableSessions.push({ sessionId: wanted[index].sessionId, title: wanted[index].title });
      return;
    }
    const { header, bookmarks } = outcome.document;
    if (bookmarks.length > 0) {
      sessions.push({
        sessionId: header.sessionId,
        title: header.title,
        savedAt: header.savedAt,
        timezone: header.timezone,
        bookmarks
      });
    }
  });
  return {
    available: true,
    outcome: 'bookmark-page',
    sessions,
    read: loaded.documents.length,
    unreadable: unnamed + unreadableSessions.length,
    unreadableSessions,
    remaining: page.remaining,
    ...(page.next !== undefined ? { next: page.next } : {}),
    cacheHits: loaded.cost.cacheHits,
    parsedBytes: loaded.cost.parsedBytes
  };
}

/** The page's log line: counts only, never a title or a label. */
export function workshopRecallBookmarkPageLogLine(page: WorkshopRecallBookmarkPage): string {
  const bookmarks = page.sessions.reduce((total, session) => total + session.bookmarks.length, 0);
  return `bookmark-page read=${page.read} unreadable=${page.unreadable} remaining=${page.remaining} ` +
    `withBookmarks=${page.sessions.length} bookmarks=${bookmarks} cacheHits=${page.cacheHits} parsedBytes=${page.parsedBytes}`;
}
