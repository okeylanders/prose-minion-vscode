/**
 * MetricsTab component - Presentation layer
 * Handles prose metrics and statistics
 */

import * as React from 'react';
import { MessageType } from '../../../shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { formatMetricsAsMarkdown } from '../utils/metricsFormatter';

interface MetricsTabProps {
  selectedText: string;
  vscode: any;
  metrics: any;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
}

export const MetricsTab: React.FC<MetricsTabProps> = ({
  selectedText,
  vscode,
  metrics,
  isLoading,
  onLoadingChange
}) => {
  const [text, setText] = React.useState(selectedText);

  React.useEffect(() => {
    setText(selectedText);
  }, [selectedText]);

  const handleMeasureProseStats = () => {
    if (!text.trim()) {
      return;
    }

    onLoadingChange(true);

    vscode.postMessage({
      type: MessageType.MEASURE_PROSE_STATS,
      text
    });
  };

  const handleMeasureStyleFlags = () => {
    if (!text.trim()) {
      return;
    }

    onLoadingChange(true);

    vscode.postMessage({
      type: MessageType.MEASURE_STYLE_FLAGS,
      text
    });
  };

  const handleMeasureWordFrequency = () => {
    if (!text.trim()) {
      return;
    }

    onLoadingChange(true);

    vscode.postMessage({
      type: MessageType.MEASURE_WORD_FREQUENCY,
      text
    });
  };

  const markdownContent = React.useMemo(() => {
    if (!metrics) return '';
    return formatMetricsAsMarkdown(metrics);
  }, [metrics]);

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Prose Metrics</h2>

      <div className="input-container">
        <label className="block text-sm font-medium mb-2">
          Text to Analyze
        </label>
        <textarea
          className="w-full h-32 resize-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Select text in your editor or paste text here..."
        />
      </div>

      <div className="button-group">
        <button
          className="btn btn-secondary"
          onClick={handleMeasureProseStats}
          disabled={!text.trim() || isLoading}
        >
          Prose Statistics
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleMeasureStyleFlags}
          disabled={!text.trim() || isLoading}
        >
          Style Flags
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleMeasureWordFrequency}
          disabled={!text.trim() || isLoading}
        >
          Word Frequency
        </button>
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Calculating metrics...</span>
        </div>
      )}

      {metrics && (
        <div className="result-box">
          <MarkdownRenderer content={markdownContent} />
        </div>
      )}
    </div>
  );
};
