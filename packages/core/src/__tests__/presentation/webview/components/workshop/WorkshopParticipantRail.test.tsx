/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopParticipantRail } from '@components/workshop/WorkshopParticipantRail';
import { WorkshopChatTarget, WorkshopPersonaGuestSnapshot, WorkshopToolSidecarSnapshot } from '@messages';

const sidecar = (
  toolId: WorkshopToolSidecarSnapshot['toolId'],
  overrides: Partial<WorkshopToolSidecarSnapshot> = {}
): WorkshopToolSidecarSnapshot => ({
  toolId,
  hasConversation: true,
  latestReportTurnId: `turn-${toolId}`,
  availableForDirectFollowUp: true,
  activeTarget: false,
  ...overrides
});

const guest: WorkshopPersonaGuestSnapshot = {
  personaId: 'margot',
  personaLabel: 'Margot',
  hasConversation: true,
  liveness: 'live',
  activeTarget: false
};

describe('WorkshopParticipantRail', () => {
  const renderRail = (
    toolSidecars: WorkshopToolSidecarSnapshot[],
    chatTarget: WorkshopChatTarget = { kind: 'host' },
    onSetChatTarget = jest.fn()
  ) => {
    render(
      <WorkshopParticipantRail
        personaId="jill"
        personaLabel="Jill"
        toolSidecars={toolSidecars}
        chatTarget={chatTarget}
        onSetChatTarget={onSetChatTarget}
      />
    );
    return onSetChatTarget;
  };

  it('renders nothing while the host is the only participant', () => {
    renderRail([]);

    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('shows the persona chip first, then live sidecars in run order', () => {
    renderRail([sidecar('cliche'), sidecar('continuity')]);

    const chips = screen.getAllByRole('button');
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual([
      'Jill',
      'Cliché',
      'Continuity'
    ]);
  });

  it('marks the host chip active in host mode and the tool chip in direct mode', () => {
    renderRail(
      [sidecar('cliche', { activeTarget: true })],
      { kind: 'tool', toolId: 'cliche' }
    );

    expect(screen.getByRole('button', { pressed: false }).textContent).toContain('Jill');
    const toolChip = screen.getByRole('button', { pressed: true });
    expect(toolChip.textContent).toContain('Cliché');
    expect(toolChip.className).toContain('pm-ws-chip-direct');
    // The rail replaced the role="status" banner — the announcement survives.
    expect(screen.getByRole('status').textContent).toContain('Talking directly to');
  });

  it('switches targets both directions and never re-posts the active target', () => {
    const onSetChatTarget = renderRail(
      [sidecar('cliche'), sidecar('continuity', { activeTarget: true })],
      { kind: 'tool', toolId: 'continuity' }
    );

    fireEvent.click(screen.getByRole('button', { name: /Jill/ }));
    expect(onSetChatTarget).toHaveBeenCalledWith({ kind: 'host' });

    fireEvent.click(screen.getByRole('button', { name: /Cliché/ }));
    expect(onSetChatTarget).toHaveBeenCalledWith({ kind: 'tool', toolId: 'cliche' });

    onSetChatTarget.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Continuity/ }));
    expect(onSetChatTarget).not.toHaveBeenCalled();
  });

  it('disables a chip whose retained conversation has been lost', () => {
    const onSetChatTarget = renderRail([
      sidecar('cliche', { availableForDirectFollowUp: false })
    ]);

    const chip = screen.getByRole('button', { name: /Cliché/ });
    expect((chip as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(chip);
    expect(onSetChatTarget).not.toHaveBeenCalled();
  });

  it('keeps the rail visible but disables every control while routing is locked', () => {
    render(
      <WorkshopParticipantRail
        personaId="jill"
        personaLabel="Jill"
        toolSidecars={[sidecar('cliche')]}
        personaGuests={[guest]}
        chatTarget={{ kind: 'host' }}
        onSetChatTarget={jest.fn()}
        disabled
        showInviteGuest
        onDismissGuest={jest.fn()}
      />
    );

    expect(screen.getByRole('toolbar')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(5);
    screen.getAllByRole('button').forEach((button) => {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
    expect(screen.getAllByTitle('Available once the response finishes')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Margot' }).title)
      .toBe('Available once the response finishes');
    expect(screen.getByRole('button', { name: /Dismiss Margot/ }).getAttribute('aria-label'))
      .toContain('available once the response finishes');
  });

  it('keeps the invite-only Jill rail mounted and locked during a response', () => {
    render(
      <WorkshopParticipantRail
        personaId="jill"
        personaLabel="Jill"
        toolSidecars={[]}
        personaGuests={[]}
        chatTarget={{ kind: 'host' }}
        onSetChatTarget={jest.fn()}
        disabled
        showInviteGuest
      />
    );

    expect(screen.getByRole('toolbar')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Invite guest/ }).title)
      .toBe('Available once the response finishes');
  });

  it('moves focus to the rail when a focused control becomes disabled', () => {
    const props = {
      personaId: 'jill' as const,
      personaLabel: 'Jill',
      toolSidecars: [] as WorkshopToolSidecarSnapshot[],
      personaGuests: [] as WorkshopPersonaGuestSnapshot[],
      chatTarget: { kind: 'host' } as WorkshopChatTarget,
      onSetChatTarget: jest.fn(),
      showInviteGuest: true
    };
    const { rerender } = render(<WorkshopParticipantRail {...props} />);
    screen.getByRole('button', { name: /Invite guest/ }).focus();

    rerender(<WorkshopParticipantRail {...props} disabled />);

    expect(document.activeElement).toBe(screen.getByRole('toolbar'));
  });

  it('exposes the explicit guest invitation and routes a live guest', () => {
    const onSetChatTarget = jest.fn();
    const onInviteGuest = jest.fn();
    render(
      <WorkshopParticipantRail
        personaId="jill"
        personaLabel="Jill"
        toolSidecars={[]}
        personaGuests={[guest]}
        chatTarget={{ kind: 'host' }}
        onSetChatTarget={onSetChatTarget}
        showInviteGuest
        onInviteGuest={onInviteGuest}
        onDismissGuest={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Invite guest/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Margot' }));

    expect(onInviteGuest).toHaveBeenCalledTimes(1);
    expect(onSetChatTarget).toHaveBeenCalledWith({ kind: 'personaGuest', personaId: 'margot' });
  });
});
