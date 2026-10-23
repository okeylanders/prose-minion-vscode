/**
 * LightboxHeadline — the chapter in one sentence, as read (ADR 2026-10-19
 * D7). It takes the board's heading once the headline lens has a reading,
 * labeled "a reading" so it never passes for the board's own title; until
 * then the heading is the board's plain one. Hover lights the paragraphs its
 * quotes and counted words stand in; a click pins it.
 *
 * Withheld, not hidden (D7; PR #149 F-04): when the headline lens read but
 * kept no headline, the plain heading stays and the lens's state sits under
 * it, as every other lens shows its own: a claim withheld by its title with
 * the reason and its quotes' reasons, a block withheld with its reason, or
 * the failure or stop of the call that should have read it.
 *
 * A headline read against an earlier version of the text says so beside it,
 * as every reading frame does (D4; PR #150 F-06).
 *
 * Call A's Analyze (Slice 4I, epic decision 43) sits in the headline's row
 * once there is a headline reading, or a state of one, to show; the plain
 * heading of a board not analyzed yet is no widget and has none (the run
 * line and the other widgets of call A offer it). "a reading" stays beside
 * a read headline, so it never passes for the board's own title.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxWithheldBlocks, LightboxWithheldClaims } from '@components/lightbox/LightboxReadingFrame';
import { LightboxAnalyzeButton } from '@components/lightbox/LightboxCallButton';

export const LIGHTBOX_PLAIN_HEADLINE = 'One chapter, held up to the light.';

/** Said beside a stale headline reading. */
const STALE_HEADLINE = 'Read against an earlier version of this chapter. Its quotes were checked again against this one. Re-analyze to read it fresh.';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxHeadline: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const [headline] = lightboxTilesOfKind(board, 'headline');
  if (!headline) {
    const view = lightboxLensView(board, 'headline');
    const failed = (view.phase === 'failed' || view.phase === 'cancelled') && view.notice;
    const withheld = view.withheldBlocks.length > 0 || view.withheldClaims.length > 0;
    return (
      <>
        {withheld || failed
          ? (
            <div className="pm-lb-headline-row">
              <h2 className="pm-lb-headline">{LIGHTBOX_PLAIN_HEADLINE}</h2>
              <LightboxAnalyzeButton lens="headline" />
            </div>
          )
          : <h2 className="pm-lb-headline">{LIGHTBOX_PLAIN_HEADLINE}</h2>}
        {(withheld || failed) && (
          <div className="pm-lb-headline-state" aria-label="Headline reading">
            {view.stale && <p className="pm-lb-stale-note"><b>Stale</b> {STALE_HEADLINE}</p>}
            {failed && <p className="pm-lb-reading-notice is-failed">The headline did not come back. {view.notice}</p>}
            <LightboxWithheldBlocks blocks={view.withheldBlocks} label="Headline withheld" />
            <LightboxWithheldClaims claims={view.withheldClaims} />
          </div>
        )}
      </>
    );
  }
  const stale = lightboxLensView(board, 'headline').stale;
  return (
    <>
      <div className="pm-lb-headline-row">
        <h2 className="pm-lb-headline">
          <LightboxItemButton binding={bind({ kind: 'reading', tileId: headline.id })} className="pm-lb-headline-reading">
            {headline.title}
          </LightboxItemButton>
        </h2>
        <span className="pm-lb-badge pm-lb-reg-read">a reading</span>
        <LightboxAnalyzeButton lens="headline" />
      </div>
      {stale && (
        <div className="pm-lb-headline-state" aria-label="Headline reading">
          <p className="pm-lb-stale-note"><b>Stale</b> {STALE_HEADLINE}</p>
        </div>
      )}
    </>
  );
};
