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
 * - **A count is never clipped** (PR #276 F-02). Each is the number of
 *   frames, exactly: the line states it as exact. The codec's bound
 *   (`WORKSHOP_TRAILER_OUTCOME_LIMITS`) is the longest an array can be, so
 *   no tally here can pass it.
 */

import type { WorkshopFileEditProposal } from '@messages';
import {
  WORKSHOP_FILE_EDIT_TRAILER_DROP_REASONS,
  WORKSHOP_LOCATIONS_TRAILER_DROP_REASONS,
  WORKSHOP_MEMORY_TRAILER_DROP_REASONS,
  WORKSHOP_TODO_TRAILER_DROP_REASONS,
  type WorkshopTrailerDrop,
  type WorkshopTrailerDropReason,
  type WorkshopTrailerOutcomes
} from '@shared/types/workshopTrailerOutcomes';
import type { WorkshopMemoryProposalDrop } from '@/application/services/workshop/memory/WorkshopReplyMemory';
import type { WorkshopFileEditProposalDrop } from '@/application/services/workshop/fileEdits/WorkshopReplyFileEditProposals';
import {
  workshopFileEditTrailerDropReason,
  workshopMemoryTrailerDropReason,
  workshopTrailerDropReason
} from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerDropReasons';
import type { WorkshopTodoStatusDropCode } from '@/application/services/workshop/todos/WorkshopReplyTodoStatus';
import type { WorkshopLocationsDropCode } from '@/application/services/workshop/locations/WorkshopReplyLocations';

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
  /** The reply's to-do status frames: how many became receipt rows, and each one that did not (ADR 2026-11-19 D7). */
  readonly todos?: {
    readonly changes: number;
    readonly drops: readonly WorkshopTodoStatusDropCode[];
  };
  /** The reply's context-paths proposal frames: the card made, each frame that became none, and the card's patterns (ADR 2026-11-19 D27). */
  readonly locations?: {
    readonly cards: number;
    readonly drops: readonly WorkshopLocationsDropCode[];
    readonly patterns: { readonly kept: number; readonly unmatched: number; readonly incomplete: number; readonly refused: number };
  };
}

export function buildWorkshopTrailerOutcomes(input: WorkshopTrailerOutcomesInput): WorkshopTrailerOutcomes | undefined {
  const refused = input.fileEdits.proposals.filter((proposal) => proposal.state === 'refused').length;
  const memory = {
    cards: input.memory.cards,
    dropped: tally(input.memory.drops.map(workshopMemoryTrailerDropReason), WORKSHOP_MEMORY_TRAILER_DROP_REASONS)
  };
  const fileEdits = {
    cards: input.fileEdits.proposals.length - refused,
    refused,
    dropped: tally(input.fileEdits.drops.map(workshopFileEditTrailerDropReason), WORKSHOP_FILE_EDIT_TRAILER_DROP_REASONS)
  };
  const todos = {
    changes: input.todos?.changes ?? 0,
    dropped: tally((input.todos?.drops ?? []).map((code) => workshopTrailerDropReason(code)), WORKSHOP_TODO_TRAILER_DROP_REASONS)
  };
  const hasMemory = memory.cards > 0 || memory.dropped.length > 0;
  const hasFileEdits = fileEdits.cards > 0 || fileEdits.refused > 0 || fileEdits.dropped.length > 0;
  const hasTodos = todos.changes > 0 || todos.dropped.length > 0;
  const locations = {
    cards: input.locations?.cards ?? 0,
    dropped: tally((input.locations?.drops ?? []).map((code) => workshopTrailerDropReason(code)), WORKSHOP_LOCATIONS_TRAILER_DROP_REASONS),
    patterns: { ...(input.locations?.patterns ?? { kept: 0, unmatched: 0, incomplete: 0, refused: 0 }) }
  };
  const hasLocations = locations.cards > 0 || locations.dropped.length > 0;
  if (!hasMemory && !hasFileEdits && !hasTodos && !hasLocations) {
    return undefined;
  }
  return {
    ...(hasMemory ? { memory } : {}),
    ...(hasFileEdits ? { fileEdits } : {}),
    ...(hasTodos ? { todos } : {}),
    ...(hasLocations ? { locations } : {})
  };
}

/** One entry per reason that occurred, in the list's order. */
function tally<Reason extends WorkshopTrailerDropReason>(
  occurred: readonly Reason[],
  order: readonly Reason[]
): WorkshopTrailerDrop<Reason>[] {
  return order.flatMap((reason) => {
    const count = occurred.filter((entry) => entry === reason).length;
    return count > 0 ? [{ reason, count }] : [];
  });
}
