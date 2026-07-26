/**
 * The one Workshop participant-delivery protocol (ADR 2026-07-24 §§4–6).
 *
 * The aggregate owns durable ledger/offset state. This collaborator owns the
 * reader projection, lossless runaway guard, and contiguous acknowledgement.
 * Prompt rendering receives only the turns selected here and performs no
 * second audience decision.
 */

import { WorkshopTurn } from '@messages';
import { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  buildWorkshopRoomCatchUp,
  WorkshopRoomFrameRenderOptions
} from '@/application/services/workshop/WorkshopRoomFrameRenderer';
import {
  isWorkshopTurnAlreadyVisibleToPrincipal,
  sameParticipantPrincipal,
  workshopTurnAudience
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

/**
 * Session lifecycle markers are durable room history, but delivering only
 * those markers is not conversational catch-up worth announcing to the user.
 */
export function hasWorkshopConversationalCatchUp(
  turns: readonly WorkshopTurn[]
): boolean {
  return turns.some(
    (turn) => turn.artifact !== 'session_start' && turn.artifact !== 'session_resume'
  );
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
    if (isWorkshopTurnAlreadyVisibleToPrincipal(turn, reader)) {
      return false;
    }
    return workshopTurnAudience(turn).kind === 'room';
  });
}

/**
 * A join snapshot targets a brand-new retained conversation. Unlike an
 * incremental delta, it must include the joining persona's own prior exchange
 * and private capability work because none of it exists in the cold-start
 * provider transcript.
 */
export function projectWorkshopJoinSnapshotTurns(
  turns: readonly WorkshopTurn[],
  reader: WorkshopCapabilityPrincipal,
  currentInvitationTurnId?: string
): WorkshopTurn[] {
  return turns.filter((turn) => {
    if (turn.id === currentInvitationTurnId) {
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

  prepareJoinSnapshot(
    reader: WorkshopCapabilityPrincipal,
    currentInvitationTurnId: string
  ): WorkshopTurn[] {
    const state = this.session.readRoomLedger();
    return projectWorkshopJoinSnapshotTurns(
      state,
      reader,
      currentInvitationTurnId
    );
  }

  prepare(
    reader: WorkshopCapabilityPrincipal,
    frameOptions: WorkshopRoomFrameRenderOptions = {}
  ): WorkshopPreparedRoomDelivery {
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
      frame: buildWorkshopRoomCatchUp(
        turns,
        pending.length - turns.length,
        frameOptions
      ),
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
    const readerLabel = delivery.reader.kind === 'host'
      ? 'host'
      : `guest:${delivery.reader.personaId}`;
    if (state.lastSeenRoomTurnId !== delivery.startingOffset) {
      throw new Error(
        `Workshop room delivery receipt is stale for ${readerLabel} ` +
        `(expected offset=${delivery.startingOffset ?? '<start>'}, ` +
        `actual=${state.lastSeenRoomTurnId ?? '<start>'})`
      );
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
      throw new Error(
        `Workshop room delivery receipt is not a contiguous prefix for ${readerLabel} ` +
        `(offset=${state.lastSeenRoomTurnId ?? '<start>'}, ` +
        `expected=${pendingIds.slice(0, delivery.deliveredTurnIds.length).join(',') || '<none>'}, ` +
        `actual=${delivery.deliveredTurnIds.join(',') || '<none>'})`
      );
    }
    // ADR §5: the durable offset records the delivered eligible prefix's last
    // id, never the physical ledger tail. Ineligible rows may be scanned again
    // on the next projection; they may not be silently acknowledged.
    const deliveredThroughTurnId = delivery.deliveredTurnIds.at(-1);
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
