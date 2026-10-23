/**
 * The Lightbox reading protocol's wire vocabulary (ADR 2026-10-19 D6, D7):
 * the sentinels, each lens's JSON key, the protocol's numeric rules, and the
 * shapes a group decodes into. Shared by the codec that reads responses, the
 * prompt builder that names the frame, and the tile assembly that checks
 * what was decoded. The ceilings are `PROMPT_BUDGETS.lightbox`.
 */

import type {
  LightboxFamiliarKind,
  LightboxGravityDegree,
  LightboxHandoffEffect,
  LightboxLensId,
  LightboxLineageSetAside,
  LightboxLineageStanceNote,
  LightboxNumberStatId,
  LightboxNumberUsage,
  LightboxParagraphEnding,
  LightboxReadingGroupId,
  LightboxStockTier
} from '@messages';
import type { LightboxDecodedPlotBlock } from '@/infrastructure/lightbox/LightboxPlotWire';
import type { LightboxDecodedOpinionBlock } from '@/infrastructure/lightbox/LightboxOpinionWire';
import type { LightboxDecodedSteeringBlock } from '@/infrastructure/lightbox/LightboxSteeringWire';
import type { ModelJsonRepairKind } from '@parsers/ModelJsonRepair';

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
  subtext: 'subtext',
  genre: 'genre',
  lineage: 'lineage',
  spark: 'spark',
  stock: 'stock',
  rhythm: 'rhythm',
  numbers: 'numbers',
  template: 'template',
  pressure: 'pressure',
  artifacts: 'artifacts',
  summary: 'summary',
  opinion: 'opinion',
  steering: 'steering'
};

// ---------------------------------------------------------------------------
// Group D's closed vocabularies (Slice 4B)
// ---------------------------------------------------------------------------

/** A tier mix is drawn only when at least this many of its classified beats are found. */
export const LIGHTBOX_STOCK_MINIMUM_BEATS = 4;

export const LIGHTBOX_STOCK_TIERS: readonly LightboxStockTier[] = ['functional', 'decorated', 'weighted', 'signature'];
export const LIGHTBOX_FAMILIAR_KINDS: readonly LightboxFamiliarKind[] = ['idiom', 'cliche', 'stock', 'weighted'];
export const LIGHTBOX_PARAGRAPH_ENDINGS: readonly LightboxParagraphEnding[] = ['lands', 'holds', 'opens'];
export const LIGHTBOX_HANDOFF_EFFECTS: readonly LightboxHandoffEffect[] = ['continues', 'pause', 'closure', 'loses'];
export const LIGHTBOX_NUMBER_USAGES: readonly LightboxNumberUsage[] = ['deliberate', 'mixed', 'habit'];

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

