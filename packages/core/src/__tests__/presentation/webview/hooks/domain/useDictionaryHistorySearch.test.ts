/**
 * @jest-environment jsdom
 */

/**
 * useDictionaryHistorySearch (ADR 2026-10-14, the 2026-11-14 search
 * amendment): debounced, correlated by request id, and never showing an
 * answer to a query the popup has moved past.
 */

import { act, renderHook } from '@testing-library/react';
import {
  DictionaryHistoryDefinitionMatch,
  DictionaryHistorySearchResultMessage,
  DictionaryHistorySearchResultPayload,
  MessageType
} from '@messages';
import { DICTIONARY_HISTORY_SEARCH_DEBOUNCE_MS } from '@shared/constants/dictionaryHistory';
import {
  DictionaryHistorySearchActions,
  DictionaryHistorySearchPersistence,
  DictionaryHistorySearchState,
  useDictionaryHistorySearch
} from '@hooks/domain/useDictionaryHistorySearch';
import { useDictionary } from '@hooks/domain/useDictionary';
import { useDictionaryHistory } from '@hooks/domain/useDictionaryHistory';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');
jest.mock('@hooks/usePersistence');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';

const match = (id: string, hit: string): DictionaryHistoryDefinitionMatch => ({
  id,
  snippet: { before: '…as the ', hit, after: ' were.' }
});

const answer = (payload: DictionaryHistorySearchResultPayload): DictionaryHistorySearchResultMessage => ({
  type: MessageType.DICTIONARY_HISTORY_SEARCH_RESULT,
  source: 'extension.dictionary',
  payload,
  timestamp: 1
});

