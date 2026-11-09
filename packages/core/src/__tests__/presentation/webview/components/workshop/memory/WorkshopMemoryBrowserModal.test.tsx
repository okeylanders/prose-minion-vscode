/** @jest-environment jsdom */

/**
 * The memory manager (Slice 4b-ui) on the shared saved-item browser: its
 * three sections, the actions every row offers (mutations by `mem-` id,
 * Open file by `entryKey` alone), files that need attention offering Open
 * file only, the over-budget and refused states, and focus returning to
 * what opened it.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  WorkshopMemoryBrowserModal,
  type WorkshopMemoryBrowserModalProps
} from '@components/workshop/memory/WorkshopMemoryBrowserModal';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';
import { FULL_OVER, managerLibrary } from '../../../hooks/domain/workshop/memory/workshopMemoryFixtures';

const ESTIMATE = {
  memories: 6,
  pinned: 4,
  pinnedLoaded: 4,
  pinnedTokens: 4_290,
  pinnedOver: false,
  catalogTokens: 702,
  frameTokens: 5_050,
  pinnedLoadedTokens: 4_290,
  catalogEntries: 2
};

function props(overrides: Partial<WorkshopMemoryBrowserModalProps> = {}): WorkshopMemoryBrowserModalProps {
  return {
    open: true,
    mode: 'ask',
    workspace: { kind: 'available' },
    library: managerLibrary(),
    estimate: ESTIMATE,
    query: '',
    actionPending: false,
    now: new Date(2026, 10, 3, 18, 0, 0),
    onQueryChange: jest.fn(),
    onRename: jest.fn(),
    onDelete: jest.fn(),
    onOpenFolder: jest.fn(),
    onNewMemory: jest.fn(),
    onClose: jest.fn(),
    onEdit: jest.fn(),
    onRestore: jest.fn(),
    onArchive: jest.fn(),
    onToggleLoadInFull: jest.fn(),
    onOpenFile: jest.fn(),
    ...overrides
  };
}

function renderManager(overrides: Partial<WorkshopMemoryBrowserModalProps> = {}) {
  const given = props(overrides);
  const view = render(<WorkshopMemoryBrowserModal {...given} />);
  act(() => {
    jest.runOnlyPendingTimers();
  });
  return { props: given, view };
}

const rowOf = (title: string) => screen.getByText(title, { selector: 'strong' }).closest('article') as HTMLElement;
const sectionTitles = () => [...document.querySelectorAll('.pm-ws-sessions-section-title')].map((title) => title.firstChild?.textContent?.trim());

beforeEach(() => {
  __resetOverlayFocusStateForTests();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('WorkshopMemoryBrowserModal', () => {
  it('is the session browser’s dialog: its words, search focused, the status labels, three sections', () => {
    renderManager();
    expect(screen.getByRole('dialog', { name: 'Project memories' })).not.toBeNull();
    expect(screen.getByText('Workshop · Project memory')).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search project memories' }));
    expect(screen.getByText('searches notes')).not.toBeNull();
    expect(['6 active', '4 in full · ≈ 4,300 of 5,000 tokens', 'list · ≈ 700 of 2,000 tokens', '3 files need attention']
      .every((text) => screen.queryByText(text))).toBe(true);
    expect(sectionTitles()).toEqual(['Needs attention', 'Active', 'Superseded and archived']);
    expect([...document.querySelectorAll('.pm-ws-sessions-group-label')].map((label) => label.textContent)).toEqual([
      'Decisions 2', 'Canon 2', 'Open threads 1', 'Preferences 1'
    ]);
  });

  it('groups by date on request, and routes the search to the host', () => {
    const { props: given } = renderManager();
    fireEvent.click(screen.getByRole('button', { name: 'Date' }));
    expect([...document.querySelectorAll('.pm-ws-sessions-group-label')].map((label) => label.textContent)).toEqual(['Today 2', 'This week 4']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search project memories' }), { target: { value: 'rabbit' } });
    expect(given.onQueryChange).toHaveBeenCalledWith('rabbit');
  });

  it('a memory’s row: origin in words, the badge, and its actions by id; Open file by entry key', () => {
    const { props: given } = renderManager();
    const kitchen = rowOf('Keep the Duchess’s kitchen offstage');
    expect(within(kitchen).getByText('suggested by Cliff · saved by you')).not.toBeNull();
    expect(within(kitchen).getByText('Loaded in full')).not.toBeNull();

    const toggle = within(kitchen).getByRole('button', { name: 'Always load in full: Keep the Duchess’s kitchen offstage' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(given.onToggleLoadInFull).toHaveBeenCalledWith('mem-1a0002', false);

    const watch = rowOf('The Rabbit’s watch runs backward');
    fireEvent.click(within(watch).getByRole('button', { name: 'Always load in full: The Rabbit’s watch runs backward' }));
    expect(given.onToggleLoadInFull).toHaveBeenLastCalledWith('mem-7f3c21', true);
    fireEvent.click(within(watch).getByRole('button', { name: 'Archive The Rabbit’s watch runs backward' }));
    expect(given.onArchive).toHaveBeenCalledWith('mem-7f3c21');
    fireEvent.click(within(watch).getByRole('button', { name: 'Open the file for The Rabbit’s watch runs backward' }));
    expect(given.onOpenFile).toHaveBeenCalledWith('key-watch');
    fireEvent.click(within(watch).getByRole('button', { name: 'Edit' }));
    expect(given.onEdit).toHaveBeenCalledWith('mem-7f3c21');
  });

  it('rename and delete are the shared row’s, sent by id; delete waits for its confirm', () => {
    const { props: given } = renderManager();
    const watch = rowOf('The Rabbit’s watch runs backward');
    fireEvent.click(within(watch).getByRole('button', { name: 'Rename The Rabbit’s watch runs backward' }));
    const field = screen.getByRole('textbox', { name: 'Rename memory' }) as HTMLInputElement;
    expect(field.maxLength).toBe(120);
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe('A memory needs a title.');
    fireEvent.change(field, { target: { value: 'The Rabbit’s watch runs backward, always' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(given.onRename).toHaveBeenCalledWith('mem-7f3c21', 'The Rabbit’s watch runs backward, always');

    fireEvent.click(within(rowOf('The Rabbit’s watch runs backward')).getByRole('button', { name: 'Delete The Rabbit’s watch runs backward' }));
    expect(given.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete The Rabbit’s watch runs backward' }));
    expect(given.onDelete).toHaveBeenCalledWith('mem-7f3c21');
  });

  it('files that need attention offer Open file only, each by its own key', () => {
    const { props: given } = renderManager();
    const copyA = rowOf('rabbit-watch-runs-backward-7f3c2a.md');
    const copyB = rowOf('rabbit-watch-copy-7f3c2a.md');
    const unreadable = rowOf('tea-party-seating-1a9e04.md');
    for (const row of [copyA, copyB, unreadable]) {
      expect(within(row).getAllByRole('button').map((button) => button.textContent)).toEqual(['Open file']);
    }
    expect(within(copyA).getByText('Same id')).not.toBeNull();
    expect(within(unreadable).getByText('Can’t read')).not.toBeNull();
    fireEvent.click(within(copyA).getByRole('button', { name: 'Open file rabbit-watch-runs-backward-7f3c2a.md' }));
    fireEvent.click(within(copyB).getByRole('button', { name: 'Open file rabbit-watch-copy-7f3c2a.md' }));
    expect((given.onOpenFile as jest.Mock).mock.calls).toEqual([['key-copy-a'], ['key-copy-b']]);
  });

  it('a set-aside copy shows its reason with no Open file', () => {
    renderManager({ library: { ...managerLibrary(), unreadable: [{ entryKey: 'key-aside', fileName: 'cheshire-cat-1a0005.md', reason: 'set-aside' }] } });
    const aside = rowOf('cheshire-cat-1a0005.md');
    expect(within(aside).getByText('Set aside')).not.toBeNull();
    expect(within(aside).queryAllByRole('button')).toHaveLength(0);
  });

  it('superseded and archived rows: Edit or Restore, no Always load in full or Archive', () => {
    const { props: given } = renderManager();
    const stops = rowOf('The Rabbit’s watch stops at six');
    expect(within(stops).getByText('Superseded by “The Rabbit’s watch runs backward”.')).not.toBeNull();
    expect(within(stops).queryByRole('button', { name: /Always load in full/ })).toBeNull();
    expect(within(stops).queryByRole('button', { name: /^Archive/ })).toBeNull();
    const tense = rowOf('Alice narrates in present tense');
    fireEvent.click(within(tense).getByRole('button', { name: 'Restore' }));
    expect(given.onRestore).toHaveBeenCalledWith('mem-1a0008');
  });

  it('over its budget: the amber label and status line, and Doesn’t fit in full on the builder’s row', () => {
    renderManager({ library: managerLibrary(true), estimate: { ...FULL_OVER, memories: 6 } });
    expect(screen.getByText('4 set to load in full · 3 loaded · ≈ 5,600 requested of 5,000 tokens').className).toBe('pm-ws-memory-chip pm-ws-memory-chip-warn');
    expect(screen.getByText(/considered oldest-created first, and “The Cheshire Cat is never seen arriving” doesn’t fit/)).not.toBeNull();
    const cat = rowOf('The Cheshire Cat is never seen arriving');
    expect(within(cat).getByText('Doesn’t fit in full')).not.toBeNull();
    expect(within(cat).queryByText('Loaded in full')).toBeNull();
  });

  it('a refused Always load in full shows under its row', () => {
    renderManager({ refusal: { entryKey: 'key-watch', wouldBeTokens: 5_080 } });
    expect(within(rowOf('The Rabbit’s watch runs backward')).getByRole('status').textContent)
      .toBe('Can’t load this one in full: memories loaded in full would come to about 5,100 of 5,000 tokens. Turn it off on another, or shorten this note.');
  });

  it('memory off: the info line, and every action still works', () => {
    const { props: given } = renderManager({ mode: 'off' });
    expect(screen.getByText(/Memory is off, so personas don’t read these/)).not.toBeNull();
    fireEvent.click(within(rowOf('The Rabbit’s watch runs backward')).getByRole('button', { name: 'Archive The Rabbit’s watch runs backward' }));
    expect(given.onArchive).toHaveBeenCalled();
  });

  it('an action in flight, or another window’s claim, holds the writes but not Open file', () => {
    renderManager({ actionPending: true });
    const watch = rowOf('The Rabbit’s watch runs backward');
    expect((within(watch).getByRole('button', { name: 'Edit' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(watch).getByRole('button', { name: /^Archive/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(watch).getByRole('button', { name: /^Open the file/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('the footer: Open memory folder and New memory call back', () => {
    const { props: given } = renderManager();
    fireEvent.click(screen.getByRole('button', { name: 'Open memory folder' }));
    fireEvent.click(screen.getByRole('button', { name: 'New memory' }));
    expect(given.onOpenFolder).toHaveBeenCalledTimes(1);
    expect(given.onNewMemory).toHaveBeenCalledTimes(1);
  });

  it('unavailable while open: the reason, the search and every write off', () => {
    renderManager({ workspace: { kind: 'unavailable', reason: 'multi-root' } });
    expect(screen.getByRole('status').textContent?.trim())
      .toBe('Project memory isn’t available here: this workspace has several folders. Open a single folder to use project memory.');
    expect((screen.getByRole('searchbox', { name: 'Search project memories' }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'New memory' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a folder that can’t be listed says the files weren’t touched', () => {
    renderManager({ workspace: { kind: 'unknown' } });
    expect(screen.getByRole('alert').textContent?.trim()).toBe('The memory folder couldn’t be listed just now. Your memory files weren’t touched.');
  });

  describe('an open rename after its row locks (PR #199 F-01)', () => {
    const LOCKS: Array<[string, (given: WorkshopMemoryBrowserModalProps, title: string) => Partial<WorkshopMemoryBrowserModalProps>]> = [
      ['the memory goes busy', (given, title) => ({
        library: { ...given.library, memories: given.library.memories.map((entry) => (entry.title === title ? { ...entry, busy: true } : entry)) }
      })],
      ['an action starts', () => ({ actionPending: true })],
      ['the workspace goes', () => ({ workspace: { kind: 'unavailable', reason: 'multi-root' } })]
    ];
    const ROWS = [['Active', 'The Rabbit’s watch runs backward'], ['Past', 'The Rabbit’s watch stops at six']] as const;

    for (const [section, title] of ROWS) {
      for (const [lock, locked] of LOCKS) {
        for (const how of ['Enter', 'blur'] as const) {
          it(`${section} row: ${how} after ${lock} sends nothing`, () => {
            const given = props();
            const view = render(<WorkshopMemoryBrowserModal {...given} />);
            act(() => {
              jest.runOnlyPendingTimers();
            });
            fireEvent.click(within(rowOf(title)).getByRole('button', { name: `Rename ${title}` }));
            const field = screen.getByRole('textbox', { name: 'Rename memory' }) as HTMLInputElement;
            fireEvent.change(field, { target: { value: 'Changed while free' } });

            view.rerender(<WorkshopMemoryBrowserModal {...given} {...locked(given, title)} />);
            if (how === 'Enter') {
              fireEvent.keyDown(field, { key: 'Enter' });
            } else {
              fireEvent.blur(field);
            }
            expect(given.onRename).not.toHaveBeenCalled();
            expect(screen.queryByRole('textbox', { name: 'Rename memory' })).toBeNull();
          });
        }
      }
    }

    it('a busy memory still opens its file', () => {
      const given = props();
      const library = { ...given.library, memories: given.library.memories.map((entry) => (entry.entryKey === 'key-watch' ? { ...entry, busy: true } : entry)) };
      render(<WorkshopMemoryBrowserModal {...given} library={library} />);
      const open = within(rowOf('The Rabbit’s watch runs backward')).getByRole('button', { name: /^Open the file/ }) as HTMLButtonElement;
      expect(open.disabled).toBe(false);
      fireEvent.click(open);
      expect(given.onOpenFile).toHaveBeenCalledWith('key-watch');
    });
  });

  it('closing returns focus to what opened it', () => {
    const Harness: React.FC = () => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Manage memories…</button>
          <WorkshopMemoryBrowserModal {...props({ open, onClose: () => setOpen(false) })} />
        </>
      );
    };
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Manage memories…' });
    opener.focus();
    fireEvent.click(opener);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(screen.getByRole('dialog', { name: 'Project memories' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close project memories' }));
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('never says pin', () => {
    const { view } = renderManager({ library: managerLibrary(true), estimate: FULL_OVER });
    expect(view.baseElement.textContent).not.toMatch(/\bpin/i);
    const names = [...view.baseElement.querySelectorAll('[aria-label]')].map((element) => element.getAttribute('aria-label'));
    expect(names.join(' ')).not.toMatch(/\bpin/i);
  });
});
