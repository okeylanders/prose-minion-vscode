/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { UtilitiesTab } from '@components/tabs/UtilitiesTab';
import { useDictionary } from '@hooks/domain/useDictionary';
import { UseDictionaryHistoryReturn, useDictionaryHistory } from '@hooks/domain/useDictionaryHistory';
import { useSelection } from '@hooks/domain/useSelection';
import { useSettings } from '@hooks/domain/useSettings';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import {
  DictionaryHistoryEntry,
  DictionaryHistorySummary,
  DictionaryLookupRequest,
  MessageType
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

const ENCYCLOPEDIA_SWITCH = 'Topic & Related Lexicon Encyclopedia entry';
const PALETTES_SWITCH = 'Chromatic Palettes Color swatches';
const RUN_LOOKUP = 'Run Dictionary Lookup';
const RUN_FAST = '⚡ Experimental: Run Dictionary Lookup [Fast]';

describe('UtilitiesTab dictionary section options', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  function DictionaryHarness() {
    const dictionary = useDictionary();
    const dictionaryHistory = useDictionaryHistory(dictionary);
    const selection = useSelection();
    const settings = useSettings();

    return <>
      <button onClick={() => selection.handleSelectionUpdated({
        type: MessageType.SELECTION_UPDATED,
        source: 'extension.editor',
        payload: { text: 'copper', target: 'dictionary', autoRun: true },
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

  beforeEach(() => {
    vscode = createMockVSCode();
    vscode.getState.mockReturnValue({
      dictionaryWord: 'copper',
      dictionaryContext: 'The copper pot glowed.'
    });
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [ENCYCLOPEDIA_SWITCH, 'to the end of this entry'],
    [PALETTES_SWITCH, 'short definition']
  ])('provides an accessible %s switch with a clear explanation and visible on/off state', (name, description) => {
    render(<DictionaryHarness />);

    const toggle = screen.getByRole('switch', { name });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(within(toggle).getByText('On')).toBeTruthy();
    expect(document.getElementById(toggle.getAttribute('aria-describedby')!)?.textContent)
      .toContain(description);

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(within(toggle).getByText('Off')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('toggles each section independently', () => {
    render(<DictionaryHarness />);

    fireEvent.click(screen.getByRole('switch', { name: PALETTES_SWITCH }));

    expect(screen.getByRole('switch', { name: PALETTES_SWITCH }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: ENCYCLOPEDIA_SWITCH }).getAttribute('aria-checked')).toBe('true');
  });

  it.each([
    [RUN_LOOKUP, MessageType.LOOKUP_DICTIONARY, true, true],
    [RUN_LOOKUP, MessageType.LOOKUP_DICTIONARY, false, true],
    [RUN_LOOKUP, MessageType.LOOKUP_DICTIONARY, true, false],
    [RUN_LOOKUP, MessageType.LOOKUP_DICTIONARY, false, false],
    [RUN_FAST, MessageType.FAST_GENERATE_DICTIONARY, true, true],
    [RUN_FAST, MessageType.FAST_GENERATE_DICTIONARY, false, true],
    [RUN_FAST, MessageType.FAST_GENERATE_DICTIONARY, true, false],
    [RUN_FAST, MessageType.FAST_GENERATE_DICTIONARY, false, false]
  ] as const)(
    '%s sends %s with encyclopedia %s and palettes %s',
    (buttonName, type, includeEncyclopedia, includePalettes) => {
      render(<DictionaryHarness />);
      const encyclopedia = screen.getByRole('switch', { name: ENCYCLOPEDIA_SWITCH });
      const palettes = screen.getByRole('switch', { name: PALETTES_SWITCH });
      if (!includeEncyclopedia) {
        fireEvent.click(encyclopedia);
      }
      if (!includePalettes) {
        fireEvent.click(palettes);
      }

      fireEvent.click(screen.getByRole('button', { name: buttonName }));

      expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type,
        payload: expect.objectContaining({ word: 'copper', includeEncyclopedia, includePalettes })
      }));
      expect((encyclopedia as HTMLButtonElement).disabled).toBe(true);
      expect((palettes as HTMLButtonElement).disabled).toBe(true);
    }
  );

  it.each([
    [false, true],
    [true, false]
  ])(
    'honors saved encyclopedia %s and palettes %s for an editor context-menu lookup',
    (includeEncyclopedia, includePalettes) => {
      vscode.getState.mockReturnValue({
        dictionaryIncludeEncyclopedia: includeEncyclopedia,
        dictionaryIncludePalettes: includePalettes
      });
      render(<DictionaryHarness />);

      fireEvent.click(screen.getByRole('button', { name: 'Look up from editor' }));

      const lookups = vscode.postMessage.mock.calls
        .filter(([message]) => message.type === MessageType.FAST_GENERATE_DICTIONARY);
      expect(lookups).toHaveLength(1);
      expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.FAST_GENERATE_DICTIONARY,
        payload: expect.objectContaining({ word: 'copper', includeEncyclopedia, includePalettes })
      }));
    }
  );
});

