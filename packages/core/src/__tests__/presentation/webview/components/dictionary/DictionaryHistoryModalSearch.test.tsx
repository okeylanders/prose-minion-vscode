/**
 * @jest-environment jsdom
 */

/**
 * The lookup history popup's search (ADR 2026-10-14, the 2026-11-14 search
 * amendment): the filter and its count, the marks, the definitions toggle,
 * and the keyboard path.
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  DictionaryHistoryModal,
  DictionaryHistoryModalProps
} from '@components/dictionary/DictionaryHistoryModal';
import type { DictionaryHistoryDefinitionSearch } from '@hooks/domain/useDictionaryHistorySearch';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';
import { DICTIONARY_HISTORY_DISPLAY_PATH, DICTIONARY_HISTORY_LIMIT } from '@shared/constants/dictionaryHistory';
import { DictionaryHistorySummary } from '@messages';

const NOW = new Date(2026, 10, 14, 18, 30);

const summary = (id: string, word: string, overrides: Partial<DictionaryHistorySummary> = {}): DictionaryHistorySummary => ({
  id,
  createdAt: new Date(2026, 10, 14, 14, 2).toISOString(),
  word,
  contextPreview: '',
  includeEncyclopedia: false,
  includePalettes: false,
  mode: 'standard',
  modelIds: [],
  ...overrides
});

/* Newest first. Made-up Alice words and paths. */
const ENTRIES: DictionaryHistorySummary[] = [
  summary('h4', 'Slithy', { contextPreview: 'The toves were slithy that afternoon.', relativePath: 'chapters/alice-ch3.md' }),
  summary('h3', 'mimsy', { contextPreview: 'All mimsy were the borogoves.', relativePath: 'chapters/alice-ch1.md' }),
  summary('h2', 'café au lait'),
  summary('h1', 'frabjous')
];

const IDLE: DictionaryHistoryDefinitionSearch = { status: 'idle', query: '', matches: [] };

