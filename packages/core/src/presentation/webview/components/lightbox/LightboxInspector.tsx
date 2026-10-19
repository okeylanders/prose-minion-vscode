/**
 * LightboxInspector — the pinned item, with its evidence (ADR 2026-10-19 D3,
 * D4). Props-only: the view model comes from `useLightboxInspector`.
 *
 * With nothing pinned it explains the board's three registers. With an item
 * pinned it shows the register, the claim, every paragraph the item lives in
 * (exact numbers, even when the ribbon buckets them; each chip pins that
 * paragraph), and what code counted. Actions that cross into the Workshop or
 * the editor arrive with later slices.
 */
import * as React from 'react';
import type { LightboxInspectorView } from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { Icon } from '@components/shared/Icon';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';

export interface LightboxInspectorProps {
  view: LightboxInspectorView | null;
  onClear: () => void;
  onPinParagraph: (index: number) => void;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}

/** Paragraph chips shown before the list collapses to a count. */
const PARAGRAPH_CHIPS = 48;

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxInspector: React.FC<LightboxInspectorProps> = ({ view, onClear, onPinParagraph, bind }) => {
  if (!view) {
    return (
      <div className="pm-lb-inspector">
        <div className="pm-lb-guide">
          <p className="pm-lb-label">Inspector</p>
          <h3>Nothing pinned yet.</h3>
          <p>
            Hover anything on the board to light the paragraphs it touches. Click it to pin it here with
            its evidence.
          </p>
          <div className="pm-lb-guide-row">
            <i className="pm-lb-key is-measured" />
            <span><b>Measured.</b> Counted by code. No model was asked.</span>
          </div>
          <div className="pm-lb-guide-row">
            <i className="pm-lb-key is-read" />
            <span>
              <b>Read.</b> A model’s interpretation, arriving in the next update. Its quotes will be checked
              against the text; a claim whose quote isn’t found is withheld, by name.
            </span>
          </div>
          <div className="pm-lb-guide-row">
            <i className="pm-lb-key is-counted-read" />
            <span><b>Counted · read.</b> Words counted by code, then grouped or named by a reading.</span>
          </div>
        </div>
      </div>
    );
  }

  const shown = view.paragraphs.slice(0, PARAGRAPH_CHIPS);
  const hidden = view.paragraphs.length - shown.length;

  return (
    <div className="pm-lb-inspector" aria-live="polite">
      <div className="pm-lb-inspector-head">
        <span className={`pm-lb-badge pm-lb-reg-${view.register}`}>{view.registerLabel}</span>
        <span className="pm-lb-inspector-where">{view.where}</span>
        <button type="button" className="pm-lb-inspector-clear" aria-label="Clear inspector" onClick={onClear}>
          <Icon name="x" size={13} />
        </button>
      </div>
      <h3 className="pm-lb-inspector-title">{view.title}</h3>
      <p className="pm-lb-inspector-claim">{view.claim}</p>
      <p className="pm-lb-inspector-note">{view.registerNote}</p>

      <div>
        <p className="pm-lb-label">Where it lives · {view.paragraphLabel}</p>
        {view.paragraphs.length === 0 ? (
          <p className="pm-lb-empty-note">No single paragraph holds it.</p>
        ) : (
          <div className="pm-lb-para-chips">
            {shown.map((index) => (
              <button
                key={index}
                type="button"
                className="pm-lb-para-chip"
                title={`Pin ¶${index}`}
                onClick={() => onPinParagraph(index)}
              >
                ¶{index}
              </button>
            ))}
            {hidden > 0 && <span className="pm-lb-para-more">+{hidden} more</span>}
          </div>
        )}
      </div>

      {view.support.length > 0 && (
        <div>
          <p className="pm-lb-label">Counted by code</p>
          <div className="pm-lb-support">
            {view.support.map((fact) => <span key={fact}>{fact}</span>)}
          </div>
        </div>
      )}

      {view.touching.length > 0 && (
        <div>
          <p className="pm-lb-label">Also in this paragraph</p>
          <div className="pm-lb-touching">
            {view.touching.map((touch) => (
              <LightboxItemButton key={touch.label} binding={bind(touch.ref)} className="pm-lb-touch">
                {touch.label}
              </LightboxItemButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
