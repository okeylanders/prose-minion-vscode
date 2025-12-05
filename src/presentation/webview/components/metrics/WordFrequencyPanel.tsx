/**
 * WordFrequencyPanel - Focused panel for Word Frequency tool
 * Extracted from MetricsTab to follow Single Responsibility Principle
 * Includes min length filter UI
 * Handles message posting independently (no callbacks from parent)
 */

import * as React from 'react';
import { MessageType } from '@messages';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { formatWordFrequencyAsMarkdown } from '@formatters';
import { WordLengthFilterTabs } from '../shared/WordLengthFilterTabs';
import { VSCodeAPI } from '../../types/vscode';
import { UseMetricsReturn } from '@hooks/domain/useMetrics';
import { UseWordFrequencySettingsReturn } from '@hooks/domain/useWordFrequencySettings';
import { TextSourceMode } from '@shared/types';
import { LoadingIndicator } from '../shared/LoadingIndicator';

interface WordFrequencyPanelProps {
  vscode: VSCodeAPI;
  metrics: UseMetricsReturn;
  wordFrequencySettings: UseWordFrequencySettingsReturn;
  onCopy: (content: string) => void;
  onSave: (content: string) => void;
}

export const WordFrequencyPanel: React.FC<WordFrequencyPanelProps> = ({
  vscode,
  metrics,
  wordFrequencySettings,
  onCopy,
  onSave
}) => {
  const toolLoading = metrics.isLoading('word_frequency');

  // Build a TextSourceSpec consistently for word frequency requests
  const buildSourceSpec = React.useCallback(() => {
    return metrics.sourceMode === 'selection'
      ? { mode: 'selection' as TextSourceMode, pathText: '[selected text]' }
      : { mode: metrics.sourceMode, pathText: metrics.pathText };
  }, [metrics.sourceMode, metrics.pathText]);

  const displayMetrics = React.useMemo(() => {
    if (metrics.metricsByTool && metrics.metricsByTool['word_frequency']) {
      return metrics.metricsByTool['word_frequency'] as any;
    }
    return null;
  }, [metrics.metricsByTool]);

  const handleMeasure = () => {
    metrics.clearSubtoolResult('word_frequency');
    metrics.setLoadingForTool('word_frequency', true);
    vscode.postMessage({
      type: MessageType.MEASURE_WORD_FREQUENCY,
      source: 'webview.metrics.word_frequency',
      payload: {
        source: buildSourceSpec()
      },
      timestamp: Date.now()
    });
  };

  const handleFilterChange = (minLength: number) => {
    wordFrequencySettings.updateSetting('minCharacterLength', minLength);
  };
  const markdownContent = React.useMemo(() => {
    if (!displayMetrics) return '';
    return formatWordFrequencyAsMarkdown(displayMetrics);
  }, [displayMetrics]);

  const handleCopy = () => {
    onCopy(markdownContent);
  };

  const handleSave = () => {
    onSave(markdownContent);
  };

  return (
    <>
      {/* Word Length Filter */}
      <WordLengthFilterTabs
        activeFilter={wordFrequencySettings.settings.minCharacterLength}
        onFilterChange={handleFilterChange}
        disabled={toolLoading}
      />

      {/* Generate button */}
      <div className="button-group">
        <button className="btn btn-primary" onClick={handleMeasure} disabled={toolLoading}>
          📈 Generate Word Frequency
        </button>
      </div>

      {toolLoading && (
        <LoadingIndicator
          isLoading
          defaultMessage="Calculating word frequency..."
        />
      )}

      {/* Results */}
      {markdownContent && (
        <div className="result-box">
          <div className="result-action-bar">
            <button
              className="icon-button"
              onClick={handleCopy}
              disabled={toolLoading}
              title="Copy metrics to clipboard"
              aria-label="Copy metrics"
            >
              📋
            </button>
            <button
              className="icon-button"
              onClick={handleSave}
              disabled={toolLoading}
              title="Save metrics to workspace"
              aria-label="Save metrics"
            >
              💾
            </button>
          </div>
          <ErrorBoundary fallback={<pre className="markdown-fallback">{markdownContent}</pre>}>
            <MarkdownRenderer content={markdownContent} />
          </ErrorBoundary>
        </div>
      )}
    </>
  );
};
