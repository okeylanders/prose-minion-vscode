/**
 * WordFrequencyPanel - Focused panel for Word Frequency tool
 * Extracted from MetricsTab to follow Single Responsibility Principle
 * Includes min length filter UI
 */

import * as React from 'react';
import { MessageType } from '@messages';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { formatWordFrequencyAsMarkdown } from '@formatters';
import { WordLengthFilterTabs } from '../shared/WordLengthFilterTabs';
import { VSCodeAPI } from '../../types/vscode';

interface WordFrequencyPanelProps {
  vscode: VSCodeAPI;
  isLoading: boolean;
  displayMetrics: any;
  sourceSpec: () => { mode: 'selection' | 'activeFile' | 'manuscript' | 'chapters'; pathText: string };
  minCharacterLength: number;
  onMinLengthChange: (length: number) => void;
  onMeasure: () => void;
  onCopy: (content: string) => void;
  onSave: (content: string) => void;
}

export const WordFrequencyPanel: React.FC<WordFrequencyPanelProps> = ({
  vscode,
  isLoading,
  displayMetrics,
  sourceSpec,
  minCharacterLength,
  onMinLengthChange,
  onMeasure,
  onCopy,
  onSave
}) => {
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
        activeFilter={minCharacterLength}
        onFilterChange={onMinLengthChange}
        disabled={isLoading}
      />

      {/* Generate button */}
      <div className="button-group">
        <button className="btn btn-primary" onClick={onMeasure} disabled={isLoading}>
          📈 Generate Word Frequency
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
