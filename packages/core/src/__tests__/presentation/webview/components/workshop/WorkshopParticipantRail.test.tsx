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

  it('exposes the explicit guest invitation and routes a live guest', () => {
    const guest: WorkshopPersonaGuestSnapshot = {
      personaId: 'margot',
      personaLabel: 'Margot',
      hasConversation: true,
      liveness: 'live',
      activeTarget: false
    };
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
