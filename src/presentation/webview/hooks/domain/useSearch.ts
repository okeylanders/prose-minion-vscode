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
  StatusMessage,
  NGramMode,
  MinOccurrences
} from '@messages';
import { CategoryRelevance, CategoryWordLimit } from '@shared/types';

type SearchSubtool = 'word' | 'category';

export interface CategorySearchState {
  query: string;
  result: CategorySearchResult | null;
  isLoading: boolean;
  error: string | null;
  relevance: CategoryRelevance;
  wordLimit: CategoryWordLimit;
  ngramMode: NGramMode;
  minOccurrences: MinOccurrences;
  progress?: { current: number; total: number };
  tickerMessage?: string;
}

export interface SearchState {
  searchResult: any | null;
  wordSearchTargets: string;
  loading: boolean; // word search loading (derived)
  loadingBySubtool: Record<SearchSubtool, boolean>;
  sourceMode: TextSourceMode;
  pathText: string;
  categorySearch: CategorySearchState;
  wordStatusMessage?: string;
  categoryStatusMessage?: string;
}

export interface SearchActions {
  handleSearchResult: (message: SearchResultMessage) => void;
  setWordSearchTargets: (targets: string) => void;
  clearSearchResult: () => void;
  setLoading: (loading: boolean) => void;
  setLoadingForSubtool: (tool: SearchSubtool, loading: boolean) => void;
  clearStatusForSubtool: (tool: SearchSubtool) => void;
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
  setCategorySearchNgramMode: (mode: NGramMode) => void;
  setCategorySearchMinOccurrences: (min: MinOccurrences) => void;
  cancelCategorySearch: () => void;
}

