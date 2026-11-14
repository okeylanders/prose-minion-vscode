/**
 * Dictionary lookup history bounds and location (ADR 2026-10-14, D1, D3, D5).
 *
 * Shared by the host store and the webview so the cap the popup states, the
 * preview it shows, and the path it names cannot drift from what the store does.
 */

/** Newest entries kept; recording past this evicts the oldest. */
export const DICTIONARY_HISTORY_LIMIT = 500;

/** Characters of collapsed context a summary carries before `…`. */
export const DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS = 140;

/**
 * Workspace-relative location, for display only (POSIX separators). The store
 * builds the real path with `path.join` so it is native on every host.
 */
export const DICTIONARY_HISTORY_DISPLAY_PATH = 'prose-minion/history/dictionary.json';

// History search (the ADR's 2026-11-14 amendment). The webview filters the
// summaries it holds; "Also search definitions" asks the host, which answers
// with ids and a snippet, never a result body.

/** Characters of a search query that are read; a longer query is clipped to this, on both sides. */
export const DICTIONARY_HISTORY_SEARCH_QUERY_CHARS = 100;

/** Characters of a definition shown before a hit, in its snippet. */
export const DICTIONARY_HISTORY_SEARCH_SNIPPET_BEFORE_CHARS = 40;

/** Characters of a definition shown after a hit, in its snippet. */
export const DICTIONARY_HISTORY_SEARCH_SNIPPET_AFTER_CHARS = 80;

/** How long the popup waits after the last keystroke before it asks the host. */
export const DICTIONARY_HISTORY_SEARCH_DEBOUNCE_MS = 250;
