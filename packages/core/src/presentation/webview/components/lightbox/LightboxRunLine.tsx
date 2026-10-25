/**
 * LightboxRunLine — the run line's button and what it says (ADR 2026-10-19
 * D6, D8). Props-only: the view model is `buildLightboxRunLine`.
 *
 * Before any run: "Run AI analyses", the call count and estimated cost, the
 * book-sized warning, and, when a call would not fit, the button disabled
 * with the reason. While analyzing: the calls back and Stop. After: quotes
 * checked and withheld, and "Finish" or "Re-analyze" with its cost. The
 * button keeps the primary (orange) style and the sparkle in every state
 * (Slice 4I, the writer's request).
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
          className="pm-lb-primary pm-lb-run-press"
          disabled={action.disabled}
          aria-describedby={described}
          title={action.reason ?? (action.cost || undefined)}
          onClick={() => onRun(action.scope)}
        >
          <Icon name="sparkle" size={13} />
          {action.label}
          {/* Before any run the note beside it states the cost; after one, the button carries it. */}
          {action.label !== 'Run AI analyses' && action.cost && <span className="pm-lb-run-cost">{action.cost}</span>}
        </button>
      )}
      {action?.reason && <p className="pm-lb-run-reason" id="pm-lb-run-reason">{action.reason}</p>}
      {view.notice && <p className="pm-lb-run-reason" role="alert">{view.notice}</p>}
    </div>
  );
};
