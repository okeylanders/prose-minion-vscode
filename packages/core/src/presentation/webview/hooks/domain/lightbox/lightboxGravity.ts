/**
 * How the board draws borrowed fields (ADR 2026-10-19 D7; Slice 3). Pure: no
 * React, no transport.
 *
 * Every figure here is the host's: a field's hits, its split by degree, its
 * drift and whether it clears the gravity line. The one figure that is the
 * reading's, the pull, is always worded as a claim, and it only places a
 * field on the orbit: a field the host found under the gravity line sits
 * outside the line whatever pull its reading claims.
 */

import type { LightboxGravityDegree, LightboxGravityFieldTile } from '@messages';
import { LIGHTBOX_GRAVITY_DEGREES, LIGHTBOX_GRAVITY_LINE_HITS } from '@shared/constants/lightbox';
import { pluralize } from '@hooks/domain/lightbox/lightboxReadings';

/** The orbit's box, in px; the field buttons are this wide and tall. */
export const LIGHTBOX_ORBIT_SIZE = 280;
export const LIGHTBOX_ORBIT_BUTTON = 44;

/** Ring radii, in px from the center: strong, moderate, and the gravity line. */
export const LIGHTBOX_ORBIT_RINGS = { strong: 50, moderate: 90, line: 128 } as const;

export interface LightboxOrbitPlacement {
  id: string;
  /** The button's top-left corner inside the orbit box. */
  left: number;
  top: number;
  /** The dot's diameter, from the host's hits. */
  dot: number;
  belowLine: boolean;
}

const GOLDEN_ANGLE = 137.508;
/**
 * The first (strongest) field sits low on the right. From there the golden
 * angle keeps the first five fields at least 35 degrees from twelve o'clock,
 * where the rings' labels are drawn, so a field's name never covers one.
 */
const FIRST_ANGLE = 30;

/**
 * Where each field sits: closer to the center the more pull its reading
 * claims, outside the gravity line when the host counted too few hits, and
 * spread around the circle by the golden angle so a handful of fields never
 * stack. The dot grows with the host's hits.
 */
export function lightboxOrbitPlacements(fields: readonly LightboxGravityFieldTile[]): LightboxOrbitPlacement[] {
  const center = LIGHTBOX_ORBIT_SIZE / 2;
  const half = LIGHTBOX_ORBIT_BUTTON / 2;
  const { line } = LIGHTBOX_ORBIT_RINGS;
  return fields.map((field, index) => {
    const radius = field.belowLine ? line : line - Math.min(1, Math.max(0, field.pull)) * (line - 28);
    const angle = ((FIRST_ANGLE + index * GOLDEN_ANGLE) * Math.PI) / 180;
    return {
      id: field.id,
      left: Math.round(center + radius * Math.cos(angle) - half),
      top: Math.round(center + radius * Math.sin(angle) - half),
      dot: Math.round(10 + Math.min(field.hits, 40) * 0.6),
      belowLine: field.belowLine
    };
  });
}

/** "pull 0.24 · claim": the reading's figure, never shown without its label. */
export function lightboxPullLabel(pull: number): string {
  return `pull ${pull.toFixed(2)} · claim`;
}

/** "3 terms · 5 hits". */
export function lightboxFieldCountLabel(field: Pick<LightboxGravityFieldTile, 'support' | 'hits'>): string {
  return `${pluralize(field.support.length, 'term')} · ${pluralize(field.hits, 'hit')}`;
}

/** The host's drift note: where the field enters, where it last appears, where it is densest. */
export function lightboxDriftNote(field: Pick<LightboxGravityFieldTile, 'drift' | 'hits'>): string {
  const { drift } = field;
  if (!drift) {
    return 'None of its terms is in the chapter.';
  }
  if (drift.first === drift.last) {
    return `Only in ¶${drift.first}, ${pluralize(field.hits, 'hit')}.`;
  }
  const { from, to, hits } = drift.densest;
  const stretch = from === to ? `¶${from}` : `¶${from}–¶${to}`;
  return `Enters at ¶${drift.first}, last at ¶${drift.last}; densest at ${stretch} (${hits} of ${pluralize(field.hits, 'hit')}).`;
}

/** Said beside a field the host counted under the gravity line. */
export function lightboxBelowLineNote(field: Pick<LightboxGravityFieldTile, 'hits'>): string {
  return `Below the gravity line: ${pluralize(field.hits, 'hit')}, fewer than ${LIGHTBOX_GRAVITY_LINE_HITS}. Drawn so you can see what the board did not call gravity.`;
}

export interface LightboxDegreeRow {
  degree: LightboxGravityDegree;
  /** "1° latent". */
  label: string;
  /** The terms the reading put at this degree, as the host counted them: "flashed ×1, burning ×0". */
  terms: string;
  /** Host-counted hits at this degree (each occurrence once). */
  hits: number;
}

/** The inspector's "By degree" rows: one per degree the reading used. */
export function lightboxDegreeRows(field: Pick<LightboxGravityFieldTile, 'support' | 'degreeHits'>): LightboxDegreeRow[] {
  return ([1, 2, 3] as const).flatMap((degree) => {
    const terms = field.support.filter((term) => term.degree === degree);
    return terms.length === 0
      ? []
      : [{
          degree,
          label: `${degree}° ${LIGHTBOX_GRAVITY_DEGREES[degree]}`,
          terms: terms.map((term) => `${term.term} ×${term.count}`).join(', '),
          hits: field.degreeHits[degree - 1]
        }];
  });
}

/** "By degree: 2 latent, 1 felt, 0 overt", for the degree bar's accessible name. */
export function lightboxDegreeAria(field: Pick<LightboxGravityFieldTile, 'degreeHits'>): string {
  const [latent, felt, overt] = field.degreeHits;
  return `By degree: ${latent} ${LIGHTBOX_GRAVITY_DEGREES[1]}, ${felt} ${LIGHTBOX_GRAVITY_DEGREES[2]}, ${overt} ${LIGHTBOX_GRAVITY_DEGREES[3]}`;
}
