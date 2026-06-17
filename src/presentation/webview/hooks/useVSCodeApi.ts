/**
 * useVSCodeApi — the VS Code adapter for {@link AppMessagePort}.
 *
 * This module is the ONLY place the `acquireVsCodeApi()` global is referenced;
 * every other webview file goes through `useVSCodeApi()` (the hook) or
 * `getVSCodeApi()` (the singleton factory, for non-hook callers like the
 * bootstrap error reporter in index.tsx). Keeping the global isolated here is
 * what lets the renderer move into platform-agnostic `core` behind the port —
 * the desktop renderer swaps in an IPC-backed `AppMessagePort` of the same
 * shape with no change to consumers.
 */

import * as React from 'react';
import { VSCodeAPI } from '../types/vscode';

// The VS Code webview runtime global — the AppMessagePort implementation.
declare function acquireVsCodeApi(): VSCodeAPI;

// Ensure we only acquire the API once per webview lifecycle.
let cachedApi: VSCodeAPI | undefined;

/**
 * Singleton accessor for the VS Code webview API (the `AppMessagePort` impl).
 * Exported for non-hook callers (e.g. the index.tsx bootstrap error path) so
 * the `acquireVsCodeApi()` global stays referenced in exactly one module.
 */
export const getVSCodeApi = (): VSCodeAPI => {
  if (!cachedApi) {
    cachedApi = acquireVsCodeApi();
  }
  return cachedApi;
};

/**
 * Custom hook that wraps the VSCode webview API
 * Returns a stable reference to the API singleton
 *
 * @example
 * ```tsx
 * const vscode = useVSCodeApi();
 * vscode.postMessage({ type: MessageType.REQUEST_DATA, source: 'webview', payload: {}, timestamp: Date.now() });
 * ```
 */
export const useVSCodeApi = (): VSCodeAPI => {
  const api = React.useMemo(getVSCodeApi, []);
  return api;
};
