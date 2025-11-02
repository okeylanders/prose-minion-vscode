/**
 * useContext - Domain hook for context generation operations
 *
 * Manages context text, loading state, status messages, and requested resources.
 */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';
import { MessageType } from '../../../../shared/types';
import { ContextResultMessage } from '../../../../shared/types/messages';

export interface ContextState {
  contextText: string;
  loading: boolean;
  statusMessage: string;
  requestedResources: string[];
  loadingRef: React.MutableRefObject<boolean>;
}

export interface ContextActions {
  handleContextResult: (message: ContextResultMessage) => void;
  setContextText: (text: string) => void;
  setLoading: (loading: boolean) => void;
  setStatusMessage: (message: string) => void;
  requestContext: (payload: { excerpt: string; existingContext: string; sourceFileUri?: string }) => void;
  clearContext: () => void;
}

export interface ContextPersistence {
  contextText: string;
  contextRequestedResources: string[];
}

export type UseContextReturn = ContextState & ContextActions & { persistedState: ContextPersistence };

/**
 * Custom hook for managing context generation state and operations
 *
 * @example
 * ```tsx
 * const context = useContext();
 *
 * // Handle context messages
 * useMessageRouter({
 *   [MessageType.CONTEXT_RESULT]: context.handleContextResult,
 * });
 *
 * // Use in AnalysisTab
 * <AnalysisTab
 *   contextText={context.contextText}
 *   onContextChange={context.setContextText}
 *   onContextRequest={context.requestContext}
 *   contextLoading={context.loading}
 *   contextStatusMessage={context.statusMessage}
 *   contextRequestedResources={context.requestedResources}
 * />
 * ```
 */
export const useContext = (): UseContextReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{
    contextText?: string;
    contextRequestedResources?: string[];
  }>();

  const [contextText, setContextTextState] = React.useState<string>(persisted?.contextText ?? '');
  const [loading, setLoading] = React.useState<boolean>(false);
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const [requestedResources, setRequestedResources] = React.useState<string[]>(
    persisted?.contextRequestedResources ?? []
  );

  // Ref to track loading state (used by analysis hook for status message filtering)
  const loadingRef = React.useRef(loading);

  React.useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const handleContextResult = React.useCallback((message: ContextResultMessage) => {
    const { result, toolName, requestedResources } = message.payload;
    setContextTextState(result);
    setRequestedResources(requestedResources ?? []);
    setLoading(false);
    setStatusMessage('');
  }, []);

  const requestContext = React.useCallback(
    (payload: { excerpt: string; existingContext: string; sourceFileUri?: string }) => {
      if (!payload.excerpt.trim()) {
        return;
      }

      setLoading(true);
      setStatusMessage('Gathering project resources...');
      setRequestedResources([]);

      vscode.postMessage({
        type: MessageType.GENERATE_CONTEXT,
        source: 'webview.context.assistant',
        payload: {
          excerpt: payload.excerpt,
          existingContext: payload.existingContext?.trim() || undefined,
          sourceFileUri: payload.sourceFileUri,
        },
        timestamp: Date.now()
      });
    },
    [vscode]
  );

  const clearContext = React.useCallback(() => {
    setContextTextState('');
    setRequestedResources([]);
  }, []);

  const setContextText = React.useCallback((text: string) => {
    setContextTextState(text);
    if (!text || !text.trim()) {
      setRequestedResources([]);
    }
  }, []);

  return {
    // State
    contextText,
    loading,
    statusMessage,
    requestedResources,
    loadingRef,

    // Actions
    handleContextResult,
    setContextText,
    setLoading,
    setStatusMessage,
    requestContext,
    clearContext,

    // Persistence
    persistedState: {
      contextText,
      contextRequestedResources: requestedResources,
    },
  };
};
