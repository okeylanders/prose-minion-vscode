/**
 * Webview entry point
 * Bootstraps the React application
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './App';
import { MessageType } from '@shared/types';
import { getVSCodeApi } from './hooks/useVSCodeApi';
import { AppMessagePort } from './ports/AppMessagePort';
import './index.css';

try {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Root element not found');
  }
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    root
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