describe('useDictionaryHistorySearch', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  const searches = (): { requestId: string; query: string }[] =>
    vscode.postMessage.mock.calls.map(([message]) => message)
      .filter(message => message.type === MessageType.SEARCH_DICTIONARY_HISTORY)
      .map(message => message.payload);
  const waitOutDebounce = () => act(() => {
    jest.advanceTimersByTime(DICTIONARY_HISTORY_SEARCH_DEBOUNCE_MS);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    (usePersistedState as jest.Mock).mockReturnValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('keeps the tripartite interfaces explicit and persists nothing', () => {
    const persistence: DictionaryHistorySearchPersistence = {};
    const { result } = renderHook(() => useDictionaryHistorySearch());
    const state: DictionaryHistorySearchState = result.current;
    const actions: DictionaryHistorySearchActions = result.current;

    expect(state.definitionSearch).toEqual({ status: 'idle', query: '', matches: [] });
    expect(typeof actions.searchDefinitions).toBe('function');
    expect(result.current.persistedState).toEqual(persistence);
  });

  it('waits out the debounce, then asks once with a request id', () => {
    const { result } = renderHook(() => useDictionaryHistorySearch());

    act(() => result.current.searchDefinitions('toves'));
    expect(result.current.definitionSearch).toEqual({ status: 'searching', query: 'toves', matches: [] });
    act(() => {
      jest.advanceTimersByTime(DICTIONARY_HISTORY_SEARCH_DEBOUNCE_MS - 1);
    });
    expect(searches()).toEqual([]);

    waitOutDebounce();
    expect(searches()).toHaveLength(1);
    expect(searches()[0].query).toBe('toves');
    expect(searches()[0].requestId).toMatch(/^dhs-[a-z0-9]+:1$/);
    expect(vscode.postMessage.mock.calls[0][0].source).toBe('webview.dictionary.history.search');
  });

  it('sends only the last query of a burst of typing', () => {
    const { result } = renderHook(() => useDictionaryHistorySearch());

    for (const query of ['t', 'to', 'tov', 'toves']) {
      act(() => result.current.searchDefinitions(query));
      act(() => {
        jest.advanceTimersByTime(DICTIONARY_HISTORY_SEARCH_DEBOUNCE_MS / 2);
      });
    }
    waitOutDebounce();

    expect(searches().map(search => search.query)).toEqual(['toves']);
  });

  it('takes the answer it waits for', () => {
    const { result } = renderHook(() => useDictionaryHistorySearch());
    act(() => result.current.searchDefinitions('toves'));
    waitOutDebounce();

    const matches = [match('h3', 'toves')];
    act(() => result.current.handleHistorySearchResult(answer({ requestId: searches()[0].requestId, status: 'found', matches })));

    expect(result.current.definitionSearch).toEqual({ status: 'found', query: 'toves', matches });
  });

  it('never shows a stale answer: a newer query supersedes an older request', () => {
    const { result } = renderHook(() => useDictionaryHistorySearch());
    act(() => result.current.searchDefinitions('toves'));
    waitOutDebounce();
    const [first] = searches();

    // The writer types on before the first answer comes; it is dropped even before the second request leaves.
    act(() => result.current.searchDefinitions('borogoves'));
    act(() => result.current.handleHistorySearchResult(answer({ requestId: first.requestId, status: 'found', matches: [match('h3', 'toves')] })));
    expect(result.current.definitionSearch).toEqual({ status: 'searching', query: 'borogoves', matches: [] });

    waitOutDebounce();
    const [, second] = searches();
    expect(second.requestId).not.toBe(first.requestId);

    // Answers out of order: the old one again, then the one waited for.
    act(() => result.current.handleHistorySearchResult(answer({ requestId: first.requestId, status: 'found', matches: [match('h3', 'toves')] })));
    expect(result.current.definitionSearch.status).toBe('searching');
    const matches = [match('h2', 'borogoves')];
    act(() => result.current.handleHistorySearchResult(answer({ requestId: second.requestId, status: 'found', matches })));
    expect(result.current.definitionSearch).toEqual({ status: 'found', query: 'borogoves', matches });

    // And an answer is taken once.
    act(() => result.current.handleHistorySearchResult(answer({ requestId: second.requestId, status: 'failed' })));
    expect(result.current.definitionSearch.status).toBe('found');
  });

  it('drops a pending answer when the search is turned off', () => {
    const { result } = renderHook(() => useDictionaryHistorySearch());
    act(() => result.current.searchDefinitions('toves'));
    waitOutDebounce();

    act(() => result.current.cancelDefinitionSearch());
    act(() => result.current.handleHistorySearchResult(answer({ requestId: searches()[0].requestId, status: 'found', matches: [match('h3', 'toves')] })));

    expect(result.current.definitionSearch).toEqual({ status: 'idle', query: '', matches: [] });
  });

  it('sends nothing when the search is turned off inside the debounce', () => {
    const { result } = renderHook(() => useDictionaryHistorySearch());
    act(() => result.current.searchDefinitions('toves'));
    act(() => result.current.cancelDefinitionSearch());
    waitOutDebounce();

    expect(searches()).toEqual([]);
    expect(result.current.definitionSearch.status).toBe('idle');
  });

  it('treats an empty query as turning the search off', () => {
    const { result } = renderHook(() => useDictionaryHistorySearch());
    act(() => result.current.searchDefinitions('toves'));
    act(() => result.current.searchDefinitions(''));
    waitOutDebounce();

    expect(searches()).toEqual([]);
    expect(result.current.definitionSearch.status).toBe('idle');
  });

  it('says so when the host could not search', () => {
    const { result } = renderHook(() => useDictionaryHistorySearch());
    act(() => result.current.searchDefinitions('toves'));
    waitOutDebounce();

    act(() => result.current.handleHistorySearchResult(answer({ requestId: searches()[0].requestId, status: 'failed' })));

    expect(result.current.definitionSearch).toEqual({ status: 'failed', query: 'toves', matches: [] });
  });

  it('ignores an answer when nothing is waited for', () => {
    const { result } = renderHook(() => useDictionaryHistorySearch());
    act(() => result.current.handleHistorySearchResult(answer({ requestId: 'dhs-other:1', status: 'found', matches: [match('h1', 'toves')] })));
    expect(result.current.definitionSearch.status).toBe('idle');
  });

  it('posts nothing after it unmounts', () => {
    const { result, unmount } = renderHook(() => useDictionaryHistorySearch());
    act(() => result.current.searchDefinitions('toves'));
    unmount();
    jest.advanceTimersByTime(DICTIONARY_HISTORY_SEARCH_DEBOUNCE_MS * 2);

    expect(searches()).toEqual([]);
  });

  it('rides along with the history hook, which still persists only its cursor', () => {
    const { result } = renderHook(() => useDictionaryHistory(useDictionary()));

    act(() => result.current.searchDefinitions('toves'));
    waitOutDebounce();
    act(() => result.current.handleHistorySearchResult(answer({ requestId: searches()[0].requestId, status: 'found', matches: [match('h3', 'toves')] })));

    expect(result.current.definitionSearch.status).toBe('found');
    expect(result.current.persistedState).toEqual({ dictionaryHistoryCursorId: null });
    expect(JSON.stringify(result.current.persistedState)).not.toContain('toves');
  });
});
