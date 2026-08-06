/**
 * Webview surface contract (ADR 2026-07-03).
 *
 * The host stamps `PM_SURFACE_ATTR` on the webview's #root to select which
 * React root the shared bundle mounts; the entry point reads the same
 * attribute back. This is the one importable home for that attribute name and
 * its values, so the host side (webviewHtml.ts) and the webview side
 * (index.tsx) cannot drift — the compiler links what used to be two
 * hand-synced string literals (PR #66 review, Marcus).
 *
 * Workshop styles necessarily repeat the literal inside their attribute
 * selectors (CSS cannot import constants); changing a surface value here means
 * updating each stylesheet's `[data-pm-surface="…"]` scope with it.
 */

export const PM_SURFACE_ATTR = 'data-pm-surface';

export type WebviewSurface = 'sidebar' | 'workshop';

export const SURFACE_SIDEBAR: WebviewSurface = 'sidebar';
export const SURFACE_WORKSHOP: WebviewSurface = 'workshop';
