/**
 * The one Workshop participant-delivery protocol (ADR 2026-07-24 §§4–6).
 *
 * The aggregate owns durable ledger/offset state. This collaborator owns the
 * reader projection, lossless runaway guard, and contiguous acknowledgement.
 * Prompt rendering receives only the turns selected here and performs no
 * second audience decision.
 */

import { WorkshopTurn } from '@messages';
import { WorkshopCapabilityPrincipal } from '@shared/types';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  buildWorkshopRoomCatchUp
} from '@/application/services/workshop/WorkshopPromptBuilder';
import {
  sameParticipantPrincipal,
  workshopTurnAudience,
  workshopTurnBelongsToPrincipal
} from '@/application/services/workshop/WorkshopRoomAudience';

export const WORKSHOP_ROOM_DELIVERY_RUNAWAY_CHARACTERS = 1_000_000;

export interface WorkshopPreparedRoomDelivery {
  reader: WorkshopCapabilityPrincipal;
  startingOffset?: string;
  turns: WorkshopTurn[];
  frame?: string;
  deliveredTurnIds: string[];
  deferredTurns: number;
}

export function projectWorkshopRoomTurns(
  turns: readonly WorkshopTurn[],
  reader: WorkshopCapabilityPrincipal,
  lastSeenRoomTurnId?: string
): WorkshopTurn[] {
  const offsetIndex = lastSeenRoomTurnId === undefined
    ? -1
    : turns.findIndex((turn) => turn.id === lastSeenRoomTurnId);
  if (lastSeenRoomTurnId !== undefined && offsetIndex < 0) {
    throw new Error(`Workshop room offset references unknown turn ${lastSeenRoomTurnId}`);
  }

  return turns.slice(offsetIndex + 1).filter((turn) => {
    if (workshopTurnBelongsToPrincipal(turn, reader)) {
      return false;
    }
    const audience = workshopTurnAudience(turn);
    return audience.kind === 'room'
      || (
        audience.principal.kind !== 'toolSidecar'
        && sameParticipantPrincipal(audience.principal, reader)
      );
  });
}

/**
 * Keep an oldest-first whole-turn prefix. The guard is deliberately enormous:
 * it catches runaway state, not normal shaping. The first turn is always kept
 * whole even when it alone exceeds the guard, so one large turn cannot starve
 * every turn behind it.
 */
export function guardWorkshopRoomDelivery(
  pending: readonly WorkshopTurn[],
  characterGuard = WORKSHOP_ROOM_DELIVERY_RUNAWAY_CHARACTERS
): WorkshopTurn[] {
  const included: WorkshopTurn[] = [];
  let characters = 0;
  for (const turn of pending) {
    if (
      included.length > 0
      && characters + turn.content.length > characterGuard
    ) {
      break;
    }
    included.push(turn);
    characters += turn.content.length;
  }
  return included;
}

export class WorkshopRoomDeliveryService {
  constructor(private readonly session: WorkshopSessionService) {}

  prepareJoinSnapshot(reader: WorkshopCapabilityPrincipal): WorkshopTurn[] {
    const state = this.session.readRoomLedger();
    return projectWorkshopRoomTurns(state, reader);
  }

  prepare(reader: WorkshopCapabilityPrincipal): WorkshopPreparedRoomDelivery {
    const state = this.session.readRoomDeliveryState(reader);
    const pending = projectWorkshopRoomTurns(
      state.turns,
      reader,
      state.lastSeenRoomTurnId
    );
    const turns = guardWorkshopRoomDelivery(pending);
    return {
      reader: { ...reader },
      startingOffset: state.lastSeenRoomTurnId,
      turns,
      frame: buildWorkshopRoomCatchUp(turns, pending.length - turns.length),
      deliveredTurnIds: turns.map((turn) => turn.id),
      deferredTurns: pending.length - turns.length
    };
  }

  /**
   * Advance only through the exact oldest contiguous prefix that shipped.
   *
   * This is the surviving PR #72 review #1 invariant: never derive an
   * acknowledgement from the newest pending/max-index turn. A missing or
   * reordered id is a delivery hole and must remain pending for retry.
   */
  commit(delivery: WorkshopPreparedRoomDelivery): void {
    const state = this.session.readRoomDeliveryState(delivery.reader);
    if (state.lastSeenRoomTurnId !== delivery.startingOffset) {
      throw new Error('Workshop room delivery receipt is stale');
    }
    const pendingIds = projectWorkshopRoomTurns(
      state.turns,
      delivery.reader,
      state.lastSeenRoomTurnId
    ).map((turn) => turn.id);
    const isExactPrefix = delivery.deliveredTurnIds.every(
      (turnId, index) => pendingIds[index] === turnId
    );
    if (!isExactPrefix) {
      throw new Error('Workshop room delivery receipt is not a contiguous prefix');
    }
    const allEligibleTurnsDelivered =
      delivery.deliveredTurnIds.length === pendingIds.length;
    const deliveredThroughTurnId = allEligibleTurnsDelivered
      ? state.turns.at(-1)?.id
      : delivery.deliveredTurnIds.at(-1);
    if (deliveredThroughTurnId === undefined) {
      return;
    }
    this.session.advanceRoomDeliveryOffset(
      delivery.reader,
      delivery.startingOffset,
      deliveredThroughTurnId
    );
  }
}
