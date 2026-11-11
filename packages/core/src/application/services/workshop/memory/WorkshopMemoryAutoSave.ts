/**
 * Save and tell me's decision point (ADR 2026-11-04 D8; epic Slice 5). Pure:
 * where Slice 3 records a reply's proposals, this says, for each in the
 * order written, whether it waits, is held for the writer with a reason, or
 * is saved at once.
 *
 * - **Ask first** (or a mode no longer read as on): the card waits, exactly
 *   as Slice 3 built it. No hold is recorded.
 * - **Save and tell me:**
 *   - **the web-research hold** comes first: a reply whose run had web
 *     search tools attached is always held, whatever it cited. Citations
 *     can't prove no search ran (D8, Context 5), so the test is "attached";
 *   - **an edit always waits** (Slice 6c): a change to a saved memory is
 *     held `edit`, and takes no place under the cap;
 *   - **a supersession always waits** (Slice 6b): a proposal naming any
 *     memory it replaces is held `supersedes`, whatever else holds;
 *   - **the room's cap**, `autoSavesPerRoom`: counted from the room's own
 *     `by: 'auto'` save receipts, so a Rewind that cuts them lowers the
 *     count with them, and a Branch carries the count it keeps. A reply's
 *     earlier proposals admitted for saving count too (`admitted`), so a
 *     batch fills the cap and the rest are held `room-cap`;
 *   - otherwise saved at once (`origin: auto`, a receipt `by: 'auto'`).
 *
 * The phrasing fence's `personal` hold (D9, amended 2026-11-11) is decided
 * before this, by `WorkshopReplyMemory` and `WorkshopReplyMemoryEdit`, in
 * either mode: a flagged proposal never reaches this route.
 */

import type { WorkshopMemoryHold, WorkshopProjectMemoryMode, WorkshopTurn } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

/** What a proposal does now. */
export type WorkshopMemoryProposalRoute =
  | { readonly kind: 'wait' }
  | { readonly kind: 'held'; readonly held: WorkshopMemoryHold }
  | { readonly kind: 'auto' };

/** The facts of the reply's run the decision reads. */
export interface WorkshopMemoryRunFacts {
  /** The run had web search tools attached (`AnalysisResult.webResearchAttached`), searched or not. */
  readonly webResearchAttached: boolean;
  /** Automatic saves this room already holds; read only under Save and tell me. */
  readonly autoSavesInRoom: () => number;
}

export const WORKSHOP_MEMORY_AUTO_SAVES_PER_ROOM = PROMPT_BUDGETS.workshopProjectMemory.autoSavesPerRoom;

/**
 * One proposal's route. `supersedes` is every id its trailer named, kept or
 * dropped; `edit` marks a change to a saved memory (Slice 6c); `admitted`
 * counts the reply's earlier proposals routed `auto`.
 */
export function routeWorkshopMemoryProposal(
  mode: WorkshopProjectMemoryMode | undefined,
  facts: WorkshopMemoryRunFacts,
  proposal: { readonly supersedes: readonly string[]; readonly edit?: boolean },
  admitted = 0
): WorkshopMemoryProposalRoute {
  if (mode !== 'auto') {
    return { kind: 'wait' };
  }
  if (facts.webResearchAttached) {
    return { kind: 'held', held: 'web-research' };
  }
  if (proposal.edit) {
    return { kind: 'held', held: 'edit' };
  }
  if (proposal.supersedes.length > 0) {
    return { kind: 'held', held: 'supersedes' };
  }
  if (facts.autoSavesInRoom() + admitted >= WORKSHOP_MEMORY_AUTO_SAVES_PER_ROOM) {
    return { kind: 'held', held: 'room-cap' };
  }
  return { kind: 'auto' };
}

/**
 * The room's automatic saves: its `saved` receipts recorded `by: 'auto'`.
 * An edit, a Forget or a Restore of one isn't another save, so it doesn't
 * count; forgetting one doesn't give its place back either.
 */
export function countWorkshopRoomAutoSaves(turns: readonly WorkshopTurn[]): number {
  return turns.reduce((count, turn) => {
    const receipt = turn.projectMemoryReceipt;
    return receipt?.action === 'saved' && receipt.by === 'auto' ? count + 1 : count;
  }, 0);
}
