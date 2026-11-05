/**
 * The store's paged walk of every named session file (ADR 2026-11-05 D8,
 * PR #214 F-02): what the Bookmarks screen reads, a page at a time.
 *
 * - **Every file, in one stable order.** Names sort newest first by code
 *   unit (they are timestamp-prefixed), and the cursor is the last name a
 *   page took: the next page starts strictly after it. Unlike the browser's
 *   listing, nothing is capped at 200, so the walk reaches every file.
 * - **Bounded per page** by `WORKSHOP_BOOKMARK_BROWSER_LIMITS`: at most
 *   `bookmarkBrowserSessions` files, stopping once their sizes reach
 *   `bookmarkBrowserBytes`. A page always takes at least one file, so a file
 *   larger than the budget is read alone rather than blocking the walk.
 * - **Read-only.** It reads the directory, each file's size and its summary
 *   (the search index, or the browser's bounded read); it never initializes,
 *   writes or flushes. The cursor is only ever compared, never a path.
 * - **Nothing skipped silently.** A file whose summary cannot be read is an
 *   entry without one, so the caller counts it as unreadable; a file gone
 *   between the listing and its read is passed over and the cursor moves on.
 */

import { WORKSHOP_BOOKMARK_BROWSER_LIMITS, WorkshopBookmarkBrowserLimits } from '@shared/constants/workshopBookmarkBrowser';
import type { WorkshopStoredSessionSummary } from '@/infrastructure/storage/WorkshopSessionSearchIndexV1';

export interface WorkshopSessionPageRequest {
  /** The cursor a previous page returned; absent for the first page. */
  readonly after?: string;
  /** Files the caller wants; the store caps it at its own bound. */
  readonly limit: number;
}

export interface WorkshopSessionPageEntry {
  /** Where this file stands in the walk: a page that ends here continues after it. */
  readonly cursor: string;
  /** Absent when the file's summary could not be read. */
  readonly summary?: WorkshopStoredSessionSummary;
}

export interface WorkshopSessionPage {
  readonly entries: readonly WorkshopSessionPageEntry[];
  /** Pass as `after` for the next page; absent once the walk is done. */
  readonly next?: string;
  /** Files after this page, not yet read. */
  readonly remaining: number;
}

/** One file as the walk reads it: gone, or its size and summary (if readable). */
export type WorkshopSessionPageRead =
  | { readonly kind: 'gone' }
  | { readonly kind: 'read'; readonly bytes: number; readonly summary?: WorkshopStoredSessionSummary };

/** Newest first, by code unit: the one order every page and cursor share. */
export function workshopSessionPageOrder(names: readonly string[]): string[] {
  return [...names].sort((left, right) => (left < right ? 1 : left > right ? -1 : 0));
}

/**
 * One page of `names` (any order) after `request.after`, each file read by
 * `read` in walk order.
 */
export async function readWorkshopSessionPage(
  names: readonly string[],
  request: WorkshopSessionPageRequest,
  read: (fileName: string) => Promise<WorkshopSessionPageRead>,
  signal?: AbortSignal,
  limits: WorkshopBookmarkBrowserLimits = WORKSHOP_BOOKMARK_BROWSER_LIMITS
): Promise<WorkshopSessionPage> {
  const after = request.after;
  const walk = workshopSessionPageOrder(names).filter((name) => after === undefined || name < after);
  const limit = Math.max(1, Math.min(Math.floor(request.limit) || 1, limits.bookmarkBrowserSessions));
  const entries: WorkshopSessionPageEntry[] = [];
  let bytes = 0;
  let taken = 0;
  for (const fileName of walk) {
    if (entries.length >= limit || (entries.length > 0 && bytes >= limits.bookmarkBrowserBytes)) {
      break;
    }
    throwIfPageAborted(signal);
    const file = await read(fileName);
    throwIfPageAborted(signal);
    taken += 1;
    if (file.kind === 'gone') {
      continue;
    }
    bytes += file.bytes;
    entries.push({ cursor: fileName, ...(file.summary ? { summary: file.summary } : {}) });
  }
  const remaining = walk.length - taken;
  return {
    entries,
    ...(remaining > 0 && taken > 0 ? { next: walk[taken - 1] } : {}),
    remaining
  };
}

function throwIfPageAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const error = new Error('Reading a page of Workshop sessions was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}
