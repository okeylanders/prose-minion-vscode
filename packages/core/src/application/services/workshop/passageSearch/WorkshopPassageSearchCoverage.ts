/**
 * Whether a persona's passage search read everything it planned (ADR
 * 2026-11-20 D21; the orchestrator's rule for PR #296). Pure.
 *
 * The host sends a result to the persona by itself only when it ended
 * `complete` or `instance-limit` and its coverage is whole: every planned
 * file searched in full, and no read failed, cut off, stopped in flight or
 * never sent. Anything else waits on the card as `ready`, with **Send
 * partial results to** the persona; the card and the directive say what was
 * not searched.
 *
 * This is the one place that rule lives. A read the engine's preflight
 * refused before dispatch (`tooLarge`, #295) is a read that went unsearched.
 * A new way for a read to go unsearched joins `WorkshopPassageSearchCoverage`
 * and the test here, and nowhere else.
 */

import type { PassageSearchResultView, WorkshopPassageSearchEnded } from '@messages';

/** What a result covered, in counts. */
export interface WorkshopPassageSearchCoverage {
  readonly ended: WorkshopPassageSearchEnded;
  /** Reads that left text unsearched or instances unread. */
  readonly calls: { readonly failed: number; readonly cut: number; readonly cancelled: number; readonly unsent: number; readonly tooLarge: number };
  /** Files of the plan, and how many of them were searched in full. */
  readonly files: { readonly planned: number; readonly searchedInFull: number };
}

export function workshopPassageSearchCoverage(view: PassageSearchResultView): WorkshopPassageSearchCoverage {
  const { calls, files } = view;
  return {
    ended: view.ended,
    calls: { failed: calls.failed, cut: calls.cut, cancelled: calls.cancelled, unsent: calls.unsent, tooLarge: calls.tooLarge },
    files: { planned: files.planned, searchedInFull: files.searched.full }
  };
}

/** Whether the host may send the result by itself: it ended reading everything, and read all of it. */
export function isWorkshopPassageSearchFullyRead(coverage: WorkshopPassageSearchCoverage): boolean {
  const { calls, files } = coverage;
  return (coverage.ended === 'complete' || coverage.ended === 'instance-limit')
    && calls.failed === 0 && calls.cut === 0 && calls.cancelled === 0 && calls.unsent === 0 && calls.tooLarge === 0
    && files.searchedInFull === files.planned;
}