describe('UtilitiesTab chromatic palette rendering', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  function DictionaryHarness() {
    const dictionary = useDictionary();
    const dictionaryHistory = useDictionaryHistory(dictionary);
    const selection = useSelection();
    const settings = useSettings();
    return <UtilitiesTab
      vscode={vscode}
      dictionary={dictionary}
      dictionaryHistory={dictionaryHistory}
      selection={selection}
      settings={settings}
    />;
  }

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders palette fences in the dictionary result as named, defined swatches', () => {
    vscode.getState.mockReturnValue({
      dictionaryWord: 'copper',
      utilitiesResult: [
        '# 🧠 AI Advisory Notes',
        '- Hex values are approximations.',
        '',
        '# 🎨 Chromatic Palettes',
        '',
        '```pm-palette',
        'title: Aged Copper & Patina',
        'kind: literal',
        'note: Oxidation and weathering.',
        'Verdigris | #43B3AE | the blue-green crust that forms on weathered copper, brass, and bronze',
        'Ecru | #C2B280 | the grayish-yellow of unbleached linen; French for "raw"',
        '```',
        '',
        '```js',
        'const untouched = true;',
        '```'
      ].join('\n')
    });

    render(<DictionaryHarness />);

    expect(screen.getByText('Verdigris')).toBeTruthy();
    expect(screen.getByText('the blue-green crust that forms on weathered copper, brass, and bronze')).toBeTruthy();
    expect(screen.getByText('#43B3AE')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Ecru, #C2B280, rgb(194, 178, 128)' })).toBeTruthy();
    expect(screen.getByText('Hex values are approximations.')).toBeTruthy();
    expect(document.querySelector('pre code')?.textContent).toContain('const untouched = true;');
    expect(document.querySelector('code.language-pm-palette')).toBeNull();
  });
});

