/**
 * The Passage Search panel's controls, in words (ADR 2026-11-20 D15). Pure.
 *
 * A control that cannot act stays focusable and says why: each `…Blocked`
 * returns the reason, or undefined when the press may go ahead. The
 * announcement is the one line the panel's live region carries.
 */

import type { PassageSearchScopeChoices } from '@messages';
import type { PassageSearchState } from '@hooks/domain/usePassageSearch';
import { passageSearchProgressLine, passageSearchSummary } from '@shared/utils/passageSearchWords';

type PanelState = Pick<PassageSearchState, 'question' | 'scopes' | 'plan' | 'run' | 'result' | 'runRefusal' | 'organizeOffer'>;

export function passageSearchHasScope(scopes: PassageSearchScopeChoices): boolean {
  return scopes.activeFile || scopes.selection || scopes.groups.length > 0 || scopes.pattern.trim().length > 0;
}

/** Why Estimate cannot be pressed now; undefined when it can. */
export function passageSearchEstimateBlocked(state: Pick<PanelState, 'question' | 'scopes' | 'plan' | 'run'>): string | undefined {
  if (state.run.status === 'running') {
    return 'A search is running. Stop it, or wait for it to finish.';
  }
  if (state.question.trim().length === 0) {
    return 'Ask a question to search for first.';
  }
  if (!passageSearchHasScope(state.scopes)) {
    return 'Choose something to search first.';
  }
  if (state.plan.status === 'estimating') {
    return 'Estimating…';
  }
  return undefined;
}

/** Why Run cannot be pressed now; undefined when it can. */
export function passageSearchRunBlocked(state: Pick<PanelState, 'plan' | 'run'>): string | undefined {
  if (state.run.status === 'running') {
    return 'A search is running.';
  }
  if (state.plan.status !== 'planned') {
    return 'Estimate the search first. Run sends exactly what was estimated.';
  }
  return undefined;
}

/** The live region's line: progress while running, else the newest outcome. */
export function passageSearchAnnouncement(state: PanelState): string {
  if (state.run.status === 'running') {
    if (state.run.stopping) {
      return 'Stopping…';
    }
    if (state.run.kind === 'organize') {
      return 'Organizing the results…';
    }
    return state.run.progress ? passageSearchProgressLine(state.run.progress) : 'Starting the search…';
  }
  if (state.runRefusal) {
    return state.runRefusal;
  }
  if (state.plan.status === 'estimating') {
    return 'Estimating…';
  }
  if (state.plan.status === 'refused') {
    return state.plan.message;
  }
  if (state.plan.status === 'planned') {
    return 'Estimate ready.';
  }
  if (state.result) {
    const summary = passageSearchSummary(state.result);
    return state.result.endedMessage ? `${summary}${summary.endsWith('.') ? '' : '.'} ${state.result.endedMessage}` : summary;
  }
  return '';
}
