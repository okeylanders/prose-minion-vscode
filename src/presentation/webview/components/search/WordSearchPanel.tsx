/**
 * WordSearchPanel - Word Search subtab panel
 * Extracted from SearchTab for better separation of concerns
 */

import * as React from 'react';
import { MessageType } from '@messages';
import { TextSourceMode } from '@shared/types';
import { MarkdownRenderer } from '@components/shared/MarkdownRenderer';
import { LoadingIndicator } from '@components/shared/LoadingIndicator';
import { ScopeBox } from '@components/shared';
import { formatSearchResultAsMarkdown } from '@formatters';
import { VSCodeAPI } from '../../types/vscode';
import { UseSearchReturn } from '@hooks/domain/useSearch';
import { UseMetricsReturn } from '@hooks/domain/useMetrics';
import { UseWordSearchSettingsReturn } from '@hooks/domain/useWordSearchSettings';

interface WordSearchPanelProps {
  vscode: VSCodeAPI;
  search: UseSearchReturn;
  metrics: UseMetricsReturn;
  wordSearchSettings: UseWordSearchSettingsReturn;
}

export const WordSearchPanel: React.FC<WordSearchPanelProps> = ({
  vscode,
  search,
  metrics,
  wordSearchSettings
}) => {
  const [markdownContent, setMarkdownContent] = React.useState('');
  const [expandInfo, setExpandInfo] = React.useState<string>('');

  // Build a TextSourceSpec consistently for search requests
  const buildSourceSpec = React.useCallback(() => {
    return metrics.sourceMode === 'selection'
      ? { mode: 'selection' as TextSourceMode, pathText: '[selected text]' }
      : { mode: metrics.sourceMode, pathText: metrics.pathText };
  }, [metrics.sourceMode, metrics.pathText]);

  // Convert search result to markdown
  const syncMarkdownContent = React.useCallback(() => {
    if (!search.searchResult) {
      setMarkdownContent('');
      return;
    }
    try {
      setMarkdownContent(formatSearchResultAsMarkdown(search.searchResult));
    } catch {
      setMarkdownContent('');
    }
  }, [search.searchResult]);

  React.useEffect(() => {
    syncMarkdownContent();
  }, [syncMarkdownContent]);

  const handleCopyResult = () => {
    try {
      vscode.postMessage({
        type: MessageType.COPY_RESULT,
        source: 'webview.search.word',
        payload: {
          toolName: 'word_search',
          content: markdownContent || ''
        },
        timestamp: Date.now()
      });
    } catch {
      // ignore
    }
  };

  const handleSaveResult = () => {
    try {
      vscode.postMessage({
        type: MessageType.SAVE_RESULT,
        source: 'webview.search.word',
        payload: {
          toolName: 'word_search',
          content: markdownContent || '',
          metadata: { timestamp: Date.now() }
        },
        timestamp: Date.now()
      });
    } catch {
      // ignore
    }
  };

  const handleRunSearch = () => {
    // Clear existing search markdown before re-running
    setMarkdownContent('');
    search.setLoadingForSubtool('word', true);
    search.clearStatusForSubtool('word');
    const wordsOrPhrases = parseTargets(search.wordSearchTargets);
    vscode.postMessage({
      type: MessageType.RUN_WORD_SEARCH,
      source: 'webview.search.word',
      payload: {
        source: buildSourceSpec(),
        options: {
          wordsOrPhrases,
          contextWords: wordSearchSettings.settings.contextWords,
          clusterWindow: wordSearchSettings.settings.clusterWindow,
          minClusterSize: wordSearchSettings.settings.minClusterSize,
          caseSensitive: wordSearchSettings.settings.caseSensitive
        }
      },
      timestamp: Date.now()
    });
  };

  return (
    <>
      <ScopeBox
        mode={metrics.sourceMode}
        pathText={metrics.pathText}
        onModeChange={(mode) => {
          metrics.setSourceMode(mode);
          if (mode === 'selection') {
            metrics.setPathText('[selected text]');
          }
        }}
        onPathTextChange={(text) => metrics.setPathText(text)}
        vscode={vscode}
        source="webview.search.word"
        disabled={search.loading}
        pathInputId="pm-search-path-input"
      />

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
          value={search.wordSearchTargets}
          onChange={(e) => search.setWordSearchTargets(e.target.value)}
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
              value={wordSearchSettings.settings.contextWords}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                wordSearchSettings.updateSetting('contextWords', val ? parseInt(val, 10) : 3);
              }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm mb-1" htmlFor="pm-search-cluster-window">Cluster window</label>
            <input
              id="pm-search-cluster-window"
              type="text"
              className="w-full"
              value={wordSearchSettings.settings.clusterWindow}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                wordSearchSettings.updateSetting('clusterWindow', val ? parseInt(val, 10) : 50);
              }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm mb-1" htmlFor="pm-search-min-cluster">Min cluster size</label>
            <input
              id="pm-search-min-cluster"
              type="text"
              className="w-full"
              value={wordSearchSettings.settings.minClusterSize}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                wordSearchSettings.updateSetting('minClusterSize', val ? parseInt(val, 10) : 2);
              }}
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={wordSearchSettings.settings.caseSensitive}
              onChange={(e) => wordSearchSettings.updateSetting('caseSensitive', e.target.checked)}
            />
            <span className="ml-2">Case sensitive</span>
          </label>
        </div>

        <div className="mt-3 flex justify-center">
          <button
            className="btn btn-primary"
            disabled={search.loading}
            onClick={handleRunSearch}
          >
            ⚡ Run Search
          </button>
        </div>
      </div>

      {search.loading && (
        <LoadingIndicator
          isLoading={search.loading}
          statusMessage={search.wordStatusMessage}
          defaultMessage="Running search..."
        />
      )}

      {markdownContent && (
        <div className="result-box">
          <div className="result-action-bar">
            <button
              className="icon-button"
              onClick={handleCopyResult}
              disabled={search.loading}
              title="Copy search results"
              aria-label="Copy search results"
            >
              📋
            </button>
            <button
              className="icon-button"
              onClick={handleSaveResult}
              disabled={search.loading}
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
        <div className="placeholder-content text-gray-500">
          No results yet. Enter targets and click Run Search.
        </div>
      )}
    </>
  );
};

function parseTargets(input: string): string[] {
  if (!input) return [];
  const parts = input.split(/\n|,/).map(s => s.trim()).filter(Boolean);
  return parts;
}
