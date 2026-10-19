/**
 * LightboxReadingFrame — the frame a lens's reading is drawn in (ADR
 * 2026-10-19 D3, D7).
 *
 * The register comes from the kind (`LIGHTBOX_TILE_REGISTER`). Around the
 * reading itself the frame shows what the honesty rules decided: skeletons
 * before and during the call, the group's failure or stop, a block withheld
 * by kind with its reason, claims withheld by title with theirs, and, for a
 * lens that found nothing, that empty answer with its friction.
 */
import * as React from 'react';
import type { LightboxReadingTileKind } from '@messages';
import type { LightboxLensView } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxWithheldQuoteText } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxTileFrame } from '@components/lightbox/LightboxTileFrame';
import { LightboxReadingPlaceholder } from '@components/lightbox/LightboxReadingPlaceholder';

export interface LightboxReadingFrameProps {
  kind: LightboxReadingTileKind;
  title: string;
  span: 3 | 6;
  view: LightboxLensView;
  /** What an empty answer means for this lens. */
  empty: string;
  /** A note beside the badge row, e.g. "affinity is a claim, not a score". */
  aside?: React.ReactNode;
  footnote?: React.ReactNode;
  children: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxReadingFrame: React.FC<LightboxReadingFrameProps> = ({
  kind,
  title,
  span,
  view,
  empty,
  aside,
  footnote,
  children
}) => {
  const read = view.phase === 'ok';
  const nothing = read && view.tiles.length === 0 && view.withheldBlocks.length === 0 && view.withheldClaims.length === 0;
  return (
    <LightboxTileFrame kind={kind} span={span} title={title} footnote={read && view.tiles.length > 0 ? footnote : undefined}>
      {aside}
      {(view.phase === 'not-run' || view.phase === 'reading') && <LightboxReadingPlaceholder live={view.phase === 'reading'} />}
      {view.notice && (
        <p className={`pm-lb-reading-notice${read ? '' : ' is-failed'}`} role={read ? undefined : 'alert'}>
          {view.notice}
        </p>
      )}
      {view.withheldBlocks.map((block) => (
        <p key={`${block.kind}:${block.reason}`} className="pm-lb-withheld-block">
          <b>Withheld</b> {block.reason}
        </p>
      ))}
      {nothing && (
        <div className="pm-lb-empty-reading">
          <p>{empty}</p>
          {view.friction && <p className="pm-lb-empty-friction"><b>Where this reading strains:</b> {view.friction}</p>}
        </div>
      )}
      {read && view.tiles.length > 0 && children}
      {view.withheldClaims.length > 0 && (
        <ul className="pm-lb-withheld-claims" aria-label="Withheld claims">
          {view.withheldClaims.map((claim, index) => (
            <li key={`${claim.title}:${index}`}>
              <b>Withheld · {claim.title}</b>
              <span>{claim.reason}</span>
              {claim.quotes.map((quote, quoteIndex) => (
                <span key={quoteIndex} className="pm-lb-withheld-quote">¶{quote.paragraph}: {lightboxWithheldQuoteText(quote)}</span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </LightboxTileFrame>
  );
};
