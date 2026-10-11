/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { UtilitiesTab } from '@components/tabs/UtilitiesTab';
import { useDictionary } from '@hooks/domain/useDictionary';
import { useSelection } from '@hooks/domain/useSelection';
import { useSettings } from '@hooks/domain/useSettings';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { MessageType } from '@messages';
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
    const selection = useSelection();
    const settings = useSettings();

    return <>
      <button onClick={() => selection.handleSelectionUpdated({
        type: MessageType.SELECTION_UPDATED,
        source: 'extension.editor',
        payload: { text: 'copper', target: 'dictionary', autoRun: true },
        timestamp: 1
      }, () => {})}>Look up from editor</button>
      <UtilitiesTab vscode={vscode} dictionary={dictionary} selection={selection} settings={settings} />
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

      expect(vscode.postMessage).toHaveBeenCalledTimes(1);
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
    const selection = useSelection();
    const settings = useSettings();
    return <UtilitiesTab vscode={vscode} dictionary={dictionary} selection={selection} settings={settings} />;
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
