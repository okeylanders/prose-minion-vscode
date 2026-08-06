/**
 * Session-owned Workshop participant and composer-routing roster.
 *
 * `WorkshopSessionService` remains the aggregate root. This collaborator owns
 * only the permanent host, retained tool sidecars, persona-guest tombstones,
 * room-delivery offsets, and explicit composer targets. `selectedToolId` lives
 * here deliberately: it is participant/tool routing state retained for the UI,
 * not analysis behavior. Turns, writer manifests, and active-run state remain
 * outside this module and are supplied only as narrow scalar facts.
 */

import type {
  WorkshopChatTarget,
  WorkshopParticipantsSnapshot,
  WorkshopPersonaGuestSnapshot,
  WorkshopPersonaId,
  WorkshopToolId
} from '@messages';
import {
  DEFAULT_WORKSHOP_PERSONA_ID,
  WORKSHOP_GUEST_CAPACITY,
  workshopPersonaLabel
} from '@shared/constants/workshopPersonas';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';

export interface WorkshopHostParticipantState {
  personaId: WorkshopPersonaId;
  conversationId?: string;
  lastSeenRoomTurnId?: string;
}

export interface WorkshopToolSidecarState {
  conversationId: string;
  latestReportTurnId: string;
}

export interface WorkshopPersonaGuestState {
  personaId: WorkshopPersonaId;
  conversationId?: string;
  lastSeenRoomTurnId?: string;
  liveness: 'live' | 'disposed';
}

/** Internal runtime shape used by aggregate hydration, never a wire contract. */
export interface WorkshopParticipantRosterState {
  host: WorkshopHostParticipantState;
  toolSidecars: Partial<Record<WorkshopToolId, WorkshopToolSidecarState>>;
  personaGuests: Map<WorkshopPersonaId, WorkshopPersonaGuestState>;
  chatTarget: WorkshopChatTarget;
  selectedToolId?: WorkshopToolId;
}

export interface RetiredWorkshopToolSidecar extends WorkshopToolSidecarState {
  toolId: WorkshopToolId;
}

export class WorkshopParticipantRoster {
  private host: WorkshopHostParticipantState = newHost();
  private toolSidecars: Partial<Record<WorkshopToolId, WorkshopToolSidecarState>> = {};
  private personaGuests = new Map<WorkshopPersonaId, WorkshopPersonaGuestState>();
  private chatTarget: WorkshopChatTarget = { kind: 'host' };
  private selectedToolId?: WorkshopToolId;

  getSelectedPersonaId(): WorkshopPersonaId {
    return this.host.personaId;
  }

  hasHostConversation(): boolean {
    return this.host.conversationId !== undefined;
  }

  getHostConversationId(): string | undefined {
    return this.host.conversationId;
  }

  setHostConversationId(conversationId: string): void {
    this.host.conversationId = conversationId;
  }

  hasToolSidecar(toolId: WorkshopToolId): boolean {
    return this.toolSidecars[toolId] !== undefined;
  }

  getToolSidecarConversationId(toolId: WorkshopToolId): string | undefined {
    return this.toolSidecars[toolId]?.conversationId;
  }

  getToolSidecarLatestReportTurnId(toolId: WorkshopToolId): string | undefined {
    return this.toolSidecars[toolId]?.latestReportTurnId;
  }

  isLiveToolReport(toolId: WorkshopToolId, reportTurnId: string): boolean {
    return this.toolSidecars[toolId]?.latestReportTurnId === reportTurnId;
  }

  adoptToolSidecar(
    toolId: WorkshopToolId,
    conversationId: string,
    latestReportTurnId: string
  ): string | undefined {
    const replacedConversationId = this.toolSidecars[toolId]?.conversationId;
    this.toolSidecars[toolId] = { conversationId, latestReportTurnId };
    return replacedConversationId && replacedConversationId !== conversationId
      ? replacedConversationId
      : undefined;
  }

