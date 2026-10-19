/**
 * Lightbox gravity and palette readings (ADR 2026-10-19 D3, D7; Slice 3).
 *
 * **Gravity.** A borrowed field is a source domain the prose leans on without
 * it being literal to the scene. The reading names the field, its governing
 * metaphor, a pull it claims and the terms that carry it, each with a degree
 * (1° latent, 2° felt, 3° overt). Everything counted is the host's: each
 * term's occurrences, the field's hits, its split by degree, whether it
 * clears the gravity line, and its drift across the chapter. A field under
 * the line is drawn below it, never dropped. Fields that are literal in the
 * scene are set aside with their reason, and two fields meeting in one
 * sentence are a collision, drawn only when its quote holds a term of each.
 *
 * **Palette.** Diction clusters group words the chapter keeps choosing, and
 * swatches name the colors the text names. The host counts every word; a
 * swatch's color is the reading's proposal, labeled so.
 *
 * Every tile here is a reading tile: host-minted ids and paragraphs, quotes
 * the host found, and a friction (`lightboxReadings.ts`).
 */

import type { LightboxCountedSupport, LightboxReadingTileBase } from './lightboxReadings';

/** A field term's degree: 1 latent, 2 felt, 3 overt. */
export type LightboxGravityDegree = 1 | 2 | 3;

/** A field term as the reading named it, with its degree, counted by the host. */
export interface LightboxGravityTerm extends LightboxCountedSupport {
  degree: LightboxGravityDegree;
}

/** Where a field lives across the chapter, from the host's count of its hits. */
export interface LightboxGravityDrift {
  /** The first and last paragraphs with a hit. */
  first: number;
  last: number;
  /** The stretch of paragraphs where the hits are densest, trimmed to its hits. */
  densest: { from: number; to: number; hits: number };
}

export interface LightboxGravityFieldTile extends LightboxReadingTileBase {
  kind: 'gravity-field';
  /** The governing metaphor: what the chapter is seen as, in one line. */
  metaphor: string;
  /** The pull the reading claims, 0–1. A claim, drawn hatched; never a measurement. */
  pull: number;
  /** The field's terms in the order named, each with its degree and the host's count. */
  support: LightboxGravityTerm[];
  /**
   * Host-counted: every occurrence of the field's terms, each once. An
   * occurrence inside a longer named term counts under the longer one.
   */
  hits: number;
  /** Host-counted hits by degree: 1°, 2°, 3°. */
  degreeHits: [number, number, number];
  /** Fewer hits than the gravity line asks: drawn below it, not dropped. */
  belowLine: boolean;
  /** `null` when no term was found in the chapter. */
  drift: LightboxGravityDrift | null;
}

export interface LightboxGravityCollisionTile extends LightboxReadingTileBase {
  kind: 'gravity-collision';
  /** The two borrowed fields that share a sentence, by name. */
  fields: [string, string];
}

/** A field present in the chapter but literal in its scene: set aside, with its reason as the claim. */
export interface LightboxGravityLiteralTile extends LightboxReadingTileBase {
  kind: 'gravity-literal';
  /** Host-counted, as a field's hits are. */
  hits: number;
}

/** A family of words the chapter keeps choosing; the host counts each word. */
export interface LightboxPaletteClusterTile extends LightboxReadingTileBase {
  kind: 'palette-cluster';
}

/** A color the text names; its words are counted, its swatch color is the reading's choice. */
export interface LightboxSwatchTile extends LightboxReadingTileBase {
  kind: 'swatch';
  /** `#RRGGBB`, upper case: the color the reading proposes for the swatch. */
  hex: string;
}
