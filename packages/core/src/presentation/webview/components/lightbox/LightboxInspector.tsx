/**
 * LightboxInspector — the pinned item, with its evidence (ADR 2026-10-19 D3,
 * D4). Props-only: the view model comes from `useLightboxInspector`.
 *
 * With nothing pinned it explains the board's three registers. With an item
 * pinned it shows the register, the claim, every paragraph the item lives in
 * (exact numbers, even when the ribbon buckets them; each chip pins that
 * paragraph), and what code counted. Actions that cross into the Workshop or
 * the editor arrive with later slices.
 *
 * The addresses render a page at a time (PR #148 F-04). With more than one
 * page, a pager steps between them and jumps to a paragraph number, all by
 * keyboard, without changing the pin; a jump focuses the address it lands on.
 * Paging is not announced chip by chip: the range label is the change the
 * live inspector reads out.
 */
import * as React from 'react';
import type {
  LightboxInspectorView,
  LightboxParagraphPage
} from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { Icon } from '@components/shared/Icon';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';

export interface LightboxInspectorProps {
  view: LightboxInspectorView | null;
  /** The page of `view.paragraphs` to render. */
  paragraphPage: LightboxParagraphPage | null;
  onClear: () => void;
  onPinParagraph: (index: number) => void;
  onShowParagraphPage: (page: number) => void;
  onJumpToParagraph: (index: number) => void;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}

/** Focus the chip a jump landed on, when it mounts. */
const focusOnMount = (chip: HTMLButtonElement | null) => chip?.focus();

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

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxInspector: React.FC<LightboxInspectorProps> = ({
  view,
  paragraphPage,
  onClear,
  onPinParagraph,
  onShowParagraphPage,
  onJumpToParagraph,
  bind
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

  const page = paragraphPage;

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
        {view.paragraphs.length === 0 || !page ? (
          <p className="pm-lb-empty-note">No single paragraph holds it.</p>
        ) : (
          <>
            {page.pageCount > 1 && (
              <LightboxParagraphPager page={page} onShowPage={onShowParagraphPage} onJump={onJumpToParagraph} />
            )}
            <div className="pm-lb-para-chips" aria-live="off">
              {page.shown.map((index) => (
                <button
                  key={index}
                  ref={index === page.target ? focusOnMount : undefined}
                  type="button"
                  className={`pm-lb-para-chip${index === page.target ? ' is-target' : ''}`}
                  title={`Pin ¶${index}`}
                  onClick={() => onPinParagraph(index)}
                >
                  ¶{index}
                </button>
              ))}
            </div>
          </>
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
