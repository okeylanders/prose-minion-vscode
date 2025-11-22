/**
 * SearchTab component - Presentation layer
 * Hosts Word Search UI and rendering, moved from Metrics
 */

import * as React from 'react';
import { MessageType, TextSourceMode, ModelScope } from '@shared/types';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { LoadingIndicator } from '../shared/LoadingIndicator';
import { ModelSelector } from '../shared/ModelSelector';
import { ScopeBox } from '../shared';
import { formatSearchResultAsMarkdown, formatCategorySearchAsMarkdown } from '../../utils/formatters';
import { CategoryRelevance, CategoryWordLimit, CATEGORY_RELEVANCE_OPTIONS } from '@shared/types';
import { VSCodeAPI } from '../../types/vscode';
import { UseSearchReturn } from '../../hooks/domain/useSearch';
import { UseMetricsReturn } from '../../hooks/domain/useMetrics';
import { UseWordSearchSettingsReturn } from '../../hooks/domain/useWordSearchSettings';
import { UseModelsSettingsReturn } from '../../hooks/domain/useModelsSettings';

type SearchSubtool = 'word' | 'category';

interface SearchTabProps {
  vscode: VSCodeAPI;
  search: UseSearchReturn;
  metrics: UseMetricsReturn;
  wordSearchSettings: UseWordSearchSettingsReturn;
  modelsSettings: UseModelsSettingsReturn;
}

export const SearchTab: React.FC<SearchTabProps> = ({
  vscode,
  search,
  metrics,
  wordSearchSettings,
  modelsSettings
}) => {
  const [markdownContent, setMarkdownContent] = React.useState('');
  const [categoryMarkdownContent, setCategoryMarkdownContent] = React.useState('');
  const [expandInfo, setExpandInfo] = React.useState<string>('');
  const [activeSubtool, setActiveSubtool] = React.useState<SearchSubtool>('word');

  // Build a TextSourceSpec consistently for search requests
  const buildSourceSpec = React.useCallback(() => {
    return metrics.sourceMode === 'selection'
      ? { mode: 'selection' as TextSourceMode, pathText: '[selected text]' }
      : { mode: metrics.sourceMode, pathText: metrics.pathText };
  }, [metrics.sourceMode, metrics.pathText]);

  React.useEffect(() => {
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

  // Convert category search result to markdown
  React.useEffect(() => {
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

  const handleCopyResult = () => {
    try {
      vscode.postMessage({
        type: MessageType.COPY_RESULT,
        source: 'webview.search.tab',
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
        source: 'webview.search.tab',
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

  return (
    <div className="tab-content">
      <h2 className="text-lg font-semibold mb-4">Search</h2>

      {/* Subtool tabs */}
      <div className="tab-bar" style={{ marginBottom: '16px' }}>
        <button
          className={`tab-button ${activeSubtool === 'word' ? 'active' : ''}`}
          onClick={() => setActiveSubtool('word')}
        >
          <span className="tab-label">Word Search</span>
        </button>
        <button
          className={`tab-button ${activeSubtool === 'category' ? 'active' : ''}`}
          onClick={() => setActiveSubtool('category')}
        >
          <span className="tab-label">Category Search</span>
        </button>
      </div>

      {/* Word Search panel */}
      {activeSubtool === 'word' && (
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
        source="webview.search.tab"
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
            <input type="checkbox" checked={wordSearchSettings.settings.caseSensitive} onChange={(e) => wordSearchSettings.updateSetting('caseSensitive', e.target.checked)} />
            <span className="ml-2">Case sensitive</span>
          </label>
        </div>

        <div className="mt-3 flex justify-center">
          <button className="btn btn-primary" disabled={search.loading} onClick={() => {
            // Clear existing search markdown before re-running
            setMarkdownContent('');
            search.setLoading(true);
            const wordsOrPhrases = parseTargets(search.wordSearchTargets);
            vscode.postMessage({
              type: MessageType.RUN_WORD_SEARCH,
              source: 'webview.search.tab',
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
          }}>⚡ Run Search</button>
        </div>
      </div>

      {search.loading && (
        <LoadingIndicator
          isLoading={search.loading}
          statusMessage={search.statusMessage}
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
        <div className="placeholder-content text-gray-500">No results yet. Enter targets and click Run Search.</div>
      )}
      </>
      )}

      {/* Category Search panel */}
      {activeSubtool === 'category' && (
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
          source="webview.search.tab"
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
          <label className="block text-sm font-medium mb-2" htmlFor="pm-category-search-query">Category Query</label>
          <span className="text-xs text-gray-500 block mb-1">Describe the category of words to find (e.g., "weather words", "emotion verbs")</span>
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
              <label className="block text-sm mb-1" htmlFor="pm-category-context-words">Context words</label>
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
              <label className="block text-sm mb-1" htmlFor="pm-category-cluster-window">Cluster window</label>
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
              <label className="block text-sm mb-1" htmlFor="pm-category-min-cluster">Min cluster size</label>
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

          <div className="mt-3 flex justify-center">
            <button
              className="btn btn-primary"
              disabled={search.categorySearch.isLoading || !search.categorySearch.query.trim()}
              onClick={() => {
                search.clearCategorySearchResult();
                search.setCategorySearchLoading(true);
                vscode.postMessage({
                  type: MessageType.CATEGORY_SEARCH_REQUEST,
                  source: 'webview.search.tab',
                  payload: {
                    query: search.categorySearch.query,
                    source: buildSourceSpec(),
                    options: {
                      contextWords: wordSearchSettings.settings.contextWords,
                      clusterWindow: wordSearchSettings.settings.clusterWindow,
                      minClusterSize: wordSearchSettings.settings.minClusterSize,
                      relevance: search.categorySearch.relevance,
                      wordLimit: search.categorySearch.wordLimit
                    }
                  },
                  timestamp: Date.now()
                });
              }}
              aria-label="Run category search"
            >⚡ Run Category Search</button>
          </div>
        </div>

        {search.categorySearch.isLoading && (
          <LoadingIndicator
            isLoading={search.categorySearch.isLoading}
            statusMessage={search.statusMessage}
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
            <MarkdownRenderer content={categoryMarkdownContent} />
          </div>
        )}

        {!search.categorySearch.result && !search.categorySearch.isLoading && !search.categorySearch.error && (
          <div className="placeholder-content text-gray-500">No results yet. Enter a category query and click Run Category Search.</div>
        )}
      </>
      )}
    </div>
  );
};

function parseTargets(input: string): string[] {
  if (!input) return [];
  const parts = input.split(/\n|,/).map(s => s.trim()).filter(Boolean);
  return parts;
}
