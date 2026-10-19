/**
 * LightboxReadingPlaceholder — where a reading will land (ADR 2026-10-19 D6).
 *
 * Drawn in the read register (dashed, periwinkle) so the board's two kinds of
 * tile are distinguishable before any reading exists. It says plainly that
 * nothing has been read; it shows no estimate, because Slice 2A sends
 * nothing to a model.
 */
import * as React from 'react';
import type { LightboxLensId } from '@messages';
import { LightboxTileFrame } from '@components/lightbox/LightboxTileFrame';

/** The lenses that read into a tile of their own; headline and tension draw elsewhere. */
export type LightboxTileLensId = Extract<LightboxLensId, 'motif' | 'characters' | 'voice' | 'genre'>;

export const LIGHTBOX_READING_TILE_TITLES: Readonly<Record<LightboxTileLensId, string>> = {
  motif: 'Motifs · where they recur',
  characters: 'Characters · the vibes they give',
  voice: 'Voice',
  genre: 'Genre neighborhood'
};

export interface LightboxReadingPlaceholderProps {
  lens: LightboxTileLensId;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxReadingPlaceholder: React.FC<LightboxReadingPlaceholderProps> = ({ lens }) => (
  <LightboxTileFrame register="read" span={3} title={LIGHTBOX_READING_TILE_TITLES[lens]}>
    <div className="pm-lb-skeleton" aria-hidden="true">
      <span className="pm-lb-skeleton-line is-95" />
      <span className="pm-lb-skeleton-line is-80" />
      <span className="pm-lb-skeleton-line is-60" />
    </div>
    <p className="pm-lb-skeleton-note">Not read yet. Readings arrive in the next update.</p>
  </LightboxTileFrame>
);
