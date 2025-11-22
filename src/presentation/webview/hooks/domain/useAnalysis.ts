/**
 * useAnalysis - Domain hook for prose/dialogue analysis operations
 *
 * Manages analysis results, loading state, guides, and status messages.
 */

import * as React from 'react';
import { usePersistedState } from '../usePersistence';
import { AnalysisResultMessage, StatusMessage } from '@messages';

export interface AnalysisState {
  result: string;
  toolName: string | undefined;
  loading: boolean;
  usedGuides: string[];
  tickerMessage: string;
  statusMessage: string;
}

export interface AnalysisActions {
  handleAnalysisResult: (message: AnalysisResultMessage) => void;
  handleStatusMessage: (message: StatusMessage, contextLoadingRef?: React.MutableRefObject<boolean>) => void;
  setLoading: (loading: boolean) => void;
  clearResult: () => void;
  clearStatus: () => void;
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

  return {
    // State
    result,
    toolName,
    loading,
    usedGuides,
    tickerMessage,
    statusMessage,

    // Actions
    handleAnalysisResult,
    handleStatusMessage,
    setLoading,
    clearResult,
    clearStatus,

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
