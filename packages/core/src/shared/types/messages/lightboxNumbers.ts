/**
 * The Lightbox's measured numbers (ADR 2026-10-19 D5, D7 addendum; Slice
 * 4B): which figures stand out in the chapter, against the writer's
 * publishing-standards preset and the writer's own average. Host-computed
 * when the board is built, with no model: every figure, instance and
 * average here is counted by the detector named for its row
 * (`LightboxNumbers`), and the same detector checks the quotes a reading of
 * it keeps.
 */

/** The figures the board measures for standouts. */
export type LightboxNumberStatId =
  | 'sentence-length'
  | 'dialogue'
  | 'passive-voice'
  | 'being-verbs'
  | 'adverbs'
  | 'intensifiers';

/** Which side of its reference a figure stands out on. */
export type LightboxStandoutDirection = 'above' | 'below';

/** What a standout stands out against. */
export type LightboxStandoutBasis = 'standards' | 'writer';

/** The preset's range for the figure, and where the chapter falls in it. */
export interface LightboxNumberRange {
  min?: number;
  max?: number;
  status: 'below' | 'within' | 'above';
}

/** The writer's own average for the figure, and the chapter's ratio to it. */
export interface LightboxNumberWriterAverage {
  average: number;
  /** Chapter ÷ average, two decimals; absent when the average is 0. */
  ratio?: number;
}

/** Why a figure stands out, and what an instance of it is measured against. */
export interface LightboxNumberStandout {
  direction: LightboxStandoutDirection;
  against: LightboxStandoutBasis[];
  /**
   * Sentence length only: the length an instance (one sentence) is measured
   * against, the range bound it broke, else the writer's average.
   */
  reference?: number;
}

/** One measured figure. */
export interface LightboxNumberRow {
  stat: LightboxNumberStatId;
  /** Host words, e.g. "Passive voice". */
  label: string;
  /** e.g. "per 1,000 words". */
  unit: string;
  /** The chapter's figure, one decimal. */
  value: number;
  /**
   * How many instances the chapter holds: matches for a pattern; for
   * sentence length, sentences beyond the reference; for dialogue, spans of
   * dialogue (above) or paragraphs of narration (below). 0 when the figure
   * does not stand out and has no instance definition of its own.
   */
  instances: number;
  /** What an instance is, in host words ("sentences over 24 words"). */
  instanceLabel: string;
  /** 1-based paragraphs holding an instance, ascending. */
  paragraphs: number[];
  range?: LightboxNumberRange;
  writer?: LightboxNumberWriterAverage;
  standout?: LightboxNumberStandout;
  /** For a word pattern: its most frequent words in the chapter, lower case. */
  top?: Array<{ term: string; count: number }>;
}

/** Where the writer's own average came from, or why there is none. */
export type LightboxWriterBaselineSummary =
  | {
      kind: 'measured';
      /** The configured resource group it was read from. */
      group: 'chapters' | 'manuscript';
      files: number;
      words: number;
      /** True when a file or word bound stopped the reading early. */
      capped: boolean;
    }
  | { kind: 'absent'; note: string };

export interface LightboxNumbersMeasure {
  rows: LightboxNumberRow[];
  baseline: LightboxWriterBaselineSummary;
}

/** The chapter's sentences beyond their mean, measured per paragraph. */
export interface LightboxSentenceSummary {
  /** The longest sentence and its paragraph; null with no sentence. */
  longest: { words: number; paragraph: number } | null;
  /** Sentences under `underWords` words. */
  veryShort: number;
  underWords: number;
}
