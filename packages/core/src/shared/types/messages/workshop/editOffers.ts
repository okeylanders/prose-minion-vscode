/**
 * A reply's edit offers (ADR 2026-11-10 D1, D2; epic Slice 1).
 *
 * A persona's reply that holds fixes or rewrites may end with one
 * `<prose-minion-edit-offer>` trailer per kind. Each frame that passes its
 * checks, and whose file the host resolved to one identity, becomes one
 * `WorkshopEditOffer` on the reply's turn (`WorkshopTurn.editOffers`), in
 * the order written: at most one per kind.
 *
 * - **`kind`** is the closed vocabulary `WORKSHOP_EDIT_OFFER_KINDS`.
 * - **`target`** is the host-owned identity the file resolved to when the
 *   reply was read (ADR 2026-11-05 D4.3): a `documentUri` the host wrote and
 *   the display `relativePath`. The webview's view omits `documentUri`
 *   (`workshopEditOfferForWebview`); host-side and on disk it is present.
 * - **`count`** is the persona's own, for a chip's label only. No check
 *   depends on it.
 *
 * An offer stores no state: whether it was used is read from the thread (D3).
 * The press, its request and answer keys, and the derived status are below
 * (Slice 2).
 */

import type { MessageEnvelope, MessageType } from '../base';
import type { WorkshopFileEditTarget } from './fileEdits';

/** What a reply may offer as edits: small fixes, or the rewrites it proposed. */
export const WORKSHOP_EDIT_OFFER_KINDS = ['fixes', 'rewrites'] as const;
export type WorkshopEditOfferKind = (typeof WORKSHOP_EDIT_OFFER_KINDS)[number];

export function isWorkshopEditOfferKind(value: unknown): value is WorkshopEditOfferKind {
  return WORKSHOP_EDIT_OFFER_KINDS.some((kind) => kind === value);
}

/** One declared, checked offer on a persona's reply. */
export interface WorkshopEditOffer {
  readonly kind: WorkshopEditOfferKind;
  /** The file, resolved once; `documentUri` is never in the webview's view. */
  readonly target: WorkshopFileEditTarget;
  /** The persona's own count, within `PROMPT_BUDGETS.workshopEditOffers.count`. */
  readonly count?: number;
  /**
   * In the webview's view of the turn only (D3): derived by the host for
   * every turn it posts. Never stored: the session codec refuses the key.
   */
  readonly status?: WorkshopEditOfferStatus;
}

/** An offer as the webview sees it: the display path, never the `documentUri` (ADR 2026-11-05 D4.3). */
export function workshopEditOfferForWebview(offer: WorkshopEditOffer, status?: WorkshopEditOfferStatus): WorkshopEditOffer {
  return {
    kind: offer.kind,
    target: { kind: offer.target.kind, relativePath: offer.target.relativePath },
    ...(offer.count !== undefined ? { count: offer.count } : {}),
    ...(status ? { status } : {})
  };
}

/*
 * The press (ADR 2026-11-10 D3–D5, D7; epic Slice 2). Three optional keys
 * carry everything: `editOffers` on the reply, `editOfferRequest` on the
 * press's writer turn, `editOfferAnswer` on the answer. Whether an offer was
 * used is read from those turns, never stored.
 */

/** On the press's writer turn: the reply and the kind the writer pressed. Host-written. */
export interface WorkshopEditOfferRequest {
  readonly sourceTurnId: string;
  readonly kind: WorkshopEditOfferKind;
}

/** What an answer came to: edit cards, or nothing to change. */
export const WORKSHOP_EDIT_OFFER_OUTCOMES = ['proposed', 'none'] as const;
export type WorkshopEditOfferOutcome = (typeof WORKSHOP_EDIT_OFFER_OUTCOMES)[number];

/** On the answer: the reply and kind it answers, and what it came to. Host-written. */
export interface WorkshopEditOfferAnswer {
  readonly sourceTurnId: string;
  readonly kind: WorkshopEditOfferKind;
  readonly outcome: WorkshopEditOfferOutcome;
  /** With `none` only: the persona's one line, within `whyCharacters`. */
  readonly why?: string;
}

