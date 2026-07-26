/**
 * The single model-visible audience policy for Workshop ledger turns.
 *
 * This module decides eligibility only. Delivery offsets, packing, and prompt
 * rendering consume its result but do not reinterpret it.
 */

import {
  WorkshopPersonaId,
  WorkshopToolId,
  WorkshopTurn
} from '@messages';
import {
  WorkshopCapabilityArtifactDetails,
  WorkshopCapabilityPrincipal
} from '@shared/types';

export type WorkshopRoomPrincipal =
  | WorkshopCapabilityPrincipal
  | { kind: 'toolSidecar'; toolId?: WorkshopToolId };

export type WorkshopRoomAudience =
  | { kind: 'room' }
  | { kind: 'private'; principal: WorkshopRoomPrincipal };

const PUBLISHABLE_CAPABILITY_OPERATIONS = new Set([
  'dictionary.lookup',
  'dictionary.full-entry',
  'analysis.run',
  'resource.read'
]);

/**
 * Compute who may receive one stored turn. Persisted publication is a
 * historical fact; audience remains policy derived from that fact.
 */
export function workshopTurnAudience(turn: WorkshopTurn): WorkshopRoomAudience {
  if (
    turn.artifact === 'direct_tool_message'
    || turn.artifact === 'direct_tool_response'
  ) {
    return {
      kind: 'private',
      principal: { kind: 'toolSidecar', toolId: turn.toolId }
    };
  }

  const capability = turn.capability;
  if (capability) {
    const publishedEvidence = isWorkshopPublishableCapabilityEvidence(capability)
      && capability.publishedWithTurnId !== undefined;
    return publishedEvidence
      ? { kind: 'room' }
      : { kind: 'private', principal: { ...capability.invokedBy } };
  }

  return { kind: 'room' };
}

export function isWorkshopPublishableCapabilityEvidence(
  capability: WorkshopCapabilityArtifactDetails
): boolean {
  return PUBLISHABLE_CAPABILITY_OPERATIONS.has(capability.operation)
    && (capability.status === 'success' || capability.status === 'partial');
}

/**
 * True when a turn is already materialized in this participant's own retained
 * conversation and therefore must not be quoted back through room catch-up.
 */
export function workshopTurnBelongsToPrincipal(
  turn: WorkshopTurn,
  principal: WorkshopCapabilityPrincipal
): boolean {
  if (turn.capability) {
    return sameParticipantPrincipal(turn.capability.invokedBy, principal);
  }

  if (principal.kind === 'host') {
    return turn.participant === 'host'
      || (
        turn.participant === 'writer'
        && turn.artifact === 'persona_message'
        && turn.personaId === undefined
      );
  }

  return (
    turn.participant === 'guest'
    && turn.personaId === principal.personaId
  ) || (
    turn.participant === 'writer'
    && turn.artifact === 'persona_message'
    && turn.personaId === principal.personaId
  );
}

export function sameParticipantPrincipal(
  left: WorkshopCapabilityPrincipal,
  right: WorkshopCapabilityPrincipal
): boolean {
  return left.kind === 'host'
    ? right.kind === 'host'
    : right.kind === 'personaGuest' && left.personaId === right.personaId;
}

export function workshopGuestPrincipal(
  personaId: WorkshopPersonaId
): WorkshopCapabilityPrincipal {
  return { kind: 'personaGuest', personaId };
}
