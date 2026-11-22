/**
 * A persona's passage-search request as a card under its reply, the
 * writer's answers to it, and the receipt of its results' delivery (ADR
 * 2026-11-20 D16–D21).
 *
 * - **`passageSearchRequest`** is optional and additive on a host or guest
 *   reply: the question, the places named (groups, configured files by
 *   catalog key, the room's excerpt), and `answer` once the writer
 *   cancelled. A scope is never a free path or a pattern.
 * - **`passageSearchResults`** marks the provisional writer-role turn a
 *   delivery records before it is dispatched. It proves nothing (D19a).
 * - **`passageSearchDelivery`** is the receipt, on the persona's adopted
 *   reply to the results: ids and counts only. "Delivered" reads only this.
 * - **A card's status is derived, never stored** (D19). `view` is the
 *   host's, added when a turn is sent to the webview and refused in a
 *   saved session.
 * - **Every route carries ids only:** a webview-minted `requestId`, the
 *   room revision and the card's turn id; a Run adds the `planKey` the
 *   writer was shown. Nothing here carries a path, a quote or an analysis.
 */

import { MessageEnvelope, MessageType } from '../base';
import type { ContextPathGroup } from '../../context';

/** One place a card names, as the host accepted it at settlement. */
export type WorkshopPassageSearchScope =
  | { kind: 'group'; group: ContextPathGroup }
  /** One configured file, by catalog key: its group and its path as listed. */
  | { kind: 'file'; group: ContextPathGroup; path: string }
  | { kind: 'excerpt' };

/** How a search's reads ended, as a receipt and a card say it. */
export const WORKSHOP_PASSAGE_SEARCH_ENDINGS = ['complete', 'stopped', 'key-changed', 'provider-failed', 'instance-limit'] as const;
export type WorkshopPassageSearchEnded = typeof WORKSHOP_PASSAGE_SEARCH_ENDINGS[number];

/** A finished search in counts: what a card shows and a receipt keeps. */
export interface WorkshopPassageSearchCounts {
  instances: number;
  /** Files read. */
  files: number;
  labels: number;
  /** Instances a model listed that the host's checks did not keep. */
  dropped: number;
  /**
   * `answered`, `failed`, `cancelled` and `unsent` add up to `planned`. A cancelled call was sent and stopped in
   * flight, and may still have been charged; an unsent one never started. `cancelled` is absent only on a receipt
   * written before it was kept apart.
   */
  calls: { planned: number; answered: number; failed: number; cut: number; unsent: number; cancelled?: number };
  ended: WorkshopPassageSearchEnded;
  /** Whether the results hold an analysis. */
  organized: boolean;
}

/** The card's state for the webview, derived by the host each time a turn is sent (D19). */
export type WorkshopPassageSearchCardView = (
  | { status: 'pending' }
  | { status: 'running'; progress?: WorkshopPassageSearchProgress }
  /** This window holds the result, undelivered. `partial`: the search did not read everything. */
  | { status: 'ready'; counts: WorkshopPassageSearchCounts; partial: boolean; sending?: true }
  | { status: 'delivered'; counts: WorkshopPassageSearchCounts; shown: number; reportHeld: boolean }
  | { status: 'cancelled' }
) & {
  /** The reply's author is no longer in the room: the results have no one to go to. */
  authorLeft?: true;
};

export type WorkshopPassageSearchStatus = WorkshopPassageSearchCardView['status'];

export interface WorkshopPassageSearchRequest {
  question: string;
  /** 1 to `scopes`, in the order named. */
  scopes: WorkshopPassageSearchScope[];
  /** Present once the writer cancelled the request. */
  answer?: 'cancelled';
  /** Host-derived for the webview; never stored. */
  view?: WorkshopPassageSearchCardView;
}

/** On the writer-role turn a delivery records: the card it delivers. */
export interface WorkshopPassageSearchResultsRequest {
  cardTurnId: string;
}

/** On the persona's adopted reply to the results (D19a): the card's turn, and counts. */
export interface WorkshopPassageSearchDelivery extends WorkshopPassageSearchCounts {
  cardTurnId: string;
  /** How many instances the directive held. */
  shown: number;
}

export interface WorkshopPassageSearchProgress {
  done: number;
  planned: number;
  found: number;
}

/** What a card shows before Run: the count first, then the price, then the model. */
export interface WorkshopPassageSearchEstimateView {
  planKey: string;
  calls: number;
  files: number;
  model: string;
  /** Absent when no live price is known. */
  usd?: number;
  /** The host's words for files left out, when any were. */
  leftOut?: string;
  /** Whether the price includes an allowance for organizing the results. */
  organizes: boolean;
}

