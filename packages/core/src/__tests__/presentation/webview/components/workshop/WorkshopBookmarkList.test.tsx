/** @jest-environment jsdom */

/**
 * WorkshopBookmarkList (ADR 2026-11-03 D5, D6): the snapshot's bookmarks in
 * the order given, each row named first by its label, tagged "opens in
 * reader" outside the window; rename saves, cancels and resets to the
 * default with the shared label rule, keeping a submitted draft until the
 * host answers it (PR #189 F-01); remove reuses the set route; and the empty
 * state is one muted line.
 */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { WorkshopBookmarkList } from '@components/workshop/WorkshopBookmarkList';
import { WorkshopBookmarkSummary } from '@messages';

const bookmark = (
  id: string,
  label: string,
  overrides: Partial<WorkshopBookmarkSummary> = {}
): WorkshopBookmarkSummary => ({
  id,
  turnId: `turn-${id}`,
  label,
  participant: 'host',
  personaId: 'jill',
  inWindow: true,
  ...overrides
});

const rows = [
  bookmark('b-1', 'Jill · The barn opens on the eggs', { inWindow: false }),
  bookmark('b-2', 'Dialogue & Beats · report', { participant: 'tool', personaId: undefined, toolId: 'dialogue' }),
  bookmark('b-3', 'You · What if the lantern never lights?', { participant: 'writer', personaId: undefined })
];

const renderList = (
  bookmarks: WorkshopBookmarkSummary[] = rows,
  props: Partial<React.ComponentProps<typeof WorkshopBookmarkList>> = {}
) => {
  const handlers = { onOpen: jest.fn(), onRename: jest.fn(() => 'rename-1'), onRemove: jest.fn() };
  const view = render(<WorkshopBookmarkList bookmarks={bookmarks} {...handlers} {...props} />);
  return { ...view, ...handlers };
};

const openRename = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: `Rename bookmark: ${label}` }));
const field = () => screen.getByRole('textbox', { name: 'Bookmark name' }) as HTMLInputElement;

