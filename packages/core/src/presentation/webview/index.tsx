/**
 * Webview entry point
 * Bootstraps the React application
 *
 * One bundle, several roots (ADR 2026-07-03; Lightbox ADR 2026-10-19 D1): the
 * host stamps `data-pm-surface` on #root for each editor tab (`workshop`,
 * `lightbox`); the sidebar stays unstamped. The root is chosen from an
 * exhaustive surface map — no second build pipeline, and no surface that can
 * silently fall through to the sidebar.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
// The shared full-tab frame loads FIRST. style-loader inserts sheets in module
// evaluation order, and each tab's own sheets (imported by its root below)
// must follow the frame, so a tab rule of equal specificity still wins, as it
// did when these rules sat at the top of the Workshop's shell.css. The order
// is pinned by workshopStyles.test.ts.
import './styles/fulltab/tokens.css';
import './styles/fulltab/shell.css';
import './styles/fulltab/modal.css';
import { App } from './App';
import { WorkshopApp } from './WorkshopApp';
import { LightboxApp } from './LightboxApp';
import {
  MessageType,
  PM_SURFACE_ATTR,
  WebviewSurface,
  resolveWebviewSurface
} from '@shared/types';
import { getVSCodeApi } from './hooks/useVSCodeApi';
import { AppMessagePort } from './ports/AppMessagePort';
import './index.css';

const SURFACE_ROOTS: Record<WebviewSurface, React.ComponentType> = {
  sidebar: App,
  workshop: WorkshopApp,
  lightbox: LightboxApp
};

try {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Root element not found');
  }
  const surface = resolveWebviewSurface(root.getAttribute(PM_SURFACE_ATTR));
  createRoot(root).render(
    <React.StrictMode>
      {React.createElement(SURFACE_ROOTS[surface])}
    </React.StrictMode>
  );
} catch (e: any) {
  const root = document.getElementById('root');
  if (root) {
    root.textContent = 'Webview init error: ' + (e?.message || String(e));
  }
  // eslint-disable-next-line no-console
  console.error('Webview init error:', e);
  try {
    // Report to the extension via the AppMessagePort adapter (the only module
    // that touches the acquireVsCodeApi() global). Typed as the narrow port so
    // the raw bootstrap diagnostic posts verbatim (not a full MessageEnvelope).
    const vscode: AppMessagePort = getVSCodeApi();
    vscode?.postMessage?.({ type: MessageType.WEBVIEW_ERROR, message: e?.message || String(e) });
  } catch {
    // ignore — the host bridge may be unavailable this early in bootstrap
  }
}
