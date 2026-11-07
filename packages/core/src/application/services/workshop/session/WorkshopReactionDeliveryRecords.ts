/**
 * `reactionDelivery` on a persisted turn (ADR 2026-11-07 D6): what
 * reactions the message a persona reply answers delivered, in the shape of
 * `projectMemoryDelivery` (ADR 2026-11-04 D14). An optional, additive turn
 * field: a session without it reads and writes exactly as before, with no
 * `schemaVersion` bump (ADR 2026-07-30). Called from the session shape file.
 *
 * When present it is exact: on a persona reply (`role: 'assistant'`, a host
 * or guest turn), one `{ participant, kind, reactions }` naming that reply's
 * own participant, each reaction `{ turnId, author, reaction }` with a known
 * id, each triple at most once, at most `WORKSHOP_REACTION_DELIVERY_LIMITS`
 * of them. It rides
 * the reply, never the writer turn, so a cut that removes the reply removes
 * the record with the history that received it (R3).
 *
 * **A triple whose turn is gone is kept.** The record says what a
 * conversation was told, as a Project Memory record keeps a memory id the
 * library no longer holds: it is inert (no standing reaction can match it),
 * so it needs no normalization. The rewind transform cannot produce one: a
 * record rides a reply later than every turn it names, so any cut that
 * removes the named turn removes the reply too.
 */

import type { WorkshopReactionDelivery } from '@messages';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import { isWorkshopReactionId, workshopReactionAuthorKey } from '@shared/constants/workshopReactions';
import {
  arrayOf,
  boundedArrayAt,
  enumAt,
  exactObject,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import {
  assertWorkshopReactionAuthorShape,
  workshopReactionKey
} from '@/application/services/workshop/session/WorkshopReactionRecords';

/**
 * The most reactions one record holds: the codec's own bound, pinned so a
 * saved session stays valid however the delivery budget
 * (`PROMPT_BUDGETS.workshopReactions.deliveredPerReply`) is later tuned
 * (ADR 2026-07-30). A test holds the budget at or under it.
 */
export const WORKSHOP_REACTION_DELIVERY_LIMITS = Object.freeze({ reactions: 1_000 });

/** Strict structure of a turn's `reactionDelivery`; refused on any turn but a persona reply, or for another participant. */
export function assertWorkshopReactionDeliveryShape(
  value: unknown,
  path: string,
  turn: { readonly role?: unknown; readonly participant?: unknown; readonly personaId?: unknown }
): void {
  if (turn.role !== 'assistant' || (turn.participant !== 'host' && turn.participant !== 'guest')) {
    shapeError(path, 'a record on a persona reply');
  }
  const own = turn.participant === 'host' ? 'host' : `guest:${String(turn.personaId)}`;
  boundedArrayAt(value, path, 1, 1, 'delivery records (one, the reply\'s own)');
  arrayOf(value, path, (item, itemPath) => {
    const delivery = exactObject(item, itemPath, ['participant', 'kind', 'reactions']);
    const participant = exactObject(delivery.participant, `${itemPath}.participant`, ['kind'], ['personaId']);
    enumAt(participant.kind, `${itemPath}.participant.kind`, ['host', 'personaGuest']);
    if (participant.kind === 'personaGuest' ? !isWorkshopPersonaId(participant.personaId) : participant.personaId !== undefined) {
      shapeError(`${itemPath}.participant.personaId`, participant.kind === 'personaGuest' ? 'known Workshop persona id' : 'absent for a host');
    }
    const key = participant.kind === 'host' ? 'host' : `guest:${String(participant.personaId)}`;
    if (key !== own) {
      shapeError(`${itemPath}.participant`, 'the reply\'s own participant');
    }
    enumAt(delivery.kind, `${itemPath}.kind`, ['start', 'update']);
    boundedArrayAt(
      delivery.reactions,
      `${itemPath}.reactions`,
      0,
      WORKSHOP_REACTION_DELIVERY_LIMITS.reactions,
      'delivered reactions'
    );
    if (delivery.kind === 'update' && delivery.reactions.length === 0) {
      shapeError(`${itemPath}.reactions`, 'at least one reaction on an update');
    }
    const triples = new Set<string>();
    arrayOf(delivery.reactions, `${itemPath}.reactions`, (entry, entryPath) => {
      const delivered = exactObject(entry, entryPath, ['turnId', 'author', 'reaction']);
      if (typeof delivered.turnId !== 'string' || delivered.turnId.length === 0) {
        shapeError(`${entryPath}.turnId`, 'non-empty string');
      }
      const author = assertWorkshopReactionAuthorShape(delivered.author, `${entryPath}.author`);
      if (!isWorkshopReactionId(delivered.reaction)) {
        shapeError(`${entryPath}.reaction`, 'a known Workshop reaction id');
      }
      // A conversation is never told its own reaction back (D4).
      if (workshopReactionAuthorKey(author) === own) {
        shapeError(`${entryPath}.author`, 'another participant than the reply\'s own');
      }
      const triple = workshopReactionKey({ turnId: delivered.turnId, author, reaction: delivered.reaction });
      if (triples.has(triple)) {
        shapeError(entryPath, 'each reaction once per record');
      }
      triples.add(triple);
    });
  });
}

/** A defensive copy of one record. */
export function cloneWorkshopReactionDelivery(delivery: WorkshopReactionDelivery): WorkshopReactionDelivery {
  return {
    participant: delivery.participant.kind === 'host'
      ? { kind: 'host' }
      : { kind: 'personaGuest', personaId: delivery.participant.personaId },
    kind: delivery.kind,
    reactions: delivery.reactions.map(({ turnId, author, reaction }) => ({
      turnId,
      author: author.kind === 'personaGuest' ? { kind: 'personaGuest', personaId: author.personaId } : { kind: author.kind },
      reaction
    }))
  };
}
