/**
 * LightboxLensesPanel — the rail's lens toggles (ADR 2026-10-19 D6).
 *
 * Measuring is always on and free. Each reading lens can be turned off: it is
 * left out of its group's prompt, and a group with no lens on is not called,
 * so the toggles change the call count and the estimate the card states. The
 * webview remembers the choice and sends it to the host, which re-estimates.
 */
import * as React from 'react';
import type { LightboxLensId } from '@messages';
import { LIGHTBOX_LENSES } from '@shared/constants/lightbox';
import { Icon } from '@components/shared/Icon';

export interface LightboxLensesPanelProps {
  lensesOff: readonly LightboxLensId[];
  /** "3 calls · est. $0.04", "measure only · free", or "Estimating…" while the host prices it. */
  costNote: string;
  onToggle: (lens: LightboxLensId) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxLensesPanel: React.FC<LightboxLensesPanelProps> = ({ lensesOff, costNote, onToggle }) => (
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
      Readings run only when you press Read, as up to four grouped calls. A lens you turn off is left out of
      its call, and a call with no lens on is not made.
    </p>
  </section>
);
