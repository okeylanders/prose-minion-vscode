/**
 * LightboxSummary — summary and movements, full width (ADR 2026-10-19 D4,
 * D7; Slice 4C):
 * - the synopsis, standing on at least two quotes code found (read);
 * - the movements (read), each over its ¶ range with its boundary quote,
 *   found by code in the movement's first paragraph, and the movements
 *   checked to tile the chapter; a set that does not is withheld whole, by
 *   the rule it broke (in the frame's withheld list);
 * - the Sections note (measured): what code found in the chapter's own
 *   headings, scene breaks and chapter lines, shown before any reading.
 * Hovering a movement lights its paragraphs; each pins to the inspector.
 */
import * as React from 'react';
import type { LightboxReadingTile } from '@messages';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { lightboxSectionsNote } from '@hooks/domain/lightbox/lightboxPlot';
import { LIGHTBOX_ENGAGEMENT_LABELS, lightboxMovementEngagement, lightboxMovementNumeral } from '@shared/constants/lightboxPlot';
import { Icon } from '@components/shared/Icon';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';
import { LightboxRegisterChip } from '@components/lightbox/LightboxReadingParts';
import { LightboxCraftHeading } from '@components/lightbox/LightboxStock';

/** A tile's first quote as the chapter has it, with its ¶ and how code found it. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxPlotQuote: React.FC<{ tile: Pick<LightboxReadingTile, 'evidence'>; index?: number }> = ({ tile, index = 0 }) => {
  const quote = tile.evidence[index];
  return quote ? (
    <span className="pm-lb-craft-quote">
      <span className="pm-lb-craft-para">¶{quote.paragraph}</span><q>{quote.text}</q>
      <span className="pm-lb-plot-check" title={quote.match === 'exact' ? 'Found verbatim by code' : 'Found by code, typography folded'}>
        <Icon name="check" size={10} strokeWidth={3} />{quote.match === 'exact' ? 'verbatim' : 'folded'}
      </span>
    </span>
  ) : null;
};

/** The movements: drawn inside the summary tile. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxMovements: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const movements = lightboxTilesOfKind(board, 'movement');
  const [template] = lightboxTilesOfKind(board, 'template');
  return movements.length === 0 ? null : (
    <div className="pm-lb-craft-part">
      <LightboxCraftHeading title="Movements" chip={<LightboxRegisterChip register="read" />} />
      <div className="pm-lb-movements">
        {movements.map((movement) => {
          const level = lightboxMovementEngagement(template, movement.id);
          return (
            <LightboxItemButton key={movement.id} binding={bind({ kind: 'reading', tileId: movement.id })} className="pm-lb-movement">
              <span className="pm-lb-movement-range">
                {lightboxMovementNumeral(movement.ordinal)} · ¶{movement.from}{movement.to > movement.from ? `–${movement.to}` : ''}
              </span>
              <span className="pm-lb-movement-title">{movement.title}</span>
              <span className="pm-lb-craft-note">{movement.claim}</span>
              <LightboxPlotQuote tile={movement} />
              {level && <span className={`pm-lb-movement-engagement is-${level}`}>Engagement · {LIGHTBOX_ENGAGEMENT_LABELS[level]}</span>}
            </LightboxItemButton>
          );
        })}
      </div>
      <span className="pm-lb-craft-note">Code checks each boundary quote in its movement's first paragraph, and that the movements tile the chapter: contiguous, no overlap, ¶1 to ¶{board.paragraphs.length}.</span>
    </div>
  );
};

/** What code found of the chapter's own structure: shown before any reading, never a model's. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const LightboxSectionsNote: React.FC<LightboxTileProps> = ({ board, bind }) => (
  <LightboxItemButton binding={bind({ kind: 'lane', lane: 'sections' })} className="pm-lb-craft-part pm-lb-sections-note">
    <LightboxCraftHeading title="Sections" chip={<LightboxRegisterChip register="measured" />} />
    <span className="pm-lb-craft-note">
      <b>Sections</b> come from code only: Markdown headings, scene breaks (*** · # · §) and chapter lines. {lightboxSectionsNote(board.measured.sections)}
    </span>
  </LightboxItemButton>
);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxSummary: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const [synopsis] = lightboxTilesOfKind(board, 'synopsis');
  return (
    <LightboxReadingFrame
      kind="synopsis"
      span={6}
      title="Summary & movements"
      view={lightboxLensView(board, 'summary')}
      empty="The reading gave no synopsis and no movements."
      aside={<LightboxSectionsNote board={board} bind={bind} />}
      footnote={<>The synopsis and movements are <b>read</b>; every quote and boundary is <b>checked by code</b>, and the sections are <b>measured</b>.</>}
    >
      {synopsis && (
        <LightboxItemButton binding={bind({ kind: 'reading', tileId: synopsis.id })} className="pm-lb-craft-part pm-lb-synopsis">
          <LightboxCraftHeading title="Synopsis" chip={<LightboxRegisterChip register="read" />} />
          <span className="pm-lb-synopsis-text">{synopsis.claim}</span>
          <span className="pm-lb-synopsis-quotes">
            {synopsis.evidence.map((_quote, index) => <LightboxPlotQuote key={index} tile={synopsis} index={index} />)}
          </span>
        </LightboxItemButton>
      )}
      <LightboxMovements board={board} bind={bind} />
    </LightboxReadingFrame>
  );
};
