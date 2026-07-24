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
    onSaveSession: jest.fn(),
    onBrowseSessions: jest.fn(),
    onOpenSession: jest.fn(),
    ...overrides
  };
  return { props, view: render(<WorkshopSessionsMenu {...props} />) };
};

describe('WorkshopSessionsMenu', () => {
  it('keeps the approved session commands and three recent rooms in the compact menu', () => {
    renderMenu();

    expect(screen.getByRole('menuitem', { name: /New session/ })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: /Save session/ })).not.toBeNull();
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
    fireEvent.click(screen.getByRole('menuitem', { name: /Pentecost — dialogue pass/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Browse all sessions/ }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onSaveSession).toHaveBeenCalledTimes(1);
    expect(props.onOpenSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'one' })
    );
    expect(props.onBrowseSessions).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and outside click', () => {
    const { props } = renderMenu();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.mouseDown(document.body);

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onOpenChange).toHaveBeenCalledTimes(2);
  });
});
