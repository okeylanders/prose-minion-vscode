/** @jest-environment jsdom */

/**
 * The rail's Boards section (Slice 5A; epic decision 31): newest first, the
 * board on screen marked, Open by file, Delete confirmed in the row (focus on
 * Keep, Escape keeps), "Read the current text" offered only when a board
 * opened from a file no longer matches it, and, past one page, how many are
 * shown and Show older (PR #163 F-04), which goes on from the rows shown
 * when the page reached a board deep in the history (PR #163 N-03). Dates
 * are pinned to UTC.
 *
 * Slice 5A.1 (epic decision 33): a named row shows its name first and its
 * date under it, every row the models that read it; the head names the
 * board on screen, with Name or Rename; Rename opens a field in place
 * (Enter saves, Escape cancels, each returning focus to the action that
 * opened it; leaving the field saves); and a confirmed delete keeps focus
 * on its row until the row goes, then moves it on (5A tech debt). Names
 * and model ids are made up.
 *
 * PR #164: only the writer's own edit is sent. A rename's answer that lands
 * while a reopened, untouched field is open shows in the field, and leaving
 * it sends nothing, in the head and in a row (F-04). A name the rule refuses
 * on leaving keeps the field open with the writer's words and the reason,
 * as Enter does; Escape then cancels (N-01).
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LightboxBoardShelf } from '@messages';
import { LightboxBoardsPanel, LightboxBoardsPanelProps } from '@components/lightbox/LightboxBoardsPanel';

const NEWER = 'drafts-alice-1-md-9b099095/2026-10-22T15-10-00-000Z.board.json';
const OLDER = 'drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json';
const SHELF: LightboxBoardShelf = {
  availability: { kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false },
  boards: [
    { fileId: NEWER, savedAt: Date.parse('2026-10-22T15:10:00.000Z'), wordCount: 508, lenses: ['headline', 'motif'], staleLenses: [], costUsd: 0.02, onScreen: true },
    { fileId: OLDER, savedAt: Date.parse('2026-10-22T14:05:09.123Z'), wordCount: 508, lenses: [], staleLenses: [], onScreen: false }
  ],
  unreadable: 0
};

function panel(overrides: Partial<LightboxBoardsPanelProps> = {}) {
  const props: LightboxBoardsPanelProps = {
    shelf: SHELF,
    hasBoard: true,
    opening: null,
    rereading: false,
    onOpen: jest.fn(),
    onDelete: jest.fn(),
    onRename: jest.fn(),
    onReadCurrentText: jest.fn(),
    timeZone: 'UTC',
    ...overrides
  };
  return { props, ...render(<LightboxBoardsPanel {...props} />) };
}

describe('LightboxBoardsPanel', () => {
  it('lists the saved boards newest first, marks the one on screen, and opens another by its file', () => {
    const { props, container } = panel();

    const rows = Array.from(container.querySelectorAll('.pm-lb-saved-board'));
    expect(rows.map((row) => row.textContent)).toEqual([
      'Oct 22, 2026, 3:10 PM2 lenses read · ≈ $0.02On screen',
      'Oct 22, 2026, 2:05 PMMeasured onlyOpen'
    ]);
    expect(rows.map((row) => row.getAttribute('aria-current'))).toEqual(['true', null]);
    expect(screen.queryByRole('button', { name: 'Open the board saved Oct 22, 2026, 3:10 PM' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open the board saved Oct 22, 2026, 2:05 PM' }));
    expect(props.onOpen).toHaveBeenCalledWith(OLDER);
  });

  it('says which board is opening and holds the other Open buttons meanwhile', () => {
    panel({ opening: OLDER, shelf: { ...SHELF, boards: SHELF.boards.map((board) => ({ ...board, onScreen: false })) } });
    const newer = screen.getByRole('button', { name: 'Open the board saved Oct 22, 2026, 3:10 PM' }) as HTMLButtonElement;
    const older = screen.getByRole('button', { name: 'Open the board saved Oct 22, 2026, 2:05 PM' }) as HTMLButtonElement;
    expect([newer.textContent, newer.disabled]).toEqual(['Open', true]);
    expect([older.textContent, older.disabled]).toEqual(['Opening…', true]);
  });

  it('asks before deleting, with focus on Keep; Escape keeps the board and returns focus to its Delete', () => {
    const { props } = panel();
    const remove = screen.getByRole('button', { name: 'Delete the board saved Oct 22, 2026, 2:05 PM' });

    fireEvent.click(remove);
    const confirm = screen.getByRole('group', { name: 'Delete the board saved Oct 22, 2026, 2:05 PM?' });
    expect(confirm.textContent).toBe('Delete this file?DeleteKeep');
    expect(document.activeElement?.textContent).toBe('Keep');

    fireEvent.keyDown(confirm, { key: 'Escape' });
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete the board saved Oct 22, 2026, 2:05 PM' }));
    expect(props.onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete the board saved Oct 22, 2026, 2:05 PM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(props.onDelete).toHaveBeenCalledWith(OLDER);
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('offers Read the current text only when the opened board\'s file has changed', () => {
    const snapshot = { fileId: OLDER, savedAt: Date.parse('2026-10-22T14:05:09.123Z'), dropped: 0 };
    const { props, rerender } = panel({ shelf: { ...SHELF, snapshot: { ...snapshot, file: 'changed' } } });

    expect(screen.getByRole('status').textContent).toBe(
      'Opened from the board saved Oct 22, 2026, 2:05 PM.' +
        'The file has changed since. This board shows the text as it was saved, and holds back Bring until you read the current text.' +
        'Read the current text'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Read the current text' }));
    expect(props.onReadCurrentText).toHaveBeenCalledTimes(1);

    rerender(<LightboxBoardsPanel {...props} shelf={{ ...SHELF, snapshot: { ...snapshot, file: 'same' } }} />);
    expect(screen.queryByRole('button', { name: 'Read the current text' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe(
      'Opened from the board saved Oct 22, 2026, 2:05 PM.The file still holds the text it was read from.'
    );
  });

  it('shows the newest twenty of more, says so, and shows older ones a page at a time (PR #163 F-04)', () => {
    const boards = Array.from({ length: 23 }, (_, index) => ({
      ...SHELF.boards[1], fileId: `f${index}`, savedAt: Date.parse('2026-10-22T14:05:00.000Z') - index * 60_000, onScreen: index === 0
    }));
    const { container } = panel({ shelf: { ...SHELF, boards } });
    const rows = () => container.querySelectorAll('.pm-lb-saved-board').length;

    expect(container.querySelector('.pm-ws-block-head')?.textContent).toBe('Boards23 saved');
    expect(rows()).toBe(20);
    expect(screen.getByRole('status').textContent).toBe('Showing the newest 20 of 23.');
    fireEvent.click(screen.getByRole('button', { name: 'Show 3 older' }));
    expect(rows()).toBe(23);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: /older/ })).toBeNull();
  });

  it.each([
    // [files, the board on screen's index, newest first, then the rows shown after each Show older]
    [65, 44, [45, 65]],
    [206, 204, [205, 206]]
  ])('with %i boards and the one on screen at index %i, Show older shows more at every press (PR #163 N-03)', (count, current, steps) => {
    const boards = Array.from({ length: count }, (_, index) => ({
      ...SHELF.boards[1], fileId: `f${index}`, savedAt: Date.parse('2026-10-22T14:05:00.000Z') - index * 60_000, onScreen: index === current
    }));
    const { container } = panel({ shelf: { ...SHELF, boards } });
    const rows = () => container.querySelectorAll('.pm-lb-saved-board').length;

    expect(rows()).toBe(steps[0]);
    for (const expected of steps.slice(1)) {
      fireEvent.click(screen.getByRole('button', { name: /^Show \d+ older$/ }));
      expect(rows()).toBe(expected);
    }
    expect(screen.queryByRole('button', { name: /older/ })).toBeNull();
    expect(container.querySelector('[aria-current="true"]')?.textContent).toContain('Oct');
  });

  it('says boards are kept for the session only, with nothing to open', () => {
    const { container } = panel({ shelf: { availability: { kind: 'session', reason: 'no-workspace' }, boards: [], unreadable: 0 } });
    expect(container.querySelector('.pm-lb-boards-note')?.textContent)
      .toBe('Boards are kept for this session only: no folder is open. Open one folder to save them.');
    expect(container.querySelector('.pm-lb-boards-list')).toBeNull();
    expect(container.querySelector('.pm-ws-block-head')?.textContent).toBe('Boardsthis session');
  });

  describe('names (Slice 5A.1)', () => {
    const NAME = '3.2.1 - after the cut - model B';
    const NAMED: LightboxBoardShelf = {
      ...SHELF,
      name: NAME,
      boards: [
        { ...SHELF.boards[0], name: NAME, models: ['provider/model-v1', 'provider/model-b'] },
        SHELF.boards[1]
      ]
    };
    const field = () => screen.getByRole('textbox') as HTMLInputElement;

    it('shows a named row\'s name first with its date under it, the models that read each row, and an unnamed row as before', () => {
      const { container } = panel({ shelf: NAMED });

      const rows = Array.from(container.querySelectorAll('.pm-lb-saved-board'));
      expect(rows.map((row) => row.textContent)).toEqual([
        `${NAME}Oct 22, 2026, 3:10 PM2 lenses read · ≈ $0.02Read by model-v1 and model-bOn screen`,
        'Oct 22, 2026, 2:05 PMMeasured onlyOpen'
      ]);
      expect(rows[0].querySelector('.pm-lb-saved-board-models')?.getAttribute('title')).toBe('provider/model-v1, provider/model-b');
      expect(rows[1].querySelector('.pm-lb-saved-board-models')).toBeNull();
    });

    it('names the board on screen in the head, with Name for an unnamed board and Rename for a named one', () => {
      const { container, rerender, props } = panel();
      expect(container.querySelector('.pm-lb-board-name')?.textContent).toBe('Unnamed boardName');
      expect(screen.getByRole('button', { name: 'Name the board on screen' })).toBeTruthy();

      rerender(<LightboxBoardsPanel {...props} shelf={NAMED} />);
      expect(container.querySelector('.pm-lb-board-name')?.textContent).toBe(`${NAME}Rename`);
      expect(screen.getByRole('button', { name: 'Rename the board on screen' })).toBeTruthy();
    });

    it('renames a row in place: Enter saves and gives focus back to its Rename; an unchanged name sends nothing', () => {
      const { props } = panel({ shelf: NAMED });
      const rename = screen.getByRole('button', { name: 'Rename the board saved Oct 22, 2026, 2:05 PM' });

      fireEvent.click(rename);
      expect(field().getAttribute('aria-label')).toBe('Name for the board saved Oct 22, 2026, 2:05 PM');
      expect(document.activeElement).toBe(field());
      expect(field().value).toBe('');
      expect(field().maxLength).toBe(120);
      fireEvent.change(field(), { target: { value: '  model A ' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(props.onRename).toHaveBeenCalledWith(OLDER, 'model A');
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename the board saved Oct 22, 2026, 2:05 PM' }));

      // The named row: its name to start from; Enter with it unchanged sends nothing.
      fireEvent.click(screen.getByRole('button', { name: 'Rename the board saved Oct 22, 2026, 3:10 PM' }));
      expect(field().value).toBe(NAME);
      fireEvent.keyDown(field(), { key: 'Enter' });
      expect(props.onRename).toHaveBeenCalledTimes(1);
    });

    it('Escape cancels, sends nothing, gives focus back, and goes no further', () => {
      const { props } = panel({ shelf: NAMED });
      const outside = jest.fn();
      document.addEventListener('keydown', outside);
      fireEvent.click(screen.getByRole('button', { name: 'Rename the board saved Oct 22, 2026, 3:10 PM' }));
      fireEvent.change(field(), { target: { value: 'model C' } });

      fireEvent.keyDown(field(), { key: 'Escape' });

      expect(props.onRename).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename the board saved Oct 22, 2026, 3:10 PM' }));
      expect(outside).not.toHaveBeenCalled();
      document.removeEventListener('keydown', outside);
    });

    it('names the board on screen from the head: the field starts empty, Enter names it, and focus returns to Name', () => {
      const { props } = panel();
      fireEvent.click(screen.getByRole('button', { name: 'Name the board on screen' }));
      expect(field().getAttribute('aria-label')).toBe('Name for the board on screen');
      expect(field().value).toBe('');

      fireEvent.change(field(), { target: { value: NAME } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(props.onRename).toHaveBeenCalledWith(null, NAME);
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Name the board on screen' }));
    });

    it('unnames with an empty field, and refuses a name with a tab in the field, which stays open', () => {
      const { props } = panel({ shelf: NAMED });
      fireEvent.click(screen.getByRole('button', { name: 'Rename the board on screen' }));
      fireEvent.change(field(), { target: { value: 'model\tC' } });
      fireEvent.keyDown(field(), { key: 'Enter' });

      expect(props.onRename).not.toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toBe('A board\'s name is one line, with no tabs or line breaks.');
      expect(field().getAttribute('aria-invalid')).toBe('true');

      fireEvent.change(field(), { target: { value: '   ' } });
      expect(screen.queryByRole('alert')).toBeNull();
      fireEvent.keyDown(field(), { key: 'Enter' });
      expect(props.onRename).toHaveBeenCalledWith(null, '');
    });

    it('leaving the field saves the name, and leaves focus where it went', () => {
      const { props } = panel();
      fireEvent.click(screen.getByRole('button', { name: 'Rename the board saved Oct 22, 2026, 2:05 PM' }));
      fireEvent.change(field(), { target: { value: 'model A' } });

      fireEvent.blur(field());

      expect(props.onRename).toHaveBeenCalledWith(OLDER, 'model A');
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(document.activeElement).toBe(document.body);
    });

    describe('a rename\'s answer while the field is open (PR #164 F-04)', () => {
      const named = (name: string, rowName: string = name): LightboxBoardShelf => ({
        ...NAMED, name, boards: [{ ...NAMED.boards[0], name: rowName }, SHELF.boards[1]]
      });

      it.each([
        ['the head', 'Rename the board on screen', null],
        ['a row', 'Rename the board saved Oct 22, 2026, 3:10 PM', NEWER]
      ])('in %s: an untouched field reopened before the answer follows it, and leaving sends nothing', (_where, action, fileId) => {
        const { props, rerender } = panel({ shelf: named('model A') });
        fireEvent.click(screen.getByRole('button', { name: action }));
        fireEvent.change(field(), { target: { value: 'model B' } });
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(props.onRename).toHaveBeenCalledWith(fileId, 'model B');

        // Reopened while the shelf still says model A; the writer types nothing.
        fireEvent.click(screen.getByRole('button', { name: action }));
        expect(field().value).toBe('model A');
        // The rename's answer lands while the field is open.
        rerender(<LightboxBoardsPanel {...props} shelf={named('model B')} />);
        expect(field().value).toBe('model B');
        fireEvent.blur(field());

        expect(props.onRename).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('textbox')).toBeNull();
      });

      it.each([
        ['the head', 'Rename the board on screen', null],
        ['a row', 'Rename the board saved Oct 22, 2026, 3:10 PM', NEWER]
      ])('in %s: the writer\'s own edit is kept through the answer, and sent', (_where, action, fileId) => {
        const { props, rerender } = panel({ shelf: named('model A') });
        fireEvent.click(screen.getByRole('button', { name: action }));
        fireEvent.change(field(), { target: { value: 'model C' } });

        rerender(<LightboxBoardsPanel {...props} shelf={named('model B')} />);
        expect(field().value).toBe('model C');
        fireEvent.keyDown(field(), { key: 'Enter' });

        expect(props.onRename).toHaveBeenCalledTimes(1);
        expect(props.onRename).toHaveBeenCalledWith(fileId, 'model C');
      });

      it('control: reopened after the answer, it shows the new name, and renaming back is sent, once', () => {
        const { props, rerender } = panel({ shelf: named('model A') });
        rerender(<LightboxBoardsPanel {...props} shelf={named('model B')} />);
        fireEvent.click(screen.getByRole('button', { name: 'Rename the board on screen' }));
        expect(field().value).toBe('model B');

        fireEvent.change(field(), { target: { value: 'model A' } });
        fireEvent.keyDown(field(), { key: 'Enter' });
        fireEvent.blur(screen.getByRole('button', { name: 'Rename the board on screen' }));

        expect(props.onRename).toHaveBeenCalledTimes(1);
        expect(props.onRename).toHaveBeenCalledWith(null, 'model A');
      });
    });

    it('leaving the field with a name the rule refuses keeps it open, with the writer\'s words and the reason; Escape then cancels (PR #164 N-01)', () => {
      const { props } = panel({ shelf: NAMED });
      fireEvent.click(screen.getByRole('button', { name: 'Rename the board saved Oct 22, 2026, 2:05 PM' }));
      fireEvent.change(field(), { target: { value: 'model\tC' } });

      fireEvent.blur(field());

      expect(props.onRename).not.toHaveBeenCalled();
      expect(field().value).toBe('model\tC');
      expect(screen.getByRole('alert').textContent).toBe('A board\'s name is one line, with no tabs or line breaks.');
      expect(field().getAttribute('aria-invalid')).toBe('true');

      field().focus();
      fireEvent.keyDown(field(), { key: 'Escape' });
      expect(props.onRename).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename the board saved Oct 22, 2026, 2:05 PM' }));
    });

    it('says a session-only name lasts as long as the session', () => {
      const { container } = panel({ shelf: { availability: { kind: 'session', reason: 'no-workspace' }, name: NAME, boards: [], unreadable: 0 } });
      expect(container.querySelector('.pm-lb-board-name')?.textContent).toBe(`${NAME}RenameA name lasts as long as this session, as the board does.`);
    });
  });

  describe('focus after a confirmed delete (5A tech debt)', () => {
    const THIRD = 'drafts-alice-1-md-9b099095/2026-10-22T13-00-00-000Z.board.json';
    const THREE: LightboxBoardShelf = {
      ...SHELF,
      boards: [...SHELF.boards, { ...SHELF.boards[1], fileId: THIRD, savedAt: Date.parse('2026-10-22T13:00:00.000Z') }]
    };
    const confirm = (when: string) => {
      fireEvent.click(screen.getByRole('button', { name: `Delete the board saved ${when}` }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    };

    it('stays on the row until it goes, then moves to the next row\'s Delete', () => {
      const { props, rerender } = panel({ shelf: THREE });
      confirm('Oct 22, 2026, 2:05 PM');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete the board saved Oct 22, 2026, 2:05 PM' }));

      rerender(<LightboxBoardsPanel {...props} shelf={{ ...THREE, boards: THREE.boards.filter((board) => board.fileId !== OLDER) }} />);

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete the board saved Oct 22, 2026, 1:00 PM' }));
    });

    it('moves to the head\'s Name when the last row goes', () => {
      const { props, rerender } = panel();
      confirm('Oct 22, 2026, 2:05 PM');

      rerender(<LightboxBoardsPanel {...props} shelf={{ ...SHELF, boards: [SHELF.boards[0]] }} />);

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Name the board on screen' }));
    });

    it('control: a delete the host refused keeps the row, and focus on its Delete', () => {
      const { props, rerender } = panel();
      confirm('Oct 22, 2026, 2:05 PM');

      rerender(<LightboxBoardsPanel {...props} shelf={{ ...SHELF, notice: 'That saved board could not be deleted. The output log says why.' }} />);

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete the board saved Oct 22, 2026, 2:05 PM' }));
    });
  });
});
