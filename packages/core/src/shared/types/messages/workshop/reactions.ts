/**
 * Workshop message reactions (ADR 2026-11-07 D2, D8).
 *
 * A reaction is a small signal on one turn: the writer's on a persona reply,
 * or (from Slice 3) a persona's on the writer's message. Reactions are
 * host-owned session state. The webview posts ids only (a turn id and a
 * reaction id); the host decides what may be reacted to, and the next
 * snapshot says what it kept. No reaction starts a model call.
 */

import { MessageEnvelope, MessageType } from '../base';
import type { WorkshopReactionId } from '@shared/constants/workshopReactions';
import type { WorkshopPersonaId } from './participants';

/** Who reacted: the writer, the room's host persona, or a guest persona. */
export type WorkshopTurnReactionAuthor =
  | { kind: 'writer' }
  | { kind: 'host' }
  | { kind: 'personaGuest'; personaId: WorkshopPersonaId };

/**
 * One reaction as the session stores it. Identity is the triple
 * `(turnId, author, reaction)`: no minted id.
 */
export interface WorkshopTurnReaction {
  /** The turn reacted to. */
  turnId: string;
  reaction: WorkshopReactionId;
  author: WorkshopTurnReactionAuthor;
  /** A persona's reaction only: the reply turn that carried its trailer. */
  viaTurnId?: string;
  /** Epoch ms (host-stamped). */
  createdAt: number;
}

/** A reaction a persona's conversation was told of, by its identity triple (ADR 2026-11-07 D6). */
export interface WorkshopDeliveredReaction {
  turnId: string;
  author: WorkshopTurnReactionAuthor;
  reaction: WorkshopReactionId;
}

/**
 * What one `<workshop-reactions>` frame told a persona's conversation
 * (ADR 2026-11-07 D6), recorded on the reply that answered the message the
 * frame rode. `start` is a conversation's first message (a fresh host, a
 * guest's join): it begins that conversation's view, so a re-invited guest
 * never inherits an earlier membership's (Project Memory's PR #198 F-02
 * precedent). `update` adds to it.
 */
export interface WorkshopReactionDelivery {
  participant: { kind: 'host' } | { kind: 'personaGuest'; personaId: WorkshopPersonaId };
  kind: 'start' | 'update';
  reactions: WorkshopDeliveredReaction[];
}

/**
 * One reaction as the snapshot shows it, on a turn in the snapshot's window:
 * the writer's first, then the personas', each in the order given. `label`
 * is the reacting participant's display name ("You", "Jill"); never
 * model-generated.
 */
export interface WorkshopTurnReactionSummary {
  turnId: string;
  reaction: WorkshopReactionId;
  author: WorkshopTurnReactionAuthor;
  label: string;
  /**
   * A persona's reaction only: the reply that carried it (ids only). The
   * webview announces a persona's reaction once, when its reply arrived live
   * in this mount (D8), never on hydration, Open or reload.
   */
  viaTurnId?: string;
}

/** Add (`true`) or remove (`false`) one of the writer's reactions on a turn. Idempotent. */
export interface WorkshopSetTurnReactionPayload {
  turnId: string;
  reaction: WorkshopReactionId;
  reacted: boolean;
}

export interface WorkshopSetTurnReactionMessage
  extends MessageEnvelope<WorkshopSetTurnReactionPayload> {
  type: MessageType.WORKSHOP_SET_TURN_REACTION;
}

/**
 * Hide a persona's reaction (Q6): removes that entry. The persona is not
 * told (Q5). Idempotent.
 */
export interface WorkshopHideTurnReactionPayload {
  turnId: string;
  reaction: WorkshopReactionId;
  author: Exclude<WorkshopTurnReactionAuthor, { kind: 'writer' }>;
}

export interface WorkshopHideTurnReactionMessage
  extends MessageEnvelope<WorkshopHideTurnReactionPayload> {
  type: MessageType.WORKSHOP_HIDE_TURN_REACTION;
}
