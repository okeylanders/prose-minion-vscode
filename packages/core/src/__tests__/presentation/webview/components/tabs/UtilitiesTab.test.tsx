/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UtilitiesTab } from '@components/tabs/UtilitiesTab';
import { useDictionary } from '@hooks/domain/useDictionary';
import { useSelection } from '@hooks/domain/useSelection';
import { useSettings } from '@hooks/domain/useSettings';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

describe('UtilitiesTab encyclopedia option', () => {
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

  it('provides an accessible switch with a clear explanation and visible on/off state', () => {
    render(<DictionaryHarness />);

    const toggle = screen.getByRole('switch', { name: 'Topic & Related Lexicon Encyclopedia entry' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('On')).toBeTruthy();
    expect(document.getElementById(toggle.getAttribute('aria-describedby')!)?.textContent)
      .toContain('to the end of this entry');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Off')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it.each([
    ['Run Dictionary Lookup', MessageType.LOOKUP_DICTIONARY, true],
    ['Run Dictionary Lookup', MessageType.LOOKUP_DICTIONARY, false],
    ['⚡ Experimental: Run Dictionary Lookup [Fast]', MessageType.FAST_GENERATE_DICTIONARY, true],
    ['⚡ Experimental: Run Dictionary Lookup [Fast]', MessageType.FAST_GENERATE_DICTIONARY, false]
  ] as const)('%s sends %s with encyclopedia inclusion %s', (buttonName, type, includeEncyclopedia) => {
    render(<DictionaryHarness />);
    const toggle = screen.getByRole('switch');
    if (!includeEncyclopedia) {
      fireEvent.click(toggle);
    }

    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type,
      payload: expect.objectContaining({ word: 'copper', includeEncyclopedia })
    }));
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([false, true])('honors saved encyclopedia inclusion %s for an editor context-menu lookup', (includeEncyclopedia) => {
    vscode.getState.mockReturnValue({ dictionaryIncludeEncyclopedia: includeEncyclopedia });
    render(<DictionaryHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Look up from editor' }));

    expect(vscode.postMessage).toHaveBeenCalledTimes(1);
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.FAST_GENERATE_DICTIONARY,
      payload: expect.objectContaining({ word: 'copper', includeEncyclopedia })
    }));
  });
});
