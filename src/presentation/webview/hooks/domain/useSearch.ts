/**
 * useSearch - Domain hook for word search functionality
 *
 * Manages search results and word search targets state.
 */

import * as React from 'react';
import { usePersistedState } from '../usePersistence';
import { TextSourceMode } from '../../../../shared/types';
import {
  SearchResultMessage,
  ActiveFileMessage,
  ManuscriptGlobsMessage,
  ChapterGlobsMessage,
  CategorySearchResultMessage,
  CategorySearchResult,
  CategorySearchOptions
} from '../../../../shared/types/messages';

export interface CategorySearchState {
  query: string;
  result: CategorySearchResult | null;
  isLoading: boolean;
  error: string | null;
}

export interface SearchState {
  searchResult: any | null;
  wordSearchTargets: string;
  loading: boolean;
  sourceMode: TextSourceMode;
  pathText: string;
  categorySearch: CategorySearchState;
}

export interface SearchActions {
  handleSearchResult: (message: SearchResultMessage) => void;
  setWordSearchTargets: (targets: string) => void;
  clearSearchResult: () => void;
  setLoading: (loading: boolean) => void;
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
}

export interface SearchPersistence {
  searchResult: any | null;
  wordSearchTargets: string;
  searchSourceMode: TextSourceMode;
  searchPathText: string;
  categorySearchQuery: string;
  categorySearchResult: CategorySearchResult | null;
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
    categorySearchQuery?: string;
    categorySearchResult?: CategorySearchResult | null;
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

  // Category search state
  const [categorySearchQuery, setCategorySearchQuery] = React.useState<string>(
    persisted?.categorySearchQuery ?? ''
  );
  const [categorySearchResult, setCategorySearchResult] = React.useState<CategorySearchResult | null>(
    persisted?.categorySearchResult ?? null
  );
  const [categorySearchLoading, setCategorySearchLoading] = React.useState<boolean>(false);
  const [categorySearchError, setCategorySearchError] = React.useState<string | null>(null);

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
    if (result.error) {
      setCategorySearchError(result.error);
    } else {
      setCategorySearchError(null);
    }
  }, []);

  const clearCategorySearchResult = React.useCallback(() => {
    setCategorySearchResult(null);
    setCategorySearchError(null);
  }, []);

  return {
    // State
    searchResult,
    wordSearchTargets,
    loading,
    sourceMode,
    pathText,
    categorySearch: {
      query: categorySearchQuery,
      result: categorySearchResult,
      isLoading: categorySearchLoading,
      error: categorySearchError,
    },

    // Actions
    handleSearchResult,
    setWordSearchTargets,
    clearSearchResult,
    setLoading,
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

    // Persistence
    persistedState: {
      searchResult,
      wordSearchTargets,
      searchSourceMode: sourceMode,
      searchPathText: pathText,
      categorySearchQuery,
      categorySearchResult,
    },
  };
};
