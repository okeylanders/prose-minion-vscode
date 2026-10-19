/**
 * Lightbox tables shared by the host and the renderer (ADR 2026-10-19 D3, D6).
 *
 * The register a tile is drawn in is derived from its kind here, never
 * supplied by a reading, so no model output can make a reading look like a
 * count. Every table is exhaustive over its union: a new tile kind or lens
 * does not compile until it is placed.
 */

/* eslint-disable @typescript-eslint/naming-convention -- tile kinds are kebab-case protocol literals (ADR 2026-10-19 D3). */

import type {
  LightboxLensId,
  LightboxReadingGroup,
  LightboxReadingGroupId,
  LightboxReadingTileKind,
  LightboxRegister,
  LightboxRunScope,
  LightboxTileKind
} from '@messages';

export const LIGHTBOX_TILE_REGISTER: Readonly<Record<LightboxTileKind, LightboxRegister>> = {
  stats: 'measured',
  'top-words': 'measured',
  'parts-of-speech': 'measured',
  headline: 'read',
  motif: 'read',
  'tension-arc': 'read',
  character: 'read',
  // The voice tile sets host-measured sentence figures beside the reading.
  voice: 'counted-read',
  'genre-neighbor': 'read',
  'reader-promise': 'read'
};

/** The lens each reading kind belongs to. */
export const LIGHTBOX_TILE_LENS: Readonly<Record<LightboxReadingTileKind, LightboxLensId>> = {
  headline: 'headline',
  motif: 'motif',
  'tension-arc': 'tension',
  character: 'characters',
  voice: 'voice',
  'genre-neighbor': 'genre',
  'reader-promise': 'genre'
};

/** What one reading of each kind is called, e.g. in the inspector's "Theme & motif · Motif". */
export const LIGHTBOX_TILE_KIND_LABELS: Readonly<Record<LightboxReadingTileKind, string>> = {
  headline: 'Headline',
  motif: 'Motif',
  'tension-arc': 'Arc',
  character: 'Vibe',
  voice: 'Narration',
  'genre-neighbor': 'Neighbor',
  'reader-promise': 'Reader promise'
};

/** The reading groups, in board order (D6). */
export const LIGHTBOX_READING_GROUPS: readonly LightboxReadingGroupId[] = ['A', 'B', 'C'];

export interface LightboxLensDescriptor {
  id: LightboxLensId;
  /** The lens's name in the rail and on its tile. */
  label: string;
  group: LightboxReadingGroupId;
}

const LENS_DESCRIPTORS: Readonly<Record<LightboxLensId, Omit<LightboxLensDescriptor, 'id'>>> = {
  headline: { label: 'Headline', group: 'A' },
  motif: { label: 'Theme & motif', group: 'A' },
  tension: { label: 'Tension arc', group: 'A' },
  characters: { label: 'Characters', group: 'B' },
  voice: { label: 'Voice', group: 'B' },
  genre: { label: 'Genre neighborhood', group: 'C' }
};

/** Every lens, in rail order (which is also group order). */
export const LIGHTBOX_LENSES: readonly LightboxLensDescriptor[] = (
  Object.keys(LENS_DESCRIPTORS) as LightboxLensId[]
).map((id) => ({ id, ...LENS_DESCRIPTORS[id] }));

export function isLightboxLensId(value: unknown): value is LightboxLensId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LENS_DESCRIPTORS, value);
}

export function lightboxLensLabel(lens: LightboxLensId): string {
  return LENS_DESCRIPTORS[lens].label;
}

export function lightboxLensGroup(lens: LightboxLensId): LightboxReadingGroupId {
  return LENS_DESCRIPTORS[lens].group;
}

/** The group's lenses in rail order. */
export function lightboxGroupLenses(group: LightboxReadingGroupId): LightboxLensId[] {
  return LIGHTBOX_LENSES.filter((lens) => lens.group === group).map((lens) => lens.id);
}

/** A group before any call. */
export function emptyLightboxReadingGroup(group: LightboxReadingGroupId): LightboxReadingGroup {
  return { group, status: 'not-run', lenses: [], tiles: [], withheldBlocks: [], withheldClaims: [], frictions: [] };
}

/** One call a press would make: a group with the lenses it reads. */
export interface LightboxPlannedCall {
  group: LightboxReadingGroupId;
  lenses: LightboxLensId[];
}

/**
 * The calls a press makes (D6). A lens that is off is left out of its group,
 * and a group with no lens on is not called. `rest` skips the groups whose
 * readings already landed; `lens` re-reads one lens that is on.
 */
export function lightboxPlannedCalls(
  lensesOff: readonly LightboxLensId[],
  scope: LightboxRunScope,
  readings: readonly Pick<LightboxReadingGroup, 'group' | 'status'>[] = []
): LightboxPlannedCall[] {
  if (scope.mode === 'lens') {
    return lensesOff.includes(scope.lens) ? [] : [{ group: lightboxLensGroup(scope.lens), lenses: [scope.lens] }];
  }
  return LIGHTBOX_READING_GROUPS.flatMap((group) => {
    const lenses = lightboxGroupLenses(group).filter((lens) => !lensesOff.includes(lens));
    const landed = readings.find((reading) => reading.group === group)?.status === 'ok';
    return lenses.length === 0 || (scope.mode === 'rest' && landed) ? [] : [{ group, lenses }];
  });
}
