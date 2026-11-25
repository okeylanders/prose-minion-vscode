/**
 * A persona's passage-search request (ADR 2026-11-20 D19–D21), rendered by
 * `WorkshopTurnBubble` under the reply beside its other cards. The card's
 * state is the host's (`passageSearchRequest.view`); this draws it.
 *
 * - **Pending:** the question, where it would look, and the price: the
 *   count of calls first, then the estimate, then the model, ending with
 *   what the price covers. **Run** and **Cancel**. Nothing is sent to a
 *   model until Run.
 * - **Running:** progress and **Stop**.
 * - **Ready:** what was found, **Send to <persona>** (or **Send partial
 *   results to <persona>** for a search that did not read everything),
 *   **Open report** and **Discard**.
 * - **Delivered:** what was found and how much of it the persona was sent,
 *   and **Open report** while this window still holds it.
 * - **Cancelled:** "Cancelled."
 *
 * Every press posts ids only, through the controls. The host's words for an
 * outcome sit beside the card in one status line, announced once.
 */

import * as React from 'react';
import type {
  WorkshopPassageSearchAction,
  WorkshopPassageSearchProgress,
  WorkshopPassageSearchScope,
  WorkshopTurn
} from '@messages';
import { workshopPassageSearchPlaceWords } from '@shared/utils/workshopPassageSearchPlaces';
import {
  WORKSHOP_PASSAGE_SEARCH_CANCELLED,
  WORKSHOP_PASSAGE_SEARCH_ORGANIZE_NOTE,
  WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS,
  WORKSHOP_PASSAGE_SEARCH_RUN_NOTE,
  workshopPassageSearchCountsWords,
  workshopPassageSearchEstimateLine,
  workshopPassageSearchPriceScope
} from '@shared/constants/workshopPassageSearchWords';
import type { WorkshopPassageSearchEstimateState } from '@hooks/domain/workshop/useWorkshopPassageSearch';

export interface WorkshopPassageSearchControls {
  estimates: ReadonlyMap<string, WorkshopPassageSearchEstimateState>;
  busy: ReadonlyMap<string, WorkshopPassageSearchAction>;
  progress: ReadonlyMap<string, WorkshopPassageSearchProgress>;
  feedback: ReadonlyMap<string, string>;
  /** True while the room's mutation lock is held. */
  locked: boolean;
  onEstimate: (turnId: string, again?: boolean) => void;
  onRun: (turnId: string) => void;
  onStop: (turnId: string) => void;
  onCancel: (turnId: string) => void;
  onSend: (turnId: string) => void;
  onDiscard: (turnId: string) => void;
  onOpenReport: (turnId: string) => void;
}

/** The host's line where a search's results were delivered: the writer wrote nothing, so it is drawn as a room line, never a bubble. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopPassageSearchResultsLine: React.FC<{ turn: WorkshopTurn; identity: Record<string, string> }> = ({ turn, identity }) => (
  <div className="pm-ws-revision-divider pm-ws-offer-request" {...identity} tabIndex={-1}>
    <span>{turn.content}</span>
  </div>
);

/** "Chapters, matching Drafts/chapter-4.*.md; Characters: jasper.md; the excerpt": where a search would look, as the card names it (S45). */
export function workshopPassageSearchScopeWords(scopes: readonly WorkshopPassageSearchScope[]): string {
  return workshopPassageSearchPlaceWords(scopes);
}

