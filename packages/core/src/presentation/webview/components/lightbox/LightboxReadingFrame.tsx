/**
 * LightboxReadingFrame — the frame a lens's reading is drawn in (ADR
 * 2026-10-19 D3, D7).
 *
 * The register comes from the kind (`LIGHTBOX_TILE_REGISTER`). Around the
 * reading itself the frame shows what the honesty rules decided: skeletons
 * before and during the call, the group's failure or stop, a block withheld
 * by kind with its reason, claims withheld by title with theirs, and, for a
 * lens that found nothing, that empty answer with its friction. A lens read
 * against an earlier version of the text is labeled stale (D4). The withheld
 * lists are their own components, so a reading drawn outside a frame (the
 * headline, in the board's heading) shows its withheld state the same way.
 *
 * The header carries the lens's call control, Analyze (Slice 4I, epic
 * decision 43), when the board gives its controls: it runs this lens's
 * call, and stands in for the bare "read" badge.
 */
import * as React from 'react';
import type { LightboxReadingTileKind, LightboxWithheldBlock, LightboxWithheldClaim } from '@messages';
import { LIGHTBOX_TILE_LENS } from '@shared/constants/lightbox';
import type { LightboxLensView } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxWithheldQuoteText } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxTileFrame } from '@components/lightbox/LightboxTileFrame';
import { LightboxReadingPlaceholder } from '@components/lightbox/LightboxReadingPlaceholder';
import { LightboxAnalyzeButton, useLightboxHasCallControls } from '@components/lightbox/LightboxCallButton';

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
  /** Shown whenever the lens has been read, tiles or none (lineage's set-aside list). */
  after?: React.ReactNode;
  /** The stale note before the aside, for a frame whose aside holds its readings (the numbers). */
  staleFirst?: boolean;
  /** The frame's own chip and class (the Opinion, Slice 4D). */
  chip?: React.ReactNode;
  frameClass?: string;
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
  after,
  staleFirst,
  chip,
  frameClass,
  children
}) => {
  const read = view.phase === 'ok';
  const nothing = read && view.tiles.length === 0 && view.withheldBlocks.length === 0 && view.withheldClaims.length === 0;
  const analyze = useLightboxHasCallControls() ? <LightboxAnalyzeButton lens={LIGHTBOX_TILE_LENS[kind]} /> : undefined;
  return (
    <LightboxTileFrame
      kind={kind}
      span={span}
      title={title}
      footnote={read && view.tiles.length > 0 ? footnote : undefined}
      chip={chip}
      className={frameClass}
      action={analyze}
    >
      {staleFirst && view.stale && <LightboxStaleNote />}
      {aside}
      {!staleFirst && view.stale && <LightboxStaleNote />}
      {(view.phase === 'not-run' || view.phase === 'reading') && <LightboxReadingPlaceholder live={view.phase === 'reading'} />}
      {view.notice && (
        <p className={`pm-lb-reading-notice${read ? '' : ' is-failed'}`} role={read ? undefined : 'alert'}>
          {view.notice}
        </p>
      )}
      <LightboxWithheldBlocks blocks={view.withheldBlocks} />
      {nothing && (
        <div className="pm-lb-empty-reading">
          <p>{empty}</p>
          {view.friction && <p className="pm-lb-empty-friction"><b>Where this reading strains:</b> {view.friction}</p>}
        </div>
      )}
      {read && view.tiles.length > 0 && children}
      {read && after}
      <LightboxWithheldClaims claims={view.withheldClaims} />
    </LightboxTileFrame>
  );
};

/** A lens read against an earlier version of the text (D4): every reading's frame, and the Spark lane, say so. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxStaleNote: React.FC = () => (
  <p className="pm-lb-stale-note">
    <b>Stale</b> Read against an earlier version of this chapter. Its quotes were checked again against
    this one, and its counts recounted. Re-analyze to read it fresh.
  </p>
);

/** Lens blocks withheld by kind, each with its reason. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxWithheldBlocks: React.FC<{ blocks: readonly LightboxWithheldBlock[]; label?: string }> = ({
  blocks,
  label = 'Withheld'
}) => (
  <>
    {blocks.map((block) => (
      <p key={`${block.kind}:${block.reason}`} className="pm-lb-withheld-block">
        <b>{label}</b> {block.reason}
      </p>
    ))}
  </>
);

/** Claims withheld by title, each with its reason and its failed quotes' reasons (never their text). */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxWithheldClaims: React.FC<{ claims: readonly LightboxWithheldClaim[] }> = ({ claims }) =>
  claims.length === 0 ? null : (
    <ul className="pm-lb-withheld-claims" aria-label="Withheld claims">
      {claims.map((claim, index) => (
        <li key={`${claim.title}:${index}`}>
          <b>Withheld · {claim.title}</b>
          <span>{claim.reason}</span>
          {claim.quotes.map((quote, quoteIndex) => (
            <span key={quoteIndex} className="pm-lb-withheld-quote">¶{quote.paragraph}: {lightboxWithheldQuoteText(quote)}</span>
          ))}
        </li>
      ))}
    </ul>
  );
