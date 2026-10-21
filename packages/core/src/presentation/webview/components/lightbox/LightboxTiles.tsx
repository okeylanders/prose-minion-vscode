/**
 * The board's tile renderers (ADR 2026-10-19 D3): one component per tile kind
 * behind an exhaustive map. A kind with no component is a compile error, not
 * a runtime guess. The layouts say where each kind is drawn: the counted
 * rows and grid (Slice 2A), and the readings (Slice 2B) in the board's
 * heading, under the ribbon, and in the grid. The reader promise is drawn
 * inside the genre tile, below its neighbors; gravity's collisions and literal
 * set-asides inside the gravity tile, and swatches inside the palette (Slice 3).
 * Lineage and subtext join the grid, and sparks are drawn in a lane of their
 * own under it, with the lane's actions (Slice 4). Group D's tiles join the
 * grid (Slice 4B): stock and signature draws its signature phrases,
 * familiar phrasing, air-locks and echoes inside it, rhythm its handoffs, and
 * the numbers tile its readings under the measured figures. Group E's
 * tiles join the grid (Slice 4C): summary and movements full width with its
 * movements inside it, template and freshness with its beats, pressure and
 * artifacts. The Opinion (Slice 4D), the one evaluative tile, is drawn last
 * on the board, full width, after the Spark lane.
 */
import * as React from 'react';
import type {
  LightboxBoard,
  LightboxLensId,
  LightboxMeasuredTileKind,
  LightboxReadingTileKind,
  LightboxSparkTile,
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
import { LightboxGravity, LightboxGravityCollisions, LightboxGravityLiterals } from '@components/lightbox/LightboxGravity';
import { LightboxPalette, LightboxSwatches } from '@components/lightbox/LightboxPalette';
import { LightboxLineage } from '@components/lightbox/LightboxLineage';
import { LightboxSubtext } from '@components/lightbox/LightboxSubtext';
import { LightboxSparkLane, type LightboxSparkBring } from '@components/lightbox/LightboxSparkLane';
import {
  LightboxAirLocks,
  LightboxEchoes,
  LightboxFamiliarPhrasing,
  LightboxSignaturePhrases,
  LightboxStock
} from '@components/lightbox/LightboxStock';
import { LightboxHandoffs, LightboxRhythm } from '@components/lightbox/LightboxRhythm';
import { LightboxNumbers } from '@components/lightbox/LightboxNumbers';
import { LightboxMovements, LightboxSummary } from '@components/lightbox/LightboxSummary';
import { LightboxTemplate, LightboxTemplateBeats } from '@components/lightbox/LightboxTemplate';
import { LightboxPressure } from '@components/lightbox/LightboxPressure';
import { LightboxArtifacts } from '@components/lightbox/LightboxArtifacts';
import { LightboxOpinion, type LightboxOpinionActions } from '@components/lightbox/LightboxOpinion';

/** What the board lets a tile do beyond hover and pin: the Spark lane's "Not for me" and Bring; the Opinion's views (Slice 4D). */
export interface LightboxTileActions {
  onDismissSpark?: (tileId: string, dismissed: boolean) => void;
  bringSpark?: { view: (spark: LightboxSparkTile) => LightboxSparkBring; onBring: (tileId: string) => void };
  opinion?: LightboxOpinionActions;
}

export interface LightboxTileProps {
  board: LightboxBoard;
  bind: (ref: LightboxItemRef) => LightboxItemBinding;
  actions?: LightboxTileActions;
  /** The lenses the writer turned off, for a tile whose parts depend on another lens (engagement on the movements). */
  lensesOff?: readonly LightboxLensId[];
}

/** The Spark lane through the renderer map, with the board's actions. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const LightboxSparkLaneTile: React.FC<LightboxTileProps> = ({ board, bind, actions }) => (
  <LightboxSparkLane board={board} bind={bind} onDismiss={actions?.onDismissSpark} bring={actions?.bringSpark} />
);

export type LightboxTileRenderer = React.ComponentType<LightboxTileProps>;

/* eslint-disable @typescript-eslint/naming-convention -- tile kinds are kebab-case protocol literals (ADR 2026-10-19 D3). */
export const LIGHTBOX_TILE_RENDERERS: Readonly<Record<LightboxTileKind, LightboxTileRenderer>> = {
  stats: LightboxStatRow,
  'top-words': LightboxTopWords,
  'parts-of-speech': LightboxPartsOfSpeech,
  headline: LightboxHeadline,
  motif: LightboxMotifs,
  'tension-arc': LightboxTensionArc,
  'gravity-field': LightboxGravity,
  'gravity-collision': LightboxGravityCollisions,
  'gravity-literal': LightboxGravityLiterals,
  'palette-cluster': LightboxPalette,
  swatch: LightboxSwatches,
  character: LightboxCharacters,
  voice: LightboxVoice,
  'genre-neighbor': LightboxGenre,
  'reader-promise': LightboxReaderPromise,
  subtext: LightboxSubtext,
  lineage: LightboxLineage,
  spark: LightboxSparkLaneTile,
  'stock-tiers': LightboxStock,
  signature: LightboxSignaturePhrases,
  'familiar-phrase': LightboxFamiliarPhrasing,
  'air-lock': LightboxAirLocks,
  echo: LightboxEchoes,
  'rhythm-endings': LightboxRhythm,
  handoff: LightboxHandoffs,
  'number-usage': LightboxNumbers,
  synopsis: LightboxSummary,
  movement: LightboxMovements,
  template: LightboxTemplate,
  'template-beat': LightboxTemplateBeats,
  'pressure-thread': LightboxPressure,
  artifact: LightboxArtifacts,
  opinion: LightboxOpinion
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
 * counted tiles, the reader promise is drawn by the genre tile, the sparks
 * take the lane under the grid, and the Opinion comes last of all.
 */
export const LIGHTBOX_READING_LAYOUT: Readonly<{
  heading: LightboxReadingTileKind;
  underRibbon: LightboxReadingTileKind;
  grid: readonly LightboxReadingTileKind[];
  lane: LightboxReadingTileKind;
  last: LightboxReadingTileKind;
  within: Readonly<Partial<Record<LightboxReadingTileKind, LightboxReadingTileKind>>>;
}> = {
  heading: 'headline',
  underRibbon: 'tension-arc',
  grid: [
    'motif', 'gravity-field', 'palette-cluster', 'character', 'lineage', 'genre-neighbor', 'voice', 'subtext',
    'stock-tiers', 'rhythm-endings', 'number-usage',
    'synopsis', 'template', 'pressure-thread', 'artifact'
  ],
  lane: 'spark',
  last: 'opinion',
  /* eslint-disable @typescript-eslint/naming-convention -- tile kinds are kebab-case protocol literals. */
  within: {
    'reader-promise': 'genre-neighbor',
    'gravity-collision': 'gravity-field',
    'gravity-literal': 'gravity-field',
    swatch: 'palette-cluster',
    signature: 'stock-tiers',
    'familiar-phrase': 'stock-tiers',
    'air-lock': 'stock-tiers',
    echo: 'stock-tiers',
    handoff: 'rhythm-endings',
    movement: 'synopsis',
    'template-beat': 'template'
  }
  /* eslint-enable @typescript-eslint/naming-convention */
};
