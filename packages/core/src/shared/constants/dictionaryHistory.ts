/**
 * Dictionary lookup history bounds and location (ADR 2026-10-14, D1, D3, D5).
 *
 * Shared by the host store and the webview so the cap the popup states, the
 * preview it shows, and the path it names cannot drift from what the store does.
 */

/** Newest entries kept; recording past this evicts the oldest. */
export const DICTIONARY_HISTORY_LIMIT = 50;

/** Characters of collapsed context a summary carries before `…`. */
export const DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS = 140;

/**
 * Workspace-relative location, for display only (POSIX separators). The store
 * builds the real path with `path.join` so it is native on every host.
 */
export const DICTIONARY_HISTORY_DISPLAY_PATH = 'prose-minion/history/dictionary.json';
