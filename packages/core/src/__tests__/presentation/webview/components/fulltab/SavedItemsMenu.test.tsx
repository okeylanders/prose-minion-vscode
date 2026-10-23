/** @jest-environment jsdom */

/**
 * The full tabs' shared saved-item menu (Lightbox Slice 5A.2), extracted
 * from the Workshop's sessions menu, whose own tests run unchanged: the
 * trigger names what is on screen and its save status; opening focuses the
 * first item (or, opted in, the first enabled one); choosing an item closes
 * the menu first, then acts; Escape and a click outside close it; closing
 * returns focus to the trigger.
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SavedItemsMenu, type SavedItemsMenuProps } from '@components/fulltab/SavedItemsMenu';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
function Menu(props: Partial<SavedItemsMenuProps> & { onChoose?: () => void; onRecent?: () => void; firstDisabled?: boolean }) {
  const [open, setOpen] = React.useState(props.open ?? false);
  return (
    <SavedItemsMenu
      open={open}
      label={props.label ?? 'Chapter 6 - 10/23/2026 9:08 AM'}
      status={props.status}
      menuId="test-menu"
      menuLabel="Test commands"
      triggerTitle="Test commands and recent items"
      focusFirstEnabled={props.focusFirstEnabled}
      onOpenChange={(next) => {
        props.onOpenChange?.(next);
        setOpen(next);
      }}
    >
      <SavedItemsMenu.Heading>Item</SavedItemsMenu.Heading>
      <SavedItemsMenu.Item icon="pen" disabled={props.firstDisabled} onSelect={props.onChoose ?? (() => undefined)}>Rename…</SavedItemsMenu.Item>
      <SavedItemsMenu.Item icon="doc" kbd="⌘O" onSelect={() => undefined}>Another…</SavedItemsMenu.Item>
      <SavedItemsMenu.Rule />
      <SavedItemsMenu.Heading recent>Recent</SavedItemsMenu.Heading>
      <SavedItemsMenu.Recent title="alice-1 - first pass" meta="Drafts/alice-1.md · 2h ago" onSelect={props.onRecent ?? (() => undefined)} />
      <SavedItemsMenu.Empty>Nothing older.</SavedItemsMenu.Empty>
    </SavedItemsMenu>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('SavedItemsMenu', () => {
  it('names what is on screen, and its save status, beside the trigger', () => {
    const { container } = render(<Menu status={{ state: 'session', text: 'Not saved yet' }} />);
    const trigger = screen.getByRole('button', { name: /Chapter 6 - 10\/23\/2026 9:08 AM/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe('test-menu');
    expect(screen.getByRole('status').textContent).toBe('Not saved yet');
    expect(container.querySelector('.pm-ws-named-save-state-session')).not.toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens on the trigger, focusing its first item, with headings, a rule, a recent item and a note', () => {
    render(<Menu />);
    fireEvent.click(screen.getByRole('button', { name: /Chapter 6/ }));
    act(() => {
      jest.runOnlyPendingTimers();
    });
    const menu = screen.getByRole('menu', { name: 'Test commands' });
    expect(menu.id).toBe('test-menu');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Rename…', 'Another…⌘O', 'alice-1 - first passDrafts/alice-1.md · 2h ago']);
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Rename…' }));
    expect(screen.getByText('Nothing older.')).not.toBeNull();
  });

  it('focuses the first enabled item when opted in; by default, the first item even when it is disabled', () => {
    const { unmount } = render(<Menu open firstDisabled />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(document.activeElement).not.toBe(screen.getByRole('menuitem', { name: 'Another… ⌘O' }));
    unmount();

    render(<Menu open firstDisabled focusFirstEnabled />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Another… ⌘O' }));
  });

  it('closes before it acts, and gives focus back to the trigger', () => {
    const order: string[] = [];
    render(<Menu open onOpenChange={(open) => order.push(`open:${open}`)} onChoose={() => order.push('rename')} onRecent={() => order.push('recent')} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename…' }));
    expect(order).toEqual(['open:false', 'rename']);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Chapter 6/ }));

    fireEvent.click(screen.getByRole('button', { name: /Chapter 6/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /alice-1 - first pass/ }));
    expect(order).toEqual(['open:false', 'rename', 'open:true', 'open:false', 'recent']);
  });

  it('closes on Escape and on a click outside', () => {
    const changes: boolean[] = [];
    render(<Menu open onOpenChange={(open) => changes.push(open)} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(changes).toEqual([false]);
    fireEvent.click(screen.getByRole('button', { name: /Chapter 6/ }));
    fireEvent.mouseDown(document.body);
    expect(changes).toEqual([false, true, false]);
  });
});
