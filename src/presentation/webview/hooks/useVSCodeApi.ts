/**
 * useVSCodeApi - Hook for accessing VSCode webview API
 *
 * Provides a stable reference to the VSCode API singleton.
 * Use this hook to send messages to the extension host.
 */

import * as React from 'react';

// VSCode API type definition
declare function acquireVsCodeApi(): any;

// Ensure we only acquire the API once per webview lifecycle
let cachedApi: any | undefined;
const getVSCodeApi = () => {
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
 * vscode.postMessage({ type: 'REQUEST_DATA' });
 * ```
 */
export const useVSCodeApi = () => {
  const api = React.useMemo(getVSCodeApi, []);
  return api;
};
