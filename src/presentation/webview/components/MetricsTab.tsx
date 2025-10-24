/**
 * MetricsTab component - Presentation layer
 * Handles prose metrics and statistics
 */

import * as React from 'react';
import { MessageType, TextSourceMode } from '../../../shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { formatMetricsAsMarkdown } from '../utils/metricsFormatter';
// MessageType is already imported from shared/types re-export

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

  // Publishing standards UI state
  const [genres, setGenres] = React.useState<Array<{ key: string; name: string; abbreviation: string; pageSizes: Array<{ key: string; label: string; width: number; height: number; common: boolean }> }>>([]);
  const [preset, setPreset] = React.useState<string>('none');
  const [pageSizeKey, setPageSizeKey] = React.useState<string>('');

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'publishing_standards_data') {
        setGenres(msg.genres || []);
        setPreset(msg.preset || 'none');
        setPageSizeKey(msg.pageSizeKey || '');
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: MessageType.REQUEST_PUBLISHING_STANDARDS_DATA });
    return () => window.removeEventListener('message', handler);
  }, [vscode]);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    vscode.postMessage({ type: MessageType.SET_PUBLISHING_PRESET, preset: value });
  };

  const handleTrimChange = (value: string) => {
    setPageSizeKey(value);
    vscode.postMessage({ type: MessageType.SET_PUBLISHING_TRIM_SIZE, pageSizeKey: value });
  };

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
        <label className="block text-sm font-medium mb-2">Publishing Standards</label>
        <div className="flex gap-2 mb-2">
          <select
            className="w-1/2"
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
            title="Select a genre preset or manuscript format to compare metrics against publishing ranges"
            disabled={isLoading}
          >
            <option value="none">None</option>
            <option value="manuscript">Manuscript Format</option>
            <optgroup label="Genres">
              {genres.map(g => (
                <option key={g.key} value={`genre:${g.key}`}>{g.name} ({g.abbreviation})</option>
              ))}
            </optgroup>
          </select>
          <select
            className="w-1/2"
            value={pageSizeKey}
            onChange={(e) => handleTrimChange(e.target.value)}
            title="Choose a trim size to estimate page count and words-per-page"
            disabled={isLoading || !preset.startsWith('genre:')}
          >
            <option value="">Auto (common size)</option>
            {(preset.startsWith('genre:')
              ? (genres.find(g => `genre:${g.key}` === preset)?.pageSizes || [])
              : []
            ).map(ps => (
              <option key={ps.key} value={ps.key}>{ps.label} ({ps.width}x{ps.height} in)</option>
            ))}
          </select>
        </div>

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
