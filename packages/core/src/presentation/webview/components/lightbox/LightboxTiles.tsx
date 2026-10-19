/**
 * The board's tile renderers (ADR 2026-10-19 D3): one component per tile kind
 * behind an exhaustive map. A kind with no component is a compile error, not
 * a runtime guess. Slice 2A's kinds are the counted tiles; the reading kinds
 * join the union, and this map, in Slice 2B.
 */
import * as React from 'react';
import type { LightboxBoard, LightboxMeasuredTileKind, LightboxTileKind } from '@messages';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { LightboxStatRow } from '@components/lightbox/LightboxStatRow';
import { LightboxTopWords } from '@components/lightbox/LightboxTopWords';
import { LightboxPartsOfSpeech } from '@components/lightbox/LightboxPartsOfSpeech';

export interface LightboxTileProps {
  board: LightboxBoard;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
}

export type LightboxTileRenderer = React.ComponentType<LightboxTileProps>;

/** Interim: the reading kinds' renderers land with the reading tiles. */
const NOT_YET_DRAWN: LightboxTileRenderer = () => null;

/* eslint-disable @typescript-eslint/naming-convention -- tile kinds are kebab-case protocol literals (ADR 2026-10-19 D3). */
export const LIGHTBOX_TILE_RENDERERS: Readonly<Record<LightboxTileKind, LightboxTileRenderer>> = {
  stats: LightboxStatRow,
  'top-words': LightboxTopWords,
  'parts-of-speech': LightboxPartsOfSpeech,
  headline: NOT_YET_DRAWN,
  motif: NOT_YET_DRAWN,
  'tension-arc': NOT_YET_DRAWN,
  character: NOT_YET_DRAWN,
  voice: NOT_YET_DRAWN,
  'genre-neighbor': NOT_YET_DRAWN,
  'reader-promise': NOT_YET_DRAWN
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
