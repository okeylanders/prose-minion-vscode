/** @jest-environment jsdom */

/**
 * The "looked up before" check (ADR 2026-10-14, D9).
 *
 * Real Dictionary hooks and the real Utilities tab, with buttons that play
 * the host's replies. Every submit path (Run, ⚡ Fast, right-click auto-run)
 * offers a phrase already in history back to the writer before spending a
 * generation on it.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UtilitiesTab } from '@components/tabs/UtilitiesTab';
import { useDictionary } from '@hooks/domain/useDictionary';
import { useDictionaryHistory } from '@hooks/domain/useDictionaryHistory';
import { useSelection } from '@hooks/domain/useSelection';
import { useSettings } from '@hooks/domain/useSettings';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { DictionaryHistoryEntry, DictionaryHistorySummary, MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

const RUN_LOOKUP = 'Run Dictionary Lookup';
const RUN_FAST = '⚡ Experimental: Run Dictionary Lookup [Fast]';
const PROMPT = { name: /You've looked up/ };

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

const LUMINOUS_NEW = summary('h3', 'luminous', { mode: 'fast', contextPreview: 'The moon on the water.' });
const UMBRA = summary('h2', 'umbra');
const LUMINOUS_OLD = summary('h1', 'Luminous');
const SUMMARIES = [LUMINOUS_NEW, UMBRA, LUMINOUS_OLD];

const LUMINOUS_ENTRY: DictionaryHistoryEntry = {
  id: 'h3',
  createdAt: LUMINOUS_NEW.createdAt,
  request: { word: 'luminous', context: 'The moon on the water.', includeEncyclopedia: true, includePalettes: true, mode: 'fast' },
  modelIds: [],
  toolName: 'dictionary_fast_generate',
  result: 'Giving off light.'
};

describe('UtilitiesTab prior-lookup check', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  function Harness({ editorWord = 'luminous' }: { editorWord?: string }) {
    const dictionary = useDictionary();
    const dictionaryHistory = useDictionaryHistory(dictionary);
    const selection = useSelection();
    const settings = useSettings();

    return <>
      <button onClick={() => dictionaryHistory.handleHistory({
        type: MessageType.DICTIONARY_HISTORY,
        source: 'extension.dictionary',
        payload: { entries: SUMMARIES, durability: { kind: 'session', reason: 'no-workspace' }, limit: 500 },
        timestamp: 1
      })}>Host sends list</button>
      <button onClick={() => dictionaryHistory.handleHistory({
        type: MessageType.DICTIONARY_HISTORY,
        source: 'extension.dictionary',
        payload: { entries: [UMBRA], durability: { kind: 'session', reason: 'no-workspace' }, limit: 500 },
        timestamp: 1
      })}>Host deletes luminous</button>
      <button onClick={() => dictionaryHistory.handleHistoryEntry({
        type: MessageType.DICTIONARY_HISTORY_ENTRY,
        source: 'extension.dictionary',
        payload: { status: 'found', entry: LUMINOUS_ENTRY },
        timestamp: 1
      })}>Host sends luminous</button>
      <button onClick={() => selection.handleSelectionUpdated({
        type: MessageType.SELECTION_UPDATED,
        source: 'extension.editor',
        payload: {
          text: editorWord, target: 'dictionary', autoRun: true,
          sourceUri: 'file:///novel/chapters/moon.md', relativePath: 'chapters/moon.md'
        },
        timestamp: 1
      }, () => {})}>Look up from editor</button>
      <UtilitiesTab
        vscode={vscode}
        dictionary={dictionary}
        dictionaryHistory={dictionaryHistory}
        selection={selection}
        settings={settings}
      />
    </>;
  }

  const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
  const prompt = () => screen.queryByRole('region', PROMPT);
  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]) => message)
    .filter(message => message.type === type);
  const lookupsPosted = () => [
    ...posted(MessageType.LOOKUP_DICTIONARY),
    ...posted(MessageType.FAST_GENERATE_DICTIONARY)
  ];

  beforeEach(() => {
    vscode = createMockVSCode();
    vscode.getState.mockReturnValue({ dictionaryWord: '  LUMINOUS ', dictionaryContext: 'Her face in the lamplight.' });
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('offers the newest recorded entry instead of running a phrase already in history', () => {
    render(<Harness />);
    click('Host sends list');

    click(RUN_LOOKUP);

    expect(lookupsPosted()).toEqual([]);
    const region = prompt();
    expect(region?.textContent).toContain("You've looked up luminous before");
    expect(region?.textContent).toContain('⚡ Fast · 2 lookups in history');
    expect(region?.textContent).toContain('The moon on the water.');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open latest entry' }));
  });

  it('opens the newest match without generating anything', () => {
    render(<Harness />);
    click('Host sends list');
    click(RUN_LOOKUP);

    click('Open latest entry');

    expect(posted(MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY)).toEqual([
      expect.objectContaining({ payload: { id: 'h3' } })
    ]);
    expect(lookupsPosted()).toEqual([]);
    expect(prompt()).toBeNull();
  });

  it.each([
    [RUN_LOOKUP, MessageType.LOOKUP_DICTIONARY, { contextText: 'Her face in the lamplight.' }],
    [RUN_FAST, MessageType.FAST_GENERATE_DICTIONARY, { context: 'Her face in the lamplight.' }]
  ] as const)('Look up again after %s runs that mode against the form', (button, type, contextField) => {
    render(<Harness />);
    click('Host sends list');
    click(button);

    click('Look up again');

    expect(lookupsPosted()).toEqual([expect.objectContaining({
      type,
      payload: expect.objectContaining({ word: 'LUMINOUS', ...contextField })
    })]);
    expect(prompt()).toBeNull();
  });

  it('says "existing entry" when the phrase was looked up once', () => {
    vscode.getState.mockReturnValue({ dictionaryWord: 'umbra' });
    render(<Harness />);
    click('Host sends list');

    click(RUN_LOOKUP);

    expect(prompt()?.textContent).not.toContain('lookups in history');
    click('Open existing entry');
    expect(posted(MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY)).toEqual([
      expect.objectContaining({ payload: { id: 'h2' } })
    ]);
  });

  it('runs a phrase that is not in history straight away', () => {
    vscode.getState.mockReturnValue({ dictionaryWord: 'petrichor' });
    render(<Harness />);
    click('Host sends list');

    click(RUN_LOOKUP);

    expect(posted(MessageType.LOOKUP_DICTIONARY)).toHaveLength(1);
    expect(prompt()).toBeNull();
  });

  it('reruns without asking when the result pane already shows that phrase', () => {
    render(<Harness />);
    click('Host sends list');
    click('Previous lookup');
    click('Host sends luminous');

    click(RUN_LOOKUP);

    expect(posted(MessageType.LOOKUP_DICTIONARY)).toHaveLength(1);
    expect(prompt()).toBeNull();
  });

  it('dismisses on the Dismiss button, on Escape, and when the word is edited', () => {
    render(<Harness />);
    click('Host sends list');

    click(RUN_LOOKUP);
    click('Dismiss');
    expect(prompt()).toBeNull();

    click(RUN_LOOKUP);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Open latest entry' }), { key: 'Escape' });
    expect(prompt()).toBeNull();

    click(RUN_LOOKUP);
    fireEvent.change(screen.getByPlaceholderText(/Enter the word or phrase/), { target: { value: 'luminou' } });
    expect(prompt()).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/Enter the word or phrase/), { target: { value: 'luminous' } });
    expect(prompt()).toBeNull();
    expect(lookupsPosted()).toEqual([]);
  });

  it('withdraws the offer when its entries leave the history', () => {
    render(<Harness />);
    click('Host sends list');
    click(RUN_LOOKUP);

    click('Host deletes luminous');

    expect(prompt()).toBeNull();
  });

  it('offers the prior entry for a right-click lookup instead of auto-running it', () => {
    render(<Harness />);
    click('Host sends list');

    click('Look up from editor');

    expect(lookupsPosted()).toEqual([]);
    expect(prompt()).not.toBeNull();

    click('Look up again');
    expect(posted(MessageType.FAST_GENERATE_DICTIONARY)).toEqual([
      expect.objectContaining({ payload: expect.objectContaining({
        word: 'luminous', sourceUri: 'file:///novel/chapters/moon.md', relativePath: 'chapters/moon.md'
      }) })
    ]);
  });

  it('still auto-runs a right-click lookup of a new phrase', () => {
    render(<Harness editorWord="verdigris" />);
    click('Host sends list');

    click('Look up from editor');

    expect(posted(MessageType.FAST_GENERATE_DICTIONARY)).toHaveLength(1);
    expect(prompt()).toBeNull();
  });
});
