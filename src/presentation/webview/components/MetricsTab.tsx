/**
 * MetricsTab component - Presentation layer
 * Handles prose metrics and statistics
 */

import * as React from 'react';
import { MessageType } from '../../../shared/types';

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

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Prose Metrics</h2>

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
          className="btn btn-secondary mr-2 mb-2"
          onClick={handleMeasureProseStats}
          disabled={!text.trim() || isLoading}
        >
          Prose Statistics
        </button>
        <button
          className="btn btn-secondary mr-2 mb-2"
          onClick={handleMeasureStyleFlags}
          disabled={!text.trim() || isLoading}
        >
          Style Flags
        </button>
        <button
          className="btn btn-secondary mb-2"
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
          <h3 className="text-md font-semibold mb-2">Metrics</h3>
          <div className="metrics-grid">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="metric-item">
                <span className="metric-label">{key}:</span>
                <span className="metric-value">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
