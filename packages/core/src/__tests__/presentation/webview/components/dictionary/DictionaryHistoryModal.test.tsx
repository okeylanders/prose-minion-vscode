/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DictionaryHistoryModal,
  DictionaryHistoryModalProps
} from '@components/dictionary/DictionaryHistoryModal';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';
import { DICTIONARY_HISTORY_DISPLAY_PATH, DICTIONARY_HISTORY_LIMIT } from '@shared/constants/dictionaryHistory';
import { DictionaryHistoryDurability, DictionaryHistorySummary } from '@messages';

const NOW = new Date(2026, 9, 14, 18, 30);

const summary = (overrides: Partial<DictionaryHistorySummary> & { id: string; word: string }): DictionaryHistorySummary => ({
  createdAt: new Date(2026, 9, 14, 14, 2).toISOString(),
  contextPreview: '',
  includeEncyclopedia: false,
  includePalettes: false,
  mode: 'standard',
  modelIds: [],
  ...overrides
});

/* Newest first, as the host sends them. */
const ENTRIES: DictionaryHistorySummary[] = [
  summary({
    id: 'dict-hist-3',
    word: 'gloaming',
    createdAt: new Date(2026, 9, 14, 14, 2).toISOString(),
    mode: 'fast',
    includeEncyclopedia: true,
    includePalettes: true,
    modelIds: ['anthropic/claude-opus-4.1-with-an-unreasonably-long-routing-suffix'],
    contextPreview: 'The light went amber, then grey, then something without a name.',
    relativePath: 'chapters/03-the-marsh.md'
  }),
  summary({
    id: 'dict-hist-2',
    word: 'petrichor',
    createdAt: new Date(2026, 9, 13, 9, 15).toISOString()
  }),
  summary({
    id: 'dict-hist-1',
    word: 'susurrus',
    createdAt: new Date(2025, 9, 12, 9, 15).toISOString(),
    includeEncyclopedia: true
  })
];

const PROJECT: DictionaryHistoryDurability = { kind: 'project', displayPath: DICTIONARY_HISTORY_DISPLAY_PATH };

const renderModal = (overrides: Partial<DictionaryHistoryModalProps> = {}) => {
  const props: DictionaryHistoryModalProps = {
    open: true,
    entries: ENTRIES,
    cursorId: null,
    durability: PROJECT,
    limit: DICTIONARY_HISTORY_LIMIT,
    selectionDisabled: false,
    now: () => NOW,
    onSelect: jest.fn(),
    onDelete: jest.fn(),
    onClear: jest.fn(),
    onClose: jest.fn(),
    ...overrides
  };
  const view = render(<DictionaryHistoryModal {...props} />);
  const rerender = (next: Partial<DictionaryHistoryModalProps>) =>
    view.rerender(<DictionaryHistoryModal {...props} {...next} />);
  return { props, view, rerender };
};

const rows = () => Array.from(document.querySelectorAll<HTMLLIElement>('.pm-dictionary-history-row'));
const selectButton = (word: string) => screen.getByRole('button', { name: `Open lookup: ${word}` }) as HTMLButtonElement;
const deleteButton = (word: string) => screen.getByRole('button', { name: `Delete lookup: ${word}` }) as HTMLButtonElement;

