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
  WORKSHOP_CAPABILITY_PUBLICATION_WITHHELD,
  WorkshopCapabilityArtifactDetails,
  WorkshopCapabilityOperation,
  WorkshopCapabilityPrincipal
} from '@shared/types/workshopCapabilities';

export type WorkshopRoomPrincipal =
  | WorkshopCapabilityPrincipal
  | { kind: 'toolSidecar'; toolId?: WorkshopToolId };

export type WorkshopRoomAudience =
  | { kind: 'room' }
  | { kind: 'private'; principal: WorkshopRoomPrincipal };

const PUBLISHABLE_CAPABILITY_OPERATIONS: ReadonlySet<WorkshopCapabilityOperation> = new Set<WorkshopCapabilityOperation>([
  'dictionary.lookup',
  'dictionary.full-entry',
  'analysis.run',
  'resource.read',
  // Reads and to-do lists of saved sessions are evidence the room may share
  // (ADR 2026-10-05 §7, D6); the catalog and search stay private discovery.
  'transcript.read',
  'transcript.todos',
  // A bookmark list is room evidence too, unless the host withheld it for
  // holding an open-room row the room could not see (ADR 2026-11-05 D7).
  'transcript.bookmarks',
  // A memory read is published with the reply that used it (ADR 2026-11-04,
  // question 5); the catalog and search stay private discovery.
  'memory.read'
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

/**
 * Whether a capability card may be published with the reply that used it.
 * A result the host stamped withheld when it built it never is (ADR
 * 2026-11-05 D7, PR #214 F-05): the policy reads the whole result's stamp,
 * never its rows.
 */
export function isWorkshopPublishableCapabilityEvidence(
  capability: WorkshopCapabilityArtifactDetails
): boolean {
  return PUBLISHABLE_CAPABILITY_OPERATIONS.has(capability.operation)
    && (capability.status === 'success' || capability.status === 'partial')
    && workshopCapabilityPublicationWithheld(capability.metadata) === undefined;
}

/** The reason, by id, a result's host stamped it unpublishable; undefined when it did not. */
export function workshopCapabilityPublicationWithheld(
  metadata: Readonly<Record<string, unknown>> | undefined
): string | undefined {
  const reason = metadata?.[WORKSHOP_CAPABILITY_PUBLICATION_WITHHELD];
  return typeof reason === 'string' ? reason : undefined;
}

/**
 * Whether a participant could see a turn of the open room: a turn the whole
 * room sees, or private work of its own, never an instrument's sidecar.
 * The rule a join snapshot hands a new conversation, and the one the open
 * room's bookmarks are filtered by (ADR 2026-11-05 D1).
 */
export function isWorkshopTurnVisibleToParticipant(
  turn: WorkshopTurn,
  reader: WorkshopCapabilityPrincipal
): boolean {
  const audience = workshopTurnAudience(turn);
  return audience.kind === 'room'
    || (
      audience.principal.kind !== 'toolSidecar'
      && sameParticipantPrincipal(audience.principal, reader)
    );
}

/**
 * True when a turn is already materialized in this participant's own retained
 * conversation and therefore must not be quoted back through room catch-up.
 */
export function isWorkshopTurnAlreadyVisibleToPrincipal(
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
