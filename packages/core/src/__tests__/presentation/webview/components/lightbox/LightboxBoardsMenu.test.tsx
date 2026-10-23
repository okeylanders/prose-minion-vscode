/** @jest-environment jsdom */

/**
 * The Boards menu in the Lightbox's header (Slice 5A.2), Workshop-style:
 * the trigger names the board on screen and whether it is saved; the menu
 * holds Rename board…, Board another chapter…, Open prior board…, the five
 * newest boards of every chapter (each opening directly; the one on screen
 * does not), and Browse all boards…; session-only, it says boards last the
 * session. Keyboard: opening focuses the first enabled item, Escape closes
 * and returns focus to the trigger. Names and paths are made up.
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { LightboxBoardShelf, LightboxSavedBoardSummary } from '@messages';
import { LightboxBoardsMenu, type LightboxBoardsMenuProps } from '@components/lightbox/LightboxBoardsMenu';
import { buildLightboxBoardsMenu, type LightboxBoardsOnScreen } from '@hooks/domain/lightbox/lightboxBoardsView';

const CHAPTER = { kind: 'file', displayPath: 'Drafts/alice-1.md' } as const;
const board = (index: number, overrides: Partial<LightboxSavedBoardSummary> = {}): LightboxSavedBoardSummary => ({
  fileId: `f/${index}`,
  name: `board ${index}`,
  savedAt: Date.now() - index * 3_600_000,
  source: index % 2 === 0 ? CHAPTER : { kind: 'file', displayPath: 'Book/chapter-6.md' },
  wordCount: 508,
  lenses: [],
  staleLenses: [],
  onScreen: false,
  ...overrides
});
const SHELF: LightboxBoardShelf = {
  availability: { kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false },
  name: 'board 0',
  boards: Array.from({ length: 7 }, (_, index) => board(index, { onScreen: index === 0 })),
  unreadable: 0
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
function Harness(props: Partial<LightboxBoardsMenuProps> & { shelf?: LightboxBoardShelf | null; onScreen?: LightboxBoardsOnScreen }) {
  const [open, setOpen] = React.useState(props.open ?? false);
  return (
    <LightboxBoardsMenu
      open={open}
      view={buildLightboxBoardsMenu(props.shelf === undefined ? SHELF : props.shelf, props.onScreen === undefined ? CHAPTER : props.onScreen)}
      openDisabled={props.openDisabled ?? false}
      onOpenChange={setOpen}
      onRename={props.onRename ?? jest.fn()}
      onBoardAnotherChapter={props.onBoardAnotherChapter ?? jest.fn()}
      onBrowse={props.onBrowse ?? jest.fn()}
      onOpenBoard={props.onOpenBoard ?? jest.fn()}
    />
  );
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('LightboxBoardsMenu', () => {
  it('names the board on screen and says it is saved', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /board 0/ }).getAttribute('aria-haspopup')).toBe('menu');
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });

  it('holds the commands, the five newest boards of every chapter, and Browse all', () => {
    render(<Harness open />);
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Rename board…',
      'Board another chapter…',
      'Open prior board…',
      'board 0Drafts/alice-1.md · on screen',
      expect.stringMatching(/^board 1Book\/chapter-6\.md · 1h ago$/),
      expect.stringMatching(/^board 2Drafts\/alice-1\.md · 2h ago$/),
      expect.stringMatching(/^board 3Book\/chapter-6\.md · 3h ago$/),
      expect.stringMatching(/^board 4Drafts\/alice-1\.md · 4h ago$/),
      'Browse all boards…'
    ]);
    expect((screen.getByRole('menuitem', { name: /board 0/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('routes each command, closing the menu first', () => {
    const onRename = jest.fn();
    const onBoardAnotherChapter = jest.fn();
    const onBrowse = jest.fn();
    const onOpenBoard = jest.fn();
    render(<Harness onRename={onRename} onBoardAnotherChapter={onBoardAnotherChapter} onBrowse={onBrowse} onOpenBoard={onOpenBoard} />);
    const trigger = screen.getByRole('button', { name: /board 0/ });
    for (const name of ['Rename board…', 'Board another chapter…', 'Open prior board…', 'Browse all boards…']) {
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole('menuitem', { name }));
      expect(screen.queryByRole('menu')).toBeNull();
    }
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: /^board 3/ }));
    expect([onRename, onBoardAnotherChapter].map((fn) => fn.mock.calls.length)).toEqual([1, 1]);
    expect(onBrowse).toHaveBeenCalledTimes(2);
    expect(onOpenBoard).toHaveBeenCalledWith('f/3');
  });

  it('is keyboard reachable: opening focuses the first enabled item, Escape closes it and focus returns to the trigger', () => {
    render(<Harness onScreen={null} shelf={{ ...SHELF, name: undefined, boards: SHELF.boards.map((row) => ({ ...row, onScreen: false })) }} />);
    const trigger = screen.getByRole('button', { name: /Boards/ });
    fireEvent.click(trigger);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    // No board on screen: Rename is disabled, so focus starts at Board another chapter….
    expect((screen.getByRole('menuitem', { name: 'Rename board…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Board another chapter…' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('holds recent boards back while a board opens or a run reads', () => {
    render(<Harness open openDisabled />);
    expect((screen.getByRole('menuitem', { name: /^board 1/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('says boards last only for the session, session-only, and that there are none yet', () => {
    render(<Harness open shelf={{ availability: { kind: 'session', reason: 'no-workspace' }, name: 'board 9', boards: [], unreadable: 0 }} />);
    expect(screen.getByRole('status').textContent).toBe('This session only');
    expect(screen.getByText('Boards are kept for this session only: no folder is open. Open one folder to save them.')).not.toBeNull();
    expect(screen.getByText('No saved boards yet.')).not.toBeNull();
  });
});
