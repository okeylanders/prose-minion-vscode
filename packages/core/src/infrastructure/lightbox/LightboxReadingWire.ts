/**
 * The Lightbox reading protocol's wire vocabulary (ADR 2026-10-19 D6, D7):
 * the sentinels, each lens's JSON key, the protocol's numeric rules, and the
 * shapes a group decodes into. Shared by the codec that reads responses, the
 * prompt builder that names the frame, and the tile assembly that checks
 * what was decoded. The ceilings are `PROMPT_BUDGETS.lightbox`.
 */

import type { LightboxGravityDegree, LightboxLensId, LightboxReadingGroupId } from '@messages';

/** The protocol version every group's JSON carries. */
export const LIGHTBOX_READING_PROTOCOL_VERSION = 1;

/** A genre neighborhood must draw at least one neighbor at or below this claimed affinity. */
export const LIGHTBOX_NEAR_MISS_AFFINITY = 0.4;

/** The fewest neighbors a genre block may draw (the ceiling is `PROMPT_BUDGETS.lightbox.genreNeighbors`). */
export const LIGHTBOX_MINIMUM_GENRE_NEIGHBORS = 2;

/** A motif recurs: it needs quotes from at least this many different paragraphs. */
export const LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS = 2;

/** The highest tension score; scores run 0 to this. */
export const LIGHTBOX_TENSION_TOP_SCORE = 9;

/**
 * The voice block's one-line traits, in display order, with the label the
 * board shows for each. `music` is the one the host sets its measured
 * sentence length beside.
 */
export const LIGHTBOX_VOICE_TRAITS = [
  ['pov', 'Point of view'],
  ['tense', 'Tense'],
  ['distance', 'Distance'],
  ['register', 'Register'],
  ['music', 'Sentence music']
] as const;

export type LightboxVoiceTraitKey = (typeof LIGHTBOX_VOICE_TRAITS)[number][0];

/** Each lens's key in a group's JSON. */
export const LIGHTBOX_LENS_KEYS: Readonly<Record<LightboxLensId, string>> = {
  headline: 'headline',
  motif: 'motifs',
  tension: 'tension',
  gravity: 'gravity',
  palette: 'palette',
  characters: 'characters',
  voice: 'voice',
  genre: 'genre'
};

export function lightboxGroupSentinels(group: LightboxReadingGroupId): { start: string; end: string } {
  return { start: `===LIGHTBOX_GROUP_${group}_V1===`, end: `===END_LIGHTBOX_GROUP_${group}_V1===` };
}

// ---------------------------------------------------------------------------
// Decoded shapes (unverified)
// ---------------------------------------------------------------------------

export interface LightboxWireQuote {
  para: number;
  quote: string;
}

export interface LightboxWirePeak extends LightboxWireQuote {
  note: string;
}

export interface LightboxDecodedMotif {
  title: string;
  gist: string;
  claim: string;
  terms: string[];
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedCharacter {
  name: string;
  aliases: string[];
  archetype: string;
  energy: string;
  wants: string;
  hides: string;
  claim: string;
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedNeighbor {
  genre: string;
  affinity: number;
  claim: string;
  nearMiss: string;
  evidence: LightboxWireQuote[];
}

/** An item that broke its rules inside a valid block, withheld by its title. */
export interface LightboxMalformedItem {
  title: string;
  reason: string;
}

export interface LightboxDecodedGravityTerm {
  term: string;
  degree: LightboxGravityDegree;
}

export interface LightboxDecodedGravityField {
  name: string;
  metaphor: string;
  /** Rounded to two decimals. */
  pull: number;
  claim: string;
  terms: LightboxDecodedGravityTerm[];
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedCollision {
  /** Two distinct names of well-formed fields in the same block. */
  fields: [string, string];
  claim: string;
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedLiteral {
  name: string;
  reason: string;
  terms: string[];
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedCluster {
  name: string;
  claim: string;
  words: string[];
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedSwatch {
  name: string;
  words: string[];
  /** `#RRGGBB`, upper case. */
  hex: string;
  note: string;
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedGravityBlock {
  lens: 'gravity';
  fields: LightboxDecodedGravityField[];
  collisions: LightboxDecodedCollision[];
  literal: LightboxDecodedLiteral[];
  malformed: {
    fields: LightboxMalformedItem[];
    collisions: LightboxMalformedItem[];
    literal: LightboxMalformedItem[];
  };
  friction: string;
}

export interface LightboxDecodedPaletteBlock {
  lens: 'palette';
  clusters: LightboxDecodedCluster[];
  swatches: LightboxDecodedSwatch[];
  malformed: {
    clusters: LightboxMalformedItem[];
    swatches: LightboxMalformedItem[];
  };
  friction: string;
}

export type LightboxDecodedBlock =
  | { lens: 'headline'; sentence: string; terms: string[]; evidence: LightboxWireQuote[]; friction: string }
  | { lens: 'motif'; items: LightboxDecodedMotif[]; malformed: LightboxMalformedItem[]; friction: string }
  | { lens: 'tension'; scores: number[]; claim: string; peaks: LightboxWirePeak[]; friction: string }
  | {
      lens: 'characters';
      items: LightboxDecodedCharacter[];
      malformed: LightboxMalformedItem[];
      friction: string;
    }
  | {
      lens: 'voice';
      /** One per `LIGHTBOX_VOICE_TRAITS` entry, in its order. */
      traits: Array<{ key: LightboxVoiceTraitKey; value: string }>;
      claim: string;
      evidence: LightboxWireQuote[];
      friction: string;
    }
  | {
      lens: 'genre';
      neighbors: LightboxDecodedNeighbor[];
      malformed: LightboxMalformedItem[];
      promise: { text: string; evidence: LightboxWireQuote[] };
      friction: string;
    }
  | LightboxDecodedGravityBlock
  | LightboxDecodedPaletteBlock;

export interface LightboxGroupDecodeContext {
  group: LightboxReadingGroupId;
  /** The lenses the call asked for, in rail order. */
  lenses: readonly LightboxLensId[];
  /** Ribbon columns the tension arc must score. */
  columnCount: number;
}

export interface LightboxDecodedGroup {
  /** In the order of `context.lenses`. */
  blocks: LightboxDecodedBlock[];
  /** Requested blocks that were missing or broke their rules, with writer-facing reasons. */
  withheld: Array<{ lens: LightboxLensId; reason: string }>;
  /** Blocks the model returned for lenses the call did not ask for; dropped, never shown. */
  ignored: LightboxLensId[];
}

/** The frame or root failed: the whole group's response is unusable. */
export class LightboxGroupFrameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LightboxGroupFrameError';
  }
}
