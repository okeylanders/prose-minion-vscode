/**
 * useAnalysis - Domain hook for prose/dialogue analysis operations
 *
 * Manages analysis results, loading state, guides, and status messages.
 */

import * as React from 'react';
import { usePersistedState } from '../usePersistence';

export interface AnalysisState {
  result: string;
  toolName: string | undefined;
  loading: boolean;
  usedGuides: string[];
  guideNames: string;
  statusMessage: string;
}

export interface AnalysisActions {
  handleAnalysisResult: (message: any) => void;
  handleStatusMessage: (message: any, contextLoadingRef?: React.MutableRefObject<boolean>) => void;
  setLoading: (loading: boolean) => void;
  clearResult: () => void;
  clearStatus: () => void;
}

export interface AnalysisPersistence {
  analysisResult: string;
  analysisToolName: string | undefined;
  usedGuides: string[];
  guideNames: string;
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
 *   [MessageType.STATUS_MESSAGE]: (msg) => analysis.handleStatusMessage(msg, contextLoadingRef),
 * });
 *
 * // Use in AnalysisTab
 * <AnalysisTab
 *   result={analysis.result}
 *   isLoading={analysis.loading}
 *   onLoadingChange={analysis.setLoading}
 *   statusMessage={analysis.statusMessage}
 *   guideNames={analysis.guideNames}
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
    guideNames?: string;
    statusMessage?: string;
  }>();

  const [result, setResult] = React.useState<string>(persisted?.analysisResult ?? '');
  const [toolName, setToolName] = React.useState<string | undefined>(persisted?.analysisToolName);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [usedGuides, setUsedGuides] = React.useState<string[]>(persisted?.usedGuides ?? []);
  const [guideNames, setGuideNames] = React.useState<string>(persisted?.guideNames ?? '');
  const [statusMessage, setStatusMessage] = React.useState<string>(persisted?.statusMessage ?? '');

  // Clear result when analysis starts
  React.useEffect(() => {
    if (loading) {
      setResult('');
    }
  }, [loading]);

  const handleAnalysisResult = React.useCallback((message: any) => {
    setResult(message.result);
    setToolName(message.toolName);
    setUsedGuides(message.usedGuides || []);
    setLoading(false);
    setStatusMessage(''); // Clear status message
    setGuideNames(''); // Clear guide names
  }, []);

  const handleStatusMessage = React.useCallback(
    (message: any, contextLoadingRef?: React.MutableRefObject<boolean>) => {
      setStatusMessage(message.message);
      setGuideNames(message.guideNames || '');

      if (contextLoadingRef && contextLoadingRef.current) {
        // Don't log during context loading
      } else {
        console.log('Status:', message.message, message.guideNames ? `(${message.guideNames})` : '');
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
    setGuideNames('');
  }, []);

  return {
    // State
    result,
    toolName,
    loading,
    usedGuides,
    guideNames,
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
      guideNames,
      statusMessage,
    },
  };
};