export interface LightboxDecodedLineageStory {
  title: string;
  source: string;
  /** One to three, each stance at most once, in the reading's order. */
  stances: LightboxLineageStanceNote[];
  claim: string;
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedLineageBlock {
  lens: 'lineage';
  items: LightboxDecodedLineageStory[];
  /** Stories checked and set aside; required as a list, possibly empty. */
  setAside: LightboxLineageSetAside[];
  malformed: LightboxMalformedItem[];
  friction: string;
}

export interface LightboxDecodedSubtextPair {
  speaker: string;
  /** The line as spoken: checked against its paragraph, and inside dialogue there. */
  said: LightboxWireQuote;
  /** What the line is read as meaning: a claim. */
  meant: string;
  /** Quotes from around the line that the reading leans on; possibly none. */
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedSubtextBlock {
  lens: 'subtext';
  items: LightboxDecodedSubtextPair[];
  malformed: LightboxMalformedItem[];
  friction: string;
}

export interface LightboxDecodedSpark {
  title: string;
  /** A question, already held to the Spark phrasing rules (`LightboxSparkPhrasing`). */
  question: string;
  /** The words it stands on; the host counts them. */
  terms: string[];
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedSparkBlock {
  lens: 'spark';
  items: LightboxDecodedSpark[];
  malformed: LightboxMalformedItem[];
  friction: string;
}

export interface LightboxDecodedBeat extends LightboxWireQuote {
  tier: LightboxStockTier;
}

/** A quoted line with a short title and a one-line note: a signature phrase or an air-lock. */
export interface LightboxDecodedNotedLine {
  title: string;
  note: string;
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedFamiliar {
  /** As it stands in the chapter; the host counts it. */
  phrase: string;
  kind: LightboxFamiliarKind;
  note: string;
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedEcho extends LightboxDecodedNotedLine {
  /** What the line sounds reminiscent of: the reading's, never checked. */
  reminiscentOf: string;
}

export interface LightboxDecodedStockBlock {
  lens: 'stock';
  economy: { note: string; beats: LightboxDecodedBeat[] };
  signature: LightboxDecodedNotedLine[];
  familiar: LightboxDecodedFamiliar[];
  airLocks: LightboxDecodedNotedLine[];
  echoes: LightboxDecodedEcho[];
  malformed: {
    beats: LightboxMalformedItem[];
    signature: LightboxMalformedItem[];
    familiar: LightboxMalformedItem[];
    airLocks: LightboxMalformedItem[];
    echoes: LightboxMalformedItem[];
  };
  friction: string;
}

export interface LightboxDecodedHandoff {
  from: LightboxWireQuote;
  to: LightboxWireQuote;
  carried: string;
  changes: string;
  effect: LightboxHandoffEffect;
}

export interface LightboxDecodedRhythmBlock {
  lens: 'rhythm';
  /** Exactly one per ribbon column. */
  endings: LightboxParagraphEnding[];
  /** Whether the sentences move toward conclusion: a claim. */
  movement: string;
  evidence: LightboxWireQuote[];
  handoffs: LightboxDecodedHandoff[];
  malformed: LightboxMalformedItem[];
  friction: string;
}

export interface LightboxDecodedNumberReading {
  stat: LightboxNumberStatId;
  usage: LightboxNumberUsage;
  claim: string;
  evidence: LightboxWireQuote[];
}

export interface LightboxDecodedNumbersBlock {
  lens: 'numbers';
  items: LightboxDecodedNumberReading[];
  malformed: LightboxMalformedItem[];
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
  | LightboxDecodedPaletteBlock
  | LightboxDecodedLineageBlock
  | LightboxDecodedSubtextBlock
  | LightboxDecodedSparkBlock
  | LightboxDecodedStockBlock
  | LightboxDecodedRhythmBlock
  | LightboxDecodedNumbersBlock
  | LightboxDecodedPlotBlock
  | LightboxDecodedOpinionBlock
  | LightboxDecodedSteeringBlock;

/** How a reply ended: as the model chose (`stop`), or at the output ceiling (`ceiling`, `finishReason === 'length'`). */
export type LightboxReplyEnd = 'stop' | 'ceiling';

/** A structural repair the frame was given before its blocks were read (Slice 4H, epic decision 39). */
export type LightboxFrameRepair = ModelJsonRepairKind | 'missing-closing-sentinel';

/** Why the block a reply was cut inside is withheld (Slice 4H, epic decision 40): host words. */
export const LIGHTBOX_CUT_OFF_REASON = 'The reply reached the output ceiling before this block finished.';

export interface LightboxGroupDecodeContext {
  group: LightboxReadingGroupId;
  /** The lenses the call asked for, in rail order. */
  lenses: readonly LightboxLensId[];
  /** Ribbon columns the tension arc must score. */
  columnCount: number;
  /** How the reply ended; `stop` when absent. A reply cut off at the ceiling is salvaged (`LightboxReadingFrame`). */
  end?: LightboxReplyEnd;
}

export interface LightboxDecodedGroup {
  /** In the order of `context.lenses`. */
  blocks: LightboxDecodedBlock[];
  /** Requested blocks that were missing or broke their rules, with writer-facing reasons. */
  withheld: Array<{ lens: LightboxLensId; reason: string }>;
  /** Blocks the model returned for lenses the call did not ask for; dropped, never shown. */
  ignored: LightboxLensId[];
  /** How the frame was read (Slice 4H): set by `decodeLightboxGroup`, for the reply's log line. */
  report?: LightboxDecodeReport;
}

export interface LightboxDecodeReport {
  /** The structural repairs the frame was given, each kind once. */
  repairs: LightboxFrameRepair[];
  /** Fields clipped at the safety ceiling (`PROMPT_BUDGETS.lightbox.safetyMultiple` times their ask). */
  clipped: number;
  /** The reply reached the output ceiling before its frame closed: what it finished was read, the rest withheld. */
  cutOff: boolean;
}

/**
 * The frame or root failed: the whole group's response is unusable. The
 * message is host-owned (positions, counts, the protocol's own names) and is
 * logged and shown. `diagnostic` may quote the model (an unknown field's
 * name), so it goes only to the rejected-response recovery store, beside the
 * body it describes (PR #149 F-05).
 */
export class LightboxGroupFrameError extends Error {
  constructor(message: string, readonly diagnostic?: string) {
    super(message);
    this.name = 'LightboxGroupFrameError';
  }
}
