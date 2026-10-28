/**
 * LightboxNumbers — what stands out in the numbers (ADR 2026-10-19 D7 and
 * its addendum; Slice 4B).
 *
 * - **Measured** (drawn before any reading, at no cost): every figure the
 *   host measured, on a bar with the preset's band and the writer's own
 *   average, and whether it stands out. Hovering a row lights the
 *   paragraphs holding an instance of it.
 * - **Read:** under each figure that stands out, how it is used here
 *   ("reads as deliberate", "mixed", "habit"), each quote holding an
 *   instance of the figure, checked by the detector that counted it. Nothing
 *   here says fix or cut; the call is the writer's. Being verbs, adverbs and
 *   intensifiers are read by craft steering (Slice 4F): their bars stay
 *   here, and a standout among them points there.
 */
import * as React from 'react';
import type { LightboxNumberRow, LightboxNumberUsageTile } from '@messages';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import {
  lightboxBaselineLine,
  lightboxNumberBar,
  lightboxNumberValue,
  lightboxStandoutLabel
} from '@hooks/domain/lightbox/lightboxCraft';
import { LIGHTBOX_NUMBER_STAT_LABELS, LIGHTBOX_NUMBER_USAGE_LABELS } from '@shared/constants/lightbox';
import { LIGHTBOX_NUMBERS_READ_STATS } from '@shared/constants/lightboxSteering';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import { LightboxRegisterChip } from '@components/lightbox/LightboxReadingParts';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const NumberRow: React.FC<{
  row: LightboxNumberRow;
  usage?: LightboxNumberUsageTile;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}> = ({ row, usage, bind }) => {
  const bar = lightboxNumberBar(row);
  const standout = lightboxStandoutLabel(row);
  return (
    <div className="pm-lb-number">
      <LightboxItemButton binding={bind({ kind: 'standout', stat: row.stat })} className={`pm-lb-number-row${row.standout ? ' is-standout' : ''}`}>
        <span className="pm-lb-number-name">{row.label}<span>{row.unit}</span></span>
        <span className="pm-lb-number-bar" aria-hidden="true">
          {bar.band && <i className="pm-lb-number-band" style={{ left: `${bar.band.left}%`, width: `${bar.band.width}%` }} />}
          {bar.writer !== undefined && <i className="pm-lb-number-writer" style={{ left: `${bar.writer}%` }} />}
          <i className={`pm-lb-number-dot${row.standout ? '' : ' is-within'}`} style={{ left: `${bar.dot}%` }} />
        </span>
        <span className="pm-lb-number-value">{lightboxNumberValue(row)}</span>
        {standout && <span className="pm-lb-number-standout">{standout}</span>}
        {row.standout && !LIGHTBOX_NUMBERS_READ_STATS.includes(row.stat) && (
          <span className="pm-lb-number-steered">Read under Craft steering, below</span>
        )}
      </LightboxItemButton>
      {usage && (
        <LightboxItemButton binding={bind({ kind: 'reading', tileId: usage.id })} className="pm-lb-number-read">
          <span className={`pm-lb-craft-tag is-${usage.usage}`}>{LIGHTBOX_NUMBER_USAGE_LABELS[usage.usage]}</span>
          <span className="pm-lb-craft-note">{usage.claim}</span>
          {usage.evidence.slice(0, 2).map((quote) => (
            <span key={`${quote.paragraph}:${quote.text}`} className="pm-lb-craft-quote">
              <span className="pm-lb-craft-para">¶{quote.paragraph}</span><q>{quote.text}</q>
            </span>
          ))}
        </LightboxItemButton>
      )}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxNumbers: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const view = lightboxLensView(board, 'numbers');
  const usages = view.phase === 'ok' ? lightboxTilesOfKind(board, 'number-usage') : [];
  const { numbers } = board.measured;
  const presetRanges = numbers.rows.some((row) => row.range !== undefined);
  // An empty reading is honest either way, but it means something different when figures it reads stood out,
  // and only figures craft steering reads may stand out (PR #160 N-01).
  const readStandout = numbers.rows.some((row) => row.standout && LIGHTBOX_NUMBERS_READ_STATS.includes(row.stat));
  const steered = numbers.rows.filter((row) => row.standout && !LIGHTBOX_NUMBERS_READ_STATS.includes(row.stat)).length;
  const readHere = LIGHTBOX_NUMBERS_READ_STATS.map((stat) => LIGHTBOX_NUMBER_STAT_LABELS[stat].toLowerCase()).join(', ');
  const empty = readStandout
    ? 'The reading said nothing about how these figures are used.'
    : steered > 0
      ? `None of the figures this lens reads (${readHere}) stands out, so it had nothing to read. ` +
        `Craft steering reads the ${steered === 1 ? 'figure that does' : 'figures that do'}, below.`
      : 'Nothing in the numbers stands out, so there was nothing to read.';
  return (
    <LightboxReadingFrame
      kind="number-usage"
      span={6}
      staleFirst
      title="What stands out in the numbers"
      view={view}
      empty={empty}
      aside={(
        <div className="pm-lb-craft-part">
          <span className="pm-lb-craft-sub">
            Standouts<LightboxRegisterChip register="measured" />
            How it is used<LightboxRegisterChip register="read" />
          </span>
          <span className="pm-lb-craft-note">{lightboxBaselineLine(numbers, presetRanges)}</span>
          {numbers.rows.map((row) => (
            // A reading is drawn only under a figure that stands out now (PR #155 F-01).
            <NumberRow key={row.stat} row={row} usage={row.standout ? usages.find((tile) => tile.stat === row.stat) : undefined} bind={bind} />
          ))}
        </div>
      )}
      footnote={<><b>Standouts are measured:</b> code flags a figure outside its range or far from your own average. <b>Readings say how it works here</b> and never tell you to cut it. The call is yours.</>}
    >
      {null}
    </LightboxReadingFrame>
  );
};
