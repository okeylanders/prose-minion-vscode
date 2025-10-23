/**
 * MetricsTab component - Presentation layer
 * Handles prose metrics and statistics
 */

import * as React from 'react';
import { MessageType, TextSourceMode } from '../../../shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { formatMetricsAsMarkdown } from '../utils/metricsFormatter';

interface MetricsTabProps {
  selectedText: string;
  vscode: any;
  metrics: any;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  sourceMode: TextSourceMode;
  pathText: string;
  onSourceModeChange: (mode: TextSourceMode) => void;
  onPathTextChange: (text: string) => void;
}

export const MetricsTab: React.FC<MetricsTabProps> = ({
  selectedText,
  vscode,
  metrics,
  isLoading,
  onLoadingChange,
  sourceMode,
  pathText,
  onSourceModeChange,
  onPathTextChange
}) => {
  // Keep a local mirror only for selection preview if needed in future.

  const handleMeasureProseStats = () => {
    onLoadingChange(true);
    vscode.postMessage({
      type: MessageType.MEASURE_PROSE_STATS,
      source: { mode: sourceMode, pathText }
    });
  };

  const handleMeasureStyleFlags = () => {
    onLoadingChange(true);
    vscode.postMessage({
      type: MessageType.MEASURE_STYLE_FLAGS,
      source: { mode: sourceMode, pathText }
    });
  };

  const handleMeasureWordFrequency = () => {
    onLoadingChange(true);
    vscode.postMessage({
      type: MessageType.MEASURE_WORD_FREQUENCY,
      source: { mode: sourceMode, pathText }
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
        <label className="block text-sm font-medium mb-2">Measure:</label>
        <div className="tab-bar" style={{ marginBottom: '8px' }}>
          <button
            className={`tab-button ${sourceMode === 'activeFile' ? 'active' : ''}`}
            onClick={() => {
              onSourceModeChange('activeFile');
              vscode.postMessage({ type: MessageType.REQUEST_ACTIVE_FILE });
            }}
            disabled={isLoading}
          >
            <span className="tab-label">Active File</span>
          </button>
          <button
            className={`tab-button ${sourceMode === 'manuscript' ? 'active' : ''}`}
            onClick={() => {
              onSourceModeChange('manuscript');
              vscode.postMessage({ type: MessageType.REQUEST_MANUSCRIPT_GLOBS });
            }}
            disabled={isLoading}
          >
            <span className="tab-label">Manuscripts</span>
          </button>
          <button
            className={`tab-button ${sourceMode === 'chapters' ? 'active' : ''}`}
            onClick={() => {
              onSourceModeChange('chapters');
              vscode.postMessage({ type: MessageType.REQUEST_CHAPTER_GLOBS });
            }}
            disabled={isLoading}
          >
            <span className="tab-label">Chapters</span>
          </button>
          <button
            className={`tab-button ${sourceMode === 'selection' ? 'active' : ''}`}
            onClick={() => {
              onSourceModeChange('selection');
              onPathTextChange('[selected text]');
            }}
            disabled={isLoading}
          >
            <span className="tab-label">Selection</span>
          </button>
        </div>

        <label className="block text-sm font-medium mb-2">Path / Pattern</label>
        <input
          className="w-full"
          type="text"
          value={pathText}
          onChange={(e) => onPathTextChange(e.target.value)}
          placeholder={sourceMode === 'selection' ? '[selected text]' : 'workspace-relative path or globs'}
        />
      </div>

      <div className="button-group">
        <button
          className="btn btn-primary"
          onClick={handleMeasureProseStats}
          disabled={isLoading}
        >
          Prose Statistics
        </button>
        <button
          className="btn btn-primary"
          onClick={handleMeasureStyleFlags}
          disabled={isLoading}
        >
          Style Flags
        </button>
        <button
          className="btn btn-primary"
          onClick={handleMeasureWordFrequency}
          disabled={isLoading}
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
