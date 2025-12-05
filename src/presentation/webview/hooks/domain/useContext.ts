/**
 * useContext - Domain hook for context generation operations
 *
 * Manages context text, loading state, status messages, and requested resources.
 * Includes streaming support for progressive response display.
 */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';
import { useStreaming } from '../useStreaming';
import { MessageType } from '@shared/types';
import { ContextResultMessage, StreamChunkMessage, StreamCompleteMessage, StreamStartedMessage } from '@messages';

export interface ContextState {
  contextText: string;
  loading: boolean;
  statusMessage: string;
  requestedResources: string[];
  loadingRef: React.MutableRefObject<boolean>;
  // Streaming state
  isStreaming: boolean;
  isBuffering: boolean;
  streamingContent: string;
  streamingTokenCount: number;
  currentRequestId: string | null;
}

export interface ContextActions {
  handleContextResult: (message: ContextResultMessage) => void;
  setContextText: (text: string) => void;
  setLoading: (loading: boolean) => void;
  setStatusMessage: (message: string) => void;
  requestContext: (payload: { excerpt: string; existingContext: string; sourceFileUri?: string }) => void;
  clearContext: () => void;
  // Streaming actions
  handleStreamChunk: (message: StreamChunkMessage) => void;
  handleStreamComplete: (message: StreamCompleteMessage) => void;
  handleStreamStarted: (message: StreamStartedMessage) => void;
  startStreaming: (requestId: string) => void;
  cancelStreaming: () => void;
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

  // Streaming state (using useStreaming hook)
  const streaming = useStreaming();
  const [currentRequestId, setCurrentRequestId] = React.useState<string | null>(null);
  const ignoredRequestIdsRef = React.useRef<Set<string>>(new Set());

  // Ref to track loading state (used by analysis hook for status message filtering)
  const loadingRef = React.useRef(loading);

  const syncLoadingRef = React.useCallback(() => {
    loadingRef.current = loading;
  }, [loading]);

  React.useEffect(() => {
    syncLoadingRef();
  }, [syncLoadingRef]);

  const handleContextResult = React.useCallback((message: ContextResultMessage) => {
    const { result, requestedResources } = message.payload;
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

  // Streaming handlers
  const startStreaming = React.useCallback((requestId: string) => {
    ignoredRequestIdsRef.current.delete(requestId);
    setCurrentRequestId(requestId);
    streaming.startStreaming();
    setLoading(true);
    setContextTextState(''); // Clear previous context
  }, [streaming]);

  const handleStreamStarted = React.useCallback((message: StreamStartedMessage) => {
    const { domain, requestId } = message.payload;
    if (domain !== 'context') return;
    startStreaming(requestId);
  }, [startStreaming]);

  const handleStreamChunk = React.useCallback((message: StreamChunkMessage) => {
    const { domain, token, requestId } = message.payload;
    // Only handle context domain chunks
    if (domain !== 'context') return;

    if (ignoredRequestIdsRef.current.has(requestId)) return;

    if (currentRequestId && requestId !== currentRequestId) {
      if (ignoredRequestIdsRef.current.has(requestId)) return;
      return;
    }

    // Auto-start streaming on first chunk (if not already streaming)
    if (!streaming.isStreaming) {
      startStreaming(requestId);
    }

    streaming.appendToken(token);
  }, [currentRequestId, startStreaming, streaming]);

  const handleStreamComplete = React.useCallback((message: StreamCompleteMessage) => {
    const { domain, cancelled, requestId } = message.payload;
    // Only handle context domain completion
    if (domain !== 'context') return;

    if (ignoredRequestIdsRef.current.has(requestId)) return;

    if (currentRequestId && requestId !== currentRequestId) {
      if (ignoredRequestIdsRef.current.has(requestId)) return;
      return;
    }

    streaming.endStreaming();
    setCurrentRequestId(null);
    setLoading(false);

    if (!cancelled) {
      // Content will come through CONTEXT_RESULT message for backward compatibility
      // The streaming content is shown progressively until then
    }
  }, [currentRequestId, streaming]);

  const cancelStreaming = React.useCallback(() => {
    if (currentRequestId) {
      ignoredRequestIdsRef.current.add(currentRequestId);
    }
    streaming.reset();
    setCurrentRequestId(null);
    setLoading(false);
    setStatusMessage('');
  }, [currentRequestId, streaming]);

  return {
    // State
    contextText,
    loading,
    statusMessage,
    requestedResources,
    loadingRef,
    // Streaming state
    isStreaming: streaming.isStreaming,
    isBuffering: streaming.isBuffering,
    streamingContent: streaming.displayContent,
    streamingTokenCount: streaming.tokenCount,
    currentRequestId,

    // Actions
    handleContextResult,
    setContextText,
    setLoading,
    setStatusMessage,
    requestContext,
    clearContext,
    // Streaming actions
    handleStreamStarted,
    handleStreamChunk,
    handleStreamComplete,
    startStreaming,
    cancelStreaming,

    // Persistence
    persistedState: {
      contextText,
      contextRequestedResources: requestedResources,
    },
  };
};
