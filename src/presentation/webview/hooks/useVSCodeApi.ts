/**
 * useVSCodeApi - Hook for accessing VSCode webview API
 *
 * Provides a stable reference to the VSCode API singleton.
 * Use this hook to send messages to the extension host.
 */

import * as React from 'react';
import { VSCodeAPI } from '../types/vscode';

// VSCode API type definition
declare function acquireVsCodeApi(): VSCodeAPI;

// Ensure we only acquire the API once per webview lifecycle
let cachedApi: VSCodeAPI | undefined;
const getVSCodeApi = (): VSCodeAPI => {
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
