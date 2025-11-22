/**
 * SearchTab component - Presentation layer
 * Hosts Word Search UI and rendering, moved from Metrics
 */

import * as React from 'react';
import { MessageType, TextSourceMode, ModelScope, ModelOption } from '../../../shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LoadingWidget } from './LoadingWidget';
import { ModelSelector } from './ModelSelector';
import { formatSearchResultAsMarkdown, formatCategorySearchAsMarkdown } from '../utils/formatters';
import { CategorySearchState } from '../hooks/domain/useSearch';
import { CategoryRelevance, CategoryWordLimit, CATEGORY_RELEVANCE_OPTIONS } from '../../../shared/types';

type SearchSubtool = 'word' | 'category';

interface SearchTabProps {
  vscode: any;
  result: any;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  statusMessage?: string;
  wordSearchTargets: string;
  onWordSearchTargetsChange: (value: string) => void;
  sourceMode: TextSourceMode;
  pathText: string;
  onSourceModeChange: (mode: TextSourceMode) => void;
  onPathTextChange: (text: string) => void;
  onRequestActiveFile: () => void;
  onRequestManuscriptGlobs: () => void;
  onRequestChapterGlobs: () => void;
  wordSearchSettings: {
    settings: {
      contextWords: number;
      clusterWindow: number;
      minClusterSize: number;
      caseSensitive: boolean;
    };
    updateSetting: (key: 'contextWords' | 'clusterWindow' | 'minClusterSize' | 'caseSensitive', value: any) => void;
  };
  // Category search props
  categorySearch: CategorySearchState;
  onCategorySearchQueryChange: (query: string) => void;
  onCategorySearchLoadingChange: (loading: boolean) => void;
  onClearCategorySearchResult: () => void;
  onCategorySearchRelevanceChange: (relevance: CategoryRelevance) => void;
  onCategorySearchWordLimitChange: (limit: CategoryWordLimit) => void;
  // Category model props
  categoryModel?: string;
  categoryModelOptions: ModelOption[];
  onCategoryModelChange: (scope: ModelScope, modelId: string) => void;
}

