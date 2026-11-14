/** @jest-environment jsdom */

/**
 * WorkshopRailStrip (Everyday Conveniences, item D): the collapsed rail. One
 * icon per rail tab, named as its tab is in the open rail, with the count and
 * the badge still in sight.
 */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { WorkshopRail, WorkshopRailProps } from '@components/workshop/WorkshopRail';
import { WorkshopRailStrip } from '@components/workshop/WorkshopRailStrip';
import type { WorkshopRailTab } from '@hooks/domain/workshop/controllers/useWorkshopRailTabs';
import type { WorkshopTodoItem } from '@messages';

const todo = (id: string): WorkshopTodoItem => ({
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
  stale: false
});

const railProps = (
  unseen: { notes?: number; material?: number } = {},
  activeTab: WorkshopRailTab = 'material'
): WorkshopRailProps => ({
  tabs: {
    activeTab,
    unseenNotesCount: unseen.notes ?? 0,
    unseenMaterialCount: unseen.material ?? 0,
    selectTab: jest.fn()
  },
  roomKey: 'room:1',
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
    attachments: [{
      id: 'ctx-1',
      kind: 'file',
      origin: 'writer',
      label: 'white-rabbit.md',
      words: 1_240,
      relativePath: 'Characters/white-rabbit.md',
      addedAt: 1
    }],
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
    entries: [],
    participantIdentity: 'jill',
    participantLabel: 'Jill',
    onOpenReader: jest.fn(),
    onJump: jest.fn()
  },
  todos: { todos: [todo('a'), todo('b')], onAction: jest.fn(), onShowSource: jest.fn() },
  bookmarks: { bookmarks: [], onOpen: jest.fn(), onRename: jest.fn(() => 'rename-1'), onRemove: jest.fn() }
});

describe('WorkshopRailStrip', () => {
  it('names each icon as its tab, with its count', () => {
    render(<WorkshopRailStrip rail={railProps()} onOpenTab={jest.fn()} />);
    const strip = screen.getByRole('group', { name: 'Open a rail section' });
    const icons = within(strip).getAllByRole('button');
    expect(icons.map((icon) => icon.getAttribute('aria-label')))
      .toEqual(['Material, 1 item', 'Notes, 2 open']);
    expect(icons.map((icon) => icon.querySelector('.pm-ws-rail-tab-count')?.textContent))
      .toEqual(['1', '2']);
    expect(strip.querySelector('.pm-ws-rail-tab-badge')).toBeNull();
    expect(icons.every((icon) => icon.querySelector('svg') !== null)).toBe(true);
  });

  it('carries the same names the open rail\'s tabs have', () => {
    const props = railProps({ notes: 1 });
    const open = render(<WorkshopRail {...props} />);
    const tabNames = screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'));
    open.unmount();

    render(<WorkshopRailStrip rail={props} onOpenTab={jest.fn()} />);
    expect(screen.getAllByRole('button').map((icon) => icon.getAttribute('aria-label')))
      .toEqual(tabNames);
  });

  it('shows a tab\'s badge, in sight and in its name', () => {
    render(<WorkshopRailStrip rail={railProps({ notes: 2, material: 1 })} onOpenTab={jest.fn()} />);
    const notes = screen.getByRole('button', { name: 'Notes, 2 open, 2 new' });
    expect(notes.querySelector('.pm-ws-rail-tab-badge')?.textContent).toBe('2 new');
    const material = screen.getByRole('button', { name: 'Material, 1 item, 1 new' });
    expect(material.querySelector('.pm-ws-rail-tab-badge')?.textContent).toBe('1 new');
  });

  it('opens the tab its icon stands for', () => {
    const onOpenTab = jest.fn();
    render(<WorkshopRailStrip rail={railProps()} onOpenTab={onOpenTab} />);
    fireEvent.click(screen.getByRole('button', { name: /^Notes/ }));
    expect(onOpenTab).toHaveBeenCalledWith('notes');
    fireEvent.click(screen.getByRole('button', { name: /^Material/ }));
    expect(onOpenTab).toHaveBeenLastCalledWith('material');
  });
});
