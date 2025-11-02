/**
 * useSearch - Domain hook for word search functionality
 *
 * Manages search results and word search targets state.
 */

import * as React from 'react';
import { usePersistedState } from '../usePersistence';
import { SearchResultMessage, TextSourceMode } from '../../../../shared/types';

export interface SearchState {
  searchResult: any | null;
  wordSearchTargets: string;
  loading: boolean;
  sourceMode: TextSourceMode;
  pathText: string;
}

export interface SearchActions {
  handleSearchResult: (message: SearchResultMessage) => void;
  setWordSearchTargets: (targets: string) => void;
  clearSearchResult: () => void;
  setLoading: (loading: boolean) => void;
  handleActiveFile: (message: any) => void;
  handleManuscriptGlobs: (message: any) => void;
  handleChapterGlobs: (message: any) => void;
  setSourceMode: (mode: TextSourceMode) => void;
  setPathText: (text: string) => void;
}

export interface SearchPersistence {
  searchResult: any | null;
  wordSearchTargets: string;
  searchSourceMode: TextSourceMode;
  searchPathText: string;
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

  const handleSearchResult = React.useCallback((message: SearchResultMessage) => {
    setSearchResult(message.payload.result);
    setLoading(false);
  }, []);

  const clearSearchResult = React.useCallback(() => {
    setSearchResult(null);
  }, []);

  const handleActiveFile = React.useCallback((message: any) => {
    setPathText(message.relativePath ?? '');
  }, []);

  const handleManuscriptGlobs = React.useCallback((message: any) => {
    setPathText(message.globs ?? '');
  }, []);

  const handleChapterGlobs = React.useCallback((message: any) => {
    setPathText(message.globs ?? '');
  }, []);

  return {
    // State
    searchResult,
    wordSearchTargets,
    loading,
    sourceMode,
    pathText,

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

    // Persistence
    persistedState: {
      searchResult,
      wordSearchTargets,
      searchSourceMode: sourceMode,
      searchPathText: pathText,
    },
  };
};
