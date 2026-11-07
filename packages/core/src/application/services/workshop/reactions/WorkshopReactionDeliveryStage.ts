/**
 * The room handler's two steps for reaction delivery (ADR 2026-11-07 D4,
 * D6): plan what a persona turn is told before its message is built, then
 * stage the record on the run once it has begun. The record is written on
 * the reply only if the reply commits, so a failed, stopped or rolled-back
 * call records nothing and the reactions arrive again.
 *
 * The host refuses reactions while a run is active (PR #245 M2), and nothing
 * awaits between the plan and the stage, so the frame is never built against
 * a reaction set changing underneath it. Logs carry counts and participant
 * keys only.
 */

import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import { workshopReactionAuthorKey } from '@shared/constants/workshopReactions';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  planWorkshopReactionDelivery,
  type WorkshopReactionDeliveryPlan
} from '@/application/services/workshop/reactions/WorkshopReactionDelivery';

/** What the steps read and write; satisfied by WorkshopSessionService. */
export type WorkshopReactionDeliverySessionPort = Pick<
  WorkshopSessionService,
  'readRoomLedger' | 'readRoomReactions' | 'getSelectedPersonaId' | 'stageReactionDelivery'
>;

/** What `reader`'s next message is told: `start` for its conversation's first message. */
export function prepareWorkshopReactionDelivery(
  session: WorkshopReactionDeliverySessionPort,
  reader: WorkshopCapabilityPrincipal,
  kind: 'start' | 'update'
): WorkshopReactionDeliveryPlan {
  return planWorkshopReactionDelivery({
    turns: session.readRoomLedger(),
    reactions: session.readRoomReactions(),
    reader,
    hostPersonaId: session.getSelectedPersonaId(),
    kind
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
    `counted=${plan.counted} deferred=${plan.deferred}`
  );
}
