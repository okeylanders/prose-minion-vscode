/** Workshop room participant, tool, target, and conversation-route contracts. */

import { MessageEnvelope, MessageType } from '../base';
import { WritingToolsFocus } from '../analysis';
/**
 * Wire id for a Workshop tool — the design catalog's 14 tools mapped 1:1 onto
 * the existing analysis contracts: `dialogue`, `prose`, and the twelve
 * WritingToolsFocus modes. The handler routes on this; it never invents tools.
 */
export type WorkshopToolId = 'dialogue' | 'prose' | WritingToolsFocus;

/** Stable ids for the Writers' Room hosts packaged with Workshop. */
export type WorkshopPersonaId =
  | 'jill'
  | 'agnes'
  | 'cliff'
  | 'dev'
  | 'edna'
  | 'felix'
  | 'harper'
  | 'margot'
  | 'penny'
  | 'quinn'
  | 'theo'
  | 'wren';

/** The one explicit routing choice behind the Workshop composer. */
export type WorkshopChatTarget =
  | { kind: 'host' }
  | { kind: 'tool'; toolId: WorkshopToolId }
  | { kind: 'personaGuest'; personaId: WorkshopPersonaId };

/** Metadata safe to expose for the permanent persona participant. */
export interface WorkshopHostParticipantSnapshot {
  personaId: WorkshopPersonaId;
  hasConversation: boolean;
}

/** Metadata safe to expose for a retained tool sidecar. Never includes its id. */
export interface WorkshopToolSidecarSnapshot {
  toolId: WorkshopToolId;
  hasConversation: true;
  /** Stable correlation for the report that owns this retained sidecar. */
  latestReportTurnId: string;
  /** False only when the retained provider conversation has been lost. */
  availableForDirectFollowUp: boolean;
  /** Convenience flag for rendering the explicit composer target. */
  activeTarget: boolean;
}

/** Public view of a guest persona retained beside the immutable host. */
export interface WorkshopPersonaGuestSnapshot {
  personaId: WorkshopPersonaId;
  personaLabel: string;
  hasConversation: boolean;
  liveness: 'live' | 'disposed';
  activeTarget: boolean;
}

/** Public view of the session's private participant graph. */
export interface WorkshopParticipantsSnapshot {
  host: WorkshopHostParticipantSnapshot;
  toolSidecars: WorkshopToolSidecarSnapshot[];
  personaGuests: WorkshopPersonaGuestSnapshot[];
  chatTarget: WorkshopChatTarget;
}

// ─────────────────────────────────────────────────────────────────────────────
// Webview → extension
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkshopRunToolPayload {
  /** Tool to run against the pinned excerpt (the excerpt itself lives host-side). */
  toolId: WorkshopToolId;
}

export interface WorkshopRunToolMessage extends MessageEnvelope<WorkshopRunToolPayload> {
  type: MessageType.WORKSHOP_RUN_TOOL;
}

export interface WorkshopQuickActionPayload {
  /** Tool context that owns this deterministic action label. */
  toolId: WorkshopToolId;
  /** The live report/sidecar generation the action was rendered beneath. */
  reportTurnId: string;
  /** One of the static labels from WORKSHOP_QUICK_ACTIONS_BY_TOOL. */
  label: string;
}

/**
 * Deterministic quick action. The webview sends the label the user clicked;
 * the handler resolves it to the static prompt template and runs the existing
 * retained-conversation follow-up path.
 */
export interface WorkshopQuickActionMessage extends MessageEnvelope<WorkshopQuickActionPayload> {
  type: MessageType.WORKSHOP_QUICK_ACTION;
}

/** Free-text follow-up: continues the session's retained conversation. */
export interface WorkshopSendMessagePayload {
  text: string;
}

export interface WorkshopSendMessageMessage extends MessageEnvelope<WorkshopSendMessagePayload> {
  type: MessageType.WORKSHOP_SEND_MESSAGE;
}

/** Explicit writer action: invite a second persona into a retained guest sidecar. */
export interface WorkshopInviteGuestPayload {
  personaId: WorkshopPersonaId;
  openingMessage: string;
}

export interface WorkshopInviteGuestMessage extends MessageEnvelope<WorkshopInviteGuestPayload> {
  type: MessageType.WORKSHOP_INVITE_GUEST;
}

/** Explicit writer action: dispose a retained guest sidecar. */
export interface WorkshopDismissGuestPayload {
  personaId: WorkshopPersonaId;
}

export interface WorkshopDismissGuestMessage extends MessageEnvelope<WorkshopDismissGuestPayload> {
  type: MessageType.WORKSHOP_DISMISS_GUEST;
}

export interface WorkshopSelectPersonaPayload {
  personaId: WorkshopPersonaId;
}

export interface WorkshopSelectPersonaMessage extends MessageEnvelope<WorkshopSelectPersonaPayload> {
  type: MessageType.WORKSHOP_SELECT_PERSONA;
}

/** Payload is deliberately the target itself: no second routing envelope. */
export interface WorkshopSetChatTargetMessage extends MessageEnvelope<WorkshopChatTarget> {
  type: MessageType.WORKSHOP_SET_CHAT_TARGET;
}
