/**
 * One suggested file edit under a persona's reply (ADR 2026-11-05 D8, D9;
 * epic Slice 4b): its file's display path and class, the why, each
 * operation, and the host's words for its state.
 *
 * - **Actions only while `pending`:** Apply, Review in editor… and Decline.
 *   Every other state offers nothing (D8: no blind retry); the writer asks
 *   the persona again.
 * - **Busy** while its request is out or the host holds it `applying`
 *   (`aria-busy`). A busy button stays focusable (`aria-disabled`) and
 *   presses nothing, so focus is never dropped mid-action.
 * - **Announced.** The state line is a `role=status` region that is always
 *   drawn, so a change of state, or an answer's words, is read out. When an
 *   action settles the card and its buttons go, focus moves to that line.
 *
 * Every word about a state comes from the host's table
 * (`workshopFileEditCardWords`) or the host's answer; the card writes none
 * of its own about why.
 */

import * as React from 'react';
import type { WorkshopFileEditProposal } from '@messages';
import { Icon } from '@components/shared/Icon';
import { workshopFileEditCardKey, workshopFileEditCardView } from '@hooks/domain/workshop/fileEdits/workshopFileEditCardView';
import type { WorkshopFileEditCardFeedback, WorkshopFileEditPreviewView } from '@hooks/domain/workshop/useWorkshopFileEdits';
import { WorkshopFileEditOperation } from './WorkshopFileEditOperation';

/** What the thread can ask of a file-edit card; WorkshopApp wires the hook in. */
export interface WorkshopFileEditControls {
  /** True while the room's mutation lock is held. */
  disabled: boolean;
  /** Why the buttons wait, in the host's words, when they do. */
  disabledReason?: string;
  busyCards: ReadonlySet<string>;
  cardFeedback: ReadonlyMap<string, WorkshopFileEditCardFeedback>;
  previews: ReadonlyMap<string, WorkshopFileEditPreviewView>;
  onApply: (turnId: string, index: number) => void;
  onReview: (turnId: string, index: number) => void;
  onDecline: (turnId: string, index: number) => void;
  onRequestPreview: (turnId: string, index: number) => void;
}

export interface WorkshopFileEditCardProps {
  turnId: string;
  index: number;
  proposal: WorkshopFileEditProposal;
  controls: WorkshopFileEditControls;
  /** "fixes" or "rewrites" on a card that answers an edit offer (ADR 2026-11-10 U4). */
  mark?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopFileEditCard: React.FC<WorkshopFileEditCardProps> = ({ turnId, index, proposal, controls, mark }) => {
  const key = workshopFileEditCardKey(turnId, index);
  const view = React.useMemo(() => workshopFileEditCardView(proposal), [proposal]);
  const requestOut = controls.busyCards.has(key);
  const busy = requestOut || proposal.state === 'applying';
  const feedback = view.actionable ? controls.cardFeedback.get(key) : undefined;
  const cardRef = React.useRef<HTMLDivElement>(null);
  const statusRef = React.useRef<HTMLDivElement>(null);
  const acted = React.useRef(false);

  // Once an action settles the card, its buttons go: focus moves to the line that says what happened.
  const focusStatusWhenSettled = React.useCallback(() => {
    if (view.actionable || !acted.current) {
      return;
    }
    acted.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || cardRef.current?.contains(active)) {
      statusRef.current?.focus();
    }
  }, [view.actionable]);
  React.useEffect(focusStatusWhenSettled, [focusStatusWhenSettled]);

  const press = (action: (turnId: string, index: number) => void) => () => {
    if (busy || controls.disabled) {
      return;
    }
    acted.current = true;
    action(turnId, index);
  };
  const named = (label: string) => `${label}, edit to ${view.path}`;

  return (
    <div
      ref={cardRef}
      className={`pm-ws-file-edit-card pm-ws-file-edit-${proposal.state}`}
      role="group"
      aria-label={`Suggested edit to ${view.path}`}
      aria-busy={busy}
    >
      <div className="pm-ws-file-edit-head">
        <span className="pm-ws-file-edit-title">
          <Icon name="pen" size={12} /> Suggested edit
        </span>
        <span className="pm-ws-file-edit-path">{view.path}</span>
        {view.classLabel && <span className="pm-ws-file-edit-class">{view.classLabel}</span>}
        {mark && <span className={`pm-ws-file-edit-class${view.classLabel ? ' pm-ws-file-edit-intent' : ''}`}>{mark}</span>}
      </div>
      {view.why && <div className="pm-ws-file-edit-why">{view.why}</div>}
      <ol className="pm-ws-file-edit-ops">
        {view.operations.map((operation, at) => (
          <WorkshopFileEditOperation
            key={at}
            view={operation}
            pending={view.actionable}
            preview={controls.previews.get(key)}
            onOpenPreview={() => controls.onRequestPreview(turnId, index)}
          />
        ))}
      </ol>
      {view.tally && <div className="pm-ws-file-edit-tally">{view.tally}</div>}
      <div ref={statusRef} className="pm-ws-file-edit-status" role="status" tabIndex={-1}>
        {feedback ? feedback.message : view.words}
      </div>
      {view.actionable && (
        <div className="pm-ws-file-edit-foot">
          <button
            type="button"
            className="pm-ws-file-edit-apply"
            disabled={controls.disabled}
            aria-disabled={busy || undefined}
            aria-label={named('Apply')}
            onClick={press(controls.onApply)}
          >
            <Icon name="check" size={12} /> Apply
          </button>
          <button
            type="button"
            className="pm-ws-file-edit-ghost"
            disabled={controls.disabled}
            aria-disabled={busy || undefined}
            aria-label={named('Review in editor')}
            onClick={press(controls.onReview)}
          >
            Review in editor…
          </button>
          <button
            type="button"
            className="pm-ws-file-edit-ghost"
            disabled={controls.disabled}
            aria-disabled={busy || undefined}
            aria-label={named('Decline')}
            onClick={press(controls.onDecline)}
          >
            Decline
          </button>
          {controls.disabled && controls.disabledReason && (
            <span className="pm-ws-file-edit-hint">{controls.disabledReason}</span>
          )}
        </div>
      )}
    </div>
  );
};
