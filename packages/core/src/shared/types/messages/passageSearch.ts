/**
 * Passage Search in the sidebar (ADR 2026-11-20 D15): the third Search
 * subtab's messages.
 *
 * - **Two steps, both correlated.** A plan request is answered with an
 *   estimate and the host's `planId`; Run names that id. Every request
 *   carries a webview-minted `requestId` the host echoes, so the panel takes
 *   only the answer it still waits for.
 * - **Text never travels webview → host** but the question, the path or
 *   pattern field and the scope choices. A selection is read on the host.
 * - **What comes back is display-safe:** display paths, lines, quotes,
 *   notes, labels, counts and the estimate. Never an absolute path, and
 *   never a host file key that could reveal one. An instance is named by
 *   its number; the host finds its file and line in the result it holds.
 */

import type { ContextPathGroup } from '../context';
import { MessageEnvelope, MessageType } from './base';
import type { TokenUsage } from './tokenUsage';

/** What the writer chose to search. Several at once. */
export interface PassageSearchScopeChoices {
  activeFile: boolean;
  selection: boolean;
  /** One per ticked context group. */
  groups: ContextPathGroup[];
  /** The path or pattern field as typed: paths or globs, one a line or comma-separated. */
  pattern: string;
}

/** Files a plan names but does not read, by why. */
export interface PassageSearchLeftOutView {
  unreadable: number;
  unsplittable: number;
  empty: number;
}

/** A plan's price: approximate, never a cap. */
export interface PassageSearchEstimateView {
  model: string;
  files: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** Absent when there is no live price for the model. */
  usd?: number;
  /** The figures include an allowance for organizing the results. */
  organizeAllowance: boolean;
  leftOut: PassageSearchLeftOutView;
  /** Host words for the files left out; absent when none were. */
  leftOutMessage?: string;
}

// Plan

export interface PassageSearchPlanRequestPayload {
  requestId: string;
  question: string;
  scopes: PassageSearchScopeChoices;
  organize: boolean;
}

export interface PassageSearchPlanRequestMessage extends MessageEnvelope<PassageSearchPlanRequestPayload> {
  type: MessageType.PASSAGE_SEARCH_PLAN_REQUEST;
}

export type PassageSearchPlanPayload =
  | { requestId: string; status: 'planned'; planId: string; estimate: PassageSearchEstimateView }
  /** `reason` is a closed host word (a plan refusal, `superseded` or `failed`); `message` is for the writer. */
  | { requestId: string; status: 'refused'; reason: string; message: string };

export interface PassageSearchPlanMessage extends MessageEnvelope<PassageSearchPlanPayload> {
  type: MessageType.PASSAGE_SEARCH_PLAN;
}

// Run, progress, stop

export interface PassageSearchRunPayload {
  requestId: string;
  planId: string;
}

export interface PassageSearchRunMessage extends MessageEnvelope<PassageSearchRunPayload> {
  type: MessageType.PASSAGE_SEARCH_RUN;
}

export interface PassageSearchProgressPayload {
  requestId: string;
  calls: { planned: number; done: number };
  found: number;
}

export interface PassageSearchProgressMessage extends MessageEnvelope<PassageSearchProgressPayload> {
  type: MessageType.PASSAGE_SEARCH_PROGRESS;
}

export interface PassageSearchStopPayload {
  /** The run's (or the organizing run's) own request id. */
  requestId: string;
}

export interface PassageSearchStopMessage extends MessageEnvelope<PassageSearchStopPayload> {
  type: MessageType.PASSAGE_SEARCH_STOP;
}

// The result

export type PassageSearchEndedView = 'complete' | 'stopped' | 'key-changed' | 'provider-failed' | 'instance-limit';
export type PassageSearchDropReasonView = 'quote-not-found' | 'quote-ambiguous' | 'malformed' | 'duplicate';
export type PassageSearchAnalysisMissingView = 'failed' | 'malformed' | 'cut' | 'no-room';

/** Files by how much of each the answered calls covered. */
export interface PassageSearchCoverageView {
  full: number;
  partial: number;
  none: number;
}

export interface PassageSearchInstanceView {
  /** From 1, in reading order: the instance's id in this result. */
  number: number;
  /** The display path, or a text's label. */
  file: string;
  line: number;
  /** Whether `line` is the document's, or counted within the searched text alone. */
  lines: 'document' | 'text';
  /** Whether the host has a file to open for it. */
  canOpen: boolean;
  quote: string;
  before: string;
  after: string;
  note: string;
  /** The label as shown. */
  label: string;
}

export interface PassageSearchLabelView {
  label: string;
  count: number;
  files: number;
}

