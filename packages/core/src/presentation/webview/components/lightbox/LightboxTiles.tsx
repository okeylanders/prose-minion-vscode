/**
 * The board's tile renderers (ADR 2026-10-19 D3): one component per tile kind
 * behind an exhaustive map. A kind with no component is a compile error, not
 * a runtime guess. The layouts say where each kind is drawn: the counted
 * rows and grid (Slice 2A), and the readings (Slice 2B) in the board's
 * heading, under the ribbon, and in the grid. The reader promise is drawn
 * inside the genre tile, below its neighbors.
 */
import * as React from 'react';
import type {
  LightboxBoard,
  LightboxMeasuredTileKind,
  LightboxReadingTileKind,
  LightboxTileKind
} from '@messages';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { LightboxStatRow } from '@components/lightbox/LightboxStatRow';
import { LightboxTopWords } from '@components/lightbox/LightboxTopWords';
import { LightboxPartsOfSpeech } from '@components/lightbox/LightboxPartsOfSpeech';
import { LightboxHeadline } from '@components/lightbox/LightboxHeadline';
import { LightboxTensionArc } from '@components/lightbox/LightboxTensionArc';
import { LightboxMotifs } from '@components/lightbox/LightboxMotifs';
import { LightboxCharacters } from '@components/lightbox/LightboxCharacters';
import { LightboxGenre, LightboxReaderPromise } from '@components/lightbox/LightboxGenre';
import { LightboxVoice } from '@components/lightbox/LightboxVoice';

export interface LightboxTileProps {
  board: LightboxBoard;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}

export type LightboxTileRenderer = React.ComponentType<LightboxTileProps>;

/* eslint-disable @typescript-eslint/naming-convention -- tile kinds are kebab-case protocol literals (ADR 2026-10-19 D3). */
export const LIGHTBOX_TILE_RENDERERS: Readonly<Record<LightboxTileKind, LightboxTileRenderer>> = {
  stats: LightboxStatRow,
  'top-words': LightboxTopWords,
  'parts-of-speech': LightboxPartsOfSpeech,
  headline: LightboxHeadline,
  motif: LightboxMotifs,
  'tension-arc': LightboxTensionArc,
  character: LightboxCharacters,
  voice: LightboxVoice,
  'genre-neighbor': LightboxGenre,
  'reader-promise': LightboxReaderPromise
};
/* eslint-enable @typescript-eslint/naming-convention */

/** Where each counted tile sits: the full-width rows above the grid, then the grid. */
export const LIGHTBOX_MEASURED_LAYOUT: Readonly<{
  rows: readonly LightboxMeasuredTileKind[];
  grid: readonly LightboxMeasuredTileKind[];
}> = {
  rows: ['stats'],
  grid: ['top-words', 'parts-of-speech']
};

/**
 * Where each reading sits: the headline takes the board's heading, the
 * tension arc's line sits under the ribbon, the rest join the grid after the
 * counted tiles, and the reader promise is drawn by the genre tile.
 */
export const LIGHTBOX_READING_LAYOUT: Readonly<{
  heading: LightboxReadingTileKind;
  underRibbon: LightboxReadingTileKind;
  grid: readonly LightboxReadingTileKind[];
  within: Readonly<Partial<Record<LightboxReadingTileKind, LightboxReadingTileKind>>>;
}> = {
  heading: 'headline',
  underRibbon: 'tension-arc',
  grid: ['motif', 'character', 'genre-neighbor', 'voice'],
  // eslint-disable-next-line @typescript-eslint/naming-convention -- tile kinds are kebab-case protocol literals.
  within: { 'reader-promise': 'genre-neighbor' }
};
