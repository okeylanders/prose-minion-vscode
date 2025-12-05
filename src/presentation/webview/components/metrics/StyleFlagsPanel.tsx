/**
 * StyleFlagsPanel - Focused panel for Style Flags tool
 * Extracted from MetricsTab to follow Single Responsibility Principle
 * Handles message posting independently (no callbacks from parent)
 */

import * as React from 'react';
import { MessageType } from '@messages';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { formatStyleFlagsAsMarkdown } from '@formatters';
import { VSCodeAPI } from '../../types/vscode';
import { UseMetricsReturn } from '@hooks/domain/useMetrics';
import { TextSourceMode } from '@shared/types';
import { LoadingIndicator } from '../shared/LoadingIndicator';

interface StyleFlagsPanelProps {
  vscode: VSCodeAPI;
  metrics: UseMetricsReturn;
  onCopy: (content: string) => void;
  onSave: (content: string) => void;
}

export const StyleFlagsPanel: React.FC<StyleFlagsPanelProps> = ({
  vscode,
  metrics,
  onCopy,
  onSave
}) => {
  const toolLoading = metrics.isLoading('style_flags');

  // Build a TextSourceSpec consistently for style flags requests
  const buildSourceSpec = React.useCallback(() => {
    return metrics.sourceMode === 'selection'
      ? { mode: 'selection' as TextSourceMode, pathText: '[selected text]' }
      : { mode: metrics.sourceMode, pathText: metrics.pathText };
  }, [metrics.sourceMode, metrics.pathText]);

  const displayMetrics = React.useMemo(() => {
    if (metrics.metricsByTool && metrics.metricsByTool['style_flags']) {
      return metrics.metricsByTool['style_flags'] as any;
    }
    return null;
  }, [metrics.metricsByTool]);

  const handleMeasure = () => {
    metrics.clearSubtoolResult('style_flags');
    metrics.setLoadingForTool('style_flags', true);
    vscode.postMessage({
      type: MessageType.MEASURE_STYLE_FLAGS,
      source: 'webview.metrics.style_flags',
      payload: {
        source: buildSourceSpec()
      },
      timestamp: Date.now()
    });
  };
  const markdownContent = React.useMemo(() => {
    if (!displayMetrics) return '';
    return formatStyleFlagsAsMarkdown(displayMetrics);
  }, [displayMetrics]);

  const handleCopy = () => {
    onCopy(markdownContent);
  };

  const handleSave = () => {
    onSave(markdownContent);
  };

  return (
    <>
      {/* Generate button */}
      <div className="button-group">
        <button className="btn btn-primary" onClick={handleMeasure} disabled={toolLoading}>
          🏁 Generate Style Flags
        </button>
      </div>

      {toolLoading && (
        <LoadingIndicator
          isLoading
          defaultMessage="Calculating style flags..."
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
          <ErrorBoundary
            fallback={<pre className="markdown-fallback">{markdownContent}</pre>}
            onError={(error) => {
              vscode.postMessage({
                type: MessageType.WEBVIEW_ERROR,
                source: 'webview.markdown_renderer',
                payload: { message: error.message },
                timestamp: Date.now()
              });
            }}
          >
            <MarkdownRenderer content={markdownContent} />
          </ErrorBoundary>
        </div>
      )}
    </>
  );
};