/** "Reading 7 of 23 · 5 found". */
export function workshopPassageSearchProgressWords(progress: WorkshopPassageSearchProgress | undefined): string {
  return progress ? `Reading ${progress.done} of ${progress.planned} · ${progress.found} found` : 'Starting the search…';
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopPassageSearchCard: React.FC<{ turn: WorkshopTurn; controls: WorkshopPassageSearchControls }> = ({ turn, controls }) => {
  const card = turn.passageSearchRequest;
  const view = card?.view ?? { status: 'pending' as const };
  const pending = card !== undefined && view.status === 'pending';
  const { onEstimate } = controls;
  // The price is asked when the card is first drawn pending; the hook asks once per card.
  const requestEstimateWhenPending = React.useCallback(() => {
    if (pending && !view.authorLeft) {
      onEstimate(turn.id);
    }
  }, [onEstimate, pending, turn.id, view.authorLeft]);
  React.useEffect(requestEstimateWhenPending, [requestEstimateWhenPending]);
  if (!card) {
    return null;
  }
  const persona = turn.personaLabel ?? 'the persona';
  const estimate = controls.estimates.get(turn.id);
  const waiting = controls.busy.get(turn.id);
  const disabled = controls.locked || waiting !== undefined;
  const note = controls.feedback.get(turn.id);
  const button = (label: string, onClick: () => void, off = disabled) => (
    <button type="button" className="settings-button" onClick={onClick} aria-disabled={off || undefined} disabled={off}>{label}</button>
  );
  const body = (() => {
    switch (view.status) {
      case 'cancelled':
        return <div className="pm-cps-applied">{WORKSHOP_PASSAGE_SEARCH_CANCELLED}</div>;
      case 'running':
        return (
          <>
            <div className="pm-cps-applied">{workshopPassageSearchProgressWords(controls.progress.get(turn.id) ?? view.progress)}</div>
            <div className="pm-cps-actions">{button('Stop', () => controls.onStop(turn.id), false)}</div>
          </>
        );
      case 'ready':
        return (
          <>
            <div className="pm-cps-applied">{workshopPassageSearchCountsWords(view.counts)}</div>
            {view.sending
              ? <div className="pm-cps-applied">Sending the results to {persona}…</div>
              : (
                <div className="pm-cps-actions">
                  {view.authorLeft
                    ? <span className="pm-cps-status">{WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['author-left']}</span>
                    : button(view.partial ? `Send partial results to ${persona}` : `Send to ${persona}`, () => controls.onSend(turn.id))}
                  {button('Open report', () => controls.onOpenReport(turn.id))}
                  {button('Discard', () => controls.onDiscard(turn.id))}
                </div>
              )}
          </>
        );
      case 'delivered':
        return (
          <>
            <div className="pm-cps-applied">
              {workshopPassageSearchCountsWords(view.counts)}{' '}
              {view.shown < view.counts.instances
                ? `${persona} was sent ${view.shown} of ${view.counts.instances} instances; the report has them all.`
                : `Sent to ${persona}.`}
            </div>
            <div className="pm-cps-actions">
              {view.reportHeld
                ? button('Open report', () => controls.onOpenReport(turn.id))
                : <span className="pm-cps-status">{WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['not-held']}</span>}
            </div>
          </>
        );
      default:
        return (
          <>
            {view.authorLeft && <div className="pm-cps-applied">{WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['author-left']}</div>}
            {!view.authorLeft && (!estimate || estimate.loading) && <div className="pm-cps-applied">Working out the price…</div>}
            {!view.authorLeft && estimate?.refusal !== undefined && <div className="pm-cps-applied">{estimate.refusal}</div>}
            {!view.authorLeft && estimate?.estimate && (
              <div className="pm-cps-applied">
                <div>{workshopPassageSearchEstimateLine(estimate.estimate)}</div>
                {estimate.estimate.leftOut && <div>{estimate.estimate.leftOut}</div>}
                <div>
                  {estimate.estimate.organizes ? `${WORKSHOP_PASSAGE_SEARCH_ORGANIZE_NOTE} ` : ''}
                  {workshopPassageSearchPriceScope(persona)}
                </div>
                <div>{WORKSHOP_PASSAGE_SEARCH_RUN_NOTE}</div>
              </div>
            )}
            <div className="pm-cps-actions">
              {!view.authorLeft && estimate?.estimate && button(waiting === 'run' ? 'Starting…' : 'Run', () => controls.onRun(turn.id))}
              {!view.authorLeft && estimate?.refusal !== undefined && button('Check the price again', () => controls.onEstimate(turn.id, true))}
              {button('Cancel', () => controls.onCancel(turn.id))}
            </div>
          </>
        );
    }
  })();
  return (
    <section className="pm-cps-sheet pm-ws-passage-search-card" aria-label={`Passage search ${persona} asked for`}>
      <div className="pm-cps-applies">Passage search: {card.question}</div>
      <div className="pm-cps-applied">Where: {workshopPassageSearchScopeWords(card.scopes)}</div>
      {body}
      {note && <div className="pm-cps-status" role="status">{note}</div>}
    </section>
  );
};
