/**
 * What state a persona's passage-search card is in, read from the thread
 * and from what this window is doing (ADR 2026-11-20 D19, D19a). Pure:
 * nothing about a card's state is stored, so a cut, a branch, a reopen or
 * an import needs no rule of its own.
 *
 * For the card on turn `turnId`:
 * - a turn in the ledger holds `passageSearchDelivery` naming it:
 *   **delivered**. The receipt is written in the persona's adopted reply's
 *   own commit, so this is the only proof a delivery landed. The
 *   writer-role request turn a delivery records proves nothing: one left
 *   behind with no receipt after it never reads as delivered;
 * - this window is searching it: **running**;
 * - this window holds its result, undelivered: **ready**;
 * - the writer cancelled it: **cancelled**;
 * - otherwise **pending**.
 *
 * `running` and `ready` are the window's, never persisted: after a reload
 * such a card is `pending` again and nothing reached the room.
 */

import type {
  WorkshopPassageSearchCardView,
  WorkshopPassageSearchCounts,
  WorkshopPassageSearchProgress,
  WorkshopPassageSearchRequest,
  WorkshopPassageSearchStatus,
  WorkshopTurn
} from '@messages';
import { isWorkshopPassageSearchPartial } from '@/application/services/workshop/passageSearch/WorkshopPassageSearchResultView';

type Turn = Pick<WorkshopTurn, 'id' | 'passageSearchRequest' | 'passageSearchDelivery'>;

/** What this window is doing for one card. */
export interface WorkshopPassageSearchWindowFacts {
  readonly running: boolean;
  /** This window holds the card's result. */
  readonly held: boolean;
}

/** The same, with what a card draws from it. */
export interface WorkshopPassageSearchWindowCard {
  readonly running?: { readonly progress?: WorkshopPassageSearchProgress };
  readonly held?: WorkshopPassageSearchCounts;
  /** Its results are on their way to the persona now. */
  readonly sending?: boolean;
}

/** The card's status; undefined when the turn holds no card. */
export function workshopPassageSearchStatus(
  ledger: readonly Turn[],
  turnId: string,
  facts: WorkshopPassageSearchWindowFacts
): WorkshopPassageSearchStatus | undefined {
  const card = ledger.find((turn) => turn.id === turnId)?.passageSearchRequest;
  if (!card) {
    return undefined;
  }
  if (workshopPassageSearchReceipt(ledger, turnId)) {
    return 'delivered';
  }
  if (facts.running) {
    return 'running';
  }
  if (facts.held) {
    return 'ready';
  }
  return card.answer === 'cancelled' ? 'cancelled' : 'pending';
}

/** The latest receipt naming the card, if any reply in the ledger holds one. */
export function workshopPassageSearchReceipt(ledger: readonly Turn[], turnId: string): WorkshopTurn['passageSearchDelivery'] {
  for (let index = ledger.length - 1; index >= 0; index -= 1) {
    if (ledger[index].passageSearchDelivery?.cardTurnId === turnId) {
      return ledger[index].passageSearchDelivery;
    }
  }
  return undefined;
}

/**
 * The card as the webview draws it: its stored fields, and the host's view
 * of its state. Without a window (a caller with no room) it has no view.
 */
export function workshopPassageSearchRequestForWebview(
  turn: Turn,
  room: {
    readonly ledger: () => readonly Turn[];
    readonly window: (turnId: string) => WorkshopPassageSearchWindowCard | undefined;
    readonly authorPresent: boolean;
  } | undefined
): WorkshopPassageSearchRequest | undefined {
  const card = turn.passageSearchRequest;
  if (!card) {
    return undefined;
  }
  const stored: WorkshopPassageSearchRequest = {
    question: card.question,
    scopes: card.scopes.map((scope) => ({ ...scope })),
    ...(card.answer ? { answer: card.answer } : {})
  };
  if (!room) {
    return stored;
  }
  const ledger = room.ledger();
  const window = room.window(turn.id);
  const status = workshopPassageSearchStatus(ledger, turn.id, { running: window?.running !== undefined, held: window?.held !== undefined });
  const receipt = workshopPassageSearchReceipt(ledger, turn.id);
  let view: WorkshopPassageSearchCardView;
  if (status === 'delivered' && receipt) {
    const { cardTurnId: _cardTurnId, shown, ...counts } = receipt;
    view = { status, counts: { ...counts, calls: { ...counts.calls } }, shown, reportHeld: window?.held !== undefined };
  } else if (status === 'running') {
    view = { status, ...(window?.running?.progress ? { progress: { ...window.running.progress } } : {}) };
  } else if (status === 'ready' && window?.held) {
    view = { status, counts: window.held, partial: isWorkshopPassageSearchPartial(window.held.ended), ...(window.sending ? { sending: true as const } : {}) };
  } else {
    view = { status: status === 'cancelled' ? 'cancelled' : 'pending' };
  }
  return { ...stored, view: room.authorPresent ? view : { ...view, authorLeft: true } };
}
