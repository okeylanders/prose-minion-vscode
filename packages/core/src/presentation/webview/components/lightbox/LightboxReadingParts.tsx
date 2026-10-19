/**
 * Small pieces the reading tiles share (ADR 2026-10-19 D4, D7): a strip that
 * shows where in the chapter a reading lives, column by ribbon column, and
 * the line that says how many of its quotes were checked and withheld.
 */
import * as React from 'react';
import type { LightboxBoard, LightboxReadingTile } from '@messages';
import { lightboxLitColumns } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { supportLabel } from '@hooks/domain/lightbox/lightboxItems';
import { pluralize } from '@hooks/domain/lightbox/lightboxReadings';

export interface LightboxParagraphStripProps {
  board: LightboxBoard;
  paragraphs: readonly number[];
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxParagraphStrip: React.FC<LightboxParagraphStripProps> = ({ board, paragraphs }) => {
  const lit = lightboxLitColumns(board.ribbon, paragraphs);
  return (
    <span
      className="pm-lb-strip"
      aria-hidden="true"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, lit.length)}, minmax(0, 1fr))` }}
    >
      {lit.map((on, index) => <i key={index} className={on ? 'is-on' : undefined} />)}
    </span>
  );
};

/** "3 quotes checked · 1 withheld". */
export function lightboxEvidenceNote(tile: LightboxReadingTile): string {
  const checked = tile.evidence.length + tile.withheldQuotes.length;
  return `${pluralize(checked, 'quote')} checked` +
    (tile.withheldQuotes.length > 0 ? ` · ${tile.withheldQuotes.length.toLocaleString('en-US')} withheld` : '');
}

/** The tile's first counted term, e.g. "down ×9". */
export function lightboxTopSupport(tile: LightboxReadingTile): string | undefined {
  return tile.support[0] ? supportLabel(tile.support[0]) : undefined;
}