describe('DictionaryHistoryModal', () => {
  afterEach(() => {
    cleanup();
    __resetOverlayFocusStateForTests();
  });

  it('renders nothing when closed', () => {
    const { view } = renderModal({ open: false });
    expect(view.container.innerHTML).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal dialog with a count against the limit', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Lookup history' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText('3 of 50')).toBeTruthy();
  });

  it('lists rows newest first with their times, badges, context, and source', () => {
    renderModal();
    expect(rows().map((row) => row.querySelector('.pm-dictionary-history-word')?.textContent)).toEqual([
      'gloaming',
      'petrichor',
      'susurrus'
    ]);
    expect(rows().map((row) => row.querySelector('time')?.textContent)).toEqual([
      'Today 14:02',
      'Yesterday 09:15',
      'Oct 12 2025, 09:15'
    ]);

    const [fast, standard, encyclopediaOnly] = rows();
    const badges = (row: HTMLElement) =>
      Array.from(row.querySelectorAll('.pm-dictionary-history-badge')).map((badge) => badge.textContent);

    expect(badges(fast)).toEqual([
      '⚡ Fast',
      'Encyclopedia',
      'Palettes',
      'anthropic/claude-opus-4.1-with-an-unreasonably-long-routing-suffix'
    ]);
    expect(badges(standard)).toEqual(['Standard']);
    expect(badges(encyclopediaOnly)).toEqual(['Standard', 'Encyclopedia']);

    const model = fast.querySelector('.pm-dictionary-history-model') as HTMLElement;
    expect(model.title).toBe('anthropic/claude-opus-4.1-with-an-unreasonably-long-routing-suffix');

    expect(fast.querySelector('.pm-dictionary-history-context')?.textContent).toBe(
      'The light went amber, then grey, then something without a name.'
    );
    expect(fast.querySelector('.pm-dictionary-history-source')?.textContent).toBe(
      'Source: chapters/03-the-marsh.md'
    );
    expect(standard.querySelector('.pm-dictionary-history-context')).toBeNull();
    expect(standard.querySelector('.pm-dictionary-history-source')).toBeNull();
  });

  it('describes each select button with its time and details', () => {
    renderModal();
    const button = selectButton('gloaming');
    const describedBy = (button.getAttribute('aria-describedby') ?? '').split(' ');
    const description = describedBy.map((id) => document.getElementById(id)?.textContent).join(' ');
    expect(description).toContain('Today 14:02');
    expect(description).toContain('Fast Encyclopedia Palettes');
    expect(description).toContain('Source: chapters/03-the-marsh.md');
  });

  it('marks only the cursor row as current', () => {
    renderModal({ cursorId: 'dict-hist-2' });
    expect(selectButton('petrichor').getAttribute('aria-current')).toBe('true');
    expect(selectButton('gloaming').hasAttribute('aria-current')).toBe(false);
    expect(selectButton('susurrus').hasAttribute('aria-current')).toBe(false);
    expect(rows().map((row) => row.classList.contains('is-current'))).toEqual([false, true, false]);
  });

  it('marks no row as current while the result pane is live', () => {
    renderModal({ cursorId: null });
    expect(document.querySelector('[aria-current]')).toBeNull();
  });

  it('selects an entry by id', () => {
    const { props } = renderModal();
    fireEvent.click(selectButton('petrichor'));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(props.onSelect).toHaveBeenCalledWith('dict-hist-2');
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('disables selection while a lookup is generating but keeps Delete available', () => {
    const { props } = renderModal({ selectionDisabled: true });
    expect(screen.getByText('History opens after the current lookup finishes.')).toBeTruthy();
    for (const word of ['gloaming', 'petrichor', 'susurrus']) {
      expect(selectButton(word).disabled).toBe(true);
      expect(deleteButton(word).disabled).toBe(false);
    }

    fireEvent.click(selectButton('petrichor'));
    expect(props.onSelect).not.toHaveBeenCalled();

    fireEvent.click(deleteButton('petrichor'));
    expect(props.onDelete).toHaveBeenCalledWith('dict-hist-2');
  });

  it('shows no generating note when selection is available', () => {
    renderModal();
    expect(screen.queryByText('History opens after the current lookup finishes.')).toBeNull();
  });

  it('deletes an entry by id and hands focus to the row that takes its place', () => {
    const { props, rerender } = renderModal();
    const target = deleteButton('petrichor');
    target.focus();
    fireEvent.click(target);
    expect(props.onDelete).toHaveBeenCalledWith('dict-hist-2');
    expect(props.onSelect).not.toHaveBeenCalled();

    /* The host broadcasts the shorter list; the deleted row unmounts. */
    rerender({ entries: [ENTRIES[0], ENTRIES[2]] });
    expect(document.activeElement).toBe(deleteButton('susurrus'));
  });

  it('moves focus to the close button when the last entry is deleted', () => {
    const { rerender } = renderModal({ entries: [ENTRIES[1]] });
    const target = deleteButton('petrichor');
    target.focus();
    fireEvent.click(target);

    rerender({ entries: [] });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close lookup history' }));
  });

  it('clears the history only after confirmation', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));

    expect(props.onClear).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Clear all 3 lookups?' });
    expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: 'Cancel' }));

    fireEvent.click(within(confirm).getByRole('button', { name: 'Clear' }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: /Clear all/ })).toBeNull();
  });

  it('aborts the clear on Cancel and returns focus to Clear history', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onClear).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: /Clear all/ })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear history' }));
  });

  it('words the confirmation for a single lookup', () => {
    renderModal({ entries: [ENTRIES[0]] });
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(screen.getByRole('group', { name: 'Clear 1 lookup?' })).toBeTruthy();
  });

  it('resets the clear confirmation when the modal closes', () => {
    const { rerender } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(screen.getByRole('group', { name: 'Clear all 3 lookups?' })).toBeTruthy();

    rerender({ open: false });
    rerender({ open: true });
    expect(screen.queryByRole('group', { name: /Clear all/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear history' })).toBeTruthy();
  });

  it('shows the empty state without a list or Clear control', () => {
    renderModal({ entries: [] });
    expect(screen.getByText('No lookups yet. Each completed lookup is kept here.')).toBeTruthy();
    expect(screen.getByText('0 of 50')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear history' })).toBeNull();
  });

  it.each<[string, DictionaryHistoryDurability, string]>([
    ['a project file', PROJECT, `Saved in ${DICTIONARY_HISTORY_DISPLAY_PATH}`],
    [
      'no workspace',
      { kind: 'session', reason: 'no-workspace' },
      'Not saved: open a folder to keep history across sessions'
    ],
    [
      'a multi-root workspace',
      { kind: 'session', reason: 'multi-root' },
      'Not saved: history is kept for single-folder workspaces'
    ],
    [
      'a failed write',
      { kind: 'session', reason: 'write-failed' },
      "Couldn't save history; it will last until VS Code restarts"
    ]
  ])('states where the history is kept for %s', (_label, durability, message) => {
    renderModal({ durability });
    expect(document.querySelector('.pm-dictionary-history-durability')?.textContent).toBe(message);
  });

  it('names the project file as code', () => {
    renderModal();
    expect(document.querySelector('.pm-dictionary-history-durability code')?.textContent).toBe(
      DICTIONARY_HISTORY_DISPLAY_PATH
    );
  });

  it('closes on Escape, the close button, and the overlay, but not a click inside the panel', () => {
    const { props } = renderModal();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close lookup history' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);

    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(props.onClose).toHaveBeenCalledTimes(2);

    fireEvent.mouseDown(document.querySelector('.pm-dictionary-history-backdrop') as HTMLElement);
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it('moves focus into the panel on open and back to the opener on close', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Lookup history';
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = renderModal();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close lookup history' }));
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    rerender({ open: false });
    await Promise.resolve();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
