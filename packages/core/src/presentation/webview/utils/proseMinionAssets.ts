/**
 * proseMinionAssets — the ONE typed view of the host→webview asset bridge.
 *
 * A webview cannot mint `vscode-webview://` URIs, so the host stamps a small
 * literal onto `window.proseMinonAssets` (see the extension's
 * `webviewHtml.ts`) and everything DOM-side reads it from here. Keeping the
 * `declare global` in a single module is what stops two components from
 * declaring conflicting shapes for the same window property.
 *
 * (The `proseMinon` spelling is a long-standing typo in the shipped bridge.
 * Renaming it would break any webview loaded from a cached HTML shell, so the
 * misspelling stays and this comment carries the apology.)
 */

import { WorkshopNoticeShot } from '@shared/constants/workshopNotices';

export interface ProseMinionAssets {
  vhsLoadingGif?: string;
  loadingGifs?: string[];
  loadingGifList?: string[];
  loadingGifCredits?: Record<string, { label: string; href: string } | string>;
  /** Workshop notice screenshots, keyed by `WORKSHOP_NOTICE_SHOTS` name. */
  noticeShots?: Partial<Record<WorkshopNoticeShot, string>>;
}

declare global {
  interface Window {
    proseMinonAssets?: ProseMinionAssets;
  }
}

export function getProseMinionAssets(): ProseMinionAssets | undefined {
  return typeof window === 'undefined' ? undefined : window.proseMinonAssets;
}

/**
 * URI for one notice screenshot, or `''` when the host has not stamped it —
 * an unresolved name renders an empty `<img>` rather than throwing, so a
 * missing asset costs a broken picture and not the whole tour.
 */
export function getNoticeShotUri(name: WorkshopNoticeShot): string {
  return getProseMinionAssets()?.noticeShots?.[name] ?? '';
}
