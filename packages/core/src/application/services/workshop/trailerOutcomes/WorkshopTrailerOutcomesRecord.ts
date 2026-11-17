/**
 * The one builder of a reply's `trailerOutcomes` (ADR 2026-11-17 D13).
 * Pure. Both commit paths (`completeWorkshopRun` and
 * `completeWorkshopEditOfferRun`) call it with the cards they hand to
 * `completeRun` and the typed drops settlement returned, so the record is
 * written once, in the reply's own commit, and never updated after.
 *
 * - **Every frame is counted once:** a card, a refused card, or a drop with
 *   a recorded reason (`workshopTrailerDropReason`).
 * - **A side with no frame is absent;** a reply with neither has no record.
 * - **`dropped` is canonical:** one entry per reason, in the reason list's
 *   order.
 * - **Counts and closed reasons only.** The builder is handed no title,
 *   quote, path, find text or note id, so none can reach the record.
 * - Each count is held within the codec's own bound
 *   (`WORKSHOP_TRAILER_OUTCOME_LIMITS`), so no reply can make a session the
 *   codec would refuse.
 */

import type { WorkshopFileEditProposal } from '@messages';
import {
  WORKSHOP_FILE_EDIT_TRAILER_DROP_REASONS,
  WORKSHOP_MEMORY_TRAILER_DROP_REASONS,
  type WorkshopTrailerDrop,
  type WorkshopTrailerDropReason,
  type WorkshopTrailerOutcomes
} from '@shared/types/workshopTrailerOutcomes';
import type { WorkshopMemoryProposalDrop } from '@/application/services/workshop/memory/WorkshopReplyMemory';
import type { WorkshopFileEditProposalDrop } from '@/application/services/workshop/fileEdits/WorkshopReplyFileEditProposals';
import { WORKSHOP_TRAILER_OUTCOME_LIMITS } from '@/application/services/workshop/session/WorkshopTrailerOutcomeRecords';
import {
  workshopFileEditTrailerDropReason,
  workshopMemoryTrailerDropReason
} from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerDropReasons';

export interface WorkshopTrailerOutcomesInput {
  /** The reply's memory frames: how many became cards, and each one that did not. */
  readonly memory: {
    readonly cards: number;
    readonly drops: readonly WorkshopMemoryProposalDrop[];
  };
  /** The reply's file-edit frames: the cards as the turn takes them, and each frame that became none. */
  readonly fileEdits: {
    readonly proposals: ReadonlyArray<Pick<WorkshopFileEditProposal, 'state'>>;
    readonly drops: readonly WorkshopFileEditProposalDrop[];
  };
}

export function buildWorkshopTrailerOutcomes(input: WorkshopTrailerOutcomesInput): WorkshopTrailerOutcomes | undefined {
  const refused = input.fileEdits.proposals.filter((proposal) => proposal.state === 'refused').length;
  const memory = {
    cards: bounded(input.memory.cards),
    dropped: tally(input.memory.drops.map(workshopMemoryTrailerDropReason), WORKSHOP_MEMORY_TRAILER_DROP_REASONS)
  };
  const fileEdits = {
    cards: bounded(input.fileEdits.proposals.length - refused),
    refused: bounded(refused),
    dropped: tally(input.fileEdits.drops.map(workshopFileEditTrailerDropReason), WORKSHOP_FILE_EDIT_TRAILER_DROP_REASONS)
  };
  const hasMemory = memory.cards > 0 || memory.dropped.length > 0;
  const hasFileEdits = fileEdits.cards > 0 || fileEdits.refused > 0 || fileEdits.dropped.length > 0;
  if (!hasMemory && !hasFileEdits) {
    return undefined;
  }
  return { ...(hasMemory ? { memory } : {}), ...(hasFileEdits ? { fileEdits } : {}) };
}

/** One entry per reason that occurred, in the list's order. */
function tally<Reason extends WorkshopTrailerDropReason>(
  occurred: readonly Reason[],
  order: readonly Reason[]
): WorkshopTrailerDrop<Reason>[] {
  return order.flatMap((reason) => {
    const count = occurred.filter((entry) => entry === reason).length;
    return count > 0 ? [{ reason, count: bounded(count) }] : [];
  });
}

function bounded(count: number): number {
  return Math.min(count, WORKSHOP_TRAILER_OUTCOME_LIMITS.count);
}
