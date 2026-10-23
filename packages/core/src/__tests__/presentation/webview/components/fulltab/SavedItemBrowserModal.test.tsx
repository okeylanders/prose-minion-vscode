/** @jest-environment jsdom */

/**
 * The full tabs' shared saved-item browser (Lightbox Slice 5A.2), extracted
 * from the Workshop's session browser, whose own tests run unchanged. Here:
 * what every tab gets (search, groupings, group counts, the empty view,
 * inline rename with Enter, leaving and Escape, delete with a confirm, and
 * Escape cancelling either before it closes the browser), and the three
 * opt-ins the Lightbox takes (a rename rule, sending only an edit the writer
 * made, and focus that returns where the writer was).
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SavedItemBrowserModal, type SavedItemBrowserModalProps } from '@components/fulltab/SavedItemBrowserModal';
import { SavedItemRow } from '@components/fulltab/SavedItemRow';
import { groupSavedItems } from '@utils/savedItemGroups';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

interface Item {
  id: string;
  title: string;
  shelf: string;
}

const ITEMS: Item[] = [
  { id: 'a', title: 'Chapter 6 - draft three', shelf: 'Book' },
  { id: 'b', title: 'alice-1 - first pass', shelf: 'Drafts' },
  { id: 'c', title: 'alice-2 - second pass', shelf: 'Book' }
];

type Props = SavedItemBrowserModalProps<Item>;

function renderBrowser(overrides: Partial<Props> = {}) {
  const props: Props = {
    open: true,
    titleId: 'test-browser-title',
    closeLabel: 'Close the browser',
    className: 'test-browser',
    eyebrow: 'Test · Items',
    title: 'Open an item',
    description: 'Items, as the host keeps them.',
    search: { label: 'Search items', placeholder: 'Search…', query: '', disabled: false, onChange: jest.fn() },
    groupLabel: 'Group items',
    groupings: [
      { key: 'all', label: 'All', group: (items) => groupSavedItems(items, () => ({ key: 'all', label: 'Every item', order: 0 })) },
      { key: 'shelf', label: 'Shelf', group: (items) => groupSavedItems(items, (item, index) => ({ key: item.shelf, label: item.shelf, order: index })) }
    ],
    status: null,
    section: { id: 'test-items-heading', title: 'Items', note: 'newest first' },
    emptyText: 'Nothing here.',
    items: ITEMS,
    itemKey: (item) => item.id,
    itemTitle: (item) => item.title,
    renderRow: (item, controls) => (
      <SavedItemRow
        title={item.title}
        disabled={false}
        glyph={<span />}
        meta={<span>{item.shelf}</span>}
        metaTitle={item.shelf}
        renameLabel="Rename item"
        primary={<button type="button" aria-label={`Open ${item.title}`}>Open</button>}
        controls={controls}
        onOpen={() => undefined}
      />
    ),
    footer: <span>Footer</span>,
    onRename: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
    ...overrides
  };
  const view = render(<SavedItemBrowserModal<Item> {...props} />);
  return { props, view, rerender: (next: Partial<Props>) => view.rerender(<SavedItemBrowserModal<Item> {...props} {...next} />) };
}

beforeEach(() => {
  __resetOverlayFocusStateForTests();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('SavedItemBrowserModal: what every tab gets', () => {
  it('renders the tab\'s words, the first grouping, its counts, and focuses the search on open', () => {
    renderBrowser();
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(screen.getByRole('dialog', { name: 'Open an item' })).not.toBeNull();
    expect([...document.querySelectorAll('.pm-ws-sessions-group-label')].map((label) => label.textContent)).toEqual(['Every item 3']);
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search items' }));
    expect(screen.getByRole('button', { name: 'All' }).className).toBe('pm-ws-session-group-active');
  });

  it('switches grouping, routes the search, and shows the empty text when there is nothing', () => {
    const { props, rerender } = renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Shelf' }));
    expect([...document.querySelectorAll('.pm-ws-sessions-group-label')].map((label) => label.textContent)).toEqual(['Book 2', 'Drafts 1']);
    expect(screen.getByRole('button', { name: 'Shelf' }).className).toBe('pm-ws-session-group-active');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search items' }), { target: { value: 'alice' } });
    expect(props.search.onChange).toHaveBeenCalledWith('alice');

    rerender({ items: [] });
    expect(screen.getByText('Nothing here.')).not.toBeNull();
  });

  it('renames in place: leaving or Enter saves the trimmed title, Escape cancels and keeps the browser open', () => {
    const { props } = renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Rename alice-1 - first pass' }));
    const field = screen.getByRole('textbox', { name: 'Rename item' }) as HTMLInputElement;
    expect(field.value).toBe('alice-1 - first pass');
    fireEvent.change(field, { target: { value: '  model A  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith('b', 'model A');
    expect(screen.queryByRole('textbox', { name: 'Rename item' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Rename Chapter 6 - draft three' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename item' }), { target: { value: 'model B' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Rename item' }));
    expect(props.onRename).toHaveBeenLastCalledWith('a', 'model B');

    fireEvent.click(screen.getByRole('button', { name: 'Rename alice-2 - second pass' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename item' }), { key: 'Escape' });
    expect(props.onRename).toHaveBeenCalledTimes(2);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('deletes only after a confirm; Keep, or Escape, keeps it and keeps the browser open', () => {
    const { props } = renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Delete alice-1 - first pass' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep alice-1 - first pass' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete alice-1 - first pass' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Keep alice-1 - first pass' }), { key: 'Escape' });
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete alice-1 - first pass' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete alice-1 - first pass' }));
    expect(props.onDelete).toHaveBeenCalledWith('b');
  });

  it('control, with no opt-ins: leaving an untouched field sends the title it holds, as the Workshop always has', () => {
    const { props } = renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Rename alice-1 - first pass' }));
    fireEvent.blur(screen.getByRole('textbox', { name: 'Rename item' }));
    expect(props.onRename).toHaveBeenCalledWith('b', 'alice-1 - first pass');
  });
});

describe('SavedItemBrowserModal: the Lightbox\'s opt-ins', () => {
  const rule = (draft: string) => (draft.includes('\t') ? 'One line, please.' : undefined);

  it('keeps a refused name open, marked invalid, with the rule\'s words, on Enter and on leaving; Escape cancels', () => {
    const { props } = renderBrowser({ renameRule: rule });
    fireEvent.click(screen.getByRole('button', { name: 'Rename alice-1 - first pass' }));
    const field = () => screen.getByRole('textbox', { name: 'Rename item' });
    fireEvent.change(field(), { target: { value: 'a\tb' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('One line, please.');
    fireEvent.blur(field());
    expect((field() as HTMLInputElement).value).toBe('a\tb');
    expect(props.onRename).not.toHaveBeenCalled();

    fireEvent.change(field(), { target: { value: 'model A' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it('sends only an edit the writer made: an untouched field follows the host\'s title and sends nothing (PR #164 F-04)', () => {
    const { props, rerender } = renderBrowser({ sendOnlyEdits: true });
    fireEvent.click(screen.getByRole('button', { name: 'Rename alice-1 - first pass' }));
    // The answer to an earlier rename lands while the field is open.
    const renamed = ITEMS.map((item) => (item.id === 'b' ? { ...item, title: 'model A' } : item));
    rerender({ items: renamed });
    expect((screen.getByRole('textbox', { name: 'Rename item' }) as HTMLInputElement).value).toBe('model A');
    fireEvent.blur(screen.getByRole('textbox', { name: 'Rename item' }));
    expect(props.onRename).not.toHaveBeenCalled();

    // An edit back to the standing title sends nothing; a real edit is sent once.
    fireEvent.click(screen.getByRole('button', { name: 'Rename model A' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename item' }), { target: { value: 'model A ' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename item' }), { key: 'Enter' });
    expect(props.onRename).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Rename model A' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename item' }), { target: { value: 'model C' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename item' }), { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledTimes(1);
    expect(props.onRename).toHaveBeenCalledWith('b', 'model C');
  });

  it('returns focus: Enter and Escape to Rename; Delete to Keep, and Keep or Escape back to Delete', () => {
    renderBrowser({ returnFocus: true });
    fireEvent.click(screen.getByRole('button', { name: 'Rename alice-1 - first pass' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename item' }), { target: { value: 'model A' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename item' }), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename alice-1 - first pass' }));

    fireEvent.click(screen.getByRole('button', { name: 'Rename alice-1 - first pass' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename item' }), { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename alice-1 - first pass' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete alice-1 - first pass' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep alice-1 - first pass' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep alice-1 - first pass' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete alice-1 - first pass' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete alice-1 - first pass' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Keep alice-1 - first pass' }), { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete alice-1 - first pass' }));
  });

  it('moves focus on from a confirmed delete once its row has gone: to the next row\'s Delete, or to the search', () => {
    const { props, rerender } = renderBrowser({ returnFocus: true });
    fireEvent.click(screen.getByRole('button', { name: 'Delete alice-1 - first pass' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete alice-1 - first pass' }));
    expect(props.onDelete).toHaveBeenCalledWith('b');
    // Until the host answers, focus stays on the row's Delete.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete alice-1 - first pass' }));

    const remaining = ITEMS.filter((item) => item.id !== 'b');
    rerender({ items: remaining });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete alice-2 - second pass' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete alice-2 - second pass' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete alice-2 - second pass' }));
    rerender({ items: remaining.filter((item) => item.id !== 'c') });
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search items' }));
  });
});
