/**
 * AnalysisTab component - Presentation layer
 * Handles dialogue and prose analysis
 */

import * as React from 'react';
import { MessageType } from '../../../shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { formatAnalysisAsMarkdown } from '../utils/metricsFormatter';

interface AnalysisTabProps {
  selectedText: string;
  vscode: any;
  result: string;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  statusMessage?: string;
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
  selectedText,
  vscode,
  result,
  isLoading,
  onLoadingChange,
  statusMessage
}) => {
  const [text, setText] = React.useState(selectedText);

  React.useEffect(() => {
    setText(selectedText);
  }, [selectedText]);

  const handleAnalyzeDialogue = () => {
    if (!text.trim()) {
      return;
    }

    onLoadingChange(true);

    vscode.postMessage({
      type: MessageType.ANALYZE_DIALOGUE,
      text
    });
  };

  const handleAnalyzeProse = () => {
    if (!text.trim()) {
      return;
    }

    onLoadingChange(true);

    vscode.postMessage({
      type: MessageType.ANALYZE_PROSE,
      text
    });
  };

  const markdownContent = React.useMemo(() => {
    if (!result) return '';
    return formatAnalysisAsMarkdown(result);
  }, [result]);

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Prose Analysis</h2>

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
          className="btn btn-primary"
          onClick={handleAnalyzeDialogue}
          disabled={!text.trim() || isLoading}
        >
          Analyze Dialogue
        </button>
        <button
          className="btn btn-primary"
          onClick={handleAnalyzeProse}
          disabled={!text.trim() || isLoading}
        >
          Analyze Prose
        </button>
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>{statusMessage || 'Analyzing...'}</span>
        </div>
      )}

      {result && (
        <div className="result-box">
          <MarkdownRenderer content={markdownContent} />
        </div>
      )}
    </div>
  );
};