export const SearchTab: React.FC<SearchTabProps> = ({
  vscode,
  result,
  isLoading,
  onLoadingChange,
  statusMessage,
  wordSearchTargets,
  onWordSearchTargetsChange,
  sourceMode,
  pathText,
  onSourceModeChange,
  onPathTextChange,
  onRequestActiveFile,
  onRequestManuscriptGlobs,
  onRequestChapterGlobs,
  wordSearchSettings,
  categorySearch,
  onCategorySearchQueryChange,
  onCategorySearchLoadingChange,
  onClearCategorySearchResult,
  onCategorySearchRelevanceChange,
  onCategorySearchWordLimitChange,
  categoryModel,
  categoryModelOptions,
  onCategoryModelChange
}) => {
  const [markdownContent, setMarkdownContent] = React.useState('');
  const [categoryMarkdownContent, setCategoryMarkdownContent] = React.useState('');
  const [expandInfo, setExpandInfo] = React.useState<string>('');
  const [activeSubtool, setActiveSubtool] = React.useState<SearchSubtool>('word');

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
      setMarkdownContent(formatSearchResultAsMarkdown(result));
    } catch {
      setMarkdownContent('');
    }
  }, [result]);

  // Convert category search result to markdown
  React.useEffect(() => {
    if (!categorySearch.result) {
      setCategoryMarkdownContent('');
      return;
    }
    try {
      setCategoryMarkdownContent(formatCategorySearchAsMarkdown(categorySearch.result));
    } catch {
      setCategoryMarkdownContent('');
    }
  }, [categorySearch.result]);

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
          <button className="btn btn-primary" disabled={isLoading} onClick={() => {
            // Clear existing search markdown before re-running
            setMarkdownContent('');
            onLoadingChange(true);
            const wordsOrPhrases = parseTargets(wordSearchTargets);
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

      {isLoading && (
        <div className="loading-indicator">
          <div className="loading-header">
            <div className="spinner"></div>
            <div className="loading-text">
              <div>{statusMessage || 'Running search...'}</div>
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
      </>
      )}

      {/* Category Search panel */}
      {activeSubtool === 'category' && (
      <>
        {/* Scope + Path/Pattern well */}
        <div className="input-container">
          <label className="block text-sm font-medium mb-2">Scope:</label>
          <div className="tab-bar" role="tablist" aria-label="Category search scope" style={{ marginBottom: '8px' }}>
            <button
              className={`tab-button ${sourceMode === 'activeFile' ? 'active' : ''}`}
              onClick={() => {
                onSourceModeChange('activeFile');
                onRequestActiveFile();
              }}
              disabled={categorySearch.isLoading}
              role="tab"
              aria-selected={sourceMode === 'activeFile'}
              aria-label="Search active file"
            >
              <span className="tab-label">Active File</span>
            </button>
            <button
              className={`tab-button ${sourceMode === 'manuscript' ? 'active' : ''}`}
              onClick={() => {
                onSourceModeChange('manuscript');
                onRequestManuscriptGlobs();
              }}
              disabled={categorySearch.isLoading}
              role="tab"
              aria-selected={sourceMode === 'manuscript'}
              aria-label="Search manuscripts"
            >
              <span className="tab-label">Manuscripts</span>
            </button>
            <button
              className={`tab-button ${sourceMode === 'chapters' ? 'active' : ''}`}
              onClick={() => {
                onSourceModeChange('chapters');
                onRequestChapterGlobs();
              }}
              disabled={categorySearch.isLoading}
              role="tab"
              aria-selected={sourceMode === 'chapters'}
              aria-label="Search chapters"
            >
              <span className="tab-label">Chapters</span>
            </button>
            <button
              className={`tab-button ${sourceMode === 'selection' ? 'active' : ''}`}
              onClick={() => {
                onSourceModeChange('selection');
                onPathTextChange('[selected text]');
              }}
              disabled={categorySearch.isLoading}
              role="tab"
              aria-selected={sourceMode === 'selection'}
              aria-label="Search selection"
            >
              <span className="tab-label">Selection</span>
            </button>
          </div>

          <label className="block text-sm font-medium mb-2" htmlFor="pm-category-search-path-input">Path / Pattern</label>
          <input
            id="pm-category-search-path-input"
            type="text"
            className="w-full"
            value={pathText}
            onChange={(e) => onPathTextChange(e.target.value)}
            placeholder={sourceMode === 'selection' ? 'Selected text' : 'e.g. prose/**/*.md'}
            disabled={categorySearch.isLoading}
          />
        </div>

        {/* Category Model selector - standalone above the query well */}
        <div style={{ margin: '16px 0' }}>
          <ModelSelector
            scope="category"
            options={categoryModelOptions}
            value={categoryModel}
            onChange={onCategoryModelChange}
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
            value={categorySearch.query}
            onChange={(e) => onCategorySearchQueryChange(e.target.value)}
            placeholder="e.g., words related to weather"
            disabled={categorySearch.isLoading}
            aria-label="Category query input"
          />

          {/* Relevance selector */}
          <label className="block text-sm font-medium mb-2 mt-3">Relevance:</label>
          <div className="tab-bar" style={{ marginBottom: '8px', padding: 0 }}>
            {CATEGORY_RELEVANCE_OPTIONS.map((level) => (
              <button
                key={level}
                className={`tab-button ${categorySearch.relevance === level ? 'active' : ''}`}
                onClick={() => onCategorySearchRelevanceChange(level)}
                disabled={categorySearch.isLoading}
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
                className={`tab-button ${categorySearch.wordLimit === limit ? 'active' : ''}`}
                onClick={() => onCategorySearchWordLimitChange(limit)}
                disabled={categorySearch.isLoading}
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
                disabled={categorySearch.isLoading}
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
                disabled={categorySearch.isLoading}
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
                disabled={categorySearch.isLoading}
              />
            </div>
          </div>

          <div className="mt-3 flex justify-center">
            <button
              className="btn btn-primary"
              disabled={categorySearch.isLoading || !categorySearch.query.trim()}
              onClick={() => {
                onClearCategorySearchResult();
                onCategorySearchLoadingChange(true);
                vscode.postMessage({
                  type: MessageType.CATEGORY_SEARCH_REQUEST,
                  source: 'webview.search.tab',
                  payload: {
                    query: categorySearch.query,
                    source: buildSourceSpec(),
                    options: {
                      contextWords: wordSearchSettings.settings.contextWords,
                      clusterWindow: wordSearchSettings.settings.clusterWindow,
                      minClusterSize: wordSearchSettings.settings.minClusterSize,
                      relevance: categorySearch.relevance,
                      wordLimit: categorySearch.wordLimit
                    }
                  },
                  timestamp: Date.now()
                });
              }}
              aria-label="Run category search"
            >⚡ Run Category Search</button>
          </div>
        </div>

        {categorySearch.isLoading && (
          <div className="loading-indicator">
            <div className="loading-header">
              <div className="spinner"></div>
              <div className="loading-text">
                <div>{statusMessage || 'Running category search...'}</div>
              </div>
            </div>
            <LoadingWidget />
          </div>
        )}

        {categorySearch.error && (
          <div className="error-message" style={{ marginTop: '8px', color: 'var(--vscode-errorForeground)' }}>
            {categorySearch.error}
          </div>
        )}

        {categoryMarkdownContent && !categorySearch.isLoading && (
          <div className="result-box">
            <div className="result-action-bar">
              <button
                className="icon-button"
                onClick={handleCopyCategoryResult}
                disabled={categorySearch.isLoading}
                title="Copy category search results"
                aria-label="Copy category search results"
              >
                📋
              </button>
              <button
                className="icon-button"
                onClick={handleSaveCategoryResult}
                disabled={categorySearch.isLoading}
                title="Save category search results"
                aria-label="Save category search results"
              >
                💾
              </button>
            </div>
            <MarkdownRenderer content={categoryMarkdownContent} />
          </div>
        )}

        {!categorySearch.result && !categorySearch.isLoading && !categorySearch.error && (
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