export interface SearchPersistence {
  searchResult: any | null;
  wordSearchTargets: string;
  searchSourceMode: TextSourceMode;
  searchPathText: string;
  wordStatusMessage?: string;
  categoryStatusMessage?: string;
  categorySearchQuery: string;
  categorySearchResult: CategorySearchResult | null;
  categorySearchRelevance: CategoryRelevance;
  categorySearchWordLimit: CategoryWordLimit;
  categorySearchNgramMode: NGramMode;
  categorySearchMinOccurrences: MinOccurrences;
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
    wordStatusMessage?: string;
    categoryStatusMessage?: string;
    categorySearchQuery?: string;
    categorySearchResult?: CategorySearchResult | null;
    categorySearchRelevance?: CategoryRelevance;
    categorySearchWordLimit?: CategoryWordLimit;
    categorySearchNgramMode?: NGramMode;
    categorySearchMinOccurrences?: MinOccurrences;
  }>();

  const [searchResult, setSearchResult] = React.useState<any | null>(
    persisted?.searchResult ?? null
  );
  const [wordSearchTargets, setWordSearchTargets] = React.useState<string>(
    persisted?.wordSearchTargets ?? ''
  );
  const [loadingBySubtool, setLoadingBySubtool] = React.useState<Record<SearchSubtool, boolean>>({
    word: false,
    category: false
  });
  const [sourceMode, setSourceMode] = React.useState<TextSourceMode>(persisted?.searchSourceMode ?? 'selection');
  const [pathText, setPathText] = React.useState<string>(persisted?.searchPathText ?? '[selected text]');
  const [wordStatusMessage, setWordStatusMessage] = React.useState<string>(persisted?.wordStatusMessage ?? '');
  const [categoryStatusMessage, setCategoryStatusMessage] = React.useState<string>(persisted?.categoryStatusMessage ?? '');

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
  const [categorySearchNgramMode, setCategorySearchNgramMode] = React.useState<NGramMode>(
    persisted?.categorySearchNgramMode ?? 'words'
  );
  const [categorySearchMinOccurrences, setCategorySearchMinOccurrences] = React.useState<MinOccurrences>(
    persisted?.categorySearchMinOccurrences ?? 2
  );
  const [categorySearchProgress, setCategorySearchProgress] = React.useState<{ current: number; total: number } | undefined>(undefined);
  const [categorySearchTicker, setCategorySearchTicker] = React.useState<string>('');

  const setLoadingForSubtool = React.useCallback((tool: SearchSubtool, isLoading: boolean) => {
    setLoadingBySubtool((prev) => ({ ...prev, [tool]: isLoading }));
  }, []);

  const handleSearchResult = React.useCallback((message: SearchResultMessage) => {
    setSearchResult(message.payload.result);
    setLoadingForSubtool('word', false);
    setWordStatusMessage('');
  }, []);

  const clearSearchResult = React.useCallback(() => {
    setSearchResult(null);
    setWordStatusMessage('');
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
    setCategoryStatusMessage('');
    if (result.error) {
      setCategorySearchError(result.error);
    } else {
      setCategorySearchError(null);
    }
  }, []);

  const clearCategorySearchResult = React.useCallback(() => {
    setCategorySearchResult(null);
    setCategorySearchError(null);
    setCategorySearchProgress(undefined); // Clear progress when clearing result
    setCategorySearchTicker(''); // Clear ticker when clearing result
    setCategoryStatusMessage('');
  }, []);

  const handleStatusMessage = React.useCallback((message: StatusMessage) => {
    if (message.source !== 'extension.search') return;
    const msg = message.payload.message || '';

    if (categorySearchLoading) {
      setCategoryStatusMessage(msg);
      // Update category search progress and ticker if available
      setCategorySearchProgress(message.payload.progress);
      if (message.payload.tickerMessage) {
        setCategorySearchTicker(message.payload.tickerMessage);
      }
      return;
    }

    // Default to word search status
    setWordStatusMessage(msg);
  }, [categorySearchLoading]);

  const clearStatusForSubtool = React.useCallback((tool: SearchSubtool) => {
    if (tool === 'category') {
      setCategoryStatusMessage('');
      setCategorySearchTicker('');
      setCategorySearchProgress(undefined);
      return;
    }
    setWordStatusMessage('');
  }, []);

  const cancelCategorySearch = React.useCallback(() => {
    setCategorySearchLoading(false);
    setCategorySearchProgress(undefined);
    setCategorySearchTicker('');
    setCategoryStatusMessage('Cancelled');
  }, []);

  const wordLoading = React.useMemo(() => loadingBySubtool.word ?? false, [loadingBySubtool]);

  return {
    // State
    searchResult,
    wordSearchTargets,
    loading: wordLoading,
    loadingBySubtool,
    sourceMode,
    pathText,
    wordStatusMessage,
    categoryStatusMessage,
    categorySearch: {
      query: categorySearchQuery,
      result: categorySearchResult,
      isLoading: categorySearchLoading,
      error: categorySearchError,
      relevance: categorySearchRelevance,
      wordLimit: categorySearchWordLimit,
      ngramMode: categorySearchNgramMode,
      minOccurrences: categorySearchMinOccurrences,
      progress: categorySearchProgress,
      tickerMessage: categorySearchTicker,
    },

    // Actions
    handleSearchResult,
    setWordSearchTargets,
    clearSearchResult,
    setLoading: (loading: boolean) => setLoadingForSubtool('word', loading), // backwards compatibility
    setLoadingForSubtool,
    clearStatusForSubtool,
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
    setCategorySearchNgramMode,
    setCategorySearchMinOccurrences,
    cancelCategorySearch,

    // Persistence
    persistedState: {
      searchResult,
      wordSearchTargets,
      searchSourceMode: sourceMode,
      searchPathText: pathText,
      wordStatusMessage,
      categoryStatusMessage,
      categorySearchQuery,
      categorySearchResult,
      categorySearchRelevance,
      categorySearchWordLimit,
      categorySearchNgramMode,
      categorySearchMinOccurrences,
    },
  };
};
