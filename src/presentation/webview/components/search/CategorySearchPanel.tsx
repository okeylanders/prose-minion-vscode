/**
 * CategorySearchPanel - Category Search subtab panel
 * Extracted from SearchTab for better separation of concerns
 */

import * as React from 'react';
import { MessageType, CATEGORY_RELEVANCE_OPTIONS, NGRAM_MODE_OPTIONS, MIN_OCCURRENCES_OPTIONS } from '@messages';
import { TextSourceMode } from '@shared/types';
import { MarkdownRenderer } from '@components/shared/MarkdownRenderer';
import { ErrorBoundary } from '@components/shared/ErrorBoundary';
import { LoadingIndicator } from '@components/shared/LoadingIndicator';
import { ModelSelector } from '@components/shared/ModelSelector';
import { ScopeBox } from '@components/shared';
import { formatCategorySearchAsMarkdown } from '@formatters';
import { VSCodeAPI } from '../../types/vscode';
import { UseSearchReturn } from '@hooks/domain/useSearch';
import { UseMetricsReturn } from '@hooks/domain/useMetrics';
import { UseWordSearchSettingsReturn } from '@hooks/domain/useWordSearchSettings';
import { UseModelsSettingsReturn } from '@hooks/domain/useModelsSettings';

interface CategorySearchPanelProps {
  vscode: VSCodeAPI;
  search: UseSearchReturn;
  metrics: UseMetricsReturn;
  wordSearchSettings: UseWordSearchSettingsReturn;
  modelsSettings: UseModelsSettingsReturn;
}

