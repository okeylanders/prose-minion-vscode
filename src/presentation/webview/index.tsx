/**
 * Webview entry point
 * Bootstraps the React application
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './App';
import { MessageType } from '@shared/types';
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
    // Report to extension output channel
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const vscode = acquireVsCodeApi?.();
    vscode?.postMessage?.({ type: MessageType.WEBVIEW_ERROR, message: e?.message || String(e) });
  } catch {
    // ignore
  }
}
