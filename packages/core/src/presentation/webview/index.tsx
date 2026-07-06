/**
 * Webview entry point
 * Bootstraps the React application
 *
 * One bundle, two roots (ADR 2026-07-03): the host stamps
 * `data-pm-surface="workshop"` on #root for the Workshop editor tab; the
 * sidebar stays unstamped. We branch on that flag here — no second build
 * pipeline, just a second React root.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { WorkshopApp } from './WorkshopApp';
import { MessageType, PM_SURFACE_ATTR, SURFACE_WORKSHOP } from '@shared/types';
import { getVSCodeApi } from './hooks/useVSCodeApi';
import { AppMessagePort } from './ports/AppMessagePort';
import './index.css';

try {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Root element not found');
  }
  const surface = root.getAttribute(PM_SURFACE_ATTR);
  createRoot(root).render(
    <React.StrictMode>
      {surface === SURFACE_WORKSHOP ? <WorkshopApp /> : <App />}
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
