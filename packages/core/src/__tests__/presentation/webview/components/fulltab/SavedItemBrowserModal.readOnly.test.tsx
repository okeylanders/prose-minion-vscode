/** @jest-environment jsdom */

/**
 * The shared saved-item browser's `readOnly` opt-in (Bookmark Recall Slice
 * 2, ADR 2026-11-05 D8): a row the writer can open but not change. With it,
 * no Rename, Delete or utility action is drawn, and nothing renames or
 * deletes; without it, the same row draws exactly as before (the Workshop's
 * and the Lightbox's browser tests run unchanged).
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SavedItemBrowserModal } from '@components/fulltab/SavedItemBrowserModal';
import { SavedItemRow, type SavedItemRowControls } from '@components/fulltab/SavedItemRow';
import { groupSavedItems } from '@utils/savedItemGroups';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

interface Item {
  id: string;
  title: string;
}

const ITEMS: Item[] = [{ id: 'a', title: 'Alice at the door' }, { id: 'b', title: 'The tea party' }];

function renderBrowser(readOnly: boolean, onOpen = jest.fn()) {
  return render(
    <SavedItemBrowserModal<Item>
      open
      titleId="read-only-title"
      closeLabel="Close"
      className="test-browser"
      eyebrow="Test"
      title="Items"
      description="Items."
      search={{ label: 'Search items', placeholder: 'Search…', query: '', disabled: false, onChange: jest.fn() }}
      groupLabel="Group items"
      groupings={[{ key: 'all', label: 'All', group: (items) => groupSavedItems(items, () => ({ key: 'all', label: 'All', order: 0 })) }]}
      status={null}
      section={{ id: 'read-only-heading', title: 'Items', note: '' }}
      emptyText="Nothing."
      items={ITEMS}
      itemKey={(item) => item.id}
      itemTitle={(item) => item.title}
      renderRow={(item, controls) => (
        <SavedItemRow
          title={item.title}
          disabled={false}
          readOnly={readOnly}
          glyph={<span />}
          meta={<span>meta</span>}
          metaTitle="meta"
          renameLabel="Rename item"
          utilities={<button type="button" aria-label={`Copy ${item.title}`}>Copy</button>}
          primary={<button type="button">Preview</button>}
          controls={controls}
          onOpen={() => onOpen(item.id)}
        />
      )}
      footer={null}
      onClose={jest.fn()}
      {...(readOnly ? { readOnly: true } : { onRename: jest.fn(), onDelete: jest.fn() })}
    />
  );
}

beforeEach(() => __resetOverlayFocusStateForTests());

describe('SavedItemBrowserModal readOnly', () => {
  it('draws no Rename, Delete or utility action, and the row still opens', () => {
    const onOpen = jest.fn();
    renderBrowser(true, onOpen);

    expect(screen.queryByRole('button', { name: /^Rename / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Copy / })).toBeNull();
    expect(document.querySelector('.pm-ws-session-utility-actions')).toBeNull();
    fireEvent.click(screen.getByText('Alice at the door'));
    expect(onOpen).toHaveBeenCalledWith('a');
    expect(screen.getAllByRole('button', { name: 'Preview' })).toHaveLength(2);
  });

  it('leaves a row without it exactly as it was: Rename, the tab\'s own actions and Delete', () => {
    renderBrowser(false);
    expect(screen.getByRole('button', { name: 'Rename Alice at the door' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy Alice at the door' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Alice at the door' })).toBeTruthy();
  });

  it('keeps every rename and delete closed under readOnly, whatever a row asks', () => {
    let captured: SavedItemRowControls | undefined;
    render(
      <SavedItemBrowserModal<Item>
        open
        titleId="read-only-controls"
        closeLabel="Close"
        className="test-browser"
        eyebrow="Test"
        title="Items"
        description="Items."
        search={{ label: 'Search items', placeholder: 'Search…', query: '', disabled: false, onChange: jest.fn() }}
        groupLabel="Group items"
        groupings={[{ key: 'all', label: 'All', group: (items) => groupSavedItems(items, () => ({ key: 'all', label: 'All', order: 0 })) }]}
        status={null}
        section={{ id: 'read-only-controls-heading', title: 'Items', note: '' }}
        emptyText="Nothing."
        items={ITEMS.slice(0, 1)}
        itemKey={(item) => item.id}
        itemTitle={(item) => item.title}
        renderRow={(item, controls) => {
          captured = controls;
          return <span>{item.title}{controls.editing ? ' editing' : ''}{controls.confirmingDelete ? ' confirming' : ''}</span>;
        }}
        footer={null}
        onClose={jest.fn()}
        readOnly
      />
    );
    React.act(() => captured!.beginRename());
    React.act(() => captured!.beginDelete());
    expect(screen.getByText('Alice at the door').textContent).toBe('Alice at the door');
  });
});
