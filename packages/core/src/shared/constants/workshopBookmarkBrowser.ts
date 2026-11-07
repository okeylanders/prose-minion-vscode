/**
 * The Bookmarks screen's page bounds (ADR 2026-11-05 D8, PR #214 F-02).
 *
 * The screen reads saved sessions a page at a time through the store's
 * read-only `listPage`. The store enforces both bounds: a page holds at most
 * `bookmarkBrowserSessions` session files, and stops once their sizes reach
 * `bookmarkBrowserBytes` (always after at least one file, so every page moves
 * the cursor on). These are writer-facing limits on what one page loads, not
 * prompt budgets: the persona's `transcript.bookmarks` keeps its own bounds in
 * `PROMPT_BUDGETS`.
 *
 * They live here, not beside `WORKSHOP_SESSION_STORE_LIMITS`, because recall
 * may know the store only as a type: the store enforces them, and recall
 * names the session bound when it asks for a page.
 */
export interface WorkshopBookmarkBrowserLimits {
  readonly bookmarkBrowserSessions: number;
  readonly bookmarkBrowserBytes: number;
}

export const WORKSHOP_BOOKMARK_BROWSER_LIMITS: WorkshopBookmarkBrowserLimits = Object.freeze({
  /** Session files one page reads, at most. */
  bookmarkBrowserSessions: 25,
  /** File bytes one page reads before it stops (the last file may carry it past). */
  bookmarkBrowserBytes: 32 * 1024 * 1024
});
