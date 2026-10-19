/**
 * Webview surface contract (ADR 2026-07-03; Lightbox ADR 2026-10-19 D1).
 *
 * The host stamps `PM_SURFACE_ATTR` on the webview's #root to select which
 * React root the shared bundle mounts; the entry point reads the same
 * attribute back. This is the one importable home for that attribute name and
 * its values, so the host side (webviewHtml.ts) and the webview side
 * (index.tsx) cannot drift — the compiler links what used to be two
 * hand-synced string literals (PR #66 review, Marcus).
 *
 * Every branch on the surface is an exhaustive `Record<WebviewSurface, …>`, so
 * adding a surface here is a compile error everywhere it must be handled
 * rather than a silent fall-through to the sidebar.
 *
 * Full editor tabs (the Workshop, the Lightbox) also carry
 * `PM_FRAME_ATTR="fulltab"`, the scope of the shared full-tab frame styles
 * (`styles/fulltab/`). Styles necessarily repeat these literals inside their
 * attribute selectors (CSS cannot import constants); changing a value here
 * means updating each stylesheet's `[data-pm-surface="…"]` or
 * `[data-pm-frame="…"]` scope with it.
 */

export const PM_SURFACE_ATTR = 'data-pm-surface';

export type WebviewSurface = 'sidebar' | 'workshop' | 'lightbox';

export const SURFACE_SIDEBAR: WebviewSurface = 'sidebar';
export const SURFACE_WORKSHOP: WebviewSurface = 'workshop';
export const SURFACE_LIGHTBOX: WebviewSurface = 'lightbox';

/** Marks a full editor tab's #root; the shared frame styles scope to it. */
export const PM_FRAME_ATTR = 'data-pm-frame';
export const PM_FRAME_FULLTAB = 'fulltab';

const WEBVIEW_SURFACES: Record<WebviewSurface, true> = {
  sidebar: true,
  workshop: true,
  lightbox: true
};

/**
 * Reads the #root stamp back into a surface. The sidebar is unstamped, so a
 * missing or unrecognized value means the sidebar, as it always has.
 */
export function resolveWebviewSurface(stamp: string | null): WebviewSurface {
  return stamp !== null && Object.prototype.hasOwnProperty.call(WEBVIEW_SURFACES, stamp)
    ? (stamp as WebviewSurface)
    : SURFACE_SIDEBAR;
}
