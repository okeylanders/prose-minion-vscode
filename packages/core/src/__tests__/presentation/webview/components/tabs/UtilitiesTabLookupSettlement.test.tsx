/** @jest-environment jsdom */

/**
 * Lookup settlement through the real app router (PR #144 review, Astra F-01
 * and F-02).
 *
 * The real Dictionary hooks and Utilities tab receive host messages through
 * the real `buildAppMessageRoutes`. Messages the host posts back to back are
 * delivered with one router map inside one `act`, as the webview's listener
 * handles them before React re-renders.
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { UtilitiesTab } from '@components/tabs/UtilitiesTab';
import { useDictionary } from '@hooks/domain/useDictionary';
import { useDictionaryHistory } from '@hooks/domain/useDictionaryHistory';
import { useSelection } from '@hooks/domain/useSelection';
import { useSettings } from '@hooks/domain/useSettings';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { AppMessageRouterDeps, buildAppMessageRoutes } from '@hooks/useAppMessageRouter';
import { MessageHandlerMap } from '@hooks/useMessageRouter';
import {
  DictionaryHistoryEntry,
  DictionaryHistorySummary,
  MessageType
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

type HostMessage = { type: MessageType; payload: unknown };

const UMBRA: DictionaryHistoryEntry = {
  id: 'h1',
  createdAt: '2026-10-14T12:00:00.000Z',
  request: { word: 'umbra', context: 'The eclipse deepened.', includeEncyclopedia: true, includePalettes: true, mode: 'standard' },
  modelIds: ['model/A'],
  toolName: 'dictionary_lookup',
  result: 'The darkest part of a shadow.'
};

const summaryOf = (entry: DictionaryHistoryEntry): DictionaryHistorySummary => ({
  id: entry.id,
  createdAt: entry.createdAt,
  word: entry.request.word,
  contextPreview: entry.request.context,
  includeEncyclopedia: entry.request.includeEncyclopedia,
  includePalettes: entry.request.includePalettes,
  mode: entry.request.mode,
  modelIds: entry.modelIds
});

const historyList = (...entries: DictionaryHistoryEntry[]): HostMessage => ({
  type: MessageType.DICTIONARY_HISTORY,
  payload: { entries: entries.map(summaryOf), durability: { kind: 'session', reason: 'no-workspace' }, limit: 50 }
});

const streamStarted = (requestId: string): HostMessage => ({
  type: MessageType.STREAM_STARTED,
  payload: { requestId, domain: 'dictionary' }
});

const streamChunk = (requestId: string, token: string): HostMessage => ({
  type: MessageType.STREAM_CHUNK,
  payload: { requestId, domain: 'dictionary', token }
});

const streamComplete = (requestId: string): HostMessage => ({
  type: MessageType.STREAM_COMPLETE,
  payload: { requestId, domain: 'dictionary', content: '', cancelled: false }
});

const dictionaryResult = (requestId: string, result: string, historyEntryId?: string): HostMessage => ({
  type: MessageType.DICTIONARY_RESULT,
  payload: { requestId, result, toolName: 'dictionary_lookup', ...(historyEntryId ? { historyEntryId } : {}) }
});

const historyEntry = (entry: DictionaryHistoryEntry): HostMessage => ({
  type: MessageType.DICTIONARY_HISTORY_ENTRY,
  payload: { status: 'found', entry }
});

/** Other domains' routes are never delivered here; the builder only reads their properties. */
const OTHER_DOMAINS = {
  analysis: {}, metrics: {}, context: {}, search: {}, publishingSettings: {}, wordSearchSettings: {},
  wordFrequencySettings: {}, tokensSettings: {}, themeSettings: {}, tokenTracking: {},
  contextPathsSettings: {}, modelsSettings: {}, accountBalance: {}
};

