/**
 * LightboxLensesPanel — the rail's lens toggles (ADR 2026-10-19 D6).
 *
 * Measuring is always on and free. Each reading lens can be turned off: it is
 * left out of its group's prompt, and a group with no lens on is not called,
 * so the toggles change the call count and the estimate the card states. The
 * webview remembers the choice and sends it to the host, which re-estimates.
 *
 * The lenses are listed under their calls (Slice 4I, epic decision 45). Each
 * call's small header names it and holds its Run: "Run A" before the call
 * holds a reading, "Rerun A" after, with its price, reading the call's
 * lenses that are on. One button per call, not per lens, so the list stays
 * a list of lenses.
 */
import * as React from 'react';
import type { LightboxLensId, LightboxReadingGroupId, LightboxRunScope } from '@messages';
import { LIGHTBOX_LENSES, LIGHTBOX_READING_GROUPS } from '@shared/constants/lightbox';
import type { LightboxCallControl } from '@hooks/domain/lightbox/lightboxCallControls';
import { Icon } from '@components/shared/Icon';
import { LightboxCallButton } from '@components/lightbox/LightboxCallButton';

export interface LightboxLensesPanelProps {
  lensesOff: readonly LightboxLensId[];
  /** "3 calls · est. $0.04", "measure only · free", or "Estimating…" while the host prices it. */
  costNote: string;
  /** Each call's Run (Slice 4I); absent while there is no board to read. */
  calls?: {
    controls: Readonly<Record<LightboxReadingGroupId, LightboxCallControl>>;
    onRun: (scope: LightboxRunScope) => void;
  };
  onToggle: (lens: LightboxLensId) => void;
}

/** The calls in rail order, each with its lenses (A–E, G, then F, as the lenses run). */
const CALLS: ReadonlyArray<{ group: LightboxReadingGroupId; lenses: typeof LIGHTBOX_LENSES }> = LIGHTBOX_LENSES
  .map((lens) => lens.group)
  .filter((group, index, groups) => groups.indexOf(group) === index)
  .map((group) => ({ group, lenses: LIGHTBOX_LENSES.filter((lens) => lens.group === group) }));

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxLensesPanel: React.FC<LightboxLensesPanelProps> = ({ lensesOff, costNote, calls, onToggle }) => (
  <section className="pm-ws-block pm-lb-lenses" aria-label="Lenses">
    <div className="pm-ws-block-head">
      <p className="pm-ws-eyebrow">Lenses</p>
      <span className="pm-lb-meta">{costNote}</span>
    </div>
    <div className="pm-lb-lens-row is-fixed">
      <span className="pm-lb-lens-lock"><Icon name="check" size={10} strokeWidth={3} /></span>
      <span className="pm-lb-lens-name">Measure</span>
      <span className="pm-lb-lens-group">free · always</span>
    </div>
    {CALLS.map(({ group, lenses }) => (
      <div key={group} className="pm-lb-lens-call" role="group" aria-label={`Call ${group}`}>
        <div className="pm-lb-call-head">
          <span className="pm-lb-call-name">Call {group}</span>
          {calls && <LightboxCallButton control={calls.controls[group]} onRun={calls.onRun} reasonId={`pm-lb-call-reason-${group}`} />}
        </div>
        {lenses.map((lens) => {
          const on = !lensesOff.includes(lens.id);
          return (
            <label key={lens.id} className={`pm-lb-lens-row${on ? '' : ' is-off'}`}>
              <input type="checkbox" checked={on} onChange={() => onToggle(lens.id)} />
              <span className="pm-lb-lens-name">{lens.label}</span>
              {/* The call is the header's to show; a checkbox reached on its own still names it. */}
              <span className="pm-lb-visually-hidden"> · call {group}</span>
            </label>
          );
        })}
      </div>
    ))}
    <p className="pm-lb-caption">
      Readings run only when you ask: Run AI analyses makes up to {LIGHTBOX_READING_GROUPS.length} calls, the Opinion last, on
      the checked board; a call&apos;s Run, or a widget&apos;s Analyze, makes that call alone. A lens you turn off is left out of
      its call, and a call with no lens on is not made.
    </p>
  </section>
);
