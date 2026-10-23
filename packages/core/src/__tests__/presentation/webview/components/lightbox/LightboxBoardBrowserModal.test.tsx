/** @jest-environment jsdom */

/**
 * The saved-board browser (Lightbox Slice 5A.2): every chapter's boards in
 * the shared saved-item browser, from the host's shelf through the pure view.
 * Rows (name, chapter, when, lenses, stale, cost, models, On screen), search
 * over names and chapter paths, both groupings, inline rename by the one name
 * rule, sending only the writer's edit, delete with a confirm and where focus
 * goes, Open and "Open a board file…", and session-only. Dates are local
 * times, shown in the local zone; names, paths and model ids are made up.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { LightboxBoardShelf, LightboxSavedBoardSummary } from '@messages';
import { LightboxBoardBrowserModal, type LightboxBoardBrowserModalProps } from '@components/lightbox/LightboxBoardBrowserModal';
import { buildLightboxBoardsBrowser } from '@hooks/domain/lightbox/lightboxBoardsView';
import { LIGHTBOX_BOARD_NAME_FAULTS } from '@shared/constants/lightboxBoardName';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

// Local times, so the date groups (told in the local zone, as the Workshop's are) hold in any zone the tests run in.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const NOW = new Date(at(23, 18));
const PROJECT = { kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false } as const;

const board = (overrides: Partial<LightboxSavedBoardSummary>): LightboxSavedBoardSummary => ({
  fileId: 'drafts-alice-1-md-9b099095/2026-10-23T14-08-00-000Z.board.json',
  name: 'alice-1 - 10/23/2026 2:08 PM',
  savedAt: at(23, 14, 8),
  source: { kind: 'file', displayPath: 'Drafts/alice-1.md' },
  wordCount: 508,
  lenses: [],
  staleLenses: [],
  onScreen: false,
  ...overrides
});

const SHELF: LightboxBoardShelf = {
  availability: PROJECT,
  boards: [
    board({ fileId: 'f/a', name: 'Chapter 6 - draft three', source: { kind: 'file', displayPath: 'Book/chapter-6.md' }, lenses: LIGHTBOX_LENSES.map((lens) => lens.id), staleLenses: ['headline'], costUsd: 0.07, models: ['provider/model-v1'], onScreen: true }),
    board({ fileId: 'f/b', name: '3.2.1 - after the cut - model B', savedAt: at(23, 9), lenses: ['characters'] }),
    board({ fileId: 'f/c', name: 'alice-1 - 10/20/2026 8:00 AM', savedAt: at(20, 8) }),
    board({ fileId: 'f/d', name: 'Chapter 6 - first pass', savedAt: new Date(2026, 8, 1, 8).getTime(), source: { kind: 'file', displayPath: 'Book/chapter-6.md' } })
  ],
  unreadable: 0
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
function Harness(overrides: Partial<LightboxBoardBrowserModalProps> & { shelf?: LightboxBoardShelf }) {
  const [query, setQuery] = React.useState('');
  return (
    <LightboxBoardBrowserModal
      open
      view={buildLightboxBoardsBrowser(overrides.shelf ?? SHELF)}
      query={query}
      opening={null}
      openingFile={false}
      reading={false}
      onQueryChange={setQuery}
      onOpen={jest.fn()}
      onOpenFile={jest.fn()}
      onRename={jest.fn()}
      onDelete={jest.fn()}
      onClose={jest.fn()}
      now={() => NOW}
      {...overrides}
    />
  );
}

const rowOf = (name: string) => screen.getByText(name, { selector: 'strong' }).closest('article') as HTMLElement;
const groups = () => [...document.querySelectorAll('.pm-ws-session-browser-group')].map((group) => [
  group.querySelector('.pm-ws-sessions-group-label')?.textContent,
  [...group.querySelectorAll('.pm-ws-session-row-title strong')].map((strong) => strong.textContent)
]);

beforeEach(() => {
  __resetOverlayFocusStateForTests();
});

describe('LightboxBoardBrowserModal', () => {
  it('shows every chapter\'s boards: name, chapter, when, lenses, stale, cost, models, and the one On screen', () => {
    render(<Harness />);
    expect(screen.getByRole('dialog', { name: 'Open a prior board' })).not.toBeNull();
    const onScreen = rowOf('Chapter 6 - draft three');
    expect(within(onScreen).getByText('On screen')).not.toBeNull();
    expect(onScreen.querySelector('.pm-ws-session-row-meta')?.textContent).toBe('Book/chapter-6.md·Oct 23, 2026, 2:08 PM·Every lens read·1 stale·≈ $0.07');
    expect(onScreen.querySelector('.pm-lb-board-models')?.textContent).toBe('Read by model-v1');
    expect((within(onScreen).getByRole('button', { name: 'Open Chapter 6 - draft three' }) as HTMLButtonElement).disabled).toBe(true);
    expect(rowOf('3.2.1 - after the cut - model B').querySelector('.pm-ws-session-row-meta')?.textContent)
      .toBe('Drafts/alice-1.md·Oct 23, 2026, 9:00 AM·1 lens read');
    expect(rowOf('3.2.1 - after the cut - model B').querySelector('.pm-lb-board-models')).toBeNull();
    expect(screen.getByText(/one file per board/).textContent).toContain('Saved in prose-minion/boards, one file per board.');
  });

  it('groups by date, Today, This week, Earlier, and by chapter', () => {
    render(<Harness />);
    expect(groups()).toEqual([
      ['Today 2', ['Chapter 6 - draft three', '3.2.1 - after the cut - model B']],
      ['This week 1', ['alice-1 - 10/20/2026 8:00 AM']],
      ['Earlier 1', ['Chapter 6 - first pass']]
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Chapter' }));
    expect(groups()).toEqual([
      ['Book/chapter-6.md 2', ['Chapter 6 - draft three', 'Chapter 6 - first pass']],
      ['Drafts/alice-1.md 2', ['3.2.1 - after the cut - model B', 'alice-1 - 10/20/2026 8:00 AM']]
    ]);
  });

  it('searches names and chapter paths', () => {
    render(<Harness />);
    const search = screen.getByRole('searchbox', { name: 'Search board names and chapters' });
    fireEvent.change(search, { target: { value: 'chapter-6' } });
    expect(groups().flatMap(([, names]) => names)).toEqual(['Chapter 6 - draft three', 'Chapter 6 - first pass']);
    fireEvent.change(search, { target: { value: 'model b' } });
    expect(groups().flatMap(([, names]) => names)).toEqual(['3.2.1 - after the cut - model B']);
    fireEvent.change(search, { target: { value: 'nothing at all' } });
    expect(screen.getByText('No saved boards match this search.')).not.toBeNull();
  });

  it('opens a row, by its button or the row; and "Open a board file…" asks the host\'s picker', () => {
    const onOpen = jest.fn();
    const onOpenFile = jest.fn();
    render(<Harness onOpen={onOpen} onOpenFile={onOpenFile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open 3.2.1 - after the cut - model B' }));
    fireEvent.click(rowOf('Chapter 6 - first pass'));
    // The board on screen does not open again.
    fireEvent.click(rowOf('Chapter 6 - draft three'));
    expect(onOpen.mock.calls).toEqual([['f/b'], ['f/d']]);
    fireEvent.click(screen.getByRole('button', { name: 'Open a board file…' }));
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });

  it('holds Open back while a run reads the board on screen, or a board is opening', () => {
    const { rerender } = render(<Harness reading />);
    expect((screen.getByRole('button', { name: 'Open 3.2.1 - after the cut - model B' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Open a board file…' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<Harness opening="f/b" />);
    expect(screen.getByRole('button', { name: 'Open 3.2.1 - after the cut - model B' }).textContent).toBe('Opening…');
  });

  it('renames in place by the one name rule, sending only the writer\'s own edit', () => {
    const onRename = jest.fn();
    render(<Harness onRename={onRename} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename 3.2.1 - after the cut - model B' }));
    const field = () => screen.getByRole('textbox', { name: 'Rename board' }) as HTMLInputElement;
    expect(field().maxLength).toBe(120);

    // Leaving untouched sends nothing.
    fireEvent.blur(field());
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Rename 3.2.1 - after the cut - model B' }));
    fireEvent.change(field(), { target: { value: '3.2.1\tafter the cut' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe(LIGHTBOX_BOARD_NAME_FAULTS['not-one-line']);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(field(), { target: { value: '' } });
    fireEvent.blur(field());
    expect(screen.getByRole('alert').textContent).toMatch(/needs a name/);
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.change(field(), { target: { value: '  3.2.2 - model C  ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('f/b', '3.2.2 - model C');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename 3.2.1 - after the cut - model B' }));
  });

  it('deletes after a confirm, with focus on Keep, back on Delete, and on to the next row once it has gone', () => {
    const onDelete = jest.fn();
    const { rerender } = render(<Harness onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete 3.2.1 - after the cut - model B' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep 3.2.1 - after the cut - model B' }));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete 3.2.1 - after the cut - model B' }));
    expect(screen.getByRole('dialog')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete 3.2.1 - after the cut - model B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete 3.2.1 - after the cut - model B' }));
    expect(onDelete).toHaveBeenCalledWith('f/b');
    act(() => {
      rerender(<Harness onDelete={onDelete} shelf={{ ...SHELF, boards: SHELF.boards.filter((row) => row.fileId !== 'f/b') }} />);
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete alice-1 - 10/20/2026 8:00 AM' }));
  });

  it('says boards last only for the session, session-only, and still offers a board file', () => {
    render(<Harness shelf={{ availability: { kind: 'session', reason: 'multi-root' }, boards: [], unreadable: 0 }} />);
    expect(screen.getByRole('status').textContent).toContain('Boards are kept for this session only: several folders are open.');
    expect(screen.getByText('Boards are kept for this session only, so there are none to open here.')).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Open a board file…' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('says what it could not list', () => {
    render(<Harness shelf={{ ...SHELF, unreadable: 2, unreadableFolders: 1, notice: 'That saved board is no longer in the boards folder.' }} />);
    expect(screen.getByRole('alert').textContent).toContain('That saved board is no longer in the boards folder.');
    expect(screen.getByText(/2 files in the boards folder could not be read/)).not.toBeNull();
    expect(screen.getByText(/1 chapter's folder could not be read/)).not.toBeNull();
  });
});
