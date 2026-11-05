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
}

/** What the loaded pages cover, as the hook accumulates it. */
export interface WorkshopBookmarkBrowserCoverage {
  read: number;
  unreadable: number;
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

export function savedBookmarkItems(sessions: readonly WorkshopBookmarkBrowserSession[]): WorkshopBookmarkBrowserItem[] {
  return sessions.flatMap((session) => session.bookmarks.map((row): WorkshopBookmarkBrowserItem => ({
    key: `${session.sessionId}/${row.bookmarkId}`,
    source: { kind: 'saved', sessionId: session.sessionId, sessionTitle: session.title, savedAt: session.savedAt },
    row
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
  const total = coverage.read + coverage.unreadable + coverage.remaining;
  if (total === 0) {
    return 'No saved sessions yet.';
  }
  const sessions = total === 1 ? 'saved session' : 'saved sessions';
  const head = coverage.remaining === 0 && coverage.unreadable === 0
    ? `Bookmarks from all ${total} ${sessions}`
    : `Bookmarks from ${coverage.read} of ${total} ${sessions}`;
  const unreadable = coverage.unreadable > 0
    ? ` · ${coverage.unreadable} couldn’t be read`
    : '';
  return `${head}${unreadable}.`;
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
