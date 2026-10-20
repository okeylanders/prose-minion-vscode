/**
 * LightboxPalette — diction clusters and the colors the text names (ADR
 * 2026-10-19 D7; Slice 3).
 *
 * Counted, then grouped by a reading: each cluster shows the words the
 * reading grouped, each with the host's count, and each swatch shows the
 * color words the text uses, counted, beside a color the reading proposes.
 * The swatch color is labeled the reading's choice; only the words are the
 * chapter's. Hover lights an item's paragraphs; a click pins it.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';

/** The colors the text names. Drawn inside the palette tile. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxSwatches: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const swatches = lightboxTilesOfKind(board, 'swatch');
  if (swatches.length === 0) {
    return null;
  }
  return (
    <>
      <p className="pm-lb-swatch-label">Colors the text names</p>
      <div className="pm-lb-swatches">
        {swatches.map((swatch) => (
          <LightboxItemButton
            key={swatch.id}
            binding={bind({ kind: 'reading', tileId: swatch.id })}
            className="pm-lb-swatch"
            title={`${swatch.hex} is the reading's choice; the words are counted.`}
          >
            <span className="pm-lb-swatch-chip" style={{ background: swatch.hex }} aria-hidden="true" />
            <span className="pm-lb-swatch-name">{swatch.title}</span>
            <span className="pm-lb-swatch-count">
              {swatch.support.map((term) => `${term.term} ×${term.count}`).join(' · ')}
            </span>
          </LightboxItemButton>
        ))}
      </div>
    </>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxPalette: React.FC<LightboxTileProps> = ({ board, bind }) => (
  <LightboxReadingFrame
    kind="palette-cluster"
    span={6}
    title="Palette"
    view={lightboxLensView(board, 'palette')}
    empty="The reading drew no cluster and found no color named."
    footnote="Words are counted by code and grouped by a reading. A swatch's color is the reading's choice."
  >
    {lightboxTilesOfKind(board, 'palette-cluster').map((cluster) => (
      <LightboxItemButton key={cluster.id} binding={bind({ kind: 'reading', tileId: cluster.id })} className="pm-lb-cluster">
        <span className="pm-lb-cluster-name">{cluster.title}</span>
        <span className="pm-lb-cluster-words">
          {cluster.support.map((term) => (
            <span key={term.term} className={`pm-lb-cluster-word${term.count === 0 ? ' is-absent' : ''}`}>
              {term.term}<b>{term.count === 0 ? 'not in the chapter' : `×${term.count}`}</b>
            </span>
          ))}
        </span>
      </LightboxItemButton>
    ))}
    <LightboxSwatches board={board} bind={bind} />
  </LightboxReadingFrame>
);
