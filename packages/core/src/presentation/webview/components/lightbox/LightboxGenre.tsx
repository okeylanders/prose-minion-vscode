/**
 * LightboxGenre — the genre neighborhood and the reader promise (ADR
 * 2026-10-19 D7; the Genre Relationship Explorer's boundaries).
 *
 * It grades resemblance, never quality. Each neighbor's affinity is labeled
 * a claim, drawn as a striped bar so it never reads as a measurement, and
 * low affinity is drawn like any other: a near miss says what matches and
 * what does not. Nothing here points the writer toward a shelf. The reader
 * promise is its own reading below the neighbors.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxReaderPromise: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const [promise] = lightboxTilesOfKind(board, 'reader-promise');
  if (!promise) {
    return null;
  }
  return (
    <LightboxItemButton binding={bind({ kind: 'reading', tileId: promise.id })} className="pm-lb-promise">
      <span className="pm-lb-promise-label">Reader promise so far</span>
      <span className="pm-lb-promise-text">{promise.claim}</span>
    </LightboxItemButton>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxGenre: React.FC<LightboxTileProps> = ({ board, bind }) => (
  <LightboxReadingFrame
    kind="genre-neighbor"
    span={3}
    title="Genre neighborhood"
    view={lightboxLensView(board, 'genre')}
    empty="No shelf is close enough to name."
    aside={<p className="pm-lb-genre-note">Affinity is a claim, not a score. Resemblance, never quality.</p>}
  >
    {lightboxTilesOfKind(board, 'genre-neighbor').map((neighbor) => (
      <LightboxItemButton
        key={neighbor.id}
        binding={bind({ kind: 'reading', tileId: neighbor.id })}
        className="pm-lb-neighbor"
        label={`${neighbor.title}, claimed affinity ${neighbor.affinity.toFixed(2)}`}
      >
        <span className="pm-lb-neighbor-top">
          <span>{neighbor.title}</span>
          <span className="pm-lb-neighbor-affinity">{neighbor.affinity.toFixed(2)}</span>
        </span>
        <span className="pm-lb-neighbor-track">
          <span className="pm-lb-neighbor-fill" style={{ width: `${Math.round(neighbor.affinity * 100)}%` }} />
        </span>
        {neighbor.nearMiss && <span className="pm-lb-neighbor-miss">{neighbor.nearMiss}</span>}
      </LightboxItemButton>
    ))}
    <LightboxReaderPromise board={board} bind={bind} />
  </LightboxReadingFrame>
);
