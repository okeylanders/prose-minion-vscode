/**
 * useAnalysis - Domain hook for prose/dialogue analysis operations
 *
 * Manages analysis results, loading state, guides, and status messages.
 * Includes streaming support for progressive response display.
 */

import * as React from 'react';
import { useVSCodeApi } from '../useVSCodeApi';
import { usePersistedState } from '../usePersistence';
import { useStreaming } from '../useStreaming';
import { MessageType } from '@shared/types';
import {
  AnalysisResultMessage,
  StatusMessage,
  StreamStartedMessage,
  StreamChunkMessage,
  StreamCompleteMessage
} from '@messages';

export interface AnalysisState {
  result: string;
  toolName: string | undefined;
  loading: boolean;
  usedGuides: string[];
  tickerMessage: string;
  statusMessage: string;
  // Streaming state
  isStreaming: boolean;
  isBuffering: boolean;
  streamingContent: string;
  streamingTokenCount: number;
  currentRequestId: string | null;
}

export interface AnalysisActions {
  handleAnalysisResult: (message: AnalysisResultMessage) => void;
  handleStatusMessage: (message: StatusMessage, contextLoadingRef?: React.MutableRefObject<boolean>) => void;
  setLoading: (loading: boolean) => void;
  clearResult: () => void;
  clearStatus: () => void;
  // Streaming actions
  handleStreamChunk: (message: StreamChunkMessage) => void;
  handleStreamComplete: (message: StreamCompleteMessage) => void;
  handleStreamStarted: (message: StreamStartedMessage) => void;
  startStreaming: (requestId: string) => void;
  cancelStreaming: () => void;
}

export interface AnalysisPersistence {
  analysisResult: string;
  analysisToolName: string | undefined;
  usedGuides: string[];
  tickerMessage: string;
  statusMessage: string;
}

export type UseAnalysisReturn = AnalysisState & AnalysisActions & { persistedState: AnalysisPersistence };

/**
 * Custom hook for managing analysis state and operations
 *
 * @example
 * ```tsx
 * const analysis = useAnalysis();
 *
 * // Handle analysis messages
 * useMessageRouter({
 *   [MessageType.ANALYSIS_RESULT]: analysis.handleAnalysisResult,
 *   [MessageType.STATUS]: (msg) => analysis.handleStatusMessage(msg, contextLoadingRef),
 * });
 *
 * // Use in AnalysisTab
 * <AnalysisTab
 *   result={analysis.result}
 *   isLoading={analysis.loading}
 *   onLoadingChange={analysis.setLoading}
 *   statusMessage={analysis.statusMessage}
 *   tickerMessage={analysis.tickerMessage}
 *   usedGuides={analysis.usedGuides}
 *   analysisToolName={analysis.toolName}
 * />
 * ```
 */