export interface PassageSearchAnalysisView {
  headline: string;
  sections: Array<{ title: string; claims: Array<{ text: string; cites: number[] }> }>;
  read: { instances: number; of: number };
  dropped: { claims: number; sections: number };
}

export interface PassageSearchResultView {
  /** The host's id for the result it holds; open-instance and organize name it. */
  resultId: string;
  question: string;
  model: string;
  instances: PassageSearchInstanceView[];
  labels: PassageSearchLabelView[];
  analysis?: PassageSearchAnalysisView;
  analysisMissing?: PassageSearchAnalysisMissingView;
  dropped: Record<PassageSearchDropReasonView, number>;
  overLimit: number;
  /** `cancelled` (sent, then cancelled by Stop) is apart from `unsent`; absent when the engine does not count it. */
  calls: { planned: number; answered: number; failed: number; cut: number; unsent: number; cancelled?: number };
  files: {
    read: number;
    withInstances: number;
    leftOut: PassageSearchLeftOutView;
    /** How many files were searched whole, in part, or not at all; absent when the engine does not say. */
    coverage?: PassageSearchCoverageView;
  };
  ended: PassageSearchEndedView;
  /** How a run that did not read everything ended, in host words. */
  endedMessage?: string;
  leftOutMessage?: string;
  /** "Organize these results" may be offered: the reads were cut short, an instance was found, and a pass can be made. */
  canOrganize: boolean;
  usage?: TokenUsage;
}

export type PassageSearchResultPayload =
  | { requestId: string; status: 'finished'; result: PassageSearchResultView }
  /** `plan-expired`, `busy`, `result-expired` or `failed`; nothing was sent to a model for a refusal. */
  | { requestId: string; status: 'refused'; reason: string; message: string };

export interface PassageSearchResultMessage extends MessageEnvelope<PassageSearchResultPayload> {
  type: MessageType.PASSAGE_SEARCH_RESULT;
}

// Open an instance

export interface PassageSearchOpenInstancePayload {
  requestId: string;
  resultId: string;
  /** The instance's number. Never a path. */
  instance: number;
}

export interface PassageSearchOpenInstanceMessage extends MessageEnvelope<PassageSearchOpenInstancePayload> {
  type: MessageType.PASSAGE_SEARCH_OPEN_INSTANCE;
}

export type PassageSearchOpenInstanceResultPayload =
  | { requestId: string; status: 'opened' }
  | { requestId: string; status: 'refused'; message: string };

export interface PassageSearchOpenInstanceResultMessage extends MessageEnvelope<PassageSearchOpenInstanceResultPayload> {
  type: MessageType.PASSAGE_SEARCH_OPEN_INSTANCE_RESULT;
}

// Organize these results (a stopped result), its own two-step press

export interface PassageSearchOrganizePlanRequestPayload {
  requestId: string;
  resultId: string;
}

export interface PassageSearchOrganizePlanRequestMessage extends MessageEnvelope<PassageSearchOrganizePlanRequestPayload> {
  type: MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST;
}

export interface PassageSearchOrganizeEstimateView {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  usd?: number;
  /** How many instances the pass would read, of how many the result holds. */
  instances: { read: number; of: number };
}

export type PassageSearchOrganizePlanPayload =
  | { requestId: string; status: 'planned'; resultId: string; organizePlanId: string; estimate: PassageSearchOrganizeEstimateView }
  | { requestId: string; status: 'refused'; reason: string; message: string };

export interface PassageSearchOrganizePlanMessage extends MessageEnvelope<PassageSearchOrganizePlanPayload> {
  type: MessageType.PASSAGE_SEARCH_ORGANIZE_PLAN;
}

/** Answered with `PASSAGE_SEARCH_RESULT`, by this request id. */
export interface PassageSearchOrganizeRunPayload {
  requestId: string;
  resultId: string;
  organizePlanId: string;
}

export interface PassageSearchOrganizeRunMessage extends MessageEnvelope<PassageSearchOrganizeRunPayload> {
  type: MessageType.PASSAGE_SEARCH_ORGANIZE_RUN;
}

export type PassageSearchWebviewToExtensionMessage =
  | PassageSearchPlanRequestMessage
  | PassageSearchRunMessage
  | PassageSearchStopMessage
  | PassageSearchOpenInstanceMessage
  | PassageSearchOrganizePlanRequestMessage
  | PassageSearchOrganizeRunMessage;

export type PassageSearchExtensionToWebviewMessage =
  | PassageSearchPlanMessage
  | PassageSearchProgressMessage
  | PassageSearchResultMessage
  | PassageSearchOpenInstanceResultMessage
  | PassageSearchOrganizePlanMessage;