/**
 * An offer's status, derived by the host from the full ledger
 * (`workshopEditOfferStatus`) and sent in the webview's view of the turn. It
 * is never stored, and the webview never works it out.
 *
 * - `open`: no answer names this reply and kind;
 * - `asked`: a run for it is going;
 * - `answered`: the latest answer proposed cards. `cards` is how many, and
 *   `changes` the operations they hold (a fix is one change, not one card);
 * - `nothing-to-change`: the latest answer was `none`;
 * - `ask-again`: the latest answer proposed cards, and every one is
 *   declined, stale or refused (D7).
 *
 * `askAgain` is D7's rule, on every answered state: a press is taken only
 * while the state is `open` or `askAgain` holds. `blocked` says why a press
 * would be refused whatever the state: the reply's author left the room.
 */
export type WorkshopEditOfferStatus =
  | { readonly state: 'open'; readonly blocked?: 'author-left' }
  | { readonly state: 'asked' }
  | {
    readonly state: 'answered' | 'ask-again';
    readonly answerTurnId: string;
    readonly cards: number;
    readonly changes: number;
    readonly askAgain: boolean;
    readonly blocked?: 'author-left';
  }
  | { readonly state: 'nothing-to-change'; readonly answerTurnId: string; readonly askAgain: true; readonly blocked?: 'author-left' };

/**
 * The press's route (D4): ids only. No text, no path, no count. The host
 * reads the reply from its own ledger.
 */
export interface WorkshopEditOfferActionPayload {
  requestId: string;
  /** The room generation the chip was shown in; another room's press is refused. */
  roomRevision: number;
  turnId: string;
  kind: WorkshopEditOfferKind;
}

export interface WorkshopEditOfferActionMessage extends MessageEnvelope<WorkshopEditOfferActionPayload> {
  type: MessageType.WORKSHOP_EDIT_OFFER_ACTION;
}

/**
 * Why a press was refused or its run left no answer: a closed list, whose
 * words are `WORKSHOP_EDIT_OFFER_REFUSAL_WORDS`.
 */
export const WORKSHOP_EDIT_OFFER_REFUSALS = [
  /** The press did not name a request, a room, a turn and a kind. */
  'invalid-request',
  /** The room was replaced since the chip was shown. */
  'room-changed',
  /** A session save or replacement is going. */
  'session-operation',
  /** A reply is running: one run at a time, never queued. */
  'run-active',
  /** The room holds no such turn. */
  'no-turn',
  /** The turn holds no offer of that kind. */
  'no-offer',
  /** The offer is already answered, and asking again could double an edit (D7). */
  'already-answered',
  /** Suggested file edits are off. */
  'file-edits-off',
  /** The reply's author is no longer in the room. */
  'author-left',
  /** The room could not take the message (no excerpt or scope, or the provider refused it). */
  'not-sent',
  /** The writer stopped the run. */
  'stopped',
  /** The persona answered with neither edits nor the no-edit frame, after its correction turn. */
  'no-answer',
  /** The answer was cut off (the token ceiling, or the provider interrupted it): never salvaged. */
  'cut-off',
  /** The run failed. */
  'failed'
] as const;
export type WorkshopEditOfferRefusal = (typeof WORKSHOP_EDIT_OFFER_REFUSALS)[number];

/**
 * What a press came to:
 * - `answered`: the answer is in the thread, as `answerTurnId`, with
 *   `outcome`, and for `proposed` its `cards` and `changes`;
 * - `refused`: nothing was asked and no turn was added;
 * - `failed`: the run was asked and left no turns; the offer is open again.
 */
export interface WorkshopEditOfferResultPayload {
  requestId: string;
  /** The room generation the press was taken in. */
  roomRevision: number;
  turnId: string;
  kind: WorkshopEditOfferKind;
  answer: 'answered' | 'refused' | 'failed';
  answerTurnId?: string;
  outcome?: WorkshopEditOfferOutcome;
  cards?: number;
  changes?: number;
  /** With `refused` and `failed`. */
  reason?: WorkshopEditOfferRefusal;
  /** The writer's words for it. */
  message: string;
}

export interface WorkshopEditOfferResultMessage extends MessageEnvelope<WorkshopEditOfferResultPayload> {
  type: MessageType.WORKSHOP_EDIT_OFFER_RESULT;
}

/** The press, webview to host. */
export type WorkshopEditOfferWebviewMessage = WorkshopEditOfferActionMessage;

/** Its answer, host to webview. */
export type WorkshopEditOfferExtensionMessage = WorkshopEditOfferResultMessage;