export const WORKSHOP_PASSAGE_SEARCH_ACTIONS = ['estimate', 'run', 'stop', 'cancel', 'send', 'discard', 'open-report'] as const;
export type WorkshopPassageSearchAction = typeof WORKSHOP_PASSAGE_SEARCH_ACTIONS[number];

/** Why an action did nothing, closed. The host's words ride beside it. */
export const WORKSHOP_PASSAGE_SEARCH_REFUSALS = [
  'invalid-request',
  'session-operation',
  'room-changed',
  'no-card',
  'not-pending',
  'not-ready',
  'not-running',
  'search-running',
  'run-active',
  'author-left',
  'not-held',
  'unavailable',
  'plan-refused',
  'report-failed',
  'search-failed',
  'delivery-failed'
] as const;
export type WorkshopPassageSearchRefusal = typeof WORKSHOP_PASSAGE_SEARCH_REFUSALS[number];

export interface WorkshopPassageSearchActionPayload {
  requestId: string;
  roomRevision: number;
  /** The reply that holds the card. */
  turnId: string;
}

export interface WorkshopPassageSearchRunPayload extends WorkshopPassageSearchActionPayload {
  /** The key of the estimate the writer was shown. */
  planKey: string;
}

export interface WorkshopPassageSearchEstimateMessage extends MessageEnvelope<WorkshopPassageSearchActionPayload> {
  type: MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE;
}
export interface WorkshopPassageSearchRunMessage extends MessageEnvelope<WorkshopPassageSearchRunPayload> {
  type: MessageType.WORKSHOP_PASSAGE_SEARCH_RUN;
}
export interface WorkshopPassageSearchStopMessage extends MessageEnvelope<WorkshopPassageSearchActionPayload> {
  type: MessageType.WORKSHOP_PASSAGE_SEARCH_STOP;
}
export interface WorkshopPassageSearchCancelMessage extends MessageEnvelope<WorkshopPassageSearchActionPayload> {
  type: MessageType.WORKSHOP_PASSAGE_SEARCH_CANCEL;
}
export interface WorkshopPassageSearchSendMessage extends MessageEnvelope<WorkshopPassageSearchActionPayload> {
  type: MessageType.WORKSHOP_PASSAGE_SEARCH_SEND;
}
export interface WorkshopPassageSearchDiscardMessage extends MessageEnvelope<WorkshopPassageSearchActionPayload> {
  type: MessageType.WORKSHOP_PASSAGE_SEARCH_DISCARD;
}
export interface WorkshopPassageSearchOpenReportMessage extends MessageEnvelope<WorkshopPassageSearchActionPayload> {
  type: MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT;
}

export type WorkshopPassageSearchWebviewMessage =
  | WorkshopPassageSearchEstimateMessage
  | WorkshopPassageSearchRunMessage
  | WorkshopPassageSearchStopMessage
  | WorkshopPassageSearchCancelMessage
  | WorkshopPassageSearchSendMessage
  | WorkshopPassageSearchDiscardMessage
  | WorkshopPassageSearchOpenReportMessage;

export type WorkshopPassageSearchResultOutcome =
  /** The action was taken. For `estimate`, `estimate` holds the price. */
  | 'done'
  /** A Run was taken and the search began; `finished` follows under the same request id. */
  | 'started'
  /** The search a Run began has ended; `message` says how, in the host's words. */
  | 'finished'
  /** A Run named an estimate that no longer holds: `estimate` is the new one, and nothing was sent. */
  | 'price-changed'
  | 'refused';

export interface WorkshopPassageSearchResultPayload {
  requestId: string;
  turnId: string;
  action: WorkshopPassageSearchAction;
  outcome: WorkshopPassageSearchResultOutcome;
  reason?: WorkshopPassageSearchRefusal;
  /** The host's words: a refusal's, or how a search or a delivery ended. */
  message?: string;
  estimate?: WorkshopPassageSearchEstimateView;
}

export interface WorkshopPassageSearchResultMessage extends MessageEnvelope<WorkshopPassageSearchResultPayload> {
  type: MessageType.WORKSHOP_PASSAGE_SEARCH_RESULT;
}

/** A running search's progress, by the Run's request id. */
export interface WorkshopPassageSearchProgressPayload extends WorkshopPassageSearchProgress {
  requestId: string;
  turnId: string;
}

export interface WorkshopPassageSearchProgressMessage extends MessageEnvelope<WorkshopPassageSearchProgressPayload> {
  type: MessageType.WORKSHOP_PASSAGE_SEARCH_PROGRESS;
}

export type WorkshopPassageSearchExtensionMessage = WorkshopPassageSearchResultMessage | WorkshopPassageSearchProgressMessage;