describe('WorkshopBookmarkList', () => {
  it('shows one muted line when there are none', () => {
    renderList([]);
    expect(screen.getByText('Bookmark a reply to find it here.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('0 · thread order')).toBeTruthy();
  });

  it('lists rows in snapshot order, names each by its label first, and tags those outside the window', () => {
    renderList();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => within(item).getAllByRole('button')[0].getAttribute('aria-label'))).toEqual([
      'Jill · The barn opens on the eggs: open it in the reader',
      'Dialogue & Beats · report: show it in the thread',
      'You · What if the lantern never lights?: show it in the thread'
    ]);
    expect(within(items[0]).getByText('opens in reader')).toBeTruthy();
    expect(within(items[1]).queryByText('opens in reader')).toBeNull();
    expect(screen.getByText('3 · thread order')).toBeTruthy();
  });

  it('describes each row by its meta line', () => {
    renderList();
    const open = screen.getByRole('button', { name: /^Dialogue & Beats · report/ });
    const meta = document.getElementById(open.getAttribute('aria-describedby')!);
    expect(meta?.textContent).toBe('Tool reply');
  });

  it('colors a participant\'s icon by its identity and leaves the writer\'s plain', () => {
    const { container } = renderList();
    const icons = Array.from(container.querySelectorAll<HTMLElement>('.pm-ws-bookmark-icon'));
    const identity = (icon: HTMLElement) => icon.style.getPropertyValue('--pm-ws-bookmark-identity');
    expect(identity(icons[0])).toMatch(/^var\(--pm-identity-\d+\)$/);
    expect(identity(icons[1])).toMatch(/^var\(--pm-identity-\d+\)$/);
    expect(identity(icons[2])).toBe('');
    expect(icons[2].classList.contains('pm-ws-bookmark-icon-writer')).toBe(true);
  });

  it('opens a row with its bookmark', () => {
    const { onOpen } = renderList();
    fireEvent.click(screen.getByRole('button', { name: /^Jill · The barn/ }));
    expect(onOpen).toHaveBeenCalledWith(rows[0]);
  });

  it('removes a bookmark through its turn', () => {
    const { onRemove } = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Remove bookmark: Dialogue & Beats · report' }));
    expect(onRemove).toHaveBeenCalledWith('turn-b-2');
  });

  it('sends a rename on Enter, trimmed, and keeps the draft, saving, until the host answers', () => {
    const { onRename, rerender, onOpen, onRemove } = renderList();
    openRename('Dialogue & Beats · report');
    expect(field().value).toBe('Dialogue & Beats · report');
    expect(document.activeElement).toBe(field());

    fireEvent.change(field(), { target: { value: '  The father never answers  ' } });
    fireEvent.submit(field().form!);

    expect(onRename).toHaveBeenCalledWith('b-2', 'The father never answers');
    expect(field().value).toBe('  The father never answers  ');
    expect(field().readOnly).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Saving…');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(field().form!);
    expect(onRename).toHaveBeenCalledTimes(1);

    // Another request's answer is not this one's.
    const props = { onOpen, onRename, onRemove };
    rerender(<WorkshopBookmarkList bookmarks={rows} {...props} renameOutcome={{ requestId: 'rename-0', bookmarkId: 'b-2', accepted: true }} />);
    expect(screen.getByRole('textbox', { name: 'Bookmark name' })).toBeTruthy();

    rerender(<WorkshopBookmarkList bookmarks={rows} {...props} renameOutcome={{ requestId: 'rename-1', bookmarkId: 'b-2', accepted: true }} />);
    expect(screen.queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Rename bookmark: Dialogue & Beats · report' })
    );
  });

  it('gives a refused draft back with the host\'s reason, ready to save again', () => {
    const { onRename, rerender, onOpen, onRemove } = renderList();
    openRename('Dialogue & Beats · report');
    fireEvent.change(field(), { target: { value: 'The father never answers' } });
    fireEvent.submit(field().form!);

    rerender(
      <WorkshopBookmarkList
        bookmarks={rows}
        onOpen={onOpen}
        onRename={onRename}
        onRemove={onRemove}
        renameOutcome={{ requestId: 'rename-1', bookmarkId: 'b-2', accepted: false, error: 'Wait for the current session save or replacement to finish before changing the room.' }}
      />
    );

    expect(field().value).toBe('The father never answers');
    expect(field().readOnly).toBe(false);
    expect(screen.getByRole('alert').textContent)
      .toBe('Wait for the current session save or replacement to finish before changing the room.');
    expect(field().getAttribute('aria-invalid')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onRename).toHaveBeenCalledTimes(2);
  });

  it('cancels on Escape and on Cancel, sending nothing', () => {
    const { onRename } = renderList();
    openRename('Dialogue & Beats · report');
    fireEvent.change(field(), { target: { value: 'Second thoughts' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();

    openRename('Dialogue & Beats · report');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('resets to the default with a blank label', () => {
    const { onRename } = renderList();
    openRename('Dialogue & Beats · report');
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onRename).toHaveBeenCalledWith('b-2', null);
  });

  it.each([
    ['too long', 'x'.repeat(81), "A bookmark's name is at most 80 characters."],
    ['not one line', 'two\tparts', "A bookmark's name is one line, with no tabs or line breaks."]
  ])('says what is wrong with a label that is %s, keeps the draft, and sends nothing', (_label, value, message) => {
    const { onRename } = renderList();
    openRename('Dialogue & Beats · report');
    fireEvent.change(field(), { target: { value } });
    fireEvent.submit(field().form!);

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(field().value).toBe(value);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(field().getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);

    fireEvent.change(field(), { target: { value: 'Fine' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('drops an open rename once its bookmark leaves the list', () => {
    const { rerender, onOpen, onRename, onRemove } = renderList();
    openRename('Dialogue & Beats · report');
    fireEvent.change(field(), { target: { value: 'Draft' } });

    const props = { onOpen, onRename, onRemove };
    rerender(<WorkshopBookmarkList bookmarks={[rows[0], rows[2]]} {...props} />);
    expect(screen.queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
    rerender(<WorkshopBookmarkList bookmarks={rows} {...props} />);
    expect(screen.queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('sends no rename or remove while the room is locked', () => {
    renderList(rows, { disabled: true });
    expect((screen.getByRole('button', { name: 'Remove bookmark: Dialogue & Beats · report' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Rename bookmark: Dialogue & Beats · report' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
