import type {
  WorkshopChatTarget,
  WorkshopPersonaId,
  WorkshopToolId
} from '@messages';
import {
  WorkshopParticipantRoster,
  WorkshopParticipantRosterState
} from '@/application/services/workshop/session/WorkshopParticipantRoster';

describe('WorkshopParticipantRoster', () => {
  it('distinguishes scope-lock tombstones from persona-selection locks', () => {
    const roster = new WorkshopParticipantRoster();

    roster.adoptToolSidecar('prose', 'tool-conversation', 'turn-report');
    expect(roster.hasRoomMemory()).toBe(true);
    expect(roster.isPersonaSelectionLocked(false)).toBe(false);
    roster.selectPersona('agnes', false);

    roster.adoptPersonaGuest('margot', 'guest-conversation', 'turn-head');
    expect(roster.isPersonaSelectionLocked(false)).toBe(true);
    expect(() => roster.selectPersona('wren', false))
      .toThrow('Cannot change the Workshop persona after host conversation start');

    roster.dismissPersonaGuest('margot');
    roster.retireToolSidecars();
    expect(roster.hasRoomMemory()).toBe(true);
    expect(roster.isPersonaSelectionLocked(false)).toBe(false);
    expect(roster.isPersonaSelectionLocked(true)).toBe(true);

    roster.setHostConversationId('host-conversation');
    expect(roster.isPersonaSelectionLocked(false)).toBe(true);
  });

  it('enforces host exclusion, duplicate invitations, and live guest capacity', () => {
    const roster = new WorkshopParticipantRoster();

    expect(() => roster.validatePersonaGuestInvitation('jill'))
      .toThrow('The Workshop host is already in the room');

    roster.adoptPersonaGuest('margot', 'guest-margot', 'turn-before-join');
    expect(() => roster.validatePersonaGuestInvitation('margot'))
      .toThrow('Margot is already in the room');
    roster.adoptPersonaGuest('quinn', 'guest-quinn', 'turn-before-quinn');

    expect(roster.liveGuestCount()).toBe(2);
    expect(() => roster.validatePersonaGuestInvitation('wren'))
      .toThrow('Workshop supports at most 2 live guests');

    expect(roster.dismissPersonaGuest('margot')).toBe('guest-margot');
    expect(roster.liveGuestCount()).toBe(1);
    roster.adoptPersonaGuest('margot', 'guest-margot-new', 'turn-new-head');
    expect(roster.getPersonaGuestConversationId('margot')).toBe('guest-margot-new');
    expect(roster.readRoomDeliveryOffset({ kind: 'personaGuest', personaId: 'margot' }))
      .toBe('turn-new-head');
  });

  it('repairs chat targets when their retained participant leaves', () => {
    const roster = new WorkshopParticipantRoster();

    expect(roster.setChatTarget({ kind: 'tool', toolId: 'prose' })).toBe(false);
    roster.adoptToolSidecar('prose', 'tool-conversation', 'turn-report');
    expect(roster.setChatTarget({ kind: 'tool', toolId: 'prose' })).toBe(true);
    expect(roster.getChatTarget()).toEqual({ kind: 'tool', toolId: 'prose' });
    roster.retireToolSidecars();
    expect(roster.getChatTarget()).toEqual({ kind: 'host' });

    expect(roster.setChatTarget({ kind: 'personaGuest', personaId: 'margot' })).toBe(false);
    roster.adoptPersonaGuest('margot', 'guest-conversation', undefined);
    expect(roster.setChatTarget({ kind: 'personaGuest', personaId: 'margot' })).toBe(true);
    roster.dismissPersonaGuest('margot');
    expect(roster.getChatTarget()).toEqual({ kind: 'host' });
  });

  it('adopts, replaces, and retires tool sidecars without leaking their records', () => {
    const roster = new WorkshopParticipantRoster();

    expect(roster.adoptToolSidecar('prose', 'tool-one', 'turn-report-1')).toBeUndefined();
    expect(roster.hasToolSidecar('prose')).toBe(true);
    expect(roster.getToolSidecarConversationId('prose')).toBe('tool-one');
    expect(roster.getToolSidecarLatestReportTurnId('prose')).toBe('turn-report-1');
    expect(roster.isLiveToolReport('prose', 'turn-report-1')).toBe(true);
    expect(roster.adoptToolSidecar('prose', 'tool-two', 'turn-report-2')).toBe('tool-one');
    expect(roster.adoptToolSidecar('prose', 'tool-two', 'turn-report-3')).toBeUndefined();
    roster.adoptToolSidecar('dialogue', 'tool-dialogue', 'turn-dialogue');
    roster.setChatTarget({ kind: 'tool', toolId: 'dialogue' });

    const retired = roster.retireToolSidecars();
    retired[0].conversationId = 'mutated outside';

    expect(retired.map((sidecar) => sidecar.toolId)).toEqual(['prose', 'dialogue']);
    expect(roster.hasToolSidecar('prose')).toBe(false);
    expect(roster.isLiveToolReport('prose', 'turn-report-3')).toBe(false);
    expect(roster.getChatTarget()).toEqual({ kind: 'host' });
  });

  it('sets host and guest conversations through narrow liveness guards', () => {
    const roster = new WorkshopParticipantRoster();

    roster.setHostConversationId('host-conversation');
    expect(roster.hasHostConversation()).toBe(true);
    expect(roster.getHostConversationId()).toBe('host-conversation');

    expect(() => roster.setPersonaGuestConversationId('margot', 'guest-conversation'))
      .toThrow('Workshop guest margot is not live');
    roster.adoptPersonaGuest('margot', 'guest-one', undefined);
    roster.setPersonaGuestConversationId('margot', 'guest-two');
    expect(roster.isLivePersonaGuest('margot')).toBe(true);
    expect(roster.getPersonaGuestConversationId('margot')).toBe('guest-two');
  });

  it('owns selected-tool routing and returns the composer to the host for each run', () => {
    const roster = new WorkshopParticipantRoster();
    roster.adoptToolSidecar('dialogue', 'tool-dialogue', 'turn-report');
    roster.setChatTarget({ kind: 'tool', toolId: 'dialogue' });

    roster.selectToolForRun('continuity');

    expect(roster.getSelectedToolId()).toBe('continuity');
    expect(roster.getChatTarget()).toEqual({ kind: 'host' });
    expect(roster.snapshot().toolSidecars[0].activeTarget).toBe(false);
  });

  it('compare-and-sets room offsets after the caller has proved turn existence', () => {
    const roster = new WorkshopParticipantRoster();

    expect(roster.readRoomDeliveryOffset({ kind: 'host' })).toBeUndefined();
    roster.advanceDeliveryOffset({ kind: 'host' }, undefined, 'turn-host-1');
    expect(roster.readRoomDeliveryOffset({ kind: 'host' })).toBe('turn-host-1');
    expect(() => roster.advanceDeliveryOffset(
      { kind: 'host' },
      undefined,
      'turn-host-2'
    )).toThrow('Workshop room offset changed during delivery for host');
    expect(roster.readRoomDeliveryOffset({ kind: 'host' })).toBe('turn-host-1');

    roster.adoptPersonaGuest('margot', 'guest-conversation', 'turn-join-head');
    expect(roster.readRoomDeliveryOffset({ kind: 'personaGuest', personaId: 'margot' }))
      .toBe('turn-join-head');
    roster.advanceDeliveryOffset(
      { kind: 'personaGuest', personaId: 'margot' },
      'turn-join-head',
      'turn-guest-1'
    );
    expect(roster.readRoomDeliveryOffset({ kind: 'personaGuest', personaId: 'margot' }))
      .toBe('turn-guest-1');

    roster.dismissPersonaGuest('margot');
    expect(() => roster.readRoomDeliveryOffset({ kind: 'personaGuest', personaId: 'margot' }))
      .toThrow('Workshop guest margot is not a live room reader');
    expect(() => roster.advanceDeliveryOffset(
      { kind: 'personaGuest', personaId: 'margot' },
      'turn-guest-1',
      'turn-guest-2'
    )).toThrow('Cannot advance Workshop room offset for non-live guest:margot');
  });

  it('clears conversations into tombstones, then resets construction state', () => {
    const roster = new WorkshopParticipantRoster();
    roster.selectPersona('agnes', false);
    roster.setHostConversationId('host-conversation');
    roster.adoptToolSidecar('prose', 'tool-conversation', 'turn-report');
    roster.adoptPersonaGuest('margot', 'guest-conversation', 'turn-join-head');
    roster.selectToolForRun('continuity');
    roster.setChatTarget({ kind: 'personaGuest', personaId: 'margot' });
    roster.advanceDeliveryOffset({ kind: 'host' }, undefined, 'turn-host-head');

    expect(roster.conversationIds()).toEqual([
      'host-conversation',
      'tool-conversation',
      'guest-conversation'
    ]);
    expect(roster.clearAllConversations()).toEqual([
      'host-conversation',
      'tool-conversation',
      'guest-conversation'
    ]);
    expect(roster.conversationIds()).toEqual([]);
    expect(roster.getSelectedPersonaId()).toBe('agnes');
    expect(roster.getSelectedToolId()).toBe('continuity');
    expect(roster.getChatTarget()).toEqual({ kind: 'host' });
    expect(roster.readRoomDeliveryOffset({ kind: 'host' })).toBe('turn-host-head');
    expect(roster.exportState().personaGuests.get('margot')?.lastSeenRoomTurnId)
      .toBe('turn-join-head');
    expect(roster.snapshot().personaGuests).toMatchObject([
      { personaId: 'margot', liveness: 'disposed', hasConversation: false }
    ]);
    expect(roster.hasRoomMemory()).toBe(true);

    roster.reset();

    expect(roster.getSelectedPersonaId()).toBe('jill');
    expect(roster.getSelectedToolId()).toBeUndefined();
    expect(roster.snapshot()).toEqual({
      host: { personaId: 'jill', hasConversation: false },
      toolSidecars: [],
      personaGuests: [],
      chatTarget: { kind: 'host' }
    });
    expect(roster.hasRoomMemory()).toBe(false);
  });

  it('prepares defensively, repairs stale targets, and exports safe snapshots', () => {
    const toolId: WorkshopToolId = 'prose';
    const guestId: WorkshopPersonaId = 'margot';
    const target: WorkshopChatTarget = { kind: 'personaGuest', personaId: guestId };
    const source: WorkshopParticipantRosterState = {
      host: {
        personaId: 'agnes',
        conversationId: 'host-conversation',
        lastSeenRoomTurnId: 'turn-host'
      },
      toolSidecars: {
        [toolId]: { conversationId: 'tool-conversation', latestReportTurnId: 'turn-report' }
      },
      personaGuests: new Map([[guestId, {
        personaId: guestId,
        conversationId: 'guest-conversation',
        lastSeenRoomTurnId: 'turn-guest',
        liveness: 'live'
      }]]),
      chatTarget: target,
      selectedToolId: 'continuity'
    };
    const roster = new WorkshopParticipantRoster();
    const prepared = roster.prepareState(source);

    source.host.personaId = 'jill';
    source.toolSidecars[toolId]!.conversationId = 'mutated tool';
    source.personaGuests.get(guestId)!.conversationId = 'mutated guest';
    source.chatTarget = { kind: 'host' };
    source.selectedToolId = undefined;
    roster.installPreparedState(prepared);

    const snapshot = roster.snapshot();
    snapshot.host.personaId = 'jill';
    snapshot.personaGuests[0].liveness = 'disposed';
    const exported = roster.exportState();
    exported.host.personaId = 'jill';
    exported.toolSidecars[toolId]!.conversationId = 'mutated export';
    exported.personaGuests.get(guestId)!.conversationId = 'mutated export';

    expect(roster.getSelectedPersonaId()).toBe('agnes');
    expect(roster.getHostConversationId()).toBe('host-conversation');
    expect(roster.getToolSidecarConversationId(toolId)).toBe('tool-conversation');
    expect(roster.getPersonaGuestConversationId(guestId)).toBe('guest-conversation');
    expect(roster.getChatTarget()).toEqual(target);
    expect(roster.getSelectedToolId()).toBe('continuity');
    expect(roster.snapshot().personaGuests[0].liveness).toBe('live');

    const staleTarget = roster.prepareState({
      ...roster.exportState(),
      chatTarget: { kind: 'tool', toolId: 'dialogue' }
    });
    expect(staleTarget.chatTarget).toEqual({ kind: 'host' });
  });
});
