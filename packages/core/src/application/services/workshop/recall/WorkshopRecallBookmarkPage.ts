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
 * - **The open room is left out** (it is read through the live port).
 * - **An id two files claim is never resolved** (PR #216 F-01, F-03). A page
 *   reads only its own files: it knows the ids its walk met on earlier pages
 *   (`priorIds`, WorkshopRecallBookmarkWalks), and an id repeated within the
 *   page, or met before, is reported in `ambiguousSessionIds` and not read.
 *   The screen then marks every row of that id, earlier pages' included, and
 *   offers none of them to open. A page reads each session from the file its
 *   own entry names (`load`), never through the store's exact-read path cache.
 * - **Unknown is never unique** (F-04). A file whose summary couldn't be read
 *   has an unknown id: it counts as unreadable, and the screen says the
 *   duplicate check covers only what it could read; an exact Preview or Open
 *   checks again.
 * - **Every session file is accounted for:** read, ambiguous, unreadable
 *   (named when its summary was readable), or not yet read (`remaining`,
 *   after `next`).
 * - Rows are recall's bookmarks (WorkshopRecallBookmarks): field by field,
 *   the message as the transcript projects it. Pure but for `load`.
 */

import type { WorkshopRecallBookmark } from '@/application/services/workshop/recall/WorkshopRecallBookmarks';
import type { WorkshopRecallLoadedDocuments } from '@/application/services/workshop/recall/WorkshopRecallDocumentLoader';
import type { WorkshopRecallSessionSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';

/** One file of a page, as the corpus port's `listPage` returns it. */
export interface WorkshopRecallSessionPageEntry {
  readonly cursor: string;
  /** Absent when the store could not read the file's summary: its id is unknown. */
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
  /** Files this page did not read because another file of the walk claims the same id. */
  readonly ambiguous: number;
  /** Those ids: every row of each, on any page, is one the screen won't open. */
  readonly ambiguousSessionIds: readonly string[];
  /** Every id this page met (read, unreadable or ambiguous): what its walk remembers. */
  readonly metSessionIds: readonly string[];
  /** Files after this page, not yet read. */
  readonly remaining: number;
  /** The cursor for the next page; absent once every file was walked. */
  readonly next?: string;
  readonly cacheHits: number;
  readonly parsedBytes: number;
}

/** A later page whose walk was forgotten: the screen starts again from the first page. */
export interface WorkshopRecallBookmarkWalkExpired {
  readonly available: true;
  readonly outcome: 'walk-expired';
}

/**
 * Read one page. `load` reads the given sessions in order (cached ones free)
 * under the call's scope; the store has already bounded the page.
 */
export async function workshopRecallBookmarkPage(
  page: WorkshopRecallSessionPage,
  liveSessionId: string,
  priorIds: ReadonlySet<string>,
  load: (sessions: readonly WorkshopRecallSessionSummary[]) => Promise<WorkshopRecallLoadedDocuments>
): Promise<WorkshopRecallBookmarkPage> {
  const claims = new Map<string, number>();
  for (const { summary } of page.entries) {
    if (summary && summary.sessionId !== liveSessionId) {
      claims.set(summary.sessionId, (claims.get(summary.sessionId) ?? 0) + 1);
    }
  }
  const wanted: WorkshopRecallSessionSummary[] = [];
  const unreadableSessions: Array<{ sessionId: string; title: string }> = [];
  const ambiguousIds = new Set<string>();
  let ambiguous = 0;
  let unnamed = 0;
  for (const { summary } of page.entries) {
    if (!summary) {
      unnamed += 1;
    } else if (summary.sessionId === liveSessionId) {
      continue;
    } else if (priorIds.has(summary.sessionId) || (claims.get(summary.sessionId) ?? 0) > 1) {
      ambiguous += 1;
      ambiguousIds.add(summary.sessionId);
    } else {
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
    ambiguous,
    ambiguousSessionIds: [...ambiguousIds],
    metSessionIds: [...claims.keys()],
    remaining: page.remaining,
    ...(page.next !== undefined ? { next: page.next } : {}),
    cacheHits: loaded.cost.cacheHits,
    parsedBytes: loaded.cost.parsedBytes
  };
}

/** The page's log line: counts only, never a title or a label. */
export function workshopRecallBookmarkPageLogLine(page: WorkshopRecallBookmarkPage): string {
  const bookmarks = page.sessions.reduce((total, session) => total + session.bookmarks.length, 0);
  return `bookmark-page read=${page.read} unreadable=${page.unreadable} ambiguous=${page.ambiguous} remaining=${page.remaining} ` +
    `withBookmarks=${page.sessions.length} bookmarks=${bookmarks} cacheHits=${page.cacheHits} parsedBytes=${page.parsedBytes}`;
}
