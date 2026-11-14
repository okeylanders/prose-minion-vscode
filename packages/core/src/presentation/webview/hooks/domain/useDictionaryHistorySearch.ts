/**
 * useDictionaryHistorySearch - "Also search definitions" in the lookup history
 * popup (ADR 2026-10-14, the 2026-11-14 search amendment).
 *
 * The popup filters words, context and file names itself. Result bodies stay
 * on the host (D5), so searching them is a request, and this hook owns it:
 *
 * - **Debounced.** A query is sent once the writer has stopped typing for
 *   `DICTIONARY_HISTORY_SEARCH_DEBOUNCE_MS`.
 * - **Correlated.** Each request carries an id minted here, the host echoes
 *   it, and only the answer still waited for is taken. A newer query, or
 *   turning the search off, stops waiting at once (before anything is sent),
 *   so an answer to an earlier query is never shown.
 * - **Never whole bodies.** The answer is ids and a short snippet each.
 *
 * Nothing here is persisted: the query is the popup's own, for as long as it
 * is open.
 */

import * as React from 'react';
import {
  DictionaryHistoryDefinitionMatch,
  DictionaryHistorySearchResultMessage,
  MessageType
} from '@messages';
import { DICTIONARY_HISTORY_SEARCH_DEBOUNCE_MS } from '@shared/constants/dictionaryHistory';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

const SOURCE = 'webview.dictionary.history.search';

/** What the host has said about one query's definitions. */
export interface DictionaryHistoryDefinitionSearch {
  /** `idle`: nothing asked. `searching`: waiting. `found`: `matches` answer `query`. `failed`: the host could not. */
  status: 'idle' | 'searching' | 'found' | 'failed';
  /** The query this is about, as it was asked; `''` when idle. */
  query: string;
  /** Empty unless `found`. */
  matches: DictionaryHistoryDefinitionMatch[];
}

export interface DictionaryHistorySearchState {
  definitionSearch: DictionaryHistoryDefinitionSearch;
}

export interface DictionaryHistorySearchActions {
  /** Ask the host for the entries whose definition holds `query`; an empty query cancels. */
  searchDefinitions: (query: string) => void;
  /** Stop waiting and forget any answer (the toggle went off, or the popup closed). */
  cancelDefinitionSearch: () => void;
  handleHistorySearchResult: (message: DictionaryHistorySearchResultMessage) => void;
}

/** The search is the open popup's; nothing of it outlives the popup. */
export type DictionaryHistorySearchPersistence = Record<string, never>;

export type UseDictionaryHistorySearchReturn = DictionaryHistorySearchState & DictionaryHistorySearchActions & {
  persistedState: DictionaryHistorySearchPersistence;
};

const IDLE: DictionaryHistoryDefinitionSearch = { status: 'idle', query: '', matches: [] };
const NO_PERSISTENCE: DictionaryHistorySearchPersistence = {};

export const useDictionaryHistorySearch = (): UseDictionaryHistorySearchReturn => {
  const vscode = useVSCodeApi();
  const [definitionSearch, setDefinitionSearch] = React.useState<DictionaryHistoryDefinitionSearch>(IDLE);

  // Request ids: this webview's prefix (so a reloaded webview never mistakes
  // an answer meant for the one before it) and a running count.
  const idPrefix = React.useRef(`dhs-${Math.random().toString(36).slice(2, 10)}`);
  const minted = React.useRef(0);
  /** The one answer still waited for; `undefined` while debouncing and when idle. */
  const pending = React.useRef<string | undefined>(undefined);
  const debounce = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stopWaiting = React.useCallback(() => {
    if (debounce.current !== undefined) {
      clearTimeout(debounce.current);
      debounce.current = undefined;
    }
    pending.current = undefined;
  }, []);

  const cancelDefinitionSearch = React.useCallback(() => {
    stopWaiting();
    setDefinitionSearch(current => (current.status === 'idle' ? current : IDLE));
  }, [stopWaiting]);

  const searchDefinitions = React.useCallback((query: string) => {
    if (query.length === 0) {
      cancelDefinitionSearch();
      return;
    }
    // An answer to another query is not this one's: stop waiting for it now, not when this one is sent.
    stopWaiting();
    setDefinitionSearch({ status: 'searching', query, matches: [] });
    debounce.current = setTimeout(() => {
      debounce.current = undefined;
      minted.current += 1;
      const requestId = `${idPrefix.current}:${minted.current}`;
      pending.current = requestId;
      vscode.postMessage({
        type: MessageType.SEARCH_DICTIONARY_HISTORY,
        source: SOURCE,
        payload: { requestId, query },
        timestamp: Date.now()
      });
    }, DICTIONARY_HISTORY_SEARCH_DEBOUNCE_MS);
  }, [cancelDefinitionSearch, stopWaiting, vscode]);

  const handleHistorySearchResult = React.useCallback((message: DictionaryHistorySearchResultMessage) => {
    const payload = message.payload;
    if (!payload || pending.current === undefined || payload.requestId !== pending.current) {
      return;
    }
    pending.current = undefined;
    const matches = payload.status === 'found' && Array.isArray(payload.matches) ? payload.matches : null;
    setDefinitionSearch(current => (matches
      ? { status: 'found', query: current.query, matches }
      : { status: 'failed', query: current.query, matches: [] }));
  }, []);

  // A timer left running would post after the hook is gone.
  React.useEffect(() => stopWaiting, [stopWaiting]);

  return {
    // State
    definitionSearch,

    // Actions
    searchDefinitions,
    cancelDefinitionSearch,
    handleHistorySearchResult,

    // Persistence
    persistedState: NO_PERSISTENCE
  };
};
