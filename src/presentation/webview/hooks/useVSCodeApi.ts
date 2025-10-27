/**
 * useVSCodeApi - Hook for accessing VSCode webview API
 *
 * Provides a stable reference to the VSCode API singleton.
 * Use this hook to send messages to the extension host.
 */

import * as React from 'react';

// VSCode API type definition
declare function acquireVsCodeApi(): any;

/**
 * Custom hook that wraps the VSCode webview API
 * Returns a stable reference to the API instance
 *
 * @example
 * ```tsx
 * const vscode = useVSCodeApi();
 * vscode.postMessage({ type: 'REQUEST_DATA' });
 * ```
 */
export const useVSCodeApi = () => {
  const vscode = React.useRef(acquireVsCodeApi());
  return vscode.current;
};
