/**
 * The host's words for a persona's passage-search card (ADR 2026-11-20
 * D19–D21): one line per refusal kind, the lines the host writes into the
 * thread and a transcript, and the card's own copy. Shared by the host's
 * answers and the webview, so a card says what the host said.
 *
 * - **Kinds, never words, are answered.** A result carries a refusal kind
 *   and these words for it.
 * - **Counts and a persona's label only.** No line holds the question, a
 *   scope's path, a quote, a note, a label or the analysis.
 * - **An estimate is approximate, never a cap:** "≈ $0.42" or "< $0.01",
 *   never "up to".
 */

import type {
  WorkshopPassageSearchCounts,
  WorkshopPassageSearchEstimateView,
  WorkshopPassageSearchRefusal
} from '@shared/types/messages/workshop/passageSearch';
import { formatApproximateUsd } from '@shared/utils/approximateUsd';

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the refusal kinds' kebab-case words, as answered. */
export const WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS: Readonly<Record<WorkshopPassageSearchRefusal, string>> = Object.freeze({
  'invalid-request': 'That press did not name a search.',
  'session-operation': 'Wait for the current session save or replacement to finish, then try again.',
  'room-changed': 'The room changed since this was shown, so nothing was done.',
  'no-card': 'That reply is no longer in this room.',
  'not-pending': 'This search was already run or cancelled.',
  'not-ready': 'This search has no results waiting here.',
  'not-running': 'This search is not running.',
  'search-running': 'Wait for the current search to finish.',
  'run-active': 'Wait for the current reply to finish.',
  'author-left': 'The persona who asked for this search isn’t in this room now.',
  'not-held': 'The report is no longer held: results are kept only while this window stays open on this room.',
  unavailable: 'Passage Search isn’t available here.',
  'plan-refused': 'This search can’t be run as asked.',
  'report-failed': 'The report could not be saved. Open a workspace folder and try again.',
  'search-failed': 'The search failed before it finished. Nothing was sent. Try again.',
  'delivery-failed': 'The results could not be sent. They are still here: send them again when ready.',
  'results-too-large': 'The results don’t fit in what is left of this conversation, so nothing was sent. They are still here: open the report.'
});
/* eslint-enable @typescript-eslint/naming-convention */

const count = (value: number): string => value.toLocaleString('en-US');
const plural = (value: number, one: string, many = `${one}s`): string => `${count(value)} ${value === 1 ? one : many}`;

/** "14 instances in 6 files", or "no instances in 6 files": counts only. */
export function workshopPassageSearchFoundWords(counts: Pick<WorkshopPassageSearchCounts, 'instances' | 'files'>): string {
  return `${counts.instances === 0 ? 'no instances' : plural(counts.instances, 'instance')} in ${plural(counts.files, 'file')}`;
}

/** The card's event line in a transcript (D21): how many places, never which. */
export function workshopPassageSearchCardTranscriptLine(scopes: number): string {
  return `Asked for a passage search of ${plural(scopes, 'scope')}.`;
}

/** The results turn's line, in the thread and a transcript (D21). */
export function workshopPassageSearchFinishedLine(counts: Pick<WorkshopPassageSearchCounts, 'instances' | 'files'>): string {
  return `Passage search finished: ${workshopPassageSearchFoundWords(counts)}.`;
}

/** What a search that did not read everything came to: "Stopped: 9 instances from 7 of 23 reads." */
export function workshopPassageSearchPartialWords(counts: WorkshopPassageSearchCounts): string {
  const lead = counts.ended === 'stopped' ? 'Stopped'
    : counts.ended === 'key-changed' ? 'The API key changed'
      : counts.ended === 'provider-failed' ? 'The provider refused the calls' : 'Ended early';
  return `${lead}: ${plural(counts.instances, 'instance')} from ${count(counts.calls.answered)} of ${plural(counts.calls.planned, 'read')}.`;
}

/** "2 calls were stopped in flight and may still have been charged."; empty when none was. */
function stoppedInFlightWords(counts: WorkshopPassageSearchCounts): string {
  const cancelled = counts.calls.cancelled ?? 0;
  return cancelled > 0 ? ` ${plural(cancelled, 'call was', 'calls were')} stopped in flight and may still have been charged.` : '';
}

/** What a finished search's card says of it, complete or not. */
export function workshopPassageSearchCountsWords(counts: WorkshopPassageSearchCounts): string {
  if (counts.ended !== 'complete' && counts.ended !== 'instance-limit') {
    return `${workshopPassageSearchPartialWords(counts)}${stoppedInFlightWords(counts)}`;
  }
  const missing = counts.calls.failed + counts.calls.unsent + (counts.calls.cancelled ?? 0);
  return `Found ${workshopPassageSearchFoundWords(counts)}.`
    + (counts.ended === 'instance-limit' ? ' The search reached the most instances it keeps.' : '')
    + (missing > 0 ? ` ${plural(missing, 'read')} did not finish.` : '');
}

/** "23 calls · ≈ $0.42 · model": the count first, then the price, then the model. */
export function workshopPassageSearchEstimateLine(estimate: Pick<WorkshopPassageSearchEstimateView, 'calls' | 'usd' | 'model'>): string {
  const price = estimate.usd === undefined ? 'price unavailable' : formatApproximateUsd(estimate.usd);
  return `${plural(estimate.calls, 'call')} · ${price} · ${estimate.model}`;
}

/** The price line's close: what the price covers, and what it does not. */
export function workshopPassageSearchPriceScope(persona: string): string {
  return `The search only. ${persona}'s reply to the results is an ordinary turn.`;
}

export const WORKSHOP_PASSAGE_SEARCH_ORGANIZE_NOTE = 'Includes an allowance for organizing the results.';
/** Beside Run: calls already made are spent if the window closes. */
export const WORKSHOP_PASSAGE_SEARCH_RUN_NOTE = 'A search that is stopped, or cut short by closing this window, cannot be resumed.';
export const WORKSHOP_PASSAGE_SEARCH_CANCELLED = 'Cancelled.';