describe('UtilitiesTab lookup settlement', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  let routes: MessageHandlerMap;

  function Harness() {
    const dictionary = useDictionary();
    const dictionaryHistory = useDictionaryHistory(dictionary);
    const selection = useSelection();
    const settings = useSettings();
    routes = buildAppMessageRoutes({
      ...OTHER_DOMAINS,
      dictionary,
      dictionaryHistory,
      selection,
      settings,
      setActiveTab: jest.fn(),
      setError: jest.fn()
    } as unknown as AppMessageRouterDeps);
    return <UtilitiesTab
      vscode={vscode}
      dictionary={dictionary}
      dictionaryHistory={dictionaryHistory}
      selection={selection}
      settings={settings}
    />;
  }

  /** Messages posted back to back: one router map, no re-render in between. */
  const deliver = (...messages: HostMessage[]): void => {
    act(() => {
      const handlers = routes;
      for (const message of messages) {
        handlers[message.type]!({ ...message, source: 'extension.dictionary', timestamp: 1 } as never);
      }
    });
  };

  const wordInput = () => screen.getByPlaceholderText(/Enter the word or phrase/) as HTMLInputElement;
  const runButton = () => screen.getByRole('button', { name: 'Run Dictionary Lookup' }) as HTMLButtonElement;
  const fastButton = () => screen.getByRole('button', { name: '⚡ Experimental: Run Dictionary Lookup [Fast]' }) as HTMLButtonElement;
  const olderButton = () => screen.getByRole('button', { name: 'Previous lookup' }) as HTMLButtonElement;
  const positionLabel = () => document.querySelector('.pm-dictionary-history-position')?.textContent;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]) => message)
    .filter(message => message.type === type);
  const lastPayload = (type: MessageType) => posted(type).at(-1)?.payload;

  const typeWord = (word: string) => fireEvent.change(wordInput(), { target: { value: word } });

  /** Run a standard lookup and deliver its stream, through completion and result, as the host does. */
  const runStandardLookup = (word: string, requestId: string, result: string, historyEntryId?: string) => {
    typeWord(word);
    fireEvent.click(runButton());
    deliver(streamStarted(requestId), streamChunk(requestId, result));
    deliver(streamComplete(requestId), dictionaryResult(requestId, result, historyEntryId));
  };

  /** Hiding and showing the sidebar makes the host replay its cached DICTIONARY_RESULT. */
  const replayCachedResult = (message: HostMessage) => deliver(message);

  const restoreUmbra = () => {
    fireEvent.click(olderButton());
    expect(lastPayload(MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY)).toEqual({ id: 'h1' });
    deliver(historyEntry(UMBRA));
  };

  const copied = () => lastPayload(MessageType.COPY_RESULT)?.content as string;

  beforeEach(() => {
    vscode = createMockVSCode();
    vscode.getState.mockReturnValue({});
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('F-01: a completed lookup stays owned until its own result settles it', () => {
    it('blocks a second Run and history navigation between completion and the result', () => {
      render(<Harness />);
      deliver(historyList(UMBRA));
      typeWord('first');
      fireEvent.click(runButton());
      deliver(streamStarted('dict-1'), streamChunk('dict-1', 'First result.'));

      // The stream completes while the host is still writing history.
      deliver(streamComplete('dict-1'));

      expect(runButton().disabled).toBe(true);
      expect(fastButton().disabled).toBe(true);
      expect(olderButton().disabled).toBe(true);
      typeWord('second');
      fireEvent.click(runButton());
      fireEvent.click(olderButton());
      expect(posted(MessageType.LOOKUP_DICTIONARY)).toHaveLength(1);
      expect(posted(MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY)).toEqual([]);

      // The write finishes: the result, then the list that now includes it.
      const first: DictionaryHistoryEntry = { ...UMBRA, id: 'h2', request: { ...UMBRA.request, word: 'first', context: '' } };
      deliver(dictionaryResult('dict-1', 'First result.', 'h2'), historyList(first, UMBRA));

      expect(screen.getByText('First result.')).toBeTruthy();
      expect(runButton().disabled).toBe(false);
      expect(positionLabel()).toBe('1 / 2');
      expect(document.querySelector('.pm-dictionary-history-meta')).not.toBeNull();
      // The form now holds the newer, unsubmitted word; Copy names the lookup shown.
      expect(wordInput().value).toBe('second');
      fireEvent.click(screen.getByRole('button', { name: 'Copy dictionary entry' }));
      expect(copied()).toBe('# first\n\nFirst result.');
    });

    it('applies a result delivered right behind its completion, as the host now sends them', () => {
      render(<Harness />);

      runStandardLookup('first', 'dict-1', 'First result.', 'h2');

      expect(screen.getByText('First result.')).toBeTruthy();
      expect(runButton().disabled).toBe(false);
    });
  });

  describe('F-02: a replayed result never replaces a restored or newer view', () => {
    it.each([
      ['failed', 'Error: provider unavailable', undefined],
      ['unconfigured', '⚠️ OpenRouter API key not configured\n\nAdd your key.', undefined],
      ['recorded', 'Gloaming result.', 'h2']
    ] as const)('shows a fresh %s result, then ignores its replay after a history restore', (_label, content, entryId) => {
      render(<Harness />);
      deliver(historyList(UMBRA));
      runStandardLookup('gloaming', 'dict-1', content, entryId);
      expect(document.body.textContent).toContain(content.split('\n')[0]);

      restoreUmbra();
      replayCachedResult(dictionaryResult('dict-1', content, entryId));

      expect(screen.getByText('The darkest part of a shadow.')).toBeTruthy();
      expect(document.body.textContent).not.toContain(content.split('\n')[0]);
      expect(positionLabel()).toBe('1 / 1');
      fireEvent.click(screen.getByRole('button', { name: 'Copy dictionary entry' }));
      expect(copied()).toBe('# umbra\n\nThe darkest part of a shadow.');
      fireEvent.click(screen.getByRole('button', { name: 'Save dictionary entry' }));
      expect(lastPayload(MessageType.SAVE_RESULT)).toMatchObject({
        content: '# umbra\n\nThe darkest part of a shadow.',
        metadata: expect.objectContaining({ word: 'umbra', context: 'The eclipse deepened.' })
      });
    });

    it('ignores a replayed failure after a newer fast result', () => {
      render(<Harness />);
      runStandardLookup('gloaming', 'dict-1', 'Error: provider unavailable');

      typeWord('petrichor');
      fireEvent.click(fastButton());
      deliver({
        type: MessageType.FAST_GENERATE_DICTIONARY_RESULT,
        payload: {
          word: 'petrichor',
          result: 'Petrichor result.',
          metadata: { totalDuration: 1, blockDurations: {}, partialFailures: [], successCount: 15, totalBlocks: 15 },
          modelIds: ['model/A'],
          historyEntryId: 'h3'
        }
      });
      expect(screen.getByText('Petrichor result.')).toBeTruthy();

      replayCachedResult(dictionaryResult('dict-1', 'Error: provider unavailable'));

      expect(screen.getByText('Petrichor result.')).toBeTruthy();
      expect(document.body.textContent).not.toContain('provider unavailable');
      fireEvent.click(screen.getByRole('button', { name: 'Copy dictionary entry' }));
      expect(copied()).toBe('# petrichor\n\nPetrichor result.');
    });
  });
});
