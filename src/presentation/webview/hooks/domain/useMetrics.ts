/**
 * useMetrics - Domain hook for prose metrics operations
 *
 * Manages prose_stats, style_flags, and word_frequency results,
 * along with source mode and path text.
 */

import * as React from 'react';
import { usePersistedState } from '../usePersistence';
import { TextSourceMode } from '@shared/types';
import { MetricsResultMessage, ActiveFileMessage, ManuscriptGlobsMessage, ChapterGlobsMessage } from '@messages';

export type MetricsTool = 'prose_stats' | 'style_flags' | 'word_frequency';

export interface MetricsState {
  metricsByTool: Partial<Record<MetricsTool, any>>;
  activeTool: MetricsTool;
  loading: boolean;
  sourceMode: TextSourceMode;
  pathText: string;
}

export interface MetricsActions {
  handleMetricsResult: (message: MetricsResultMessage) => void;
  handleActiveFile: (message: ActiveFileMessage) => void;
  handleManuscriptGlobs: (message: ManuscriptGlobsMessage) => void;
  handleChapterGlobs: (message: ChapterGlobsMessage) => void;
  setActiveTool: (tool: MetricsTool) => void;
  setLoading: (loading: boolean) => void;
  setSourceMode: (mode: TextSourceMode) => void;
  setPathText: (text: string) => void;
  clearSubtoolResult: (tool: MetricsTool) => void;
  clearResults: () => void;
}

export interface MetricsPersistence {
  metricsResultsByTool: Partial<Record<MetricsTool, any>>;
  metricsActiveTool: MetricsTool;
  metricsSourceMode: TextSourceMode;
  metricsPathText: string;
}

export type UseMetricsReturn = MetricsState & MetricsActions & { persistedState: MetricsPersistence };

/**
 * Custom hook for managing metrics state and operations
 *
 * @example
 * ```tsx
 * const metrics = useMetrics();
 *
 * // Handle metrics messages
 * useMessageRouter({
 *   [MessageType.METRICS_RESULT]: metrics.handleMetricsResult,
 *   [MessageType.ACTIVE_FILE]: metrics.handleActiveFile,
 *   [MessageType.MANUSCRIPT_GLOBS]: metrics.handleManuscriptGlobs,
 *   [MessageType.CHAPTER_GLOBS]: metrics.handleChapterGlobs,
 * });
 *
 * // Use in MetricsTab
 * <MetricsTab
 *   metricsByTool={metrics.metricsByTool}
 *   activeTool={metrics.activeTool}
 *   onActiveToolChange={metrics.setActiveTool}
 *   isLoading={metrics.loading}
 *   onLoadingChange={metrics.setLoading}
 *   sourceMode={metrics.sourceMode}
 *   pathText={metrics.pathText}
 *   onSourceModeChange={metrics.setSourceMode}
 * />
 * ```
 */
export const useMetrics = (): UseMetricsReturn => {
  const persisted = usePersistedState<{
    metricsResultsByTool?: Partial<Record<MetricsTool, any>>;
    metricsActiveTool?: MetricsTool;
    metricsSourceMode?: TextSourceMode;
    metricsPathText?: string;
  }>();

  const [metricsByTool, setMetricsByTool] = React.useState<Partial<Record<MetricsTool, any>>>(
    persisted?.metricsResultsByTool ?? {}
  );
  const [activeTool, setActiveTool] = React.useState<MetricsTool>(
    persisted?.metricsActiveTool ?? 'prose_stats'
  );
  const [loading, setLoading] = React.useState<boolean>(false);
  const [sourceMode, setSourceMode] = React.useState<TextSourceMode>(
    persisted?.metricsSourceMode ?? 'selection'
  );
  const [pathText, setPathText] = React.useState<string>(persisted?.metricsPathText ?? '[selected text]');

  const handleMetricsResult = React.useCallback((message: MetricsResultMessage) => {
    const { result, toolName } = message.payload;
    if (
      toolName === 'prose_stats' ||
      toolName === 'style_flags' ||
      toolName === 'word_frequency'
    ) {
      // Store per-subtool result without forcing a re-run on tab switch
      setMetricsByTool((prev) => ({ ...prev, [toolName]: result }));
      setActiveTool(toolName);
    }
    setLoading(false);
  }, []);

  const handleActiveFile = React.useCallback((message: ActiveFileMessage) => {
    const { relativePath } = message.payload;
    setPathText(relativePath ?? '');
  }, []);

  const handleManuscriptGlobs = React.useCallback((message: ManuscriptGlobsMessage) => {
    const { globs } = message.payload;
    setPathText(globs ?? '');
  }, []);

  const handleChapterGlobs = React.useCallback((message: ChapterGlobsMessage) => {
    const { globs } = message.payload;
    setPathText(globs ?? '');
  }, []);

  const clearResults = React.useCallback(() => {
    setMetricsByTool({});
  }, []);

  const clearSubtoolResult = React.useCallback((tool: MetricsTool) => {
    setMetricsByTool((prev) => {
      const next = { ...prev };
      delete next[tool];
      return next;
    });
  }, []);

  return {
    // State
    metricsByTool,
    activeTool,
    loading,
    sourceMode,
    pathText,

    // Actions
    handleMetricsResult,
    handleActiveFile,
    handleManuscriptGlobs,
    handleChapterGlobs,
    setActiveTool,
    setLoading,
    setSourceMode,
    setPathText,
    clearResults,
    clearSubtoolResult,

    // Persistence
    persistedState: {
      metricsResultsByTool: metricsByTool,
      metricsActiveTool: activeTool,
      metricsSourceMode: sourceMode,
      metricsPathText: pathText,
    },
  };
};
