/**
 * The room handler's steps for reaction delivery (ADR 2026-11-07 D4, D6):
 * plan what a persona turn is told before its message is built, then stage
 * the record on the run once it has begun. The record is written on the
 * reply only if the reply commits, so a failed, stopped or rolled-back call
 * records nothing and the reactions arrive again.
 *
 * The host refuses reactions while a run is active (PR #245 M2), and nothing
 * awaits between the plan and the stage, so the frame is never built against
 * a reaction set changing underneath it. Logs carry counts and participant
 * keys only.
 */

import type { WorkshopTurn } from '@messages';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import { workshopReactionAuthorKey } from '@shared/constants/workshopReactions';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { isWorkshopTurnAlreadyVisibleToPrincipal } from '@/application/services/workshop/WorkshopRoomAudience';
import {
  planWorkshopReactionDelivery,
  type WorkshopReactionDeliveryPlan
} from '@/application/services/workshop/reactions/WorkshopReactionDelivery';
import { workshopReactionDeliveredView } from '@/application/services/workshop/reactions/WorkshopReactionDeliveredView';

/** What the steps read and write; satisfied by WorkshopSessionService. */
export type WorkshopReactionDeliverySessionPort = Pick<
  WorkshopSessionService,
  'readRoomLedger' | 'readRoomReactions' | 'getSelectedPersonaId' | 'stageReactionDelivery'
>;

/** Which turns a reader holds once its message lands (PR #246 L1). */
export type WorkshopReactionHolds = (turn: WorkshopTurn) => boolean;

/**
 * A retained conversation's message: its own turns, the room turns at or
 * before its offset, and the turns this message's catch-up hands it. A turn
 * catch-up deferred is not held yet.
 */
export function workshopReactionHoldsAfterCatchUp(
  turns: readonly WorkshopTurn[],
  reader: WorkshopCapabilityPrincipal,
  delivery: { readonly startingOffset?: string; readonly deliveredTurnIds: readonly string[] } | undefined
): WorkshopReactionHolds {
  const offset = delivery?.startingOffset === undefined ? -1 : turns.findIndex((turn) => turn.id === delivery.startingOffset);
  const held = new Set([...turns.slice(0, offset + 1).map((turn) => turn.id), ...(delivery?.deliveredTurnIds ?? [])]);
  return (turn) => held.has(turn.id) || isWorkshopTurnAlreadyVisibleToPrincipal(turn, reader);
}

/** A guest's join: exactly the turns its transcript hands the new conversation. */
export function workshopReactionHoldsTranscript(deliveredTurnIds: readonly string[]): WorkshopReactionHolds {
  const held = new Set(deliveredTurnIds);
  return (turn) => held.has(turn.id);
}

/** What `reader`'s next message is told: `start` for its conversation's first message. */
export function prepareWorkshopReactionDelivery(
  session: WorkshopReactionDeliverySessionPort,
  reader: WorkshopCapabilityPrincipal,
  kind: 'start' | 'update',
  holds: WorkshopReactionHolds
): WorkshopReactionDeliveryPlan {
  return planWorkshopReactionDelivery({
    turns: session.readRoomLedger(),
    reactions: session.readRoomReactions(),
    reader,
    hostPersonaId: session.getSelectedPersonaId(),
    kind,
    holds
  });
}

/** Stage the plan's record on the run `requestId`, and log what was delivered. */
export function stageWorkshopReactionDelivery(
  session: WorkshopReactionDeliverySessionPort,
  requestId: string,
  reader: WorkshopCapabilityPrincipal,
  plan: WorkshopReactionDeliveryPlan,
  log: (line: string) => void
): void {
  if (!plan.record) {
    return;
  }
  const staged = session.stageReactionDelivery(requestId, plan.record);
  log(
    `Reactions delivery ${staged ? 'staged' : 'not staged (run not active)'} ` +
    `(${workshopReactionAuthorKey(reader)}, ${plan.record.kind}): listed=${plan.listed} ` +
    `counted=${plan.counted} deferred=${plan.deferred} waiting=${plan.waiting}`
  );
}

/**
 * A conversation started without a frame (the host's, by a tool run's
 * synthesis; PR #246 M1): stage an empty `start`, so its view begins empty
 * and its next message delivers again. Only when an earlier view exists to
 * end; the synthesis itself carries no frame (D4's delivery points).
 */
export function stageWorkshopReactionRestart(
  session: WorkshopReactionDeliverySessionPort,
  requestId: string,
  reader: WorkshopCapabilityPrincipal,
  log: (line: string) => void
): void {
  if (!workshopReactionDeliveredView(session.readRoomLedger(), reader).recorded) {
    return;
  }
  const participant = reader.kind === 'host' ? { kind: 'host' as const } : { kind: 'personaGuest' as const, personaId: reader.personaId };
  const staged = session.stageReactionDelivery(requestId, { participant, kind: 'start', reactions: [] });
  log(`Reactions view restart ${staged ? 'staged' : 'not staged (run not active)'} (${workshopReactionAuthorKey(reader)})`);
}
