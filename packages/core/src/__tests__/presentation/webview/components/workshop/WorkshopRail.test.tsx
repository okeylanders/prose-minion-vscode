/** @jest-environment jsdom */

/**
 * WorkshopRail (ADR 2026-11-03 D1): two file-style tabs over the rail's
 * panels, wired as WAI-ARIA tabs with automatic activation.
 */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { WorkshopRail, WorkshopRailProps } from '@components/workshop/WorkshopRail';
import {
  useWorkshopRailTabs,
  WorkshopRailTab
} from '@hooks/domain/workshop/controllers/useWorkshopRailTabs';
import {
  WorkshopBookmarkSummary,
  WorkshopContextAttachmentSnapshot,
  WorkshopTodoItem
} from '@messages';
import type { ContextSourceEntry } from '@shared/types';

const readInRow = (label: string, deliveredAt = 1_000): ContextSourceEntry => ({
  kind: 'resource',
  origin: 'host',
  label,
  configuredResource: { group: 'characters', path: label },
  sizeChars: 120,
  isEstimate: true,
  deliveredAt
});

const attachment: WorkshopContextAttachmentSnapshot = {
  id: 'ctx-1',
  kind: 'file',
  origin: 'writer',
  label: 'character-sheet-raven.md',
  words: 1_240,
  relativePath: 'Characters/Raven/character-sheet-raven.md',
  addedAt: 1
};

const todo = (id: string, overrides: Partial<WorkshopTodoItem> = {}): WorkshopTodoItem => ({
  id,
  text: `Check the cup in scene ${id}.`,
  status: 'open',
  source: {
    kind: 'tool_report',
    turnId: `report-${id}`,
    participantLabel: 'Continuity',
    toolId: 'continuity',
    findingKey: `finding-${id}`,
    findingText: 'x',
    excerptVersion: 1
  },
  createdAt: 1,
  stale: false,
  ...overrides
});

const bookmark = (id: string, inWindow = true): WorkshopBookmarkSummary => ({
  id,
  turnId: `turn-${id}`,
  label: `Jill · Bookmark ${id}`,
  participant: 'host',
  personaId: 'jill',
  inWindow
});

const panelProps = (
  todos: WorkshopTodoItem[] = [],
  readIn: ContextSourceEntry[] = [],
  bookmarks: WorkshopBookmarkSummary[] = []
): Omit<WorkshopRailProps, 'tabs' | 'roomKey'> => ({
  excerpt: {
    excerpt: null,
    shelvedExcerpt: null,
    scope: 'excerpt',
    hostLabel: 'Jill',
    isRunning: false,
    roomHasMemory: false,
    onOpenPasteSheet: jest.fn(),
    onChooseFile: jest.fn(),
    onRereadFile: jest.fn(),
    onContinueWithExcerpt: jest.fn(),
    onRepinExcerpt: jest.fn(),
    onSetAside: jest.fn(),
    onStartOpenConversation: jest.fn()
  },
  context: {
    attachments: [attachment],
    pendingDelivery: false,
    isRunning: false,
    onAddText: jest.fn(),
    onAddFile: jest.fn(),
    onRefreshFiles: jest.fn(),
    onOpenAttachment: jest.fn(),
    onRemove: jest.fn(),
    wizardRunning: false,
    onRunWizard: jest.fn(),
    onCancelWizard: jest.fn()
  },
  readIn: {
    entries: readIn,
    participantIdentity: 'jill',
    participantLabel: 'Jill',
    onOpenReader: jest.fn(),
    onJump: jest.fn()
  },
  todos: { todos, onAction: jest.fn(), onShowSource: jest.fn() },
  bookmarks: { bookmarks, onOpen: jest.fn(), onRename: jest.fn(), onRemove: jest.fn() }
});

const StatefulRail: React.FC<{
  props: Omit<WorkshopRailProps, 'tabs' | 'roomKey'>;
  initialTab?: WorkshopRailTab;
  roomKey?: string;
}> = ({ props, initialTab, roomKey = 'room:1' }) => {
  const tabs = useWorkshopRailTabs({
    todos: props.todos.todos,
    roomKey,
    readIn: props.readIn.entries,
    readInKey: props.readIn.participantIdentity,
    bookmarks: props.bookmarks.bookmarks,
    initialTab
  });
  return <WorkshopRail tabs={tabs} roomKey={roomKey} {...props} />;
};

