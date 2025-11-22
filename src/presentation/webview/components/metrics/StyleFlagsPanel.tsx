/**
 * StyleFlagsPanel - Focused panel for Style Flags tool
 * Extracted from MetricsTab to follow Single Responsibility Principle
 */

import * as React from 'react';
import { MessageType } from '@messages';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { formatStyleFlagsAsMarkdown } from '@formatters';
import { VSCodeAPI } from '../../types/vscode';

interface StyleFlagsPanelProps {
  vscode: VSCodeAPI;
  isLoading: boolean;
  displayMetrics: any;
  sourceSpec: () => { mode: 'selection' | 'activeFile' | 'manuscript' | 'chapters'; pathText: string };
  onMeasure: () => void;
  onCopy: (content: string) => void;
  onSave: (content: string) => void;
}

export const StyleFlagsPanel: React.FC<StyleFlagsPanelProps> = ({
  vscode,
  isLoading,
  displayMetrics,
  sourceSpec,
  onMeasure,
  onCopy,
  onSave
}) => {
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
        <button className="btn btn-primary" onClick={onMeasure} disabled={isLoading}>
          🏁 Generate Style Flags
        </button>
      </div>

      {/* Results */}
      {markdownContent && (
        <div className="result-box">
          <div className="result-action-bar">
            <button
              className="icon-button"
              onClick={handleCopy}
              disabled={isLoading}
              title="Copy metrics to clipboard"
              aria-label="Copy metrics"
            >
              📋
            </button>
            <button
              className="icon-button"
              onClick={handleSave}
              disabled={isLoading}
              title="Save metrics to workspace"
              aria-label="Save metrics"
            >
              💾
            </button>
          </div>
          <MarkdownRenderer content={markdownContent} />
        </div>
      )}
    </>
  );
};
