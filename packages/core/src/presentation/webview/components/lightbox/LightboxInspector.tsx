/**
 * LightboxInspector — the pinned item, with its evidence (ADR 2026-10-19 D3,
 * D4, D7). Props-only: the view model comes from `useLightboxInspector`.
 *
 * With nothing pinned it explains the board's three registers. With an item
 * pinned it shows the register, the claim, every paragraph the item lives in
 * (exact numbers, even when the ribbon buckets them; each chip pins that
 * paragraph), and what code counted. A reading adds its evidence (each quote
 * as the chapter has it, with its ¶ and how it was found), the quotes
 * withheld and why, its own fields, where it strains, and "Re-read this
 * tile": one call for that lens. Actions that cross into the Workshop or the
 * editor arrive with later slices.
 */
import * as React from 'react';
import type { LightboxLensId } from '@messages';
import type { LightboxInspectorView } from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { Icon } from '@components/shared/Icon';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';

/** What "Re-read this tile" says and does. */
export interface LightboxRereadControl {
  /** "1 call · est. $0.01" for a lens. */
  note: (lens: LightboxLensId) => string | undefined;
  /** Why it cannot run now (a run in flight, no API key). */
  reason?: string;
  onReread: (lens: LightboxLensId) => void;
}

export interface LightboxInspectorProps {
  view: LightboxInspectorView | null;
  onClear: () => void;
  onPinParagraph: (index: number) => void;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
  reread: LightboxRereadControl;
}

/** Paragraph chips shown before the list collapses to a count. */
const PARAGRAPH_CHIPS = 48;

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxInspector: React.FC<LightboxInspectorProps> = ({ view, onClear, onPinParagraph, bind, reread }) => {
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
              <b>Read.</b> A model’s interpretation. Its quotes are checked against the text; a claim whose
              quote isn’t found is withheld, by name.
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
  const reading = view.reading;
  const rereadNote = reading ? reread.note(reading.lens) : undefined;

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
      {view.claim && <p className={`pm-lb-inspector-claim${reading ? ' is-read' : ''}`}>{view.claim}</p>}
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

      {reading && (reading.evidence.length > 0 || reading.withheld.length > 0) && (
        <div>
          <p className="pm-lb-label">Evidence · checked against the text</p>
          {reading.evidence.map((quote, index) => (
            <div key={`${quote.paragraph}:${index}`} className="pm-lb-evidence">
              <span className="pm-lb-evidence-top">
                <span>¶{quote.paragraph}{quote.note ? ` · ${quote.note}` : ''}</span>
                <span className="pm-lb-evidence-ok"><Icon name="check" size={11} strokeWidth={3} />{quote.matchLabel}</span>
              </span>
              <q className="pm-lb-evidence-quote">{quote.text}</q>
            </div>
          ))}
          {reading.withheld.map((quote, index) => (
            <div key={`withheld:${quote.paragraph}:${index}`} className="pm-lb-withheld-quote-card">
              <b>Withheld · ¶{quote.paragraph}</b>
              <span>{quote.text}</span>
            </div>
          ))}
        </div>
      )}

      {reading && reading.details.length > 0 && (
        <div>
          <p className="pm-lb-label">The reading</p>
          <dl className="pm-lb-details">
            {reading.details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>
                  {detail.measured && <span className="pm-lb-voice-measured">{detail.measured}</span>}
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {view.support.length > 0 && (
        <div>
          <p className="pm-lb-label">Counted by code</p>
          <div className="pm-lb-support">
            {view.support.map((fact) => <span key={fact}>{fact}</span>)}
          </div>
        </div>
      )}

      {reading && (
        <div>
          <p className="pm-lb-label">Where this reading strains</p>
          <div className="pm-lb-friction"><p>{reading.friction}</p></div>
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

      {reading && (
        <div className="pm-lb-inspector-actions">
          <button
            type="button"
            className="pm-lb-button is-ghost"
            disabled={reread.reason !== undefined}
            title={reread.reason ?? rereadNote}
            onClick={() => reread.onReread(reading.lens)}
          >
            Re-read this tile
          </button>
          <span className="pm-lb-run-note">{reread.reason ?? rereadNote ?? '1 call'}</span>
        </div>
      )}
    </div>
  );
};
