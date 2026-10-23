/**
 * LightboxCallButton — one call's run control (ADR 2026-10-19 D6; Slice 4I,
 * epic decisions 41–45). Props-only over `lightboxCallControls`' view.
 *
 * - **The widgets' Analyze.** Every AI-read widget draws
 *   `LightboxAnalyzeButton` in its header, for its lens. It reads the board's
 *   controls from `LightboxCallControlsProvider`, so the renderer map and
 *   each tile's component pass nothing new; without a provider it draws
 *   nothing, and the frame keeps its register badge.
 * - **The Lenses panel's Run** draws `LightboxCallButton` with a call's
 *   control.
 * - **Disabled, not gone.** A control that cannot run now stays a focusable
 *   button with `aria-disabled` and its reason as its description, so the
 *   keyboard reaches it and a screen reader hears why; a press then does
 *   nothing. The reason is shown under it when it is the call's own (the
 *   Opinion with nothing to weigh, a call too large), and only described
 *   while another run is in flight. The accessible name starts with the
 *   visible label, then names the call, its lenses and its price ("Analyze,
 *   call B: Characters, Voice, Subtext · ≈ $0.04"; PR #166 N-01).
 */
import * as React from 'react';
import type { LightboxLensId, LightboxRunScope } from '@messages';
import type { LightboxCallControl, LightboxCallControls } from '@hooks/domain/lightbox/lightboxCallControls';
import { Icon } from '@components/shared/Icon';

/** The board's call controls and the press they send, for every widget under it. */
export interface LightboxCallControlsValue {
  controls: LightboxCallControls;
  onRun: (scope: LightboxRunScope) => void;
}

const LIGHTBOX_CALL_CONTROLS = React.createContext<LightboxCallControlsValue | null>(null);

/** Gives every widget below it its Analyze. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxCallControlsProvider = LIGHTBOX_CALL_CONTROLS.Provider;

export interface LightboxCallButtonProps {
  control: LightboxCallControl;
  onRun: (scope: LightboxRunScope) => void;
  /** A document-unique id for its reason (the description it points to). */
  reasonId: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxCallButton: React.FC<LightboxCallButtonProps> = ({ control, onRun, reasonId }) => {
  const unavailable = control.reason !== undefined;
  const { again } = control;
  return (
    <span className={`pm-lb-call${control.blocked ? ' is-blocked' : ''}`}>
      <button
        type="button"
        className={`pm-lb-call-button${again ? ' is-again' : ''}${control.inFlight ? ' is-live' : ''}`}
        aria-label={control.name}
        aria-disabled={unavailable ? true : undefined}
        aria-describedby={unavailable ? reasonId : undefined}
        title={control.reason ?? control.name}
        data-call={control.group}
        data-lens={control.scope.mode === 'group' ? control.scope.lens : undefined}
        onClick={() => {
          if (!unavailable) {
            onRun(control.scope);
          }
        }}
      >
        {control.inFlight
          ? <span className="pm-lb-spin is-small" aria-hidden="true" />
          : <Icon name={again ? 'refresh' : 'sparkle'} size={11} />}
        <span className="pm-lb-call-label">{control.label}</span>
        {control.cost && !control.inFlight && <span className="pm-lb-call-cost">{control.cost}</span>}
      </button>
      {unavailable && (
        <span id={reasonId} className={control.blocked ? 'pm-lb-call-reason' : 'pm-lb-visually-hidden'}>{control.reason}</span>
      )}
    </span>
  );
};

/** A widget's Analyze, for its lens, from the board's controls; nothing without them. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxAnalyzeButton: React.FC<{ lens: LightboxLensId }> = ({ lens }) => {
  const value = React.useContext(LIGHTBOX_CALL_CONTROLS);
  if (!value) {
    return null;
  }
  return <LightboxCallButton control={value.controls.lens[lens]} onRun={value.onRun} reasonId={`pm-lb-analyze-reason-${lens}`} />;
};

/** Whether the board's call controls are given here: the frame then draws Analyze in place of its read badge. */
export function useLightboxHasCallControls(): boolean {
  return React.useContext(LIGHTBOX_CALL_CONTROLS) !== null;
}