  retireToolSidecars(): RetiredWorkshopToolSidecar[] {
    const retired = Object.entries(this.toolSidecars).flatMap(([rawToolId, sidecar]) =>
      sidecar
        ? [{ toolId: rawToolId as WorkshopToolId, ...sidecar }]
        : []
    );
    this.toolSidecars = {};
    if (this.chatTarget.kind === 'tool') {
      this.chatTarget = { kind: 'host' };
    }
    return retired;
  }

  isLivePersonaGuest(personaId: WorkshopPersonaId): boolean {
    const guest = this.personaGuests.get(personaId);
    return guest?.liveness === 'live' && guest.conversationId !== undefined;
  }

  getPersonaGuestConversationId(personaId: WorkshopPersonaId): string | undefined {
    return this.isLivePersonaGuest(personaId)
      ? this.personaGuests.get(personaId)?.conversationId
      : undefined;
  }

  setPersonaGuestConversationId(
    personaId: WorkshopPersonaId,
    conversationId: string
  ): void {
    const guest = this.personaGuests.get(personaId);
    if (guest?.liveness !== 'live') {
      throw new Error(`Workshop guest ${personaId} is not live`);
    }
    guest.conversationId = conversationId;
  }

  liveGuestCount(): number {
    return [...this.personaGuests.values()]
      .filter((guest) => guest.liveness === 'live').length;
  }

  validatePersonaGuestInvitation(personaId: WorkshopPersonaId): void {
    if (personaId === this.host.personaId) {
      throw new Error('The Workshop host is already in the room');
    }
    if (this.personaGuests.get(personaId)?.liveness === 'live') {
      throw new Error(`${workshopPersonaLabel(personaId)} is already in the room`);
    }
    if (this.liveGuestCount() >= WORKSHOP_GUEST_CAPACITY) {
      throw new Error(`Workshop supports at most ${WORKSHOP_GUEST_CAPACITY} live guests`);
    }
  }

  /** Adopt exactly the room head captured before the awaited provider join. */
  adoptPersonaGuest(
    personaId: WorkshopPersonaId,
    conversationId: string,
    roomHead: string | undefined
  ): void {
    this.validatePersonaGuestInvitation(personaId);
    if (!conversationId.trim()) {
      throw new Error('Cannot retain a guest without a conversation id');
    }
    this.personaGuests.set(personaId, {
      personaId,
      conversationId,
      lastSeenRoomTurnId: roomHead,
      liveness: 'live'
    });
  }

  /** Dispose one guest while preserving its historical attribution tombstone. */
  dismissPersonaGuest(personaId: WorkshopPersonaId): string | undefined {
    const guest = this.personaGuests.get(personaId);
    if (!guest || guest.liveness === 'disposed') {
      return undefined;
    }
    const conversationId = guest.conversationId;
    guest.conversationId = undefined;
    guest.liveness = 'disposed';
    if (
      this.chatTarget.kind === 'personaGuest'
      && this.chatTarget.personaId === personaId
    ) {
      this.chatTarget = { kind: 'host' };
    }
    return conversationId;
  }

  /**
   * Scope memory includes disposed guest tombstones. A participant cannot
   * un-read a room merely because its provider conversation was discarded.
   */
  hasRoomMemory(): boolean {
    return this.conversationIds().length > 0 || this.personaGuests.size > 0;
  }

  /** Tool sidecars do not lock the immutable host-persona selection. */
  isPersonaSelectionLocked(hasActiveRun: boolean): boolean {
    const hasLiveGuest = [...this.personaGuests.values()]
      .some((guest) => guest.liveness === 'live');
    return hasActiveRun || this.hasHostConversation() || hasLiveGuest;
  }

  selectPersona(personaId: WorkshopPersonaId, hasActiveRun: boolean): void {
    if (this.isPersonaSelectionLocked(hasActiveRun)) {
      throw new Error('Cannot change the Workshop persona after host conversation start');
    }
    this.host.personaId = personaId;
  }