const renderRail = (todos: WorkshopTodoItem[] = [], initialTab?: WorkshopRailTab) => {
  const props = panelProps(todos);
  const view = render(<StatefulRail props={props} initialTab={initialTab} />);
  return { ...view, props };
};

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('WorkshopRail', () => {
  it('wires the tab list, tabs, and panel with ARIA roles', () => {
    renderRail();
    const list = screen.getByRole('tablist', { name: 'Rail sections' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs).toHaveLength(2);

    const [material, notes] = tabs;
    expect(material.getAttribute('aria-selected')).toBe('true');
    expect(notes.getAttribute('aria-selected')).toBe('false');
    expect(material.tabIndex).toBe(0);
    expect(notes.tabIndex).toBe(-1);
    expect(material.getAttribute('aria-controls')).toBeTruthy();
    expect(notes.getAttribute('aria-controls')).toBeTruthy();
    expect(material.getAttribute('aria-controls')).not.toBe(notes.getAttribute('aria-controls'));

    const panel = screen.getByRole('tabpanel');
    expect(panel.id).toBe(material.getAttribute('aria-controls'));
    expect(panel.getAttribute('aria-labelledby')).toBe(material.id);
    expect(screen.getByRole('tabpanel', { name: /Material/ })).toBe(panel);

    // Every tab's aria-controls names a panel that exists, selected or not
    // (PR #184 N-01); the inactive one is hidden, not removed.
    for (const each of tabs) {
      const controlled = document.getElementById(each.getAttribute('aria-controls')!);
      expect(controlled).not.toBeNull();
      expect(controlled!.getAttribute('role')).toBe('tabpanel');
      expect(controlled!.getAttribute('aria-labelledby')).toBe(each.id);
      expect(controlled!.hidden).toBe(each.getAttribute('aria-selected') !== 'true');
    }
  });

  it('keeps an empty panel in the tab sequence (PR #184 N-02)', () => {
    renderRail([], 'notes');
    const panel = screen.getByRole('tabpanel', { name: /Notes/ });
    expect(within(panel).queryByRole('button')).toBeNull();
    expect(panel.tabIndex).toBe(0);
    expect(document.getElementById(tab(/^Material/).getAttribute('aria-controls')!)!.tabIndex).toBe(0);
  });

  it('keeps an unsaved to-do edit across a tab switch, then saves that draft (PR #184 F-01)', () => {
    const { props } = renderRail([todo('draft')], 'notes');
    fireEvent.click(screen.getByRole('button', { name: 'Edit task' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit task text' }), {
      target: { value: 'Unsaved writer correction' }
    });

    fireEvent.click(tab(/^Material/));
    expect(screen.queryByRole('textbox', { name: 'Edit task text' })).toBeNull();
    fireEvent.click(tab(/^Notes/));

    const input = screen.getByRole('textbox', { name: 'Edit task text' }) as HTMLInputElement;
    expect(input.value).toBe('Unsaved writer correction');
    expect(props.todos.onAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));
    expect(props.todos.onAction).toHaveBeenCalledWith({
      action: 'edit',
      todoId: 'draft',
      text: 'Unsaved writer correction'
    });
  });

  it('still cancels an edit with Escape, and never autosaves on a tab switch', () => {
    const { props } = renderRail([todo('draft')], 'notes');
    fireEvent.click(screen.getByRole('button', { name: 'Edit task' }));
    const input = screen.getByRole('textbox', { name: 'Edit task text' });
    fireEvent.change(input, { target: { value: 'Second thoughts' } });
    fireEvent.click(tab(/^Material/));
    fireEvent.click(tab(/^Notes/));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit task text' }), { key: 'Escape' });

    expect(screen.queryByRole('textbox', { name: 'Edit task text' })).toBeNull();
    expect(screen.getByText('Check the cup in scene draft.')).toBeTruthy();
    expect(props.todos.onAction).not.toHaveBeenCalled();
  });

  it('drops a draft when the room is replaced, or when its task leaves the list', () => {
    const props = panelProps([todo('1'), todo('2')]);
    const { rerender } = render(<StatefulRail props={props} initialTab="notes" />);
    const [firstEdit] = screen.getAllByRole('button', { name: 'Edit task' });
    fireEvent.click(firstEdit);
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit task text' }), {
      target: { value: 'Old room draft' }
    });

    // New, Open, Rewind and Branch bring a new room generation: same ids,
    // different room. The draft must not carry over.
    rerender(<StatefulRail props={props} initialTab="notes" roomKey="room:2" />);
    expect(screen.queryByRole('textbox', { name: 'Edit task text' })).toBeNull();

    const [againEdit] = screen.getAllByRole('button', { name: 'Edit task' });
    fireEvent.click(againEdit);
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit task text' }), {
      target: { value: 'Draft for a task about to go' }
    });
    const withoutFirst = { ...props, todos: { ...props.todos, todos: [todo('2')] } };
    rerender(<StatefulRail props={withoutFirst} initialTab="notes" roomKey="room:2" />);
    expect(screen.queryByRole('textbox', { name: 'Edit task text' })).toBeNull();

    // The id coming back does not revive the dropped draft.
    rerender(<StatefulRail props={props} initialTab="notes" roomKey="room:2" />);
    expect(screen.queryByRole('textbox', { name: 'Edit task text' })).toBeNull();
    expect(props.todos.onAction).not.toHaveBeenCalled();
  });

  it('moves focus and selection with the arrow, Home, and End keys', () => {
    renderRail();
    const material = tab(/^Material/);
    material.focus();

    fireEvent.keyDown(material, { key: 'ArrowRight' });
    const notes = tab(/^Notes/);
    expect(notes.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(notes);
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(notes.id);

    fireEvent.keyDown(notes, { key: 'ArrowRight' });
    expect(tab(/^Material/).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab(/^Material/));

    fireEvent.keyDown(tab(/^Material/), { key: 'ArrowLeft' });
    expect(tab(/^Notes/).getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(tab(/^Notes/), { key: 'Home' });
    expect(tab(/^Material/).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab(/^Material/));

    fireEvent.keyDown(tab(/^Material/), { key: 'End' });
    expect(tab(/^Notes/).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab(/^Notes/));

    fireEvent.keyDown(tab(/^Notes/), { key: 'Enter' });
    expect(tab(/^Notes/).getAttribute('aria-selected')).toBe('true');
  });

  it('shows the excerpt and context on Material, and the to-dos on Notes', () => {
    const { props } = renderRail([todo('1')]);
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('Paste or type')).toBeTruthy();
    expect(within(panel).getByText('character-sheet-raven.md')).toBeTruthy();
    expect(within(panel).queryByText('To-do List')).toBeNull();

    fireEvent.click(within(panel).getByText('Paste or type'));
    expect(props.excerpt.onOpenPasteSheet).toHaveBeenCalledTimes(1);

    fireEvent.click(tab(/^Notes/));
    const notesPanel = screen.getByRole('tabpanel');
    expect(within(notesPanel).getByText('To-do List')).toBeTruthy();
    expect(within(notesPanel).queryByText('character-sheet-raven.md')).toBeNull();
    fireEvent.click(within(notesPanel).getByTitle('Show source turn report-1'));
    expect(props.todos.onShowSource).toHaveBeenCalledWith('report-1');
  });

  it('counts material and open to-dos, and names the badge in the tab', () => {
    const props = panelProps([todo('1'), todo('2', { status: 'completed' })]);
    const { rerender } = render(<StatefulRail props={props} />);
    expect(tab(/^Material/).getAttribute('aria-label')).toBe('Material, 1 item');
    expect(tab(/^Notes/).getAttribute('aria-label')).toBe('Notes, 1 open');
    expect(screen.queryByText(/new$/)).toBeNull();

    const next = { ...props, todos: { ...props.todos, todos: [...props.todos.todos, todo('3'), todo('4')] } };
    rerender(<StatefulRail props={next} />);
    const notes = screen.getByRole('tab', { name: 'Notes, 3 open, 2 new' });
    expect(within(notes).getByText('2 new')).toBeTruthy();
    expect(tab(/^Material/).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(notes);
    expect(screen.getByRole('tab', { name: 'Notes, 3 open' })).toBeTruthy();
    expect(screen.queryByText('2 new')).toBeNull();
  });

  it('shows Read in under Context on Material, and counts its rows as material', () => {
    const props = panelProps([], [readInRow('characters/rabbit.md')]);
    render(<StatefulRail props={props} />);
    const panel = screen.getByRole('tabpanel', { name: /Material/ });
    const readIn = within(panel).getByRole('region', { name: 'Read in by Jill' });
    expect(within(readIn).getByText('characters/rabbit.md')).toBeTruthy();
    expect(tab(/^Material/).getAttribute('aria-label')).toBe('Material, 2 items');

    fireEvent.click(within(readIn).getByRole('button', { name: 'Open characters/rabbit.md in the reader' }));
    expect(props.readIn.onOpenReader).toHaveBeenCalledWith(props.readIn.entries[0]);
  });

  it('badges Material for a row read while Notes is showing, and never switches the tab', () => {
    const props = panelProps([], [readInRow('characters/rabbit.md')]);
    const { rerender } = render(<StatefulRail props={props} initialTab="notes" />);
    expect(tab(/^Material/).getAttribute('aria-label')).toBe('Material, 2 items');

    const next = {
      ...props,
      readIn: { ...props.readIn, entries: [...props.readIn.entries, readInRow('characters/duchess.md', 2_000)] }
    };
    rerender(<StatefulRail props={next} initialTab="notes" />);
    const material = screen.getByRole('tab', { name: 'Material, 3 items, 1 new' });
    expect(within(material).getByText('1 new')).toBeTruthy();
    expect(tab(/^Notes/).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(material);
    expect(screen.getByRole('tab', { name: 'Material, 3 items' })).toBeTruthy();
  });

  it('does not badge Material when the chat target changes', () => {
    const props = panelProps([], [readInRow('characters/rabbit.md')]);
    const { rerender } = render(<StatefulRail props={props} initialTab="notes" />);
    const guest = {
      ...props,
      readIn: {
        ...props.readIn,
        participantIdentity: 'tool:continuity',
        participantLabel: 'Continuity',
        entries: [readInRow('characters/hatter.md', 5_000), readInRow('characters/queen.md', 6_000)]
      }
    };
    rerender(<StatefulRail props={guest} initialTab="notes" />);
    expect(screen.getByRole('tab', { name: 'Material, 3 items' })).toBeTruthy();
  });

  describe('bookmarks (Slice 5)', () => {
    it('lists bookmarks under the to-dos on Notes, and counts them in the tab', () => {
      const props = panelProps([todo('1')], [], [bookmark('a'), bookmark('b', false)]);
      render(<StatefulRail props={props} initialTab="notes" />);

      const notes = screen.getByRole('tabpanel', { name: /Notes/ });
      const text = notes.textContent ?? '';
      expect(text.indexOf('To-do List')).toBeGreaterThanOrEqual(0);
      expect(text.indexOf('Bookmarks')).toBeGreaterThan(text.indexOf('To-do List'));
      expect(within(notes).getByRole('region', { name: 'Bookmarks' })).toBeTruthy();
      expect(tab(/^Notes/).getAttribute('aria-label')).toBe('Notes, 1 open, 2 bookmarks');
    });

    it('keeps an open rename across a tab switch, then saves that draft', () => {
      const props = panelProps([], [], [bookmark('a')]);
      render(<StatefulRail props={props} initialTab="notes" />);
      fireEvent.click(screen.getByRole('button', { name: 'Rename bookmark: Jill · Bookmark a' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Bookmark name' }), {
        target: { value: 'The lantern beat' }
      });

      fireEvent.click(tab(/^Material/));
      expect(screen.queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
      fireEvent.click(tab(/^Notes/));

      const input = screen.getByRole('textbox', { name: 'Bookmark name' }) as HTMLInputElement;
      expect(input.value).toBe('The lantern beat');
      expect(props.bookmarks.onRename).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(props.bookmarks.onRename).toHaveBeenCalledWith('a', 'The lantern beat');
    });

    it('drops an open rename when the room is replaced', () => {
      const props = panelProps([], [], [bookmark('a')]);
      const { rerender } = render(<StatefulRail props={props} initialTab="notes" />);
      fireEvent.click(screen.getByRole('button', { name: 'Rename bookmark: Jill · Bookmark a' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Bookmark name' }), { target: { value: 'Old room' } });

      rerender(<StatefulRail props={props} initialTab="notes" roomKey="room:2" />);

      expect(screen.queryByRole('textbox', { name: 'Bookmark name' })).toBeNull();
      expect(props.bookmarks.onRename).not.toHaveBeenCalled();
    });
  });
});
