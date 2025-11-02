/**
 * usePersistence - Hooks for persisting state to VSCode webview storage
 *
 * Provides utilities for reading and writing state that persists across
 * webview reloads and VSCode restarts.
 */

import * as React from 'react';
import { useVSCodeApi } from './useVSCodeApi';

/**
 * Hook that automatically syncs state to vscode.setState
 *
 * @param state - The state object to persist
 *
 * @example
 * ```tsx
 * const [count, setCount] = useState(0);
 * usePersistence({ count });
 * ```
 */
export const usePersistence = <T extends Record<string, any>>(state: T): void => {
  const vscode = useVSCodeApi();

  React.useEffect(() => {
    vscode.setState(state);
  }, [vscode, state]);
};

/**
 * Hook that retrieves persisted state from vscode.getState
 *
 * @returns The persisted state object, or undefined if no state exists
 *
 * @example
 * ```tsx
 * const persisted = usePersistedState<MyState>();
 * const [count, setCount] = useState(persisted?.count ?? 0);
 * ```
 */
export const usePersistedState = <T>(): T | undefined => {
  const vscode = useVSCodeApi();
  const [persistedState] = React.useState(() => vscode.getState?.() as T | undefined);
  return persistedState;
};
