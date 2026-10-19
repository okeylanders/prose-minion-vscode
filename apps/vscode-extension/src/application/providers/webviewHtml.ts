/**
 * Shared webview HTML shell — Application layer.
 *
 * One HTML document for EVERY webview surface: the sidebar view
 * (ProseToolsViewProvider), the Workshop editor tab (WorkshopPanelProvider,
 * ADR 2026-07-03) and the Lightbox editor tab (ADR 2026-10-19 D1). All load
 * the same bundle (`dist/webview.js`); the only per-surface differences are
 * the <title> and the #root markup, kept in one exhaustive map below. The
 * `data-pm-surface` stamp on #root tells the webview entry point which React
 * root to mount; full editor tabs also stamp `data-pm-frame="fulltab"`, the
 * scope of the shared full-tab frame styles. One bundle, several roots — no
 * second build pipeline.
 *
 * Extracted from ProseToolsViewProvider so the CSP, nonce, and asset wiring
 * cannot drift between surfaces.
 */

import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
// Surface contract + message type via the public barrel (ADR 2026-06-16):
// the same symbols the webview entry point reads, so the stamp can't drift.
import {
  MessageType,
  PM_FRAME_ATTR,
  PM_FRAME_FULLTAB,
  PM_SURFACE_ATTR,
  SURFACE_LIGHTBOX,
  SURFACE_WORKSHOP,
  WORKSHOP_NOTICE_SHOT_DIR,
  WORKSHOP_NOTICE_SHOTS,
  WebviewSurface,
} from '@prose-minion/core';

interface SurfaceDocument {
  title: string;
  rootDiv: string;
}

/**
 * A full editor tab stamps its surface and the full-tab frame, and carries the
 * boot placeholder on a child <span>, so the first React render leaves no
 * stray inline styles on the layout root.
 */
function fullTabRoot(surface: WebviewSurface, loadingText: string): string {
  return `<div id="root" ${PM_SURFACE_ATTR}="${surface}" ${PM_FRAME_ATTR}="${PM_FRAME_FULLTAB}"><span style="padding:8px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)">${loadingText}</span></div>`;
}

/**
 * Exhaustive per-surface deltas: a new `WebviewSurface` does not compile until
 * it says what its document looks like. The sidebar keeps its historical,
 * unstamped, inline-padded #root (pinned byte-for-byte by snapshot).
 */
const SURFACE_DOCUMENTS: Record<WebviewSurface, SurfaceDocument> = {
  sidebar: {
    title: 'Prose Minion Tools',
    rootDiv: `<div id="root" style="padding:8px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)">Loading Prose Minion…</div>`
  },
  workshop: {
    title: 'Prose Minion Workshop',
    rootDiv: fullTabRoot(SURFACE_WORKSHOP, 'Loading the Workshop…')
  },
  lightbox: {
    title: 'Prose Minion Lightbox',
    rootDiv: fullTabRoot(SURFACE_LIGHTBOX, 'Loading the Lightbox…')
  }
};

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  surface: WebviewSurface
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js')
  );

  const myWorldLoadingGifUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'assets', 'assistant-working-prose-minion-my-world-is-user-generated.gif')
  );
  const helloWorldLoadingGifUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'assets', 'assistant-working-prose-minion-hello-world.gif')
  );

  // Workshop startup-notice screenshots. The webview cannot mint
  // `vscode-webview://` URIs, so the host resolves one per name from the
  // shared contract; the notice modal and the project-configuration guide
  // look them up by the same name (`@shared/constants/workshopNotices`).
  const noticeShotEntries = WORKSHOP_NOTICE_SHOTS.map((name) => {
    const uri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'assets', WORKSHOP_NOTICE_SHOT_DIR, `${name}.png`)
    );
    return `${JSON.stringify(name)}: ${JSON.stringify(String(uri))}`;
  }).join(',\n        ');

  const nonce = getNonce();

  const { title, rootDiv } = SURFACE_DOCUMENTS[surface];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
  <title>${title}</title>
</head>
<body>
  ${rootDiv}
  <script nonce="${nonce}">
    window.proseMinionAssets = {
      vhsLoadingGif: "${myWorldLoadingGifUri}",
      loadingGifs: [
        "${myWorldLoadingGifUri}",
        "${helloWorldLoadingGifUri}"
      ],
      // Enumerate available loading GIF filenames for credits management
      loadingGifList: [
        'assistant-working-prose-minion-my-world-is-user-generated.gif',
        'assistant-working-prose-minion-hello-world.gif'
      ],
      // Map of filename -> credit info
      loadingGifCredits: {
        'assistant-working-prose-minion-my-world-is-user-generated.gif': 'Generated with Adobe Firefly',
        'assistant-working-prose-minion-hello-world.gif': 'Generated with Adobe Firefly'
      },
      // Workshop notice screenshots, keyed by WORKSHOP_NOTICE_SHOTS name
      noticeShots: {
        ${noticeShotEntries}
      }
    };
  </script>
  <script nonce="${nonce}">
    console.log('[Prose Minion] Webview HTML loaded');
    // acquireVsCodeApi() may be called ONCE per webview. This script runs before
    // the bundle, so acquire here and share it: the bundle's getVSCodeApi()
    // prefers this handle instead of acquiring a second time (which throws).
    // Without this the handlers below silently stopped forwarding the moment the
    // React app acquired the API — their try/catch swallowed the throw.
    window.__pmVsCodeApi = (function () { try { return acquireVsCodeApi(); } catch { return undefined; } })();
    function pmPostWebviewError(message) {
      try {
        const api = window.__pmVsCodeApi;
        if (api && api.postMessage) api.postMessage({ type: '${MessageType.WEBVIEW_ERROR}', message: message });
      } catch {}
    }
    window.addEventListener('error', function (e) {
      try {
        const el = document.getElementById('root');
        if (el) el.textContent = 'Webview error: ' + (e?.message || 'unknown');
        pmPostWebviewError(e?.message || 'unknown');
      } catch {}
    });
    // Resource load failures (a missing <img>, a dropped asset) fire AT the
    // element and do not bubble, so the bubble-phase handler above structurally
    // cannot see them — a broken screenshot in the first-run tour used to leave
    // no trail at all (PR #94 review, Oliver). Capture phase catches them.
    // Deliberately NOT routed through the handler above: that one replaces
    // #root's text, which would trade one broken picture for a blank Workshop.
    window.addEventListener('error', function (e) {
      try {
        const el = e?.target;
        const src = el && el.tagName === 'IMG' ? (el.currentSrc || el.src || '') : '';
        if (!src) return;
        pmPostWebviewError('asset failed to load: ' + src);
      } catch {}
    }, true);
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/**
 * CSP nonce from the CSPRNG (PR #66 review #15): `Math.random()` is
 * predictable, and this string is the only thing standing between the CSP and
 * an injected <script> once real model output renders in these documents.
 * base64 stays within the token charset CSP nonces allow.
 */
function getNonce(): string {
  return randomBytes(24).toString('base64');
}
