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
import { WorkshopContextAttachmentSnapshot, WorkshopTodoItem } from '@messages';

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

const panelProps = (todos: WorkshopTodoItem[] = []): Omit<WorkshopRailProps, 'tabs'> => ({
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
  todos: { todos, onAction: jest.fn(), onShowSource: jest.fn() }
});

const StatefulRail: React.FC<{
  props: Omit<WorkshopRailProps, 'tabs'>;
  initialTab?: WorkshopRailTab;
}> = ({ props, initialTab }) => {
  const tabs = useWorkshopRailTabs({ todos: props.todos.todos, roomKey: 'room:1', initialTab });
  return <WorkshopRail tabs={tabs} {...props} />;
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
});
