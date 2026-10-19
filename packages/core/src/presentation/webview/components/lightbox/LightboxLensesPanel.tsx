/**
 * LightboxLensesPanel — the rail's lens toggles (ADR 2026-10-19 D6).
 *
 * Measuring is always on and free. Each reading lens can be turned off; the
 * webview remembers the choice, the board hides an off lens's placeholder,
 * and Slice 2B leaves an off lens out of its group's call. Until then no
 * lens sends anything, so the card states that instead of a cost.
 */
import * as React from 'react';
import type { LightboxLensId } from '@messages';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { Icon } from '@components/shared/Icon';

export interface LightboxLensesPanelProps {
  lensesOff: readonly LightboxLensId[];
  onToggle: (lens: LightboxLensId) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxLensesPanel: React.FC<LightboxLensesPanelProps> = ({ lensesOff, onToggle }) => (
  <section className="pm-ws-block pm-lb-lenses" aria-label="Lenses">
    <div className="pm-ws-block-head">
      <p className="pm-ws-eyebrow">Lenses</p>
      <span className="pm-lb-meta">measure only · free</span>
    </div>
    <div className="pm-lb-lens-row is-fixed">
      <span className="pm-lb-lens-lock"><Icon name="check" size={10} strokeWidth={3} /></span>
      <span className="pm-lb-lens-name">Measure</span>
      <span className="pm-lb-lens-group">free · always</span>
    </div>
    {LIGHTBOX_LENSES.map((lens) => {
      const on = !lensesOff.includes(lens.id);
      return (
        <label key={lens.id} className={`pm-lb-lens-row${on ? '' : ' is-off'}`}>
          <input type="checkbox" checked={on} onChange={() => onToggle(lens.id)} />
          <span className="pm-lb-lens-name">{lens.label}</span>
          <span className="pm-lb-lens-group">call {lens.group}</span>
        </label>
      );
    })}
    <p className="pm-lb-caption">
      Readings arrive in the next update, as three grouped calls you start yourself. Lenses you turn off
      stay off.
    </p>
  </section>
);