const renderModal = (overrides: Partial<DictionaryHistoryModalProps> = {}) => {
  const props: DictionaryHistoryModalProps = {
    open: true,
    entries: ENTRIES,
    cursorId: null,
    durability: { kind: 'project', displayPath: DICTIONARY_HISTORY_DISPLAY_PATH },
    limit: DICTIONARY_HISTORY_LIMIT,
    selectionDisabled: false,
    definitionSearch: IDLE,
    onSearchDefinitions: jest.fn(),
    onCancelDefinitionSearch: jest.fn(),
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

const field = () => screen.getByRole('searchbox', { name: 'Search lookup history' }) as HTMLInputElement;
const toggle = () => screen.getByRole('checkbox', { name: 'Also search definitions' }) as HTMLInputElement;
const type = (query: string) => fireEvent.change(field(), { target: { value: query } });
const words = () => Array.from(document.querySelectorAll('.pm-dictionary-history-word')).map(word => word.textContent);
const marks = () => Array.from(document.querySelectorAll('mark')).map(mark => mark.textContent);
const status = () => screen.getByRole('status').textContent;
const selectButton = (word: string) => screen.getByRole('button', { name: `Open lookup: ${word}` }) as HTMLButtonElement;
const deleteButton = (word: string) => screen.getByRole('button', { name: `Delete lookup: ${word}` }) as HTMLButtonElement;

describe('DictionaryHistoryModal search', () => {
  afterEach(() => {
    cleanup();
    __resetOverlayFocusStateForTests();
  });

  describe('the filter', () => {
    it('shows every row and no count until something is typed', () => {
      renderModal();
      expect(words()).toEqual(['Slithy', 'mimsy', 'café au lait', 'frabjous']);
      expect(status()).toBe('');
      expect(marks()).toEqual([]);
    });

    it('filters by word, context and file name as the writer types, with a count', () => {
      renderModal();

      type('frab');
      expect(words()).toEqual(['frabjous']);
      expect(status()).toBe('1 of 4 matches');

      type('borogoves');
      expect(words()).toEqual(['mimsy']);

      type('alice-ch');
      expect(words()).toEqual(['Slithy', 'mimsy']);
      expect(status()).toBe('2 of 4 match');
    });

    it('ignores case and accents', () => {
      renderModal();
      type('SLITHY');
      expect(words()).toEqual(['Slithy']);
      type('Cafe');
      expect(words()).toEqual(['café au lait']);
    });

    it('marks the hits in each row', () => {
      renderModal();
      type('slithy');
      expect(marks()).toEqual(['Slithy', 'slithy']);
      type('alice-ch3');
      expect(marks()).toEqual(['alice-ch3']);
      expect(document.querySelector('.pm-dictionary-history-source')?.textContent).toBe('Source: chapters/alice-ch3.md');
    });

    it('shows what was typed as text, never as markup', () => {
      const entries = [summary('h1', '<img src=x onerror=alert(1)>', { contextPreview: '<b>bold</b> tove' })];
      renderModal({ entries });
      type('<b>');
      expect(document.querySelector('.pm-dictionary-history-row img')).toBeNull();
      expect(document.querySelector('.pm-dictionary-history-row b')).toBeNull();
      expect(marks()).toEqual(['<b>']);
      expect(document.querySelector('.pm-dictionary-history-context')?.textContent).toBe('<b>bold</b> tove');
    });

    it('says when nothing matches, and keeps the count against the limit in the head', () => {
      renderModal();
      type('jabberwock');
      expect(screen.getByText('No lookups match.')).toBeTruthy();
      expect(screen.queryByRole('list')).toBeNull();
      expect(status()).toBe('0 of 4 match');
      expect(screen.getByText('4 of 500')).toBeTruthy();
    });

    it('asks the host for nothing while only the filter is used', () => {
      const { props } = renderModal();
      type('slithy');
      expect(props.onSearchDefinitions).not.toHaveBeenCalled();
    });

    it('forgets the query when the popup closes', () => {
      const { rerender } = renderModal();
      type('slithy');
      rerender({ open: false });
      rerender({ open: true });
      expect(field().value).toBe('');
      expect(words()).toHaveLength(4);
    });
  });

  describe('Also search definitions', () => {
    it('asks the host for the query, folded and bounded, only when it is on', () => {
      const { props } = renderModal();
      type('  The TOVES  ');
      expect(props.onSearchDefinitions).not.toHaveBeenCalled();

      fireEvent.click(toggle());
      expect(props.onSearchDefinitions).toHaveBeenLastCalledWith('the toves');

      type('Café');
      expect(props.onSearchDefinitions).toHaveBeenLastCalledWith('cafe');
    });

    it('cancels when it is turned off, when the field empties, and when the popup closes', () => {
      const { props, rerender } = renderModal();
      type('toves');
      fireEvent.click(toggle());
      (props.onCancelDefinitionSearch as jest.Mock).mockClear();

      fireEvent.click(toggle());
      expect(props.onCancelDefinitionSearch).toHaveBeenCalledTimes(1);

      fireEvent.click(toggle());
      type('');
      expect(props.onCancelDefinitionSearch).toHaveBeenCalledTimes(2);

      rerender({ open: false });
      expect((props.onCancelDefinitionSearch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('says it is searching, quietly, beside the count', () => {
      const { rerender } = renderModal();
      type('toves');
      fireEvent.click(toggle());
      rerender({ definitionSearch: { status: 'searching', query: 'toves', matches: [] } });
      expect(status()).toBe('1 of 4 matches · Searching definitions…');
    });

    it('adds the rows found only in a definition, with the snippet and its hit marked', () => {
      const { rerender } = renderModal();
      type('toves');
      fireEvent.click(toggle());
      rerender({
        definitionSearch: {
          status: 'found',
          query: 'toves',
          matches: [
            { id: 'h4', snippet: { before: 'Lithe as the ', hit: 'toves', after: '.' } },
            { id: 'h1', snippet: { before: '…joyous, said of ', hit: 'Toves', after: ' at play…' } }
          ]
        }
      });

      expect(words()).toEqual(['Slithy', 'frabjous']);
      expect(status()).toBe('2 of 4 match');
      const snippets = Array.from(document.querySelectorAll('.pm-dictionary-history-snippet'));
      expect(snippets.map(snippet => snippet.textContent)).toEqual(['In the definition: …joyous, said of Toves at play…']);
      expect(snippets[0].querySelector('mark')?.textContent).toBe('Toves');
      // The row found by its context keeps its own mark and shows no snippet.
      expect(marks()).toEqual(['toves', 'Toves']);
    });

    it('never shows an answer to another query', () => {
      const { rerender } = renderModal();
      type('toves');
      fireEvent.click(toggle());
      const stale: DictionaryHistoryDefinitionSearch = {
        status: 'found',
        query: 'toves',
        matches: [{ id: 'h1', snippet: { before: '', hit: 'toves', after: '' } }]
      };
      rerender({ definitionSearch: stale });
      expect(words()).toEqual(['Slithy', 'frabjous']);

      type('borogoves');
      expect(words()).toEqual(['mimsy']);
      expect(document.querySelector('.pm-dictionary-history-snippet')).toBeNull();
    });

    it('hides the host’s answer once the toggle is off', () => {
      const found: DictionaryHistoryDefinitionSearch = {
        status: 'found',
        query: 'toves',
        matches: [{ id: 'h1', snippet: { before: '', hit: 'toves', after: '' } }]
      };
      const { rerender } = renderModal();
      type('toves');
      fireEvent.click(toggle());
      rerender({ definitionSearch: found });
      expect(words()).toEqual(['Slithy', 'frabjous']);

      fireEvent.click(toggle());
      expect(words()).toEqual(['Slithy']);
    });

    it('leaves one quiet line when the host fails, and the filter still works', () => {
      const { rerender } = renderModal();
      type('toves');
      fireEvent.click(toggle());
      rerender({ definitionSearch: { status: 'failed', query: 'toves', matches: [] } });

      expect(status()).toBe("1 of 4 matches · Couldn't search definitions");
      expect(words()).toEqual(['Slithy']);
      expect(screen.queryByRole('alert')).toBeNull();

      rerender({ definitionSearch: { status: 'failed', query: 'toves', matches: [] } });
      type('mimsy');
      expect(words()).toEqual(['mimsy']);
    });
  });

  describe('the keyboard', () => {
    it('focuses the field on open', () => {
      renderModal();
      expect(document.activeElement).toBe(field());
    });

    it('moves from the field into the rows on ↓, walks them, and returns on ↑', () => {
      renderModal();
      fireEvent.keyDown(field(), { key: 'ArrowDown' });
      expect(document.activeElement).toBe(selectButton('Slithy'));

      fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(selectButton('mimsy'));

      fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowUp' });
      fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(field());
    });

    it('stays on the last row on ↓, and keeps to Delete when focus was on Delete', () => {
      renderModal();
      selectButton('frabjous').focus();
      fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(selectButton('frabjous'));

      deleteButton('mimsy').focus();
      fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(deleteButton('café au lait'));
    });

    it('moves into the filtered rows only', () => {
      renderModal();
      type('mimsy');
      fireEvent.keyDown(field(), { key: 'ArrowDown' });
      expect(document.activeElement).toBe(selectButton('mimsy'));
    });

    it('moves to Delete on ↓ while a lookup is generating and rows cannot be opened', () => {
      renderModal({ selectionDisabled: true });
      fireEvent.keyDown(field(), { key: 'ArrowDown' });
      expect(document.activeElement).toBe(deleteButton('Slithy'));
    });

    it('opens the first match on Enter in the field', () => {
      const { props } = renderModal();
      type('mimsy');
      fireEvent.keyDown(field(), { key: 'Enter' });
      expect(props.onSelect).toHaveBeenCalledTimes(1);
      expect(props.onSelect).toHaveBeenCalledWith('h3');
    });

    it('opens nothing on Enter with an empty field, no match, or a lookup generating', () => {
      const { props, rerender } = renderModal();
      fireEvent.keyDown(field(), { key: 'Enter' });
      type('jabberwock');
      fireEvent.keyDown(field(), { key: 'Enter' });
      rerender({ selectionDisabled: true });
      type('mimsy');
      fireEvent.keyDown(field(), { key: 'Enter' });
      expect(props.onSelect).not.toHaveBeenCalled();
    });

    it('opens a row by its own button, as before', () => {
      const { props } = renderModal();
      type('slithy');
      fireEvent.click(selectButton('Slithy'));
      expect(props.onSelect).toHaveBeenCalledWith('h4');
    });

    it('clears the query on Escape, then closes on the next', () => {
      const { props } = renderModal();
      type('mimsy');
      selectButton('mimsy').focus();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(props.onClose).not.toHaveBeenCalled();
      expect(field().value).toBe('');
      expect(words()).toHaveLength(4);
      expect(document.activeElement).toBe(field());

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('closes by the close button whatever is typed', () => {
      const { props } = renderModal();
      type('mimsy');
      fireEvent.click(screen.getByRole('button', { name: 'Close lookup history' }));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleting from a filtered list', () => {
    it('hands focus to the row that takes the deleted one’s place', () => {
      const { props, rerender } = renderModal();
      type('alice-ch');
      const target = deleteButton('Slithy');
      target.focus();
      fireEvent.click(target);
      expect(props.onDelete).toHaveBeenCalledWith('h4');

      rerender({ entries: ENTRIES.slice(1) });
      expect(document.activeElement).toBe(deleteButton('mimsy'));
    });

    it('hands focus to the field when the last matching row is deleted', () => {
      const { rerender } = renderModal();
      type('frabjous');
      const target = deleteButton('frabjous');
      target.focus();
      fireEvent.click(target);

      rerender({ entries: ENTRIES.slice(0, 3) });
      expect(screen.getByText('No lookups match.')).toBeTruthy();
      expect(document.activeElement).toBe(field());
    });
  });
});
