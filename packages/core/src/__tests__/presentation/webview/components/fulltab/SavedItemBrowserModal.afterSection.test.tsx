/** @jest-environment jsdom */

/**
 * The shared saved-item browser's `afterSection` opt-in (Project Memory
 * Slice 4b-ui): a second, ungrouped section after the list, whose rows
 * share the list's rename, delete and focus order. Without it nothing
 * changes (the Workshop's and the Lightbox's own tests run unchanged).
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
}

const LISTED: Item[] = [{ id: 'a', title: 'Alice in the hall' }];
const AFTER: Item[] = [{ id: 'b', title: 'Alice at the door' }, { id: 'c', title: 'Alice in the pool' }];

function renderBrowser(overrides: Partial<SavedItemBrowserModalProps<Item>> = {}) {
  const props: SavedItemBrowserModalProps<Item> = {
    open: true,
    titleId: 'after-title',
    closeLabel: 'Close the browser',
    className: 'test-browser',
    eyebrow: 'Test',
    title: 'Items',
    description: 'Items.',
    search: { label: 'Search items', placeholder: 'Search…', query: '', disabled: false, onChange: jest.fn() },
    groupLabel: 'Group items',
    groupings: [{ key: 'all', label: 'All', group: (items) => groupSavedItems(items, () => ({ key: 'all', label: 'Every item', order: 0 })) }],
    status: null,
    section: { id: 'listed-heading', title: 'Listed', note: 'grouped' },
    afterSection: { id: 'after-heading', title: 'Put away', note: 'never grouped', items: AFTER },
    emptyText: 'Nothing here.',
    items: LISTED,
    itemKey: (item) => item.id,
    itemTitle: (item) => item.title,
    renderRow: (item, controls) => (
      <SavedItemRow
        title={item.title}
        disabled={false}
        glyph={<span />}
        meta={<span>meta</span>}
        metaTitle="meta"
        renameLabel="Rename item"
        primary={<button type="button">Open</button>}
        controls={controls}
      />
    ),
    footer: null,
    onRename: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
    returnFocus: true,
    ...overrides
  };
  const view = render(<SavedItemBrowserModal<Item> {...props} />);
  act(() => {
    jest.runOnlyPendingTimers();
  });
  return { props, rerender: (next: Partial<SavedItemBrowserModalProps<Item>>) => view.rerender(<SavedItemBrowserModal<Item> {...props} {...next} />) };
}

beforeEach(() => {
  __resetOverlayFocusStateForTests();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('SavedItemBrowserModal afterSection', () => {
  it('draws a second section after the list, ungrouped, with the same section markup', () => {
    renderBrowser();
    const sections = [...document.querySelectorAll('.pm-ws-session-browser-section')];
    expect(sections.map((section) => section.getAttribute('aria-labelledby'))).toEqual(['listed-heading', 'after-heading']);
    expect(document.getElementById('after-heading')?.textContent).toBe('Put away never grouped');
    expect(sections[1].querySelector('.pm-ws-sessions-group-label')).toBeNull();
    expect(sections[1].querySelectorAll('article')).toHaveLength(2);
  });

  it('draws nothing when it holds no items', () => {
    renderBrowser({ afterSection: { id: 'after-heading', title: 'Put away', note: 'never grouped', items: [] } });
    expect(document.getElementById('after-heading')).toBeNull();
  });

  it('its rows rename and delete through the browser, and focus moves on to the next row', () => {
    const { props, rerender } = renderBrowser();
    fireEvent.click(screen.getByRole('button', { name: 'Rename Alice at the door' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename item' }), { target: { value: 'Alice by the door' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename item' }), { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith('b', 'Alice by the door');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Alice at the door' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Alice at the door' }));
    expect(props.onDelete).toHaveBeenCalledWith('b');
    rerender({ afterSection: { id: 'after-heading', title: 'Put away', note: 'never grouped', items: [AFTER[1]] } });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete Alice in the pool' }));
  });
});
