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
 * as every reading frame does (D4; PR #150 F-06). So does one being read
 * again, which stays on show until the new one lands, and one a call did not
 * replace, under the quiet "Earlier reading" label (Slice 4J, decision 49).
 *
 * Call A's Analyze (Slice 4I, epic decision 43) sits in the headline's row
 * once the headline lens has been asked for: while call A reads it, after a
 * headline lands, and when it was withheld, failed or stopped. The plain
 * heading of a board whose headline was never asked for is no widget and has
 * none (the run line and the other widgets of call A offer it). "a reading"
 * stays beside a read headline, so it never passes for the board's own
 * title.
 *
 * One row, one button (PR #166 N-02): the row keeps the same shape whether
 * a headline is read, being read, or failed, so pressing a focused
 * Re-analyze keeps the button mounted; it reads "Analyzing…", disabled, over
 * the earlier headline, and then "Re-analyze" again with the focus still on
 * it, whether the new headline landed or the earlier one was kept.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxOwnWithheldBlocks, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxKeptNote, LightboxWithheldBlocks, LightboxWithheldClaims } from '@components/lightbox/LightboxReadingFrame';
import { LightboxAnalyzeButton } from '@components/lightbox/LightboxCallButton';
import { LightboxCallLine } from '@components/lightbox/LightboxCallNotes';

export const LIGHTBOX_PLAIN_HEADLINE = 'One chapter, held up to the light.';

/** Said beside a stale headline reading. */
const STALE_HEADLINE = 'Read against an earlier version of this chapter. Its quotes were checked again against this one. Re-analyze to read it fresh.';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxHeadline: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const [headline] = lightboxTilesOfKind(board, 'headline');
  const view = lightboxLensView(board, 'headline');
  const failed = !headline && (view.phase === 'failed' || view.phase === 'cancelled') && Boolean(view.notice);
  const blocks = lightboxOwnWithheldBlocks(view);
  // Decision 52: the call's own failure or cut is said once, in its note under the run line; the headline points there.
  const pointer = !headline && view.callNote !== undefined;
  const withheld = !headline && (blocks.length > 0 || view.withheldClaims.length > 0);
  // Asked for at least once: its Analyze stays in the row through a rerun's start, landing and failure (N-02).
  const asked = headline !== undefined || view.phase !== 'not-run';
  // A headline read again, or kept after a call that did not replace it, says so (Slice 4J).
  const kept = headline !== undefined && (view.reanalyzing || view.earlier !== undefined);
  const state = headline ? view.stale || kept : withheld || failed || pointer;
  return (
    <>
      {asked
        ? (
          <div className="pm-lb-headline-row">
            <h2 className="pm-lb-headline">
              {headline
                ? (
                  <LightboxItemButton binding={bind({ kind: 'reading', tileId: headline.id })} className="pm-lb-headline-reading">
                    {headline.title}
                  </LightboxItemButton>
                )
                : LIGHTBOX_PLAIN_HEADLINE}
            </h2>
            {headline && <span className="pm-lb-badge pm-lb-reg-read">a reading</span>}
            <LightboxAnalyzeButton lens="headline" />
          </div>
        )
        : <h2 className="pm-lb-headline">{LIGHTBOX_PLAIN_HEADLINE}</h2>}
      {state && (
        <div className="pm-lb-headline-state" aria-label="Headline reading" aria-describedby={view.callNote?.id}>
          {view.stale && <p className="pm-lb-stale-note"><b>Stale</b> {STALE_HEADLINE}</p>}
          {kept && <LightboxKeptNote view={view} />}
          {pointer && view.callNote && <LightboxCallLine note={view.callNote} prefix="The headline did not come back." />}
          {failed && !pointer && <p className="pm-lb-reading-notice is-failed">The headline did not come back. {view.notice}</p>}
          {withheld && <LightboxWithheldBlocks blocks={blocks} label="Headline withheld" />}
          {withheld && <LightboxWithheldClaims claims={view.withheldClaims} />}
        </div>
      )}
    </>
  );
};