  getChatTarget(): WorkshopChatTarget {
    return cloneChatTarget(this.chatTarget);
  }

  /** Host is always valid; sidecar targets must name a live participant. */
  setChatTarget(target: WorkshopChatTarget): boolean {
    if (target.kind === 'host') {
      this.chatTarget = { kind: 'host' };
      return true;
    }
    if (target.kind === 'tool') {
      if (!this.hasToolSidecar(target.toolId)) {
        return false;
      }
      this.chatTarget = { kind: 'tool', toolId: target.toolId };
      return true;
    }
    if (!this.isLivePersonaGuest(target.personaId)) {
      return false;
    }
    this.chatTarget = { kind: 'personaGuest', personaId: target.personaId };
    return true;
  }

  getSelectedToolId(): WorkshopToolId | undefined {
    return this.selectedToolId;
  }

  /** A fresh tool run always returns composer routing to the permanent host. */
  selectToolForRun(toolId: WorkshopToolId): void {
    this.selectedToolId = toolId;
    this.chatTarget = { kind: 'host' };
  }

  conversationIds(): string[] {
    const ids = this.host.conversationId ? [this.host.conversationId] : [];
    for (const sidecar of Object.values(this.toolSidecars)) {
      if (sidecar?.conversationId) {
        ids.push(sidecar.conversationId);
      }
    }
    for (const guest of this.personaGuests.values()) {
      if (guest.conversationId) {
        ids.push(guest.conversationId);
      }
    }
    return ids;
  }

  readRoomDeliveryOffset(reader: WorkshopCapabilityPrincipal): string | undefined {
    if (reader.kind === 'host') {
      return this.host.lastSeenRoomTurnId;
    }
    const guest = this.personaGuests.get(reader.personaId);
    if (guest?.liveness !== 'live') {
      throw new Error(`Workshop guest ${reader.personaId} is not a live room reader`);
    }
    return guest.lastSeenRoomTurnId;
  }

  /**
   * Compare-and-set a durable offset after the aggregate has independently
   * proved that `deliveredThroughTurnId` exists in the turn ledger.
   */
  advanceDeliveryOffset(
    reader: WorkshopCapabilityPrincipal,
    expectedOffset: string | undefined,
    deliveredThroughTurnId: string
  ): void {
    const readerLabel = reader.kind === 'host'
      ? 'host'
      : `guest:${reader.personaId}`;
    const participant = reader.kind === 'host'
      ? this.host
      : this.personaGuests.get(reader.personaId);
    if (!participant || ('liveness' in participant && participant.liveness !== 'live')) {
      throw new Error(
        `Cannot advance Workshop room offset for non-live ${readerLabel} ` +
        `(expected offset=${expectedOffset ?? '<start>'}, ` +
        `delivered through=${deliveredThroughTurnId})`
      );
    }
    if (participant.lastSeenRoomTurnId !== expectedOffset) {
      throw new Error(
        `Workshop room offset changed during delivery for ${readerLabel} ` +
        `(expected=${expectedOffset ?? '<start>'}, ` +
        `actual=${participant.lastSeenRoomTurnId ?? '<start>'}, ` +
        `delivered through=${deliveredThroughTurnId})`
      );
    }
    participant.lastSeenRoomTurnId = deliveredThroughTurnId;
  }

  snapshot(): WorkshopParticipantsSnapshot {
    return {
      host: {
        personaId: this.host.personaId,
        hasConversation: this.hasHostConversation()
      },
      toolSidecars: Object.entries(this.toolSidecars).flatMap(([rawToolId, sidecar]) =>
        sidecar
          ? [{
              toolId: rawToolId as WorkshopToolId,
              hasConversation: true as const,
              latestReportTurnId: sidecar.latestReportTurnId,
              availableForDirectFollowUp: true,
              activeTarget:
                this.chatTarget.kind === 'tool'
                && this.chatTarget.toolId === rawToolId
            }]
          : []
      ),
      personaGuests: [...this.personaGuests.values()].map<WorkshopPersonaGuestSnapshot>(
        (guest) => ({
          personaId: guest.personaId,
          personaLabel: workshopPersonaLabel(guest.personaId),
          hasConversation: guest.liveness === 'live' && guest.conversationId !== undefined,
          liveness: guest.liveness,
          activeTarget:
            this.chatTarget.kind === 'personaGuest'
            && this.chatTarget.personaId === guest.personaId
        })
      ),
      chatTarget: this.getChatTarget()
    };
  }

