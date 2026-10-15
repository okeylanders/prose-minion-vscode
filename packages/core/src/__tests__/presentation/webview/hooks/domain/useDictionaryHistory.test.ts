/**
 * @jest-environment jsdom
 */

/**
 * useDictionaryHistory (ADR 2026-10-14, D5 and D6)
 *
 * Driven against the real useDictionary, so a restore is checked by what the
 * tab would show, not by which setter was called.
 */

import { act, renderHook } from '@testing-library/react';
import {
  DictionaryHistoryEntry,
  DictionaryHistoryEntryMessage,
  DictionaryHistoryMessage,
  DictionaryHistorySummary,
  MessageType
} from '@messages';
import { useDictionary } from '@hooks/domain/useDictionary';
import {
  DictionaryHistoryActions,
  DictionaryHistoryPersistence,
  DictionaryHistoryState,
  useDictionaryHistory
} from '@hooks/domain/useDictionaryHistory';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');
jest.mock('@hooks/usePersistence');

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { usePersistedState } from '@hooks/usePersistence';

const summary = (id: string, word: string, overrides: Partial<DictionaryHistorySummary> = {}): DictionaryHistorySummary => ({
  id,
  createdAt: '2026-10-14T12:00:00.000Z',
  word,
  contextPreview: '',
  includeEncyclopedia: true,
  includePalettes: true,
  mode: 'standard',
  modelIds: [],
  ...overrides
});

const SUMMARIES = [summary('h3', 'petrichor'), summary('h2', 'geosmin'), summary('h1', 'umbra')];

const entryFor = (id: string, word: string): DictionaryHistoryEntry => ({
  id,
  createdAt: '2026-10-14T12:00:00.000Z',
  request: {
    word,
    context: `${word} context`,
    includeEncyclopedia: false,
    includePalettes: true,
    mode: 'standard',
    relativePath: `${word}.md`
  },
  modelIds: ['test/model'],
  toolName: 'dictionary_lookup',
  result: `# ${word} result`
});

const historyMessage = (entries: DictionaryHistorySummary[]): DictionaryHistoryMessage => ({
  type: MessageType.DICTIONARY_HISTORY,
  source: 'extension.dictionary',
  payload: {
    entries,
    durability: { kind: 'project', displayPath: 'prose-minion/history/dictionary.json' },
    limit: 50
  },
  timestamp: 1
});

const foundMessage = (entry: DictionaryHistoryEntry): DictionaryHistoryEntryMessage => ({
  type: MessageType.DICTIONARY_HISTORY_ENTRY,
  source: 'extension.dictionary',
  payload: { status: 'found', entry },
  timestamp: 1
});

const missingMessage = (id: string): DictionaryHistoryEntryMessage => ({
  type: MessageType.DICTIONARY_HISTORY_ENTRY,
  source: 'extension.dictionary',
  payload: { status: 'missing', id },
  timestamp: 1
});