export const CategorySearchPanel: React.FC<CategorySearchPanelProps> = ({
  vscode,
  search,
  metrics,
  wordSearchSettings,
  modelsSettings
}) => {
  const [categoryMarkdownContent, setCategoryMarkdownContent] = React.useState('');

  // Build a TextSourceSpec consistently for search requests
  const buildSourceSpec = React.useCallback(() => {
    return metrics.sourceMode === 'selection'
      ? { mode: 'selection' as TextSourceMode, pathText: '[selected text]' }
      : { mode: metrics.sourceMode, pathText: metrics.pathText };
  }, [metrics.sourceMode, metrics.pathText]);

  // Sync category search result to markdown format
  const syncCategoryMarkdownContent = React.useCallback(() => {
    if (!search.categorySearch.result) {
      setCategoryMarkdownContent('');
      return;
    }
    try {
      setCategoryMarkdownContent(formatCategorySearchAsMarkdown(search.categorySearch.result));
    } catch {
      setCategoryMarkdownContent('');
    }
  }, [search.categorySearch.result]);

  React.useEffect(() => {
    syncCategoryMarkdownContent();
  }, [syncCategoryMarkdownContent]);

  const handleCopyCategoryResult = () => {
    try {
      vscode.postMessage({
        type: MessageType.COPY_RESULT,
        source: 'webview.search.category',
        payload: {
          toolName: 'category_search',
          content: categoryMarkdownContent || ''
        },
        timestamp: Date.now()
      });
    } catch {
      // ignore
    }
  };

  const handleSaveCategoryResult = () => {
    try {
      vscode.postMessage({
        type: MessageType.SAVE_RESULT,
        source: 'webview.search.category',
        payload: {
          toolName: 'category_search',
          content: categoryMarkdownContent || '',
          metadata: { timestamp: Date.now() }
        },
        timestamp: Date.now()
      });
    } catch {
      // ignore
    }
  };

  const handleRunCategorySearch = () => {
    search.clearCategorySearchResult();
    search.setCategorySearchLoading(true);
    search.clearStatusForSubtool('category');
    vscode.postMessage({
      type: MessageType.CATEGORY_SEARCH_REQUEST,
      source: 'webview.search.category',
      payload: {
        query: search.categorySearch.query,
        source: buildSourceSpec(),
        options: {
          contextWords: wordSearchSettings.settings.contextWords,
          clusterWindow: wordSearchSettings.settings.clusterWindow,
          minClusterSize: wordSearchSettings.settings.minClusterSize,
          relevance: search.categorySearch.relevance,
          wordLimit: search.categorySearch.wordLimit,
          ngramMode: search.categorySearch.ngramMode,
          minOccurrences: search.categorySearch.minOccurrences
        }
      },
      timestamp: Date.now()
    });
  };

  const handleCancelCategorySearch = () => {
    vscode.postMessage({
      type: MessageType.CANCEL_CATEGORY_SEARCH_REQUEST,
      source: 'webview.search.category',
      payload: {
        requestId: 'category-search',
        domain: 'search'
      },
      timestamp: Date.now()
    });
    search.cancelCategorySearch();
  };

  return (
    <>
      {/* Scope + Path/Pattern well */}
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
        source="webview.search.category"
        disabled={search.categorySearch.isLoading}
        pathInputId="pm-category-search-path-input"
        scopeAriaLabel="Category search scope"
      />

      {/* Category Model selector - standalone above the query well */}
      <div style={{ margin: '16px 0' }}>
        <ModelSelector
          scope="category"
          options={modelsSettings.categoryModelOptions}
          value={modelsSettings.modelSelections.category}
          onChange={modelsSettings.setModelSelection}
          label="Category Model"
        />
      </div>

      {/* Unified Category Query well */}
      <div className="input-container">
        <label className="block text-sm font-medium mb-2" htmlFor="pm-category-search-query">
          Category Query
        </label>
        <span className="text-xs text-gray-500 block mb-1">
          Describe the category of words to find (e.g., "weather words", "emotion verbs")
        </span>
        <textarea
          id="pm-category-search-query"
          className="w-full"
          rows={2}
          value={search.categorySearch.query}
          onChange={(e) => search.setCategorySearchQuery(e.target.value)}
          placeholder="e.g., words related to weather"
          disabled={search.categorySearch.isLoading}
          aria-label="Category query input"
        />

        {/* Relevance selector */}
        <label className="block text-sm font-medium mb-2 mt-3">Relevance:</label>
        <div className="tab-bar" style={{ marginBottom: '8px', padding: 0 }}>
          {CATEGORY_RELEVANCE_OPTIONS.map((level) => (
            <button
              key={level}
              className={`tab-button ${search.categorySearch.relevance === level ? 'active' : ''}`}
              onClick={() => search.setCategorySearchRelevance(level)}
              disabled={search.categorySearch.isLoading}
            >
              <span className="tab-label">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
            </button>
          ))}
        </div>

        {/* Word limit selector */}
        <label className="block text-sm font-medium mb-2">Limit to:</label>
        <div className="tab-bar" style={{ marginBottom: '8px', padding: 0 }}>
          {([20, 50, 75, 100, 250, 350, 500] as const).map((limit) => (
            <button
              key={limit}
              className={`tab-button ${search.categorySearch.wordLimit === limit ? 'active' : ''}`}
              onClick={() => search.setCategorySearchWordLimit(limit)}
              disabled={search.categorySearch.isLoading}
            >
              <span className="tab-label">{limit}</span>
            </button>
          ))}
        </div>

        {/* Context/Cluster settings */}
        <div className="flex gap-2 mt-2">
          <div className="flex-1">
            <label className="block text-sm mb-1" htmlFor="pm-category-context-words">
              Context words
            </label>
            <input
              id="pm-category-context-words"
              type="text"
              className="w-full"
              value={wordSearchSettings.settings.contextWords}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                wordSearchSettings.updateSetting('contextWords', val ? parseInt(val, 10) : 3);
              }}
              disabled={search.categorySearch.isLoading}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm mb-1" htmlFor="pm-category-cluster-window">
              Cluster window
            </label>
            <input
              id="pm-category-cluster-window"
              type="text"
              className="w-full"
              value={wordSearchSettings.settings.clusterWindow}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                wordSearchSettings.updateSetting('clusterWindow', val ? parseInt(val, 10) : 50);
              }}
              disabled={search.categorySearch.isLoading}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm mb-1" htmlFor="pm-category-min-cluster">
              Min cluster size
            </label>
            <input
              id="pm-category-min-cluster"
              type="text"
              className="w-full"
              value={wordSearchSettings.settings.minClusterSize}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                wordSearchSettings.updateSetting('minClusterSize', val ? parseInt(val, 10) : 2);
              }}
              disabled={search.categorySearch.isLoading}
            />
          </div>
        </div>

        {/* N-gram mode selector */}
        <label className="block text-sm font-medium mb-2 mt-3">Search mode:</label>
        <div className="tab-bar" style={{ marginBottom: '8px', padding: 0 }}>
          {NGRAM_MODE_OPTIONS.map((mode) => (
            <button
              key={mode}
              className={`tab-button ${search.categorySearch.ngramMode === mode ? 'active' : ''}`}
              onClick={() => search.setCategorySearchNgramMode(mode)}
              disabled={search.categorySearch.isLoading}
            >
              <span className="tab-label">{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
            </button>
          ))}
        </div>

        {/* Min occurrences - only shown for bigrams/trigrams */}
        {search.categorySearch.ngramMode !== 'words' && (
          <>
            <label className="block text-sm font-medium mb-2">Min occurrences:</label>
            <div className="tab-bar" style={{ marginBottom: '8px', padding: 0 }}>
              {MIN_OCCURRENCES_OPTIONS.map((min) => (
                <button
                  key={min}
                  className={`tab-button ${search.categorySearch.minOccurrences === min ? 'active' : ''}`}
                  onClick={() => search.setCategorySearchMinOccurrences(min)}
                  disabled={search.categorySearch.isLoading}
                >
                  <span className="tab-label">{min}{min === 5 ? '+' : ''}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-3 flex justify-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={search.categorySearch.isLoading || !search.categorySearch.query.trim()}
            onClick={handleRunCategorySearch}
            aria-label="Run category search"
          >
            ⚡ Run Category Search
          </button>
          {search.categorySearch.isLoading && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancelCategorySearch}
              aria-label="Cancel category search"
            >
              ✕ Cancel
            </button>
          )}
        </div>
      </div>

      {search.categorySearch.isLoading && (
        <LoadingIndicator
          isLoading={search.categorySearch.isLoading}
          statusMessage={search.categoryStatusMessage}
          defaultMessage="Running category search..."
          tickerMessage={search.categorySearch.tickerMessage}
          progress={search.categorySearch.progress ? {
            current: search.categorySearch.progress.current,
            total: search.categorySearch.progress.total,
            label: `Batch ${search.categorySearch.progress.current} of ${search.categorySearch.progress.total}`
          } : undefined}
        />
      )}

      {search.categorySearch.error && (
        <div className="error-message" style={{ marginTop: '8px', color: 'var(--vscode-errorForeground)' }}>
          {search.categorySearch.error}
        </div>
      )}

      {categoryMarkdownContent && !search.categorySearch.isLoading && (
        <div className="result-box">
          <div className="result-action-bar">
            <button
              className="icon-button"
              onClick={handleCopyCategoryResult}
              disabled={search.categorySearch.isLoading}
              title="Copy category search results"
              aria-label="Copy category search results"
            >
              📋
            </button>
            <button
              className="icon-button"
              onClick={handleSaveCategoryResult}
              disabled={search.categorySearch.isLoading}
              title="Save category search results"
              aria-label="Save category search results"
            >
              💾
            </button>
          </div>
          <ErrorBoundary
            fallback={<pre className="markdown-fallback">{categoryMarkdownContent}</pre>}
            onError={(error: Error) => {
              vscode.postMessage({
                type: MessageType.WEBVIEW_ERROR,
                source: 'webview.markdown_renderer',
                payload: { message: error.message },
                timestamp: Date.now()
              });
            }}
          >
            <MarkdownRenderer content={categoryMarkdownContent} />
          </ErrorBoundary>
        </div>
      )}

      {!search.categorySearch.result && !search.categorySearch.isLoading && !search.categorySearch.error && (
        <div className="placeholder-content text-gray-500">
          No results yet. Enter a category query and click Run Category Search.
        </div>
      )}
    </>
  );
};
