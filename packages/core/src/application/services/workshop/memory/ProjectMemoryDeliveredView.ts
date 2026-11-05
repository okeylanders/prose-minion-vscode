/**
 * What one participant's conversation has been told of project memory
 * (ADR 2026-11-04 D14), folded from the turns in ledger order: the latest
 * snapshot its frame or a note recorded replaces every earlier one. Pure.
 *
 * **Receipts (D7; Slice 3).** A receipt is a room-wide divider, so it reached
 * this conversation exactly when room delivery handed it over: only a receipt
 * at or before `deliveredThroughTurnId` (this run's prepared catch-up, or the
 * reader's committed offset) counts, and only after this conversation's
 * latest snapshot, since a snapshot replaces the view and a new membership
 * starts with its own frame (PR #198 F-02). A counted receipt leaves the view
 * at its memory's version (a Forget removes the memory: the conversation was
 * told it is gone), so the next note never repeats it. A receipt is its own
 * turn, so a cut that removes it removes its effect.
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
  /** A set too large to list was recorded as this digest instead (PR #198 F-03). */
  readonly digest?: { readonly count: number; readonly hash: string };
  /**
   * Receipts counted after a digest snapshot, by memory id: the version the
   * receipt told, or null for a Forget. A digest can't take them in, so the
   * note reads them beside it.
   */
  readonly receipted?: ReadonlyMap<string, string | null>;
}

export interface ProjectMemoryDeliveredViewOptions {
  /** The last room turn this conversation has been, or is now being, handed; receipts after it don't count yet. */
  readonly deliveredThroughTurnId?: string;
}

export function projectMemoryDeliveredView(
  turns: readonly WorkshopTurn[],
  participant: WorkshopCapabilityPrincipal,
  options: ProjectMemoryDeliveredViewOptions = {}
): ProjectMemoryDeliveredView {
  const key = workshopProjectMemoryParticipantKey(participant);
  const deliveredThrough = options.deliveredThroughTurnId === undefined
    ? -1
    : turns.findIndex((turn) => turn.id === options.deliveredThroughTurnId);
  let memories = new Map<string, string>();
  let recorded = false;
  let digest: { count: number; hash: string } | undefined;
  let receipted = new Map<string, string | null>();
  turns.forEach((turn, index) => {
    for (const delivery of turn.projectMemoryDelivery ?? []) {
      if (workshopProjectMemoryParticipantKey(delivery.participant) === key) {
        memories = new Map(delivery.memories.map(({ id, version }) => [id, version]));
        recorded = true;
        digest = delivery.digest ? { ...delivery.digest } : undefined;
        receipted = new Map();
      }
    }
    const receipt = turn.projectMemoryReceipt;
    if (receipt && index <= deliveredThrough) {
      const told = receipt.action === 'forgotten' ? null : receipt.version;
      receipted.set(receipt.memoryId, told);
      if (told === null) {
        memories.delete(receipt.memoryId);
      } else {
        memories.set(receipt.memoryId, told);
      }
    }
  });
  return {
    memories,
    recorded,
    ...(digest ? { digest, ...(receipted.size > 0 ? { receipted } : {}) } : {})
  };
}
