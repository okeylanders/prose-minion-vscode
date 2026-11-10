/**
 * Whether a reply's offer was used, read from the thread (ADR 2026-11-10 D3,
 * D7; epic Slice 2). Pure over the full ledger: nothing about "used" is
 * stored, so a cut, a branch, a reopen or an import needs no rule of its own.
 *
 * For the offer of `kind` on turn `turnId`:
 * - a run is going and a request for it stands after its latest answer:
 *   **asked**;
 * - no answer turn names it: **open**;
 * - the latest answer is `none`: **nothing to change**, and it may be asked
 *   again (D7: a second answer can double nothing);
 * - the latest answer is `proposed`, and every one of its cards is
 *   `declined`, `stale` or `refused`: **ask again** (D7: nothing landed,
 *   nothing is pending, nothing is unknown);
 * - otherwise **answered**.
 *
 * An answered state carries the answer turn's id, how many cards it holds
 * and how many changes they hold: a fix is one change, not one card.
 *
 * A failed or stopped press rolls its writer turn back, so a request with no
 * answer stands only while its run is going; the `runActive` fact guards the
 * one case it does not (a session captured mid-run).
 */

import type { WorkshopEditOfferKind, WorkshopEditOfferStatus, WorkshopFileEditState, WorkshopTurn } from '@messages';

/** A card that neither landed anything, nor is pending, nor is unknown (D7). */
const SPENT: ReadonlySet<WorkshopFileEditState> = new Set<WorkshopFileEditState>(['declined', 'stale', 'refused']);

type Turn = Pick<WorkshopTurn, 'id' | 'editOfferRequest' | 'editOfferAnswer' | 'fileEditProposals'>;

export function workshopEditOfferStatus(
  ledger: readonly Turn[],
  turnId: string,
  kind: WorkshopEditOfferKind,
  facts: { readonly runActive: boolean }
): WorkshopEditOfferStatus {
  let answer: Turn | undefined;
  let requestedSinceAnswer = false;
  for (const turn of ledger) {
    if (turn.editOfferAnswer?.sourceTurnId === turnId && turn.editOfferAnswer.kind === kind) {
      answer = turn;
      requestedSinceAnswer = false;
    } else if (turn.editOfferRequest?.sourceTurnId === turnId && turn.editOfferRequest.kind === kind) {
      requestedSinceAnswer = true;
    }
  }
  if (facts.runActive && requestedSinceAnswer) {
    return { state: 'asked' };
  }
  if (!answer?.editOfferAnswer) {
    return { state: 'open' };
  }
  if (answer.editOfferAnswer.outcome === 'none') {
    return { state: 'nothing-to-change', answerTurnId: answer.id, askAgain: true };
  }
  const cards = answer.fileEditProposals ?? [];
  const askAgain = cards.every((card) => SPENT.has(card.state));
  return {
    state: askAgain ? 'ask-again' : 'answered',
    answerTurnId: answer.id,
    cards: cards.length,
    changes: cards.reduce((sum, card) => sum + card.operations.length, 0),
    askAgain
  };
}

/** Whether a press may be taken for a status (D4.3): open, or D7's rule holds. */
export function workshopEditOfferMayBeAsked(status: WorkshopEditOfferStatus): boolean {
  return status.state === 'open' || (status.state !== 'asked' && status.askAgain);
}
