/**
 * LightboxRunLine — the Read button and what it says (ADR 2026-10-19 D6, D8).
 * Props-only: the view model is `buildLightboxRunLine`.
 *
 * Before a press: the call count and estimated cost, the book-sized warning,
 * and, when a call would not fit, the button disabled with the reason. While
 * reading: the groups back and Stop. After: quotes checked and withheld, and
 * the next press.
 */
import * as React from 'react';
import type { LightboxRunScope } from '@messages';
import type { LightboxRunLineView } from '@hooks/domain/lightbox/lightboxRunLine';
import { Icon } from '@components/shared/Icon';

export interface LightboxRunLineProps {
  view: LightboxRunLineView;
  onRun: (scope: LightboxRunScope) => void;
  onStop: (token: string) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxRunLine: React.FC<LightboxRunLineProps> = ({ view, onRun, onStop }) => {
  const { action } = view;
  const described = action?.reason ? 'pm-lb-run-reason' : undefined;
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
      {action && (
        <button
          type="button"
          className={action.label === 'Read the chapter' ? 'pm-lb-primary' : 'pm-lb-button'}
          disabled={action.disabled}
          aria-describedby={described}
          title={action.reason ?? (action.cost || undefined)}
          onClick={() => onRun(action.scope)}
        >
          <Icon name={action.label === 'Read the chapter' ? 'sparkle' : 'refresh'} size={13} />
          {action.label}
          {action.label !== 'Read the chapter' && <span className="pm-lb-run-cost">{action.cost}</span>}
        </button>
      )}
      {action?.reason && <p className="pm-lb-run-reason" id="pm-lb-run-reason">{action.reason}</p>}
      {view.notice && <p className="pm-lb-run-reason" role="alert">{view.notice}</p>}
    </div>
  );
};
