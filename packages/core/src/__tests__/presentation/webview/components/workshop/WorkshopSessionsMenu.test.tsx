/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopSessionsMenu } from '@components/workshop/WorkshopSessionsMenu';
import { WorkshopSessionSummary } from '@messages';

const session = (
  sessionId: string,
  title: string,
  hostPersonaId: WorkshopSessionSummary['hostPersonaId'],
  updatedAt: number
): WorkshopSessionSummary => ({
  sessionId,
  title,
  fileName: `${sessionId}.json`,
  kind: 'named',
  startedAt: updatedAt - 60_000,
  updatedAt,
  savedAt: updatedAt,
  timezone: 'America/Chicago',
  hostPersonaId,
  participantPersonaIds: [hostPersonaId],
  turnCount: 4,
  excerptWordCount: 720
});

const renderMenu = (
  overrides: Partial<React.ComponentProps<typeof WorkshopSessionsMenu>> = {}
) => {
  const props: React.ComponentProps<typeof WorkshopSessionsMenu> = {
    open: true,
    sessions: [
      session('one', 'Pentecost — dialogue pass', 'dev', Date.now() - 2 * 3_600_000),
      session('two', 'Kayla — blackout scene', 'margot', Date.now() - 86_400_000),
      session('three', 'Prom confrontation', 'edna', Date.now() - 90_000_000),
      session('four', 'This one stays in the browser', 'jill', Date.now() - 100_000_000)
    ],
    disabled: false,
    newSessionDisabled: false,
    onOpenChange: jest.fn(),
    onNewSession: jest.fn(),
    onFullResetSession: jest.fn(),
    onEmptyResetSession: jest.fn(),
    pinnedFileCount: 0,
    hasWorkingSet: true,
    onSaveSession: jest.fn(),
    exportDisabled: false,
    onExportSession: jest.fn(),
    onBrowseSessions: jest.fn(),
    onOpenSession: jest.fn(),
    ...overrides
  };
  return { props, view: render(<WorkshopSessionsMenu {...props} />) };
};

describe('WorkshopSessionsMenu', () => {
  it('keeps the approved session commands and three recent rooms in the compact menu', () => {
    renderMenu();

    expect(screen.getByRole('menuitem', { name: /^New session ⌘⇧N$/ })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: /Save session/ })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: /^Export…$/ })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: /Open prior session/ })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: /Browse all sessions/ })).not.toBeNull();
    expect(screen.getByText('Pentecost — dialogue pass')).not.toBeNull();
    expect(screen.getByText('Dev · 2h ago')).not.toBeNull();
    expect(screen.getByText('Kayla — blackout scene')).not.toBeNull();
    expect(screen.getByText('Prom confrontation')).not.toBeNull();
    expect(screen.queryByText('This one stays in the browser')).toBeNull();
  });

  it('shows the active named room and its real persistence state in the header', () => {
    const { view } = renderMenu({
      activeSessionTitle: 'Pentecost — auditorium beat',
      saveStatus: 'saving'
    });

    expect(screen.getByRole('button', {
      name: /Pentecost — auditorium beat/
    })).not.toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Saving');
    expect(view.container.querySelector('.pm-ws-named-save-state-saving')).not.toBeNull();
  });

  it('routes each compact action and closes the menu first', () => {
    const { props } = renderMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: /Save session/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Export…$/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Pentecost — dialogue pass/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Browse all sessions/ }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onSaveSession).toHaveBeenCalledTimes(1);
    expect(props.onExportSession).toHaveBeenCalledTimes(1);
    expect(props.onOpenSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'one' })
    );
    expect(props.onBrowseSessions).toHaveBeenCalledTimes(1);
  });

  it('keeps Export available in an unsaved room but not before the first message', () => {
    renderMenu({ disabled: true });
    const exportItem = screen.getByRole('menuitem', { name: /^Export…$/ }) as HTMLButtonElement;
    expect(exportItem.disabled).toBe(false);
  });

  it('explains a disabled Export instead of hiding it', () => {
    const { props } = renderMenu({ exportDisabled: true });
    const exportItem = screen.getByRole('menuitem', { name: /^Export…$/ }) as HTMLButtonElement;

    fireEvent.click(exportItem);

    expect(exportItem.disabled).toBe(true);
    expect(exportItem.title).toContain('Nothing to export yet');
    expect(props.onExportSession).not.toHaveBeenCalled();
  });

  it('closes on Escape and outside click', () => {
    const { props } = renderMenu();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.mouseDown(document.body);

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onOpenChange).toHaveBeenCalledTimes(2);
  });

  describe('pinned context (ADR 2026-11-04 D7)', () => {
    it('is today\'s menu with nothing pinned: one full reset, its copy and tooltip', () => {
      renderMenu({ pinnedFileCount: 0 });

      const fullReset = screen.getByRole('menuitem', { name: /full reset/ }) as HTMLButtonElement;
      expect(screen.getAllByRole('menuitem', { name: /full reset/ })).toHaveLength(1);
      expect(fullReset.textContent).toBe('New session: full resetalso clears the excerpt and context');
      expect(fullReset.title).toBe('Start over with no excerpt and no context attachments');
      expect(screen.queryByRole('menuitem', { name: /empty context/ })).toBeNull();
    });

    it('adds the empty-context item directly under the full reset while anything is pinned', () => {
      renderMenu({ pinnedFileCount: 10 });

      const items = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
      const fullReset = items.findIndex((text) => text.startsWith('New session: full reset'));
      expect(items[fullReset]).toBe(
        'New session: full resetclears the excerpt and context, then attaches pinned context'
      );
      expect(items[fullReset + 1]).toBe(
        'New session: full reset, empty contextclears the excerpt and context, and leaves pinned context out'
      );
      const empty = screen.getByRole('menuitem', { name: /empty context/ }) as HTMLButtonElement;
      expect(empty.className).toContain('danger');
      expect(empty.title).toBe('Start over with no excerpt, no context attachments and no pinned context');
      expect((screen.getByRole('menuitem', { name: /full reset(?!,)/ }) as HTMLButtonElement).title)
        .toBe('Start over with no excerpt and no context attachments, then attach your 10 pinned files');
    });

    it('sends each start through its own item', () => {
      const { props } = renderMenu({ pinnedFileCount: 1 });

      fireEvent.click(screen.getByRole('menuitem', { name: /^New session ⌘⇧N$/ }));
      fireEvent.click(screen.getByRole('menuitem', { name: /empty context/ }));

      expect(props.onNewSession).toHaveBeenCalledTimes(1);
      expect(props.onEmptyResetSession).toHaveBeenCalledTimes(1);
      expect(props.onFullResetSession).not.toHaveBeenCalled();
    });

    it('disables the empty-context item with the others while a new session cannot start', () => {
      renderMenu({ pinnedFileCount: 2, newSessionDisabled: true });

      expect((screen.getByRole('menuitem', { name: /empty context/ }) as HTMLButtonElement).disabled)
        .toBe(true);
    });
  });
});
