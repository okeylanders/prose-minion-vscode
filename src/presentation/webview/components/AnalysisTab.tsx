/**
 * AnalysisTab component - Presentation layer
 * Handles dialogue and prose analysis
 */

import * as React from 'react';
import { MessageType } from '../../../shared/types';

interface AnalysisTabProps {
  selectedText: string;
  vscode: any;
  result: string;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
  selectedText,
  vscode,
  result,
  isLoading,
  onLoadingChange
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

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Prose Analysis</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Text to Analyze
        </label>
        <textarea
          className="w-full h-32 p-2 border rounded resize-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Select text in your editor or paste text here..."
        />
      </div>

      <div className="button-group mb-4">
        <button
          className="btn btn-primary mr-2"
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
          <span>Analyzing...</span>
        </div>
      )}

      {result && (
        <div className="result-box">
          <h3 className="text-md font-semibold mb-2">Results</h3>
          <div className="result-content whitespace-pre-wrap">
            {result}
          </div>
        </div>
      )}
    </div>
  );
};