  exportState(): WorkshopParticipantRosterState {
    return cloneState({
      host: this.host,
      toolSidecars: this.toolSidecars,
      personaGuests: this.personaGuests,
      chatTarget: this.chatTarget,
      selectedToolId: this.selectedToolId
    });
  }

  /** Clone and repair routing before aggregate hydration crosses its install barrier. */
  prepareState(state: WorkshopParticipantRosterState): WorkshopParticipantRosterState {
    const prepared = cloneState(state);
    prepared.chatTarget = repairedChatTarget(prepared);
    return prepared;
  }

  /** Install only state returned by `prepareState`; this phase must not throw. */
  installPreparedState(state: WorkshopParticipantRosterState): void {
    this.host = state.host;
    this.toolSidecars = state.toolSidecars;
    this.personaGuests = state.personaGuests;
    this.chatTarget = state.chatTarget;
    this.selectedToolId = state.selectedToolId;
  }

  /**
   * Drop runtime conversations but preserve host identity, offsets, guest
   * tombstones, and the last selected tool exactly as the aggregate does.
   */
  clearAllConversations(): string[] {
    const conversationIds = this.conversationIds();
    this.host.conversationId = undefined;
    this.toolSidecars = {};
    this.chatTarget = { kind: 'host' };
    for (const guest of this.personaGuests.values()) {
      guest.conversationId = undefined;
      guest.liveness = 'disposed';
    }
    return conversationIds;
  }

  /** A new room restores the construction-time participant and routing state. */
  reset(): void {
    this.host = newHost();
    this.toolSidecars = {};
    this.personaGuests = new Map();
    this.chatTarget = { kind: 'host' };
    this.selectedToolId = undefined;
  }
}

function newHost(): WorkshopHostParticipantState {
  return { personaId: DEFAULT_WORKSHOP_PERSONA_ID };
}

function cloneChatTarget(target: WorkshopChatTarget): WorkshopChatTarget {
  if (target.kind === 'tool') {
    return { kind: 'tool', toolId: target.toolId };
  }
  if (target.kind === 'personaGuest') {
    return { kind: 'personaGuest', personaId: target.personaId };
  }
  return { kind: 'host' };
}

function cloneState(state: WorkshopParticipantRosterState): WorkshopParticipantRosterState {
  return {
    host: { ...state.host },
    toolSidecars: Object.fromEntries(
      Object.entries(state.toolSidecars).flatMap(([toolId, sidecar]) =>
        sidecar ? [[toolId, { ...sidecar }]] : []
      )
    ) as Partial<Record<WorkshopToolId, WorkshopToolSidecarState>>,
    personaGuests: new Map(
      [...state.personaGuests.entries()].map(([personaId, guest]) => [
        personaId,
        { ...guest }
      ])
    ),
    chatTarget: cloneChatTarget(state.chatTarget),
    selectedToolId: state.selectedToolId
  };
}

function repairedChatTarget(state: WorkshopParticipantRosterState): WorkshopChatTarget {
  const target = state.chatTarget;
  if (target.kind === 'tool') {
    return state.toolSidecars[target.toolId]
      ? cloneChatTarget(target)
      : { kind: 'host' };
  }
  if (target.kind === 'personaGuest') {
    const guest = state.personaGuests.get(target.personaId);
    return guest?.liveness === 'live' && guest.conversationId !== undefined
      ? cloneChatTarget(target)
      : { kind: 'host' };
  }
  return { kind: 'host' };
}
