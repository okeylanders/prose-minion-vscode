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
 * tile": one call for that lens. A borrowed field (Slice 3) adds its terms
 * by degree and "Build as a lens", which the host carries into the Workshop.
 * Other actions that cross into the Workshop or the editor arrive later.
 *
 * The addresses render a page at a time (PR #148 F-04). With more than one
 * page, a pager steps between them and jumps to a paragraph number, all by
 * keyboard, without changing the pin; a jump focuses the address it lands on.
 * Paging is not announced chip by chip: the range label is the change the
 * live inspector reads out. A reading's evidence is its own list, apart from
 * the paged addresses.
 */
import * as React from 'react';
import type { LightboxGravityFieldTile, LightboxLensId } from '@messages';
import type { LightboxBuildLensView } from '@hooks/domain/lightbox/lightboxHandoff';
import type {
  LightboxInspectorView,
  LightboxParagraphPage
} from '@hooks/domain/lightbox/controllers/useLightboxInspector';
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

/** "Build as a lens": its view for a pinned borrowed field, and the press. */
export interface LightboxBuildLensControl {
  view: (field: LightboxGravityFieldTile) => LightboxBuildLensView;
  onBuild: (fieldId: string) => void;
}

export interface LightboxInspectorProps {
  view: LightboxInspectorView | null;
  /** The page of `view.paragraphs` to render. */
  paragraphPage: LightboxParagraphPage | null;
  onClear: () => void;
  onPinParagraph: (index: number) => void;
  onShowParagraphPage: (page: number) => void;
  onJumpToParagraph: (index: number) => void;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
  reread: LightboxRereadControl;
  buildLens?: LightboxBuildLensControl;
}

/** "¶765–¶812 (337–347 of 347)": the addresses on show, then where they sit in the list. */
function rangeLabel(page: LightboxParagraphPage): { addresses: string; positions: string } {
  const first = page.shown[0];
  const last = page.shown[page.shown.length - 1];
  const positions = page.from === page.to ? `${page.from}` : `${page.from}–${page.to}`;
  return {
    addresses: first === last ? `¶${first}` : `¶${first}–¶${last}`,
    positions: `(${positions} of ${page.total.toLocaleString('en-US')})`
  };
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const LightboxParagraphPager: React.FC<{
  page: LightboxParagraphPage;
  onShowPage: (page: number) => void;
  onJump: (index: number) => void;
}> = ({ page, onShowPage, onJump }) => {
  const submitJump = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem('paragraph') as HTMLInputElement | null;
    const index = Number(field?.value);
    if (Number.isInteger(index) && index >= 1) {
      onJump(index);
    }
  };
  const label = rangeLabel(page);
  return (
    <div className="pm-lb-para-pager">
      <div className="pm-lb-para-nav" role="group" aria-label="Paragraph pages">
        <button
          type="button"
          className="pm-lb-para-step"
          aria-label="Previous paragraphs"
          disabled={page.page === 0}
          onClick={() => onShowPage(page.page - 1)}
        >
          <Icon name="chevLeft" size={12} />
        </button>
        <span className="pm-lb-para-range">
          <span>{label.addresses}</span> <span className="pm-lb-para-position">{label.positions}</span>
        </span>
        <button
          type="button"
          className="pm-lb-para-step"
          aria-label="Next paragraphs"
          disabled={page.page >= page.pageCount - 1}
          onClick={() => onShowPage(page.page + 1)}
        >
          <Icon name="chevRight" size={12} />
        </button>
      </div>
      <form className="pm-lb-para-jump" aria-label="Go to a paragraph" onSubmit={submitJump}>
        <label>
          Go to ¶
          <input name="paragraph" type="number" min={1} step={1} inputMode="numeric" />
        </label>
        <button type="submit" className="pm-lb-para-step">Go</button>
      </form>
    </div>
  );
};

/**
 * One page of addresses. Each explicit jump focuses the chip it landed on,
 * a repeated jump to the same chip included (PR #148 F-05); a re-render that
 * is not a jump, such as a board update, leaves focus where it is. The jump
 * on show at mount is not replayed.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const LightboxParagraphChips: React.FC<{
  page: LightboxParagraphPage;
  onPin: (index: number) => void;
}> = ({ page, onPin }) => {
  const target = React.useRef<HTMLButtonElement | null>(null);
  const focusedJump = React.useRef(page.jump);
  React.useEffect(() => {
    if (page.jump !== undefined && page.jump !== focusedJump.current) {
      focusedJump.current = page.jump;
      target.current?.focus();
    }
  }, [page.jump]);

  return (
    <div className="pm-lb-para-chips" aria-live="off">
      {page.shown.map((index) => (
        <button
          key={index}
          ref={index === page.target ? target : undefined}
          type="button"
          className={`pm-lb-para-chip${index === page.target ? ' is-target' : ''}`}
          title={`Pin ¶${index}`}
          onClick={() => onPin(index)}
        >
          ¶{index}
        </button>
      ))}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxInspector: React.FC<LightboxInspectorProps> = ({
  view,
  paragraphPage,
  onClear,
  onPinParagraph,
  onShowParagraphPage,
  onJumpToParagraph,
  bind,
  reread,
  buildLens
}) => {
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

  const page = paragraphPage;
  const reading = view.reading;
  const rereadNote = reading ? reread.note(reading.lens) : undefined;
  const field = reading?.tile.kind === 'gravity-field' ? reading.tile : undefined;
  const build = field && buildLens ? buildLens.view(field) : undefined;

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
      {reading?.stale && (
        <p className="pm-lb-stale-note">
          <b>Stale</b> Read against an earlier version of this chapter. The quotes below were checked again
          against this one; a quote whose words are gone is withheld.
        </p>
      )}

      <div>
        <p className="pm-lb-label">Where it lives · {view.paragraphLabel}</p>
        {view.paragraphs.length === 0 || !page ? (
          <p className="pm-lb-empty-note">No single paragraph holds it.</p>
        ) : (
          <>
            {page.pageCount > 1 && (
              <LightboxParagraphPager page={page} onShowPage={onShowParagraphPage} onJump={onJumpToParagraph} />
            )}
            <LightboxParagraphChips page={page} onPin={onPinParagraph} />
          </>
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

      {reading && reading.degrees.length > 0 && (
        <div>
          <p className="pm-lb-label">By degree</p>
          <div className="pm-lb-degree-rows">
            {reading.degrees.map((row) => (
              <div key={row.degree} className="pm-lb-degree-row">
                <span className={`pm-lb-degree-tag is-deg${row.degree}`}>{row.label}</span>
                <span>{row.terms} · {row.hits.toLocaleString('en-US')} {row.hits === 1 ? 'hit' : 'hits'}</span>
              </div>
            ))}
          </div>
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

      {field && build && buildLens && (
        <div className="pm-lb-inspector-actions pm-lb-build-lens">
          <button
            type="button"
            className="pm-lb-button"
            disabled={build.disabled}
            aria-describedby="pm-lb-build-lens-note"
            onClick={() => buildLens.onBuild(field.id)}
          >
            {build.label} →
          </button>
          <span
            id="pm-lb-build-lens-note"
            className={`pm-lb-run-note${build.outcome ? ` is-${build.outcome}` : ''}`}
            role={build.outcome ? 'status' : undefined}
          >
            {build.note}
          </span>
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
