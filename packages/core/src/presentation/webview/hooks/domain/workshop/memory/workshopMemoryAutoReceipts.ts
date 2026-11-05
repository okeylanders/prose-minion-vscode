/**
 * Save and tell me in the thread (Slice 0d decision 13; ADR 2026-11-04 D7,
 * D8; epic Slice 5). Pure, over the host's snapshot turns.
 *
 * A save under Save and tell me shows no settled line under the reply: its
 * receipt carries it, and expands to the card the persona proposed, read
 * only. The card is the one on the reply's own turn (one of its
 * `memoryProposals`: Slice 6b), which the host recorded as saved with the
 * memory's id; the receipt names that id. The receipt's own payload never
 * carries the memory's body (D7).
 */

import type { WorkshopMemoryProposal, WorkshopTurn } from '@messages';
import { workshopMemoryCardKey } from '@shared/constants/workshopProjectMemoryWrites';

export interface WorkshopAutoSavedMemories {
  /** The saved card each automatic receipt expands to, by receipt turn id. */
  readonly cards: ReadonlyMap<string, WorkshopMemoryProposal>;
  /** Cards Save and tell me saved, by `workshopMemoryCardKey`: their receipt shows each, so the reply shows none. */
  readonly cardKeys: ReadonlySet<string>;
}

export const WORKSHOP_NO_AUTO_SAVED_MEMORIES: WorkshopAutoSavedMemories = Object.freeze({
  cards: new Map<string, WorkshopMemoryProposal>(),
  cardKeys: new Set<string>()
});

export function workshopAutoSavedMemories(turns: readonly WorkshopTurn[]): WorkshopAutoSavedMemories {
  const savedCards = new Map<string, { key: string; proposal: WorkshopMemoryProposal }>();
  const cards = new Map<string, WorkshopMemoryProposal>();
  const cardKeys = new Set<string>();
  for (const turn of turns) {
    turn.memoryProposals?.forEach((proposal, index) => {
      if (proposal.state === 'saved' && proposal.memoryId) {
        savedCards.set(proposal.memoryId, { key: workshopMemoryCardKey(turn.id, index), proposal });
      }
    });
    const receipt = turn.projectMemoryReceipt;
    if (receipt?.action !== 'saved' || receipt.by !== 'auto') {
      continue;
    }
    const source = savedCards.get(receipt.memoryId);
    if (source) {
      cards.set(turn.id, source.proposal);
      cardKeys.add(source.key);
    }
  }
  return cards.size === 0 ? WORKSHOP_NO_AUTO_SAVED_MEMORIES : { cards, cardKeys };
}
