/**
 * The Bookmarks screen in words (ADR 2026-11-05 D8): its items, search,
 * groupings and coverage line. Pure; the host sends rows, this decides how
 * they read.
 *
 * - **Items** are the open room's rows and each saved session's, keyed by
 *   their source (bookmark ids are unique only within a session).
 * - **Search** covers each bookmark's label and its message's text. The open
 *   room's rows carry their whole message, so search over them is complete;
 *   saved rows are searched as far as pages have loaded, and the screen says
 *   so (`searchCoverageNote`).
 * - **Groupings:** by the bookmark's date (the shared buckets), or by session.
 * - **Coverage:** how many saved sessions the loaded pages read, of all of
 *   them, and how many could not be read.
 * - **Duplicate ids** (PR #216 F-01, F-03, F-04): a row whose session id
 *   another file claims is `ambiguous`, and is never offered to open. The
 *   check covers only the sessions read so far: one that couldn't be read
 *   has an unknown id, never a unique one, and the screen says so
 *   (`duplicateCheckNote`); an exact Preview or Open always checks again.
 */

import type {
  WorkshopBookmarkBrowserRow,
  WorkshopBookmarkBrowserSession
} from '@messages';
import { groupSavedItems, groupSavedItemsByDate, type SavedItemGroup } from '@utils/savedItemGroups';

export type WorkshopBookmarkBrowserSource =
  | { kind: 'live' }
  | { kind: 'saved'; sessionId: string; sessionTitle: string; savedAt: string };

export interface WorkshopBookmarkBrowserItem {
  /** `live/{bookmarkId}` or `{sessionId}/{bookmarkId}`. */
  key: string;
  source: WorkshopBookmarkBrowserSource;
  row: WorkshopBookmarkBrowserRow;
  /** Another saved file claims this session's id: the row previews but never opens. */
  ambiguous?: true;
}

/** What the loaded pages cover, as the hook accumulates it. */
export interface WorkshopBookmarkBrowserCoverage {
  read: number;
  unreadable: number;
  /** Files not read because another file claims the same id. */
  ambiguous: number;
  /** Not yet read, as the latest page said. */
  remaining: number;
  /** A first page has landed. */
  started: boolean;
}

export const LIVE_SESSION_LABEL = 'This conversation';
/** How much of a message a row shows. */
const FIRST_LINES = 3;
const FIRST_LINE_CHARACTERS = 240;

export function liveBookmarkItems(rows: readonly WorkshopBookmarkBrowserRow[]): WorkshopBookmarkBrowserItem[] {
  return rows.map((row) => ({ key: `live/${row.bookmarkId}`, source: { kind: 'live' }, row }));
}

export function savedBookmarkItems(
  sessions: readonly WorkshopBookmarkBrowserSession[],
  ambiguousSessionIds: ReadonlySet<string> = new Set()
): WorkshopBookmarkBrowserItem[] {
  return sessions.flatMap((session) => session.bookmarks.map((row): WorkshopBookmarkBrowserItem => ({
    key: `${session.sessionId}/${row.bookmarkId}`,
    source: { kind: 'saved', sessionId: session.sessionId, sessionTitle: session.title, savedAt: session.savedAt },
    row,
    ...(ambiguousSessionIds.has(session.sessionId) ? { ambiguous: true as const } : {})
  })));
}

/** Where a bookmark lives, as a row names it. */
export function bookmarkSessionLabel(item: WorkshopBookmarkBrowserItem): string {
  return item.source.kind === 'live' ? LIVE_SESSION_LABEL : item.source.sessionTitle;
}

/** Search over the label and the message's text, every word required, case and accents aside. */
export function matchesBookmarkQuery(item: WorkshopBookmarkBrowserItem, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return true;
  }
  const haystack = fold(`${item.row.label}\n${item.row.message?.content ?? ''}`);
  return words.every((word) => haystack.includes(word));
}

