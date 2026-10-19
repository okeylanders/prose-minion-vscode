/**
 * Lightbox tables shared by the host and the renderer (ADR 2026-10-19 D3, D6).
 *
 * The register a tile is drawn in is derived from its kind here, never
 * supplied by a reading, so no model output can make a reading look like a
 * count. Both tables are exhaustive over their unions: a new tile kind or lens
 * does not compile until it is placed.
 */

/* eslint-disable @typescript-eslint/naming-convention -- tile kinds are kebab-case protocol literals (ADR 2026-10-19 D3). */

import type {
  LightboxLensId,
  LightboxReadingGroupId,
  LightboxRegister,
  LightboxTileKind
} from '@messages';

export const LIGHTBOX_TILE_REGISTER: Readonly<Record<LightboxTileKind, LightboxRegister>> = {
  stats: 'measured',
  'top-words': 'measured',
  'parts-of-speech': 'measured'
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

/** Every lens, in rail order. */
export const LIGHTBOX_LENSES: readonly LightboxLensDescriptor[] = (
  Object.keys(LENS_DESCRIPTORS) as LightboxLensId[]
).map((id) => ({ id, ...LENS_DESCRIPTORS[id] }));

export function isLightboxLensId(value: unknown): value is LightboxLensId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LENS_DESCRIPTORS, value);
}
