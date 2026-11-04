/**
 * What one participant's conversation has been told of project memory
 * (ADR 2026-11-04 D14), folded from the turns in ledger order: the latest
 * snapshot its frame or a note recorded replaces every earlier one. Slice 3
 * adds receipts to the fold. Pure.
 *
 * A conversation with no record yet (it started while memory was off, or
 * before this epic) has an empty view, so its first note carries the whole
 * catalog: exactly a delta from nothing.
 */

import type { WorkshopTurn } from '@messages';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import { workshopProjectMemoryParticipantKey } from '@/application/services/workshop/session/WorkshopProjectMemoryDeliveryRecords';

/** Each memory id the conversation was told of, and the version it was told. */
export interface ProjectMemoryDeliveredView {
  readonly memories: ReadonlyMap<string, string>;
  /** Whether any frame or note was ever recorded for this conversation. */
  readonly recorded: boolean;
}

export function projectMemoryDeliveredView(
  turns: readonly WorkshopTurn[],
  participant: WorkshopCapabilityPrincipal
): ProjectMemoryDeliveredView {
  const key = workshopProjectMemoryParticipantKey(participant);
  let latest: ReadonlyMap<string, string> | undefined;
  for (const turn of turns) {
    for (const delivery of turn.projectMemoryDelivery ?? []) {
      if (workshopProjectMemoryParticipantKey(delivery.participant) === key) {
        latest = new Map(delivery.memories.map(({ id, version }) => [id, version]));
      }
    }
  }
  return { memories: latest ?? new Map(), recorded: latest !== undefined };
}
