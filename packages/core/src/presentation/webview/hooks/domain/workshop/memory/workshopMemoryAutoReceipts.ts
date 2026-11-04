/**
 * Save and tell me in the thread (Slice 0d decision 13; ADR 2026-11-04 D7,
 * D8; epic Slice 5). Pure, over the host's snapshot turns.
 *
 * A save under Save and tell me shows no settled line under the reply: its
 * receipt carries it, and expands to the card the persona proposed, read
 * only. The card is the one on the reply's own turn, which the host
 * recorded as saved with the memory's id; the receipt names that id. The
 * receipt's own payload never carries the memory's body (D7).
 */

import type { WorkshopMemoryProposal, WorkshopTurn } from '@messages';

export interface WorkshopAutoSavedMemories {
  /** The saved card each automatic receipt expands to, by receipt turn id. */
  readonly cards: ReadonlyMap<string, WorkshopMemoryProposal>;
  /** Replies whose card Save and tell me saved: their receipt shows it, so they show none. */
  readonly replyTurnIds: ReadonlySet<string>;
}

export const WORKSHOP_NO_AUTO_SAVED_MEMORIES: WorkshopAutoSavedMemories = Object.freeze({
  cards: new Map<string, WorkshopMemoryProposal>(),
  replyTurnIds: new Set<string>()
});

export function workshopAutoSavedMemories(turns: readonly WorkshopTurn[]): WorkshopAutoSavedMemories {
  const savedCards = new Map<string, { turnId: string; proposal: WorkshopMemoryProposal }>();
  const cards = new Map<string, WorkshopMemoryProposal>();
  const replyTurnIds = new Set<string>();
  for (const turn of turns) {
    const proposal = turn.memoryProposal;
    if (proposal?.state === 'saved' && proposal.memoryId) {
      savedCards.set(proposal.memoryId, { turnId: turn.id, proposal });
    }
    const receipt = turn.projectMemoryReceipt;
    if (receipt?.action !== 'saved' || receipt.by !== 'auto') {
      continue;
    }
    const source = savedCards.get(receipt.memoryId);
    if (source) {
      cards.set(turn.id, source.proposal);
      replyTurnIds.add(source.turnId);
    }
  }
  return cards.size === 0 ? WORKSHOP_NO_AUTO_SAVED_MEMORIES : { cards, replyTurnIds };
}