describe('useDictionaryHistory', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  const renderHistory = () => renderHook(() => {
    const dictionary = useDictionary();
    const history = useDictionaryHistory(dictionary);
    return { dictionary, history };
  });

  const postedOfType = (type: MessageType) =>
    vscode.postMessage.mock.calls.map(([message]) => message).filter(message => message.type === type);

  /** Mount with the list loaded, type a live draft, and step older onto h3. */
  const renderOnNewestEntry = () => {
    const rendered = renderHistory();
    act(() => rendered.result.current.history.handleHistory(historyMessage(SUMMARIES)));
    act(() => rendered.result.current.dictionary.setWord('live draft'));
    act(() => rendered.result.current.history.goOlder());
    act(() => rendered.result.current.history.handleHistoryEntry(foundMessage(entryFor('h3', 'petrichor'))));
    return rendered;
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    (usePersistedState as jest.Mock).mockReturnValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the tripartite interfaces explicit', () => {
    const persistence: DictionaryHistoryPersistence = { dictionaryHistoryCursorId: null };
    const { result } = renderHistory();
    const state: DictionaryHistoryState = result.current.history;
    const actions: DictionaryHistoryActions = result.current.history;

    expect(state.entries).toEqual([]);
    expect(state.durability).toBeNull();
    expect(typeof actions.goOlder).toBe('function');
    expect(result.current.history.persistedState).toEqual(persistence);
  });

  it('requests the history list on mount', () => {
    renderHistory();

    expect(postedOfType(MessageType.REQUEST_DICTIONARY_HISTORY)).toEqual([
      expect.objectContaining({ payload: {}, source: 'webview.dictionary.history' })
    ]);
  });

  it('takes entries, durability, and limit from the host list', () => {
    const { result } = renderHistory();

    act(() => result.current.history.handleHistory(historyMessage(SUMMARIES)));

    expect(result.current.history.entries).toEqual(SUMMARIES);
    expect(result.current.history.durability).toEqual({ kind: 'project', displayPath: 'prose-minion/history/dictionary.json' });
    expect(result.current.history.limit).toBe(50);
    expect(result.current.history.position).toEqual({ index: null, total: 3 });
    expect(result.current.history.canGoOlder).toBe(true);
    expect(result.current.history.canGoNewer).toBe(false);
    expect(result.current.history.olderSummary?.word).toBe('petrichor');
  });

  it('stashes the live view as the draft and requests the newest entry when stepping older', () => {
    const { result } = renderHistory();
    act(() => result.current.history.handleHistory(historyMessage(SUMMARIES)));
    act(() => {
      result.current.dictionary.setWord('live draft');
      result.current.dictionary.setContext('unsent context');
    });

    act(() => result.current.history.goOlder());

    expect(result.current.history.draft).toEqual(expect.objectContaining({ word: 'live draft', context: 'unsent context' }));
    expect(result.current.history.pendingEntryId).toBe('h3');
    expect(postedOfType(MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY)).toEqual([
      expect.objectContaining({ payload: { id: 'h3' } })
    ]);
  });

  it('restores an arriving entry into the tab and moves the cursor onto it', () => {
    const { result } = renderOnNewestEntry();
    const { dictionary, history } = result.current;

    expect(history.cursorId).toBe('h3');
    expect(history.pendingEntryId).toBeNull();
    expect(history.cursorSummary?.word).toBe('petrichor');
    expect(history.position).toEqual({ index: 1, total: 3 });
    expect(dictionary.word).toBe('petrichor');
    expect(dictionary.context).toBe('petrichor context');
    expect(dictionary.includeEncyclopedia).toBe(false);
    expect(dictionary.relativePath).toBe('petrichor.md');
    expect(dictionary.result).toBe('# petrichor result');
    expect(dictionary.lookupSubject?.word).toBe('petrichor');
    expect(history.olderSummary?.word).toBe('geosmin');
    expect(history.canGoNewer).toBe(true);
  });

  it('does not stash a clean entry when stepping on', () => {
    const { result } = renderOnNewestEntry();
    const draft = result.current.history.draft;

    act(() => result.current.history.goOlder());

    expect(result.current.history.draft).toBe(draft);
    expect(result.current.history.pendingEntryId).toBe('h2');
  });

  it('stashes an edited entry, because the form no longer matches its result', () => {
    const { result } = renderOnNewestEntry();
    act(() => result.current.dictionary.setWord('petrichor revised'));

    act(() => result.current.history.goOlder());

    expect(result.current.history.draft?.word).toBe('petrichor revised');
    expect(result.current.history.draft?.result).toBe('# petrichor result');
  });

  it('applies only the latest load: a stale entry reply is ignored', () => {
    const { result } = renderHistory();
    act(() => result.current.history.handleHistory(historyMessage(SUMMARIES)));
    act(() => result.current.dictionary.setWord('live draft'));

    act(() => result.current.history.goOlder());
    act(() => result.current.history.goOlder());

    expect(result.current.history.pendingEntryId).toBe('h2');
    expect(result.current.history.draft?.word).toBe('live draft');

    act(() => result.current.history.handleHistoryEntry(foundMessage(entryFor('h3', 'petrichor'))));
    expect(result.current.dictionary.word).toBe('live draft');
    expect(result.current.history.cursorId).toBeNull();

    act(() => result.current.history.handleHistoryEntry(foundMessage(entryFor('h2', 'geosmin'))));
    expect(result.current.dictionary.word).toBe('geosmin');
    expect(result.current.history.cursorId).toBe('h2');
  });

  it('clears the pending load and asks for the list again when the entry is missing', () => {
    const { result } = renderHistory();
    act(() => result.current.history.handleHistory(historyMessage(SUMMARIES)));
    act(() => result.current.history.goOlder());
    vscode.postMessage.mockClear();

    act(() => result.current.history.handleHistoryEntry(missingMessage('h3')));

    expect(result.current.history.pendingEntryId).toBeNull();
    expect(postedOfType(MessageType.REQUEST_DICTIONARY_HISTORY)).toHaveLength(1);
  });

  it('keeps a newer pending load when a stale missing reply arrives', () => {
    const { result } = renderHistory();
    act(() => result.current.history.handleHistory(historyMessage(SUMMARIES)));
    act(() => result.current.history.goOlder());
    act(() => result.current.history.goOlder());

    act(() => result.current.history.handleHistoryEntry(missingMessage('h3')));

    expect(result.current.history.pendingEntryId).toBe('h2');
  });

  it('restores the draft and returns to live when stepping newer from the newest entry', () => {
    const { result } = renderOnNewestEntry();
    vscode.postMessage.mockClear();

    act(() => result.current.history.goNewer());

    expect(result.current.dictionary.word).toBe('live draft');
    expect(result.current.dictionary.result).toBe('');
    expect(result.current.dictionary.lookupSubject).toBeNull();
    expect(result.current.history.cursorId).toBeNull();
    expect(result.current.history.draft).toBeNull();
    expect(result.current.history.canGoNewer).toBe(false);
    expect(vscode.postMessage).not.toHaveBeenCalled();
  });

  it('restores the draft over a load still in flight, and ignores that load when it lands', () => {
    const { result } = renderOnNewestEntry();
    act(() => result.current.history.goOlder());
    act(() => result.current.history.handleHistoryEntry(foundMessage(entryFor('h2', 'geosmin'))));

    act(() => result.current.history.goNewer());
    act(() => result.current.history.goNewer());
    expect(result.current.dictionary.word).toBe('live draft');

    act(() => result.current.history.handleHistoryEntry(foundMessage(entryFor('h3', 'petrichor'))));
    expect(result.current.dictionary.word).toBe('live draft');
    expect(result.current.history.cursorId).toBeNull();
  });

  it('opens a specific entry with the same stash-then-load rule', () => {
    const { result } = renderHistory();
    act(() => result.current.history.handleHistory(historyMessage(SUMMARIES)));
    act(() => result.current.dictionary.setWord('live draft'));

    act(() => result.current.history.openEntry('h1'));

    expect(result.current.history.draft?.word).toBe('live draft');
    expect(result.current.history.pendingEntryId).toBe('h1');
    expect(postedOfType(MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY)).toEqual([
      expect.objectContaining({ payload: { id: 'h1' } })
    ]);
  });

  it('beginNewLookup clears the cursor, the pending load, and the draft', () => {
    const { result } = renderOnNewestEntry();
    act(() => result.current.history.goOlder());

    act(() => result.current.history.beginNewLookup());

    expect(result.current.history.cursorId).toBeNull();
    expect(result.current.history.pendingEntryId).toBeNull();
    expect(result.current.history.draft).toBeNull();
  });

  it('resets a cursor and a pending load the new list no longer holds', () => {
    const { result } = renderOnNewestEntry();
    act(() => result.current.history.goOlder());

    act(() => result.current.history.handleHistory(historyMessage([summary('h1', 'umbra')])));

    expect(result.current.history.cursorId).toBeNull();
    expect(result.current.history.pendingEntryId).toBeNull();
    expect(result.current.history.cursorSummary).toBeNull();
    expect(result.current.history.draft?.word).toBe('live draft');
  });

  it('drops the draft when the history becomes empty', () => {
    const { result } = renderOnNewestEntry();

    act(() => result.current.history.handleHistory(historyMessage([])));

    expect(result.current.history.draft).toBeNull();
    expect(result.current.history.position).toEqual({ index: null, total: 0 });
  });

  it('keeps a just-followed cursor when the list that names it arrives before a re-render', () => {
    const { result } = renderHistory();
    act(() => result.current.history.handleHistory(historyMessage(SUMMARIES)));
    const { history } = result.current;

    // DICTIONARY_RESULT then DICTIONARY_HISTORY, handled from one render's closures.
    act(() => {
      history.followRecordedEntry('h4');
      history.handleHistory(historyMessage([summary('h4', 'sillage'), ...SUMMARIES]));
    });

    expect(result.current.history.cursorId).toBe('h4');
    expect(result.current.history.cursorSummary?.word).toBe('sillage');
    expect(result.current.history.position).toEqual({ index: 1, total: 4 });
  });

  it('follows an unrecorded result as live and remembers which entries it followed', () => {
    const { result } = renderOnNewestEntry();

    act(() => result.current.history.followRecordedEntry('h4'));
    expect(result.current.history.cursorId).toBe('h4');
    expect(result.current.history.hasFollowedEntry('h4')).toBe(true);
    expect(result.current.history.hasFollowedEntry('h3')).toBe(false);
    expect(result.current.history.hasFollowedEntry(undefined)).toBe(false);

    act(() => result.current.history.followRecordedEntry(undefined));
    expect(result.current.history.cursorId).toBeNull();
  });

  it('ignores navigation while a lookup is generating', () => {
    const { result } = renderHistory();
    act(() => result.current.history.handleHistory(historyMessage(SUMMARIES)));
    act(() => result.current.dictionary.setLoading(true));
    vscode.postMessage.mockClear();

    expect(result.current.history.navigationLocked).toBe(true);
    expect(result.current.history.canGoOlder).toBe(false);

    act(() => result.current.history.goOlder());
    act(() => result.current.history.openEntry('h1'));

    expect(vscode.postMessage).not.toHaveBeenCalled();
    expect(result.current.history.pendingEntryId).toBeNull();
    expect(result.current.history.draft).toBeNull();
  });

  it('persists the cursor id and seeds it on the next mount', () => {
    const first = renderOnNewestEntry();
    expect(first.result.current.history.persistedState).toEqual({ dictionaryHistoryCursorId: 'h3' });
    first.unmount();

    (usePersistedState as jest.Mock).mockReturnValue({ dictionaryHistoryCursorId: 'h3' });
    const { result } = renderHistory();

    expect(result.current.history.cursorId).toBe('h3');
    act(() => result.current.history.handleHistory(historyMessage(SUMMARIES)));
    expect(result.current.history.cursorSummary?.word).toBe('petrichor');
  });

  it('posts delete and clear, and clearing drops the draft at once', () => {
    const { result } = renderOnNewestEntry();

    act(() => result.current.history.deleteEntry('h2'));
    act(() => result.current.history.clearHistory());

    expect(postedOfType(MessageType.DELETE_DICTIONARY_HISTORY_ENTRY)).toEqual([
      expect.objectContaining({ payload: { id: 'h2' } })
    ]);
    expect(postedOfType(MessageType.CLEAR_DICTIONARY_HISTORY)).toEqual([
      expect.objectContaining({ payload: {} })
    ]);
    expect(result.current.history.draft).toBeNull();
  });
});