describe('UtilitiesTab dictionary history', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  const SUMMARIES: DictionaryHistorySummary[] = [
    { id: 'h3', createdAt: '2026-10-14T12:00:00.000Z', word: 'petrichor', contextPreview: '', includeEncyclopedia: true, includePalettes: true, mode: 'standard', modelIds: ['test/model'] },
    { id: 'h2', createdAt: '2026-10-13T12:00:00.000Z', word: 'geosmin', contextPreview: '', includeEncyclopedia: true, includePalettes: true, mode: 'fast', modelIds: [] },
    { id: 'h1', createdAt: '2026-10-12T12:00:00.000Z', word: 'umbra', contextPreview: '', includeEncyclopedia: true, includePalettes: true, mode: 'standard', modelIds: [] }
  ];
  const PETRICHOR: DictionaryHistoryEntry = {
    id: 'h3',
    createdAt: '2026-10-14T12:00:00.000Z',
    request: {
      word: 'petrichor',
      context: 'Rain on hot stone.',
      includeEncyclopedia: true,
      includePalettes: true,
      mode: 'standard',
      relativePath: 'chapters/rain.md'
    },
    modelIds: ['test/model'],
    toolName: 'dictionary_lookup',
    result: 'The smell of rain on dry earth.'
  };

  const onSubject = jest.fn();
  const onBegin = jest.fn();

  /** Real hooks, with spies on the two submit-path calls and buttons that play host replies. */
  function HistoryHarness() {
    const dictionary = useDictionary();
    const dictionaryHistory = useDictionaryHistory(dictionary);
    const selection = useSelection();
    const settings = useSettings();
    const spiedDictionary = {
      ...dictionary,
      setLookupSubject: (subject: DictionaryLookupRequest | null) => {
        onSubject(subject);
        dictionary.setLookupSubject(subject);
      }
    };
    const spiedHistory = {
      ...dictionaryHistory,
      beginNewLookup: () => {
        onBegin();
        dictionaryHistory.beginNewLookup();
      }
    };

    return <>
      <button onClick={() => dictionaryHistory.handleHistory({
        type: MessageType.DICTIONARY_HISTORY,
        source: 'extension.dictionary',
        payload: { entries: SUMMARIES, durability: { kind: 'session', reason: 'no-workspace' }, limit: 50 },
        timestamp: 1
      })}>Host sends list</button>
      <button onClick={() => dictionaryHistory.handleHistoryEntry({
        type: MessageType.DICTIONARY_HISTORY_ENTRY,
        source: 'extension.dictionary',
        payload: { status: 'found', entry: PETRICHOR },
        timestamp: 1
      })}>Host sends petrichor</button>
      <button onClick={() => selection.handleSelectionUpdated({
        type: MessageType.SELECTION_UPDATED,
        source: 'extension.editor',
        payload: { text: 'verdigris', target: 'dictionary', autoRun: true },
        timestamp: 1
      }, () => {})}>Look up from editor</button>
      <UtilitiesTab
        vscode={vscode}
        dictionary={spiedDictionary}
        dictionaryHistory={spiedHistory}
        selection={selection}
        settings={settings}
      />
    </>;
  }

  /** A history model with every action stubbed, for rendering fixed nav states. */
  const stubHistory = (overrides: Partial<UseDictionaryHistoryReturn> = {}): UseDictionaryHistoryReturn => ({
    entries: SUMMARIES,
    durability: { kind: 'project', displayPath: 'prose-minion/history/dictionary.json' },
    limit: 50,
    cursorId: null,
    pendingEntryId: null,
    draft: null,
    navigationLocked: false,
    canGoOlder: true,
    canGoNewer: false,
    position: { index: null, total: 3 },
    cursorSummary: null,
    olderSummary: SUMMARIES[0],
    newerSummary: null,
    requestHistory: jest.fn(),
    handleHistory: jest.fn(),
    handleHistoryEntry: jest.fn(),
    goOlder: jest.fn(),
    goNewer: jest.fn(),
    openEntry: jest.fn(),
    deleteEntry: jest.fn(),
    clearHistory: jest.fn(),
    followRecordedEntry: jest.fn(),
    beginNewLookup: jest.fn(),
    persistedState: { dictionaryHistoryCursorId: null },
    ...overrides
  });

  function StubHarness({ history }: { history: UseDictionaryHistoryReturn }) {
    const dictionary = useDictionary();
    const selection = useSelection();
    const settings = useSettings();
    return <UtilitiesTab
      vscode={vscode}
      dictionary={dictionary}
      dictionaryHistory={history}
      selection={selection}
      settings={settings}
    />;
  }

  const older = () => screen.getByRole('button', { name: 'Previous lookup' }) as HTMLButtonElement;
  const newer = () => screen.getByRole('button', { name: 'Next lookup' }) as HTMLButtonElement;
  const positionLabel = () => document.querySelector('.pm-dictionary-history-position');
  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]) => message)
    .filter(message => message.type === type);

  beforeEach(() => {
    vscode = createMockVSCode();
    vscode.getState.mockReturnValue({
      dictionaryWord: 'copper',
      dictionaryContext: 'The copper pot glowed.',
      dictionarySourceUri: 'file:///novel/chapters/kitchen.md',
      dictionaryRelativePath: 'chapters/kitchen.md'
    });
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the nav cluster beside the title, with the position label hidden until there is history', () => {
    render(<HistoryHarness />);

    expect(screen.getByRole('heading', { name: 'Utilities · Dictionary' })).toBeTruthy();
    expect(older().disabled).toBe(true);
    expect(newer().disabled).toBe(true);
    expect(positionLabel()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Host sends list' }));

    expect(positionLabel()?.textContent).toBe('— / 3');
    expect(older().disabled).toBe(false);
    expect(older().title).toBe('Previous lookup: petrichor');
    expect(newer().disabled).toBe(true);
  });

  it('disables ‹ at the oldest entry and › at the newest entry without a draft', () => {
    const { rerender } = render(<StubHarness history={stubHistory({
      cursorId: 'h1', position: { index: 3, total: 3 }, canGoOlder: false, canGoNewer: true,
      olderSummary: null, newerSummary: SUMMARIES[1]
    })} />);

    expect(positionLabel()?.textContent).toBe('3 / 3');
    expect(older().disabled).toBe(true);
    expect(newer().disabled).toBe(false);
    expect(newer().title).toBe('Next lookup: geosmin');

    rerender(<StubHarness history={stubHistory({
      cursorId: 'h3', position: { index: 1, total: 3 }, canGoOlder: true, canGoNewer: false,
      olderSummary: SUMMARIES[1], newerSummary: null
    })} />);

    expect(positionLabel()?.textContent).toBe('1 / 3');
    expect(older().disabled).toBe(false);
    expect(newer().disabled).toBe(true);
  });

  it('names the stashed draft as the target of › from the newest entry', () => {
    render(<StubHarness history={stubHistory({
      cursorId: 'h3', position: { index: 1, total: 3 }, canGoNewer: true, newerSummary: null,
      draft: {
        word: 'copper', context: '', includeEncyclopedia: true, includePalettes: true,
        sourceUri: '', relativePath: '', result: '', toolName: undefined, lookupSubject: null
      }
    })} />);

    expect(newer().title).toBe('Next lookup: copper (unsaved)');
  });

  it('disables both buttons while a lookup is generating', () => {
    render(<HistoryHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Host sends list' }));
    expect(older().disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Run Dictionary Lookup' }));

    expect(older().disabled).toBe(true);
    expect(newer().disabled).toBe(true);
  });

  it('steps through history with ‹ and ›', () => {
    const history = stubHistory({ canGoNewer: true, cursorId: 'h2', position: { index: 2, total: 3 } });
    render(<StubHarness history={history} />);

    fireEvent.click(older());
    fireEvent.click(newer());

    expect(history.goOlder).toHaveBeenCalledTimes(1);
    expect(history.goNewer).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Run Dictionary Lookup', MessageType.LOOKUP_DICTIONARY, 'standard', { contextText: 'The copper pot glowed.' }],
    ['⚡ Experimental: Run Dictionary Lookup [Fast]', MessageType.FAST_GENERATE_DICTIONARY, 'fast', { context: 'The copper pot glowed.' }]
  ] as const)('%s sends its source, records its subject, and starts a new lookup', (button, type, mode, contextField) => {
    render(<HistoryHarness />);

    fireEvent.click(screen.getByRole('button', { name: button }));

    expect(posted(type)).toEqual([expect.objectContaining({
      payload: expect.objectContaining({
        word: 'copper',
        ...contextField,
        sourceUri: 'file:///novel/chapters/kitchen.md',
        relativePath: 'chapters/kitchen.md'
      })
    })]);
    expect(onSubject).toHaveBeenCalledWith({
      word: 'copper',
      context: 'The copper pot glowed.',
      includeEncyclopedia: true,
      includePalettes: true,
      mode,
      sourceUri: 'file:///novel/chapters/kitchen.md',
      relativePath: 'chapters/kitchen.md'
    });
    expect(onBegin).toHaveBeenCalledTimes(1);
  });

  it('the editor context-menu lookup also records its subject and starts a new lookup', () => {
    render(<HistoryHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Look up from editor' }));

    expect(onSubject).toHaveBeenCalledWith(expect.objectContaining({ word: 'verdigris', mode: 'fast' }));
    expect(onBegin).toHaveBeenCalledTimes(1);
    expect(posted(MessageType.FAST_GENERATE_DICTIONARY)).toHaveLength(1);
  });

  it('restores an entry and shows where it came from', () => {
    render(<HistoryHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Host sends list' }));
    expect(document.querySelector('.pm-dictionary-history-meta')).toBeNull();

    fireEvent.click(older());
    expect(posted(MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY)).toEqual([
      expect.objectContaining({ payload: { id: 'h3' } })
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Host sends petrichor' }));

    expect((screen.getByPlaceholderText(/Enter the word or phrase/) as HTMLInputElement).value).toBe('petrichor');
    expect(screen.getByText('Source: chapters/rain.md')).toBeTruthy();
    expect(screen.getByText('The smell of rain on dry earth.')).toBeTruthy();
    expect(positionLabel()?.textContent).toBe('1 / 3');
    const meta = document.querySelector('.pm-dictionary-history-meta')?.textContent ?? '';
    expect(meta.startsWith('From history · ')).toBe(true);
    expect(meta.endsWith(' · Standard · test/model')).toBe(true);
  });

  it('labels a fast entry and omits an unknown model on the meta line', () => {
    render(<StubHarness history={stubHistory({ cursorId: 'h2', cursorSummary: SUMMARIES[1], position: { index: 2, total: 3 } })} />);

    const meta = document.querySelector('.pm-dictionary-history-meta')?.textContent ?? '';
    expect(meta.endsWith(' · ⚡ Fast')).toBe(true);
    expect(meta.split(' · ')).toHaveLength(3);
  });

  it('names the restored lookup in the Copy and Save headers even after the form is edited', () => {
    render(<HistoryHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Host sends list' }));
    fireEvent.click(older());
    fireEvent.click(screen.getByRole('button', { name: 'Host sends petrichor' }));
    fireEvent.change(screen.getByPlaceholderText(/Enter the word or phrase/), { target: { value: 'geosmin' } });

    fireEvent.click(screen.getByRole('button', { name: 'Copy dictionary entry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save dictionary entry' }));

    expect(posted(MessageType.COPY_RESULT)[0].payload.content.startsWith('# petrichor\n')).toBe(true);
    const save = posted(MessageType.SAVE_RESULT)[0].payload;
    expect(save.content.startsWith('# petrichor\n')).toBe(true);
    expect(save.metadata).toEqual(expect.objectContaining({ word: 'petrichor', context: 'Rain on hot stone.' }));
  });

  it('opens the lookup history popup from the position button', () => {
    render(<StubHarness history={stubHistory({ cursorId: 'h2', position: { index: 2, total: 3 } })} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Lookup history' }));

    const dialog = screen.getByRole('dialog', { name: 'Lookup history' });
    expect(within(dialog).getByRole('button', { name: 'Open lookup: petrichor' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Open lookup: umbra' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Open lookup: geosmin' }).getAttribute('aria-current')).toBe('true');
  });

  it('restores a lookup chosen in the popup and closes it', () => {
    const history = stubHistory();
    render(<StubHarness history={history} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lookup history' }));

    fireEvent.click(screen.getByRole('button', { name: 'Open lookup: umbra' }));

    expect(history.openEntry).toHaveBeenCalledWith('h1');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('deletes and clears through the history model', () => {
    const history = stubHistory();
    render(<StubHarness history={history} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lookup history' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete lookup: geosmin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(history.deleteEntry).toHaveBeenCalledWith('h2');
    expect(history.clearHistory).toHaveBeenCalledTimes(1);
  });

  it('locks row selection in the popup while a lookup is generating', () => {
    render(<StubHarness history={stubHistory({ navigationLocked: true, canGoOlder: false })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lookup history' }));

    expect((screen.getByRole('button', { name: 'Open lookup: petrichor' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Delete lookup: petrichor' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps the popup open on its empty state after the last entry is cleared', () => {
    const { rerender } = render(<StubHarness history={stubHistory()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lookup history' }));

    rerender(<StubHarness history={stubHistory({ entries: [], position: { index: null, total: 0 }, canGoOlder: false, olderSummary: null })} />);

    expect(screen.getByRole('dialog', { name: 'Lookup history' })).toBeTruthy();
    expect(screen.getByText(/No lookups yet/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close lookup history' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lookup history' })).toBeNull();
  });

  it('falls back to the normalized form word in the Copy header when nothing was looked up', () => {
    vscode.getState.mockReturnValue({ dictionaryWord: '  copper   pot ', utilitiesResult: 'A shiny metal.' });
    render(<HistoryHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy dictionary entry' }));

    expect(posted(MessageType.COPY_RESULT)[0].payload.content.startsWith('# copper pot\n')).toBe(true);
  });
});
