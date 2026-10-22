/** @jest-environment jsdom */

/**
 * The rail's Boards section (Slice 5A; epic decision 31): newest first, the
 * board on screen marked, Open by file, Delete confirmed in the row (focus on
 * Keep, Escape keeps), and "Read the current text" offered only when a board
 * opened from a file no longer matches it. Dates are pinned to UTC.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LightboxBoardShelf } from '@messages';
import { LightboxBoardsPanel, LightboxBoardsPanelProps } from '@components/lightbox/LightboxBoardsPanel';

const NEWER = 'drafts-alice-1-md/2026-10-22T15-10-00-000Z.board.json';
const OLDER = 'drafts-alice-1-md/2026-10-22T14-05-09-123Z.board.json';
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

  it('says boards are kept for the session only, with nothing to open', () => {
    const { container } = panel({ shelf: { availability: { kind: 'session', reason: 'no-workspace' }, boards: [], unreadable: 0 } });
    expect(container.querySelector('.pm-lb-boards-note')?.textContent)
      .toBe('Boards are kept for this session only: no folder is open. Open one folder to save them.');
    expect(container.querySelector('.pm-lb-boards-list')).toBeNull();
    expect(container.querySelector('.pm-ws-block-head')?.textContent).toBe('Boardsthis session');
  });
});