export function filterBookmarks(items: readonly WorkshopBookmarkBrowserItem[], query: string): WorkshopBookmarkBrowserItem[] {
  return items.filter((item) => matchesBookmarkQuery(item, query));
}

/** By the bookmark's own date: Today, This week, Earlier, newest first within each. */
export function groupBookmarksByDate(
  items: readonly WorkshopBookmarkBrowserItem[],
  now: Date = new Date()
): Array<SavedItemGroup<WorkshopBookmarkBrowserItem>> {
  const newestFirst = [...items].sort((left, right) => right.row.createdAt - left.row.createdAt);
  return groupSavedItemsByDate(newestFirst, (item) => item.row.createdAt, now);
}

/** By session, in the order the sessions arrived (the open room first), thread order within each. */
export function groupBookmarksBySession(
  items: readonly WorkshopBookmarkBrowserItem[]
): Array<SavedItemGroup<WorkshopBookmarkBrowserItem>> {
  const order = new Map<string, number>();
  return groupSavedItems(items, (item) => {
    const key = item.source.kind === 'live' ? 'live' : `saved:${item.source.sessionId}`;
    if (!order.has(key)) {
      order.set(key, order.size);
    }
    return { key, label: bookmarkSessionLabel(item), order: order.get(key)! };
  });
}

/** The first lines of a message, as a row shows them. */
export function bookmarkFirstLines(content: string | undefined): string {
  if (!content) {
    return '';
  }
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, FIRST_LINES).join(' ');
  return lines.length > FIRST_LINE_CHARACTERS ? `${lines.slice(0, FIRST_LINE_CHARACTERS - 1).trimEnd()}…` : lines;
}

/** "Bookmarks from 120 of 340 saved sessions", and what could not be read. */
export function bookmarkCoverageLine(coverage: WorkshopBookmarkBrowserCoverage): string | undefined {
  if (!coverage.started) {
    return undefined;
  }
  const total = coverage.read + coverage.unreadable + coverage.ambiguous + coverage.remaining;
  if (total === 0) {
    return 'No saved sessions yet.';
  }
  const sessions = total === 1 ? 'saved session' : 'saved sessions';
  const head = coverage.remaining === 0 && coverage.unreadable === 0 && coverage.ambiguous === 0
    ? `Bookmarks from all ${total} ${sessions}`
    : `Bookmarks from ${coverage.read} of ${total} ${sessions}`;
  const unreadable = coverage.unreadable > 0
    ? ` · ${coverage.unreadable} couldn’t be read`
    : '';
  return `${head}${unreadable}.`;
}

/**
 * What the duplicate check covers, said only when it matters: some sessions
 * share an id, or some couldn't be read, so their ids are unknown. Never a
 * claim that the rows shown are unique.
 */
export function duplicateCheckNote(coverage: WorkshopBookmarkBrowserCoverage): string | undefined {
  if (!coverage.started || (coverage.ambiguous === 0 && coverage.unreadable === 0)) {
    return undefined;
  }
  const parts: string[] = [];
  if (coverage.ambiguous > 0) {
    parts.push(`${coverage.ambiguous} saved ${coverage.ambiguous === 1 ? 'file shares its' : 'files share their'} session id with another, so those bookmarks can’t be opened from here.`);
  }
  if (coverage.unreadable > 0) {
    parts.push(`Shared session ids are checked across the ${coverage.read} sessions read; ${coverage.unreadable} couldn’t be read, so Preview and Open check again.`);
  }
  return parts.join(' ');
}

/** What a search can say while saved sessions remain unread; nothing once every page is in. */
export function searchCoverageNote(query: string, coverage: WorkshopBookmarkBrowserCoverage): string | undefined {
  if (!query.trim() || !coverage.started || coverage.remaining === 0) {
    return undefined;
  }
  return `Searching the sessions loaded so far. ${coverage.remaining} more ${
    coverage.remaining === 1 ? 'session hasn’t' : 'sessions haven’t'} been read.`;
}

function fold(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}
