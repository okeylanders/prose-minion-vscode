/**
 * useSearch - Domain hook for word search functionality
 *
 * Manages search results and word search targets state.
 */

import * as React from 'react';
import { usePersistedState } from '../usePersistence';
import { TextSourceMode } from '@shared/types';
import {
  SearchResultMessage,
  ActiveFileMessage,
  ManuscriptGlobsMessage,
  ChapterGlobsMessage,
  CategorySearchResultMessage,
  CategorySearchResult,
  StatusMessage
} from '@messages';
import { CategoryRelevance, CategoryWordLimit } from '@shared/types';

export interface CategorySearchState {
  query: string;
  result: CategorySearchResult | null;
  isLoading: boolean;
  error: string | null;
  relevance: CategoryRelevance;
  wordLimit: CategoryWordLimit;
  progress?: { current: number; total: number };
  tickerMessage?: string;
}

export interface SearchState {
  searchResult: any | null;
  wordSearchTargets: string;
  loading: boolean;
  sourceMode: TextSourceMode;
  pathText: string;
  categorySearch: CategorySearchState;
  statusMessage?: string;
}

export interface SearchActions {
  handleSearchResult: (message: SearchResultMessage) => void;
  setWordSearchTargets: (targets: string) => void;
  clearSearchResult: () => void;
  setLoading: (loading: boolean) => void;
  handleStatusMessage: (message: StatusMessage) => void;
  handleActiveFile: (message: ActiveFileMessage) => void;
  handleManuscriptGlobs: (message: ManuscriptGlobsMessage) => void;
  handleChapterGlobs: (message: ChapterGlobsMessage) => void;
  setSourceMode: (mode: TextSourceMode) => void;
  setPathText: (text: string) => void;
  // Category search actions
  handleCategorySearchResult: (message: CategorySearchResultMessage) => void;
  setCategorySearchQuery: (query: string) => void;
  setCategorySearchLoading: (loading: boolean) => void;
  clearCategorySearchResult: () => void;
  setCategorySearchRelevance: (relevance: CategoryRelevance) => void;
  setCategorySearchWordLimit: (limit: CategoryWordLimit) => void;
}

export interface SearchPersistence {
  searchResult: any | null;
  wordSearchTargets: string;
  searchSourceMode: TextSourceMode;
  searchPathText: string;
  statusMessage?: string;
  categorySearchQuery: string;
  categorySearchResult: CategorySearchResult | null;
  categorySearchRelevance: CategoryRelevance;
  categorySearchWordLimit: CategoryWordLimit;
}

export type UseSearchReturn = SearchState & SearchActions & { persistedState: SearchPersistence };

/**
 * Custom hook for managing search state and operations
 *
 * @example
 * ```tsx
 * const search = useSearch();
 *
 * // Handle search result message
 * useMessageRouter({
 *   [MessageType.SEARCH_RESULT]: search.handleSearchResult,
 * });
 *
 * // Render search tab
 * <SearchTab
 *   result={search.searchResult}
 *   wordSearchTargets={search.wordSearchTargets}
 *   onWordSearchTargetsChange={search.setWordSearchTargets}
 * />
 * ```
 */
