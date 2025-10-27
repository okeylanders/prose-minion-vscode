/**
 * useSearch - Domain hook for word search functionality
 *
 * Manages search results and word search targets state.
 */

import * as React from 'react';
import { usePersistedState } from '../usePersistence';
import { SearchResultMessage } from '../../../../shared/types';

export interface SearchState {
  searchResult: any | null;
  wordSearchTargets: string;
}

export interface SearchActions {
  handleSearchResult: (message: SearchResultMessage) => void;
  setWordSearchTargets: (targets: string) => void;
  clearSearchResult: () => void;
}

export interface SearchPersistence {
  searchResult: any | null;
  wordSearchTargets: string;
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
  const persisted = usePersistedState<{ searchResult?: any; wordSearchTargets?: string }>();

  const [searchResult, setSearchResult] = React.useState<any | null>(
    persisted?.searchResult ?? null
  );
  const [wordSearchTargets, setWordSearchTargets] = React.useState<string>(
    persisted?.wordSearchTargets ?? ''
  );

  const handleSearchResult = React.useCallback((message: SearchResultMessage) => {
    setSearchResult(message.result);
  }, []);

  const clearSearchResult = React.useCallback(() => {
    setSearchResult(null);
  }, []);

  return {
    // State
    searchResult,
    wordSearchTargets,

    // Actions
    handleSearchResult,
    setWordSearchTargets,
    clearSearchResult,

    // Persistence
    persistedState: {
      searchResult,
      wordSearchTargets,
    },
  };
};
