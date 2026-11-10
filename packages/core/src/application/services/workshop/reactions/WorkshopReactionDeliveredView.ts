/**
 * What one participant's conversation has been told of reactions (ADR
 * 2026-11-07 D6), folded from the `reactionDelivery` records on its own
 * replies, in ledger order: the shape of `ProjectMemoryDeliveredView`. An
 * `update` adds its reactions; a `start` (the conversation's first message)
 * begins the view again, so a re-invited guest's new conversation never
 * inherits what its earlier membership was told. Pure.
 *
 * A reaction removed and re-added is the same triple, so it is in the view
 * already and is never announced twice. A cut that removes a reply removes
 * its record, and what it delivered is owed again (R3).
 */

import type { WorkshopTurn } from '@messages';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import { workshopReactionAuthorKey } from '@shared/constants/workshopReactions';
import { workshopReactionKey } from '@/application/services/workshop/session/WorkshopReactionRecords';

export interface WorkshopReactionDeliveredView {
  /** Each delivered reaction's identity key (`workshopReactionKey`). */
  readonly reactions: ReadonlySet<string>;
  /** Whether any record was ever written for this conversation. */
  readonly recorded: boolean;
}

export function workshopReactionDeliveredView(
  turns: readonly WorkshopTurn[],
  participant: WorkshopCapabilityPrincipal
): WorkshopReactionDeliveredView {
  const key = workshopReactionAuthorKey(participant);
  let reactions = new Set<string>();
  let recorded = false;
  for (const turn of turns) {
    for (const delivery of turn.reactionDelivery ?? []) {
      if (workshopReactionAuthorKey(delivery.participant) !== key) {
        continue;
      }
      recorded = true;
      if (delivery.kind === 'start') {
        reactions = new Set();
      }
      for (const reaction of delivery.reactions) {
        reactions.add(workshopReactionKey(reaction));
      }
    }
  }
  return { reactions, recorded };
}
