/**
 * SearchTab component - Presentation layer
 * Hosts Word Search UI and rendering, moved from Metrics
 */

import * as React from 'react';
import { MessageType, TextSourceMode } from '../../../shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LoadingWidget } from './LoadingWidget';
import { formatMetricsAsMarkdown } from '../utils/resultFormatter';

interface SearchTabProps {
  vscode: any;
  result: any;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  wordSearchTargets: string;
  onWordSearchTargetsChange: (value: string) => void;
  sourceMode: TextSourceMode;
  pathText: string;
  onSourceModeChange: (mode: TextSourceMode) => void;
  onPathTextChange: (text: string) => void;
  onRequestActiveFile: () => void;
  onRequestManuscriptGlobs: () => void;
  onRequestChapterGlobs: () => void;
}

export const SearchTab: React.FC<SearchTabProps> = ({
  vscode,
  result,
  isLoading,
  onLoadingChange,
  wordSearchTargets,
  onWordSearchTargetsChange,
  sourceMode,
  pathText,
  onSourceModeChange,
  onPathTextChange,
  onRequestActiveFile,
  onRequestManuscriptGlobs,
  onRequestChapterGlobs
}) => {
  const [markdownContent, setMarkdownContent] = React.useState('');
  const [expandInfo, setExpandInfo] = React.useState<string>('');
  const [wordSearchContextWords, setWordSearchContextWords] = React.useState<number>(7);
  const [wordSearchClusterWindow, setWordSearchClusterWindow] = React.useState<number>(150);
  const [wordSearchMinCluster, setWordSearchMinCluster] = React.useState<number>(3);
  const [wordSearchCaseSensitive, setWordSearchCaseSensitive] = React.useState<boolean>(false);

  // Build a TextSourceSpec consistently for search requests
  const buildSourceSpec = React.useCallback(() => {
    return sourceMode === 'selection'
      ? { mode: 'selection' as TextSourceMode, pathText: '[selected text]' }
      : { mode: sourceMode, pathText };
  }, [sourceMode, pathText]);

  React.useEffect(() => {
    if (!result) {
      setMarkdownContent('');
      return;
    }
    try {
      setMarkdownContent(formatMetricsAsMarkdown(result));
    } catch {
      setMarkdownContent('');
    }
  }, [result]);

  const handleCopyResult = () => {
    try {
      vscode.postMessage({
        type: MessageType.COPY_RESULT,
        toolName: 'word_search',
        content: markdownContent || ''
      });
    } catch {
      // ignore
    }
  };

  const handleSaveResult = () => {
    try {
      vscode.postMessage({
        type: MessageType.SAVE_RESULT,
        toolName: 'word_search',
        content: markdownContent || '',
        metadata: { timestamp: Date.now() }
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Search</h2>

      <div className="input-container">
        <label className="block text-sm font-medium mb-2">Scope:</label>
        <div className="tab-bar" style={{ marginBottom: '8px' }}>
          <button
            className={`tab-button ${sourceMode === 'activeFile' ? 'active' : ''}`}
          onClick={() => {
            onSourceModeChange('activeFile');
            onRequestActiveFile();
          }}
            disabled={isLoading}
          >
            <span className="tab-label">Active File</span>
          </button>
          <button
            className={`tab-button ${sourceMode === 'manuscript' ? 'active' : ''}`}
          onClick={() => {
            onSourceModeChange('manuscript');
            onRequestManuscriptGlobs();
          }}
            disabled={isLoading}
          >
            <span className="tab-label">Manuscripts</span>
          </button>
          <button
            className={`tab-button ${sourceMode === 'chapters' ? 'active' : ''}`}
          onClick={() => {
            onSourceModeChange('chapters');
            onRequestChapterGlobs();
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

        <label className="block text-sm font-medium mb-2" htmlFor="pm-search-path-input">Path / Pattern</label>
        <input
          id="pm-search-path-input"
          type="text"
          className="w-full"
          value={pathText}
          onChange={(e) => onPathTextChange(e.target.value)}
          placeholder={sourceMode === 'selection' ? 'Selected text' : 'e.g. prose/**/*.md'}
          disabled={isLoading}
        />
      </div>

      <div className="input-container">
        <label className="block text-sm font-medium mb-2">Targets</label>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">One per line or comma-separated</span>
          <button
            className="icon-button"
            title="Expand word list"
            aria-label="Expand word list"
            onClick={() => setExpandInfo('Auto expand search coming soon')}
          >
            🤖
          </button>
        </div>
        <textarea
          title="Search Target"
          id="pm-search-targets-textarea"
          className="w-full"
          rows={3}
          value={wordSearchTargets}
          onChange={(e) => onWordSearchTargetsChange(e.target.value)}
          placeholder=""
        />
        {expandInfo && (
          <div className="context-status">{expandInfo}</div>
        )}

        <div className="flex gap-2 mt-2">
          <div className="flex-1">
            <label className="block text-sm mb-1" htmlFor="pm-search-context-words">Context words</label>
            <input
              id="pm-search-context-words"
              type="text"
              className="w-full"
              value={wordSearchContextWords}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setWordSearchContextWords(val ? parseInt(val, 10) : 7);
              }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm mb-1" htmlFor="pm-search-cluster-window">Cluster window</label>
            <input
              id="pm-search-cluster-window"
              type="text"
              className="w-full"
              value={wordSearchClusterWindow}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setWordSearchClusterWindow(val ? parseInt(val, 10) : 150);
              }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm mb-1" htmlFor="pm-search-min-cluster">Min cluster size</label>
            <input
              id="pm-search-min-cluster"
              type="text"
              className="w-full"
              value={wordSearchMinCluster}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setWordSearchMinCluster(val ? parseInt(val, 10) : 3);
              }}
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="inline-flex items-center">
            <input type="checkbox" checked={wordSearchCaseSensitive} onChange={(e) => setWordSearchCaseSensitive(e.target.checked)} />
            <span className="ml-2">Case sensitive</span>
          </label>
        </div>

        <div className="mt-3 flex justify-center">
          <button className="btn btn-primary" disabled={isLoading} onClick={() => {
            // Clear existing search markdown before re-running
            setMarkdownContent('');
            onLoadingChange(true);
            const wordsOrPhrases = parseTargets(wordSearchTargets);
            vscode.postMessage({
              type: MessageType.RUN_WORD_SEARCH,
              source: buildSourceSpec(),
              options: {
                wordsOrPhrases,
                contextWords: wordSearchContextWords,
                clusterWindow: wordSearchClusterWindow,
                minClusterSize: wordSearchMinCluster,
                caseSensitive: wordSearchCaseSensitive
              }
            });
          }}>⚡ Run Search</button>
        </div>
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <div className="loading-header">
            <div className="spinner"></div>
            <div className="loading-text">
              <div>{'Running search...'}</div>
            </div>
          </div>
          <LoadingWidget />
        </div>
      )}

      {markdownContent && (
        <div className="result-box">
          <div className="result-action-bar">
            <button
              className="icon-button"
              onClick={handleCopyResult}
              disabled={isLoading}
              title="Copy search results"
              aria-label="Copy search results"
            >
              📋
            </button>
            <button
              className="icon-button"
              onClick={handleSaveResult}
              disabled={isLoading}
              title="Save search results"
              aria-label="Save search results"
            >
              💾
            </button>
          </div>
          <MarkdownRenderer content={markdownContent} />
        </div>
      )}
      {!markdownContent && (
        <div className="placeholder-content text-gray-500">No results yet. Enter targets and click Run Search.</div>
      )}
    </div>
  );
};

function parseTargets(input: string): string[] {
  if (!input) return [];
  const parts = input.split(/\n|,/).map(s => s.trim()).filter(Boolean);
  return parts;
}