export const useSearch = (): UseSearchReturn => {
  const persisted = usePersistedState<{
    searchResult?: any;
    wordSearchTargets?: string;
    searchSourceMode?: TextSourceMode;
    searchPathText?: string;
    statusMessage?: string;
    categorySearchQuery?: string;
    categorySearchResult?: CategorySearchResult | null;
    categorySearchRelevance?: CategoryRelevance;
    categorySearchWordLimit?: CategoryWordLimit;
  }>();

  const [searchResult, setSearchResult] = React.useState<any | null>(
    persisted?.searchResult ?? null
  );
  const [wordSearchTargets, setWordSearchTargets] = React.useState<string>(
    persisted?.wordSearchTargets ?? ''
  );
  const [loading, setLoading] = React.useState<boolean>(false);
  const [sourceMode, setSourceMode] = React.useState<TextSourceMode>(persisted?.searchSourceMode ?? 'selection');
  const [pathText, setPathText] = React.useState<string>(persisted?.searchPathText ?? '[selected text]');
  const [statusMessage, setStatusMessage] = React.useState<string>(persisted?.statusMessage ?? '');

  // Category search state
  const [categorySearchQuery, setCategorySearchQuery] = React.useState<string>(
    persisted?.categorySearchQuery ?? ''
  );
  const [categorySearchResult, setCategorySearchResult] = React.useState<CategorySearchResult | null>(
    persisted?.categorySearchResult ?? null
  );
  const [categorySearchLoading, setCategorySearchLoading] = React.useState<boolean>(false);
  const [categorySearchError, setCategorySearchError] = React.useState<string | null>(null);
  const [categorySearchRelevance, setCategorySearchRelevance] = React.useState<CategoryRelevance>(
    persisted?.categorySearchRelevance ?? 'focused'
  );
  const [categorySearchWordLimit, setCategorySearchWordLimit] = React.useState<CategoryWordLimit>(
    persisted?.categorySearchWordLimit ?? 50
  );
  const [categorySearchProgress, setCategorySearchProgress] = React.useState<{ current: number; total: number } | undefined>(undefined);
  const [categorySearchTicker, setCategorySearchTicker] = React.useState<string>('');

  const handleSearchResult = React.useCallback((message: SearchResultMessage) => {
    setSearchResult(message.payload.result);
    setLoading(false);
  }, []);

  const clearSearchResult = React.useCallback(() => {
    setSearchResult(null);
  }, []);

  const handleActiveFile = React.useCallback((message: ActiveFileMessage) => {
    const { relativePath } = message.payload;
    setPathText(relativePath ?? '');
  }, []);

  const handleManuscriptGlobs = React.useCallback((message: ManuscriptGlobsMessage) => {
    const { globs } = message.payload;
    setPathText(globs ?? '');
  }, []);

  const handleChapterGlobs = React.useCallback((message: ChapterGlobsMessage) => {
    const { globs } = message.payload;
    setPathText(globs ?? '');
  }, []);

  // Category search handlers
  const handleCategorySearchResult = React.useCallback((message: CategorySearchResultMessage) => {
    const { result } = message.payload;
    setCategorySearchResult(result);
    setCategorySearchLoading(false);
    setCategorySearchProgress(undefined); // Clear progress when complete
    setCategorySearchTicker(''); // Clear ticker when complete
    if (result.error) {
      setCategorySearchError(result.error);
    } else {
      setCategorySearchError(null);
    }
    setStatusMessage('');
  }, []);

  const clearCategorySearchResult = React.useCallback(() => {
    setCategorySearchResult(null);
    setCategorySearchError(null);
    setCategorySearchProgress(undefined); // Clear progress when clearing result
    setCategorySearchTicker(''); // Clear ticker when clearing result
  }, []);

  const handleStatusMessage = React.useCallback((message: StatusMessage) => {
    setStatusMessage(message.payload.message || '');
    // Update category search progress and ticker if available
    if (message.source === 'extension.search' && categorySearchLoading) {
      setCategorySearchProgress(message.payload.progress);
      if (message.payload.tickerMessage) {
        console.log('[useSearch] Category search ticker:', message.payload.tickerMessage);
        setCategorySearchTicker(message.payload.tickerMessage);
      }
    }
  }, [categorySearchLoading]);

  return {
    // State
    searchResult,
    wordSearchTargets,
    loading,
    sourceMode,
    pathText,
    statusMessage,
    categorySearch: {
      query: categorySearchQuery,
      result: categorySearchResult,
      isLoading: categorySearchLoading,
      error: categorySearchError,
      relevance: categorySearchRelevance,
      wordLimit: categorySearchWordLimit,
      progress: categorySearchProgress,
      tickerMessage: categorySearchTicker,
    },

    // Actions
    handleSearchResult,
    setWordSearchTargets,
    clearSearchResult,
    setLoading,
    handleStatusMessage,
    handleActiveFile,
    handleManuscriptGlobs,
    handleChapterGlobs,
    setSourceMode,
    setPathText,
    // Category search actions
    handleCategorySearchResult,
    setCategorySearchQuery,
    setCategorySearchLoading,
    clearCategorySearchResult,
    setCategorySearchRelevance,
    setCategorySearchWordLimit,

    // Persistence
    persistedState: {
      searchResult,
      wordSearchTargets,
      searchSourceMode: sourceMode,
      searchPathText: pathText,
      statusMessage,
      categorySearchQuery,
      categorySearchResult,
      categorySearchRelevance,
      categorySearchWordLimit,
    },
  };
};
