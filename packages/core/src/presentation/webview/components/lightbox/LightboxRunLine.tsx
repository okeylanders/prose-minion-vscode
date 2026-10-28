/**
 * LightboxRunLine — the run line's presses and what it says (ADR 2026-10-19
 * D6, D8). Props-only: the view model is `buildLightboxRunLine`.
 *
 * Before any run: "Run AI analyses", the call count and estimated cost, the
 * book-sized warning, and, when a call would not fit, the button disabled
 * with the reason. While analyzing: the calls back and Stop. After: quotes
 * checked and withheld, and "Finish" or "Re-analyze" with its cost. That
 * press keeps the primary (orange) style and the sparkle in every state
 * (Slice 4I, the writer's request). Beside "Finish", once a call has landed,
 * "Re-analyze all" runs every call again: a secondary button with its own
 * cost and its own reason (Slice 4M, epic decision 53). Each press's
 * accessible name starts with its visible label.
 */
import * as React from 'react';
import type { LightboxRunScope } from '@messages';
import {
  lightboxRunLineReasons,
  type LightboxRunLineAction,
  type LightboxRunLineView
} from '@hooks/domain/lightbox/lightboxRunLine';
import { Icon } from '@components/shared/Icon';

export interface LightboxRunLineProps {
  view: LightboxRunLineView;
  onRun: (scope: LightboxRunScope) => void;
  onStop: (token: string) => void;
}

interface LightboxRunPressProps {
  action: LightboxRunLineAction;
  className: string;
  icon: 'sparkle' | 'refresh';
  /** The id of the reason it is described by, when it cannot run. */
  describedBy?: string;
  onRun: (scope: LightboxRunScope) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const LightboxRunPress: React.FC<LightboxRunPressProps> = ({ action, className, icon, describedBy, onRun }) => (
  <button
    type="button"
    className={className}
    disabled={action.disabled}
    aria-describedby={describedBy}
    title={action.reason ?? (action.cost || undefined)}
    onClick={() => onRun(action.scope)}
  >
    <Icon name={icon} size={13} />
    {action.label}
    {/* Before any run the note beside it states the cost; after one, the button carries it. */}
    {action.label !== 'Run AI analyses' && action.cost && <span className="pm-lb-run-cost">{action.cost}</span>}
  </button>
);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxRunLine: React.FC<LightboxRunLineProps> = ({ view, onRun, onStop }) => {
  const { action, secondaryAction } = view;
  const reasons = lightboxRunLineReasons(view);
  return (
    <div className="pm-lb-run" data-run-status={view.status}>
      {view.status === 'running' && <span className="pm-lb-spin" aria-hidden="true" />}
      <span className="pm-lb-run-note" role={view.status === 'running' ? 'status' : undefined}>{view.note}</span>
      {view.warning && <span className="pm-lb-run-warning">{view.warning}</span>}
      {view.status === 'running' && (
        <button
          type="button"
          className="pm-lb-button"
          disabled={!view.stopToken}
          onClick={() => view.stopToken && onStop(view.stopToken)}
        >
          Stop
        </button>
      )}
      {/* The presses stay together: side by side, wrapping as a pair onto a line of their own (Slice 4M). */}
      {action && (
        <span className="pm-lb-run-presses">
          <LightboxRunPress
            action={action}
            className="pm-lb-primary pm-lb-run-press"
            icon="sparkle"
            describedBy={reasons.action}
            onRun={onRun}
          />
          {secondaryAction && (
            <LightboxRunPress
              action={secondaryAction}
              className="pm-lb-button pm-lb-run-secondary"
              icon="refresh"
              describedBy={reasons.secondaryAction}
              onRun={onRun}
            />
          )}
        </span>
      )}
      {reasons.shown.map((reason) => <p key={reason.id} className="pm-lb-run-reason" id={reason.id}>{reason.text}</p>)}
      {view.notice && <p className="pm-lb-run-reason" role="alert">{view.notice}</p>}
    </div>
  );
};
