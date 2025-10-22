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
  guideNames?: string;
  usedGuides?: string[];
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
  selectedText,
  vscode,
  result,
  isLoading,
  onLoadingChange,
  statusMessage,
  guideNames,
  usedGuides
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
          <div className="loading-text">
            <div>{statusMessage || 'Analyzing...'}</div>
            {guideNames && (
              <div className="guide-ticker-container">
                <div className="guide-ticker">{guideNames}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="result-box">
          <MarkdownRenderer content={markdownContent} />
          {usedGuides && usedGuides.length > 0 && (
            <div className="guides-footer">
              <div className="guides-footer-title">📚 Guides Used:</div>
              <div className="guides-footer-list">
                {usedGuides.map((guide, index) => {
                  const displayName = guide
                    .split('/')
                    .pop()
                    ?.replace(/\.md$/i, '')
                    .split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                  const handleGuideClick = () => {
                    vscode.postMessage({
                      type: MessageType.OPEN_GUIDE_FILE,
                      guidePath: guide
                    });
                  };

                  return (
                    <button
                      key={index}
                      className="guide-tag"
                      onClick={handleGuideClick}
                      title={`Click to open ${guide}`}
                    >
                      {displayName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