export const useAnalysis = (): UseAnalysisReturn => {
  const vscode = useVSCodeApi();
  const persisted = usePersistedState<{
    analysisResult?: string;
    analysisToolName?: string;
    usedGuides?: string[];
    tickerMessage?: string;
    statusMessage?: string;
  }>();

  const [result, setResult] = React.useState<string>(persisted?.analysisResult ?? '');
  const [toolName, setToolName] = React.useState<string | undefined>(persisted?.analysisToolName);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [usedGuides, setUsedGuides] = React.useState<string[]>(persisted?.usedGuides ?? []);
  const [tickerMessage, setTickerMessage] = React.useState<string>(persisted?.tickerMessage ?? '');
  const [statusMessage, setStatusMessage] = React.useState<string>(persisted?.statusMessage ?? '');

  // Streaming state (using useStreaming hook)
  const streaming = useStreaming();
  const [currentRequestId, setCurrentRequestId] = React.useState<string | null>(null);
  const ignoredRequestIdsRef = React.useRef<Set<string>>(new Set());

  // Clear result when analysis starts
  const clearResultWhenLoading = React.useCallback(() => {
    if (loading) {
      setResult('');
    }
  }, [loading]);

  React.useEffect(() => {
    clearResultWhenLoading();
  }, [clearResultWhenLoading]);

  const handleAnalysisResult = React.useCallback((message: AnalysisResultMessage) => {
    const { result, toolName, usedGuides } = message.payload;
    setResult(result);
    setToolName(toolName);
    setUsedGuides(usedGuides || []);
    setLoading(false);
    setStatusMessage(''); // Clear status message
    setTickerMessage(''); // Clear ticker message
  }, []);

  const handleStatusMessage = React.useCallback(
    (message: StatusMessage, contextLoadingRef?: React.MutableRefObject<boolean>) => {
      const { message: statusText, tickerMessage } = message.payload;
      setStatusMessage(statusText);
      setTickerMessage(tickerMessage || '');

      if (contextLoadingRef && contextLoadingRef.current) {
        // Don't log during context loading
      } else {
        console.log('Status:', statusText, tickerMessage ? `(${tickerMessage})` : '');
      }
    },
    []
  );

  const clearResult = React.useCallback(() => {
    setResult('');
    setUsedGuides([]);
  }, []);

  const clearStatus = React.useCallback(() => {
    setStatusMessage('');
    setTickerMessage('');
  }, []);

  // Streaming handlers
  const startStreaming = React.useCallback((requestId: string) => {
    // Cancel any existing stream first
    if (currentRequestId) {
      // Notify backend to stop the old stream
      vscode.postMessage({
        type: MessageType.CANCEL_ANALYSIS_REQUEST,
        source: 'webview.analysis.preempt',
        payload: { requestId: currentRequestId, domain: 'analysis' },
        timestamp: Date.now()
      });

      ignoredRequestIdsRef.current.add(currentRequestId);
      streaming.reset();
    }

    ignoredRequestIdsRef.current.delete(requestId);
    setCurrentRequestId(requestId);
    streaming.startStreaming();
    setLoading(true);
    setResult(''); // Clear previous result
  }, [currentRequestId, streaming, vscode]);

  const handleStreamStarted = React.useCallback((message: StreamStartedMessage) => {
    const { domain, requestId } = message.payload;
    if (domain !== 'analysis') return;
    startStreaming(requestId);
  }, [startStreaming]);

  const handleStreamChunk = React.useCallback((message: StreamChunkMessage) => {
    const { domain, token, requestId } = message.payload;
    // Only handle analysis domain chunks
    if (domain !== 'analysis') return;

    if (ignoredRequestIdsRef.current.has(requestId)) return;

    // Ignore chunks for cancelled/old requests
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
    // Only handle analysis domain completion
    if (domain !== 'analysis') return;

    // Clean up ignored ID for this request (whether it completed or was ignored)
    ignoredRequestIdsRef.current.delete(requestId);

    if (ignoredRequestIdsRef.current.has(requestId)) return;

    if (currentRequestId && requestId !== currentRequestId) {
      if (ignoredRequestIdsRef.current.has(requestId)) return;
      return;
    }

    streaming.endStreaming();
    setCurrentRequestId(null);
    setLoading(false);

    if (!cancelled) {
      // Content will come through ANALYSIS_RESULT message for backward compatibility
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
    result,
    toolName,
    loading,
    usedGuides,
    tickerMessage,
    statusMessage,
    // Streaming state
    isStreaming: streaming.isStreaming,
    isBuffering: streaming.isBuffering,
    streamingContent: streaming.displayContent,
    streamingTokenCount: streaming.tokenCount,
    currentRequestId,

    // Actions
    handleAnalysisResult,
    handleStatusMessage,
    setLoading,
    clearResult,
    clearStatus,
    // Streaming actions
    handleStreamStarted,
    handleStreamChunk,
    handleStreamComplete,
    startStreaming,
    cancelStreaming,

    // Persistence
    persistedState: {
      analysisResult: result,
      analysisToolName: toolName,
      usedGuides,
      tickerMessage,
      statusMessage,
    },
  };
};
