/**
 * Lightbox craft steering (ADR 2026-10-19 D3, D7 and its second addendum of
 * 2026-10-21; Slice 4F): group G reads the chapter's being verbs, adverbs
 * (-ly) and intensifiers and fillers, whatever their rates.
 *
 * **Measured first, by the host** (`LightboxSteeringMeasure`). Each figure's
 * total and rate come from the detector behind the numbers tile's bar, so
 * they are the same numbers; the board adds how many stand in narration and
 * in dialogue, a breakdown by construction (the word-frequency tool's
 * tagger), and how many sit in runs of short sentences. No model is asked.
 *
 * **Then read.** One reading per figure of how it works in this chapter
 * (`steering-reading`), and up to four instance notes (`steering-note`), each
 * one quote the host found that holds an instance of the figure, by its own
 * detector, with a stance, a why and, only when the note leans or
 * compensates, a nudge that names the craft move as worth a look and may
 * carry one example the writer chose to allow: a phrase of the checked quote
 * and a few words showing one way the move could go. The example is an
 * illustration, never a quote of the chapter.
 *
 * Every tile here is a reading tile: host-minted ids and titles, quotes the
 * host found, a friction (`lightboxReadings.ts`).
 */

import type { LightboxNumberStatId } from './lightboxNumbers';
import type { LightboxReadingTileBase } from './lightboxReadings';

/** The figures craft steering owns: the numbers lens no longer reads them (epic decision 20). */
export type LightboxSteeringStatId = Extract<LightboxNumberStatId, 'being-verbs' | 'adverbs' | 'intensifiers'>;

/** How an instance works where it stands. A reading of use, never a grade. */
export type LightboxSteeringStance = 'earns' | 'leans' | 'compensates';

/**
 * The constructions a figure's instances are sorted into, by the host. Each
 * figure uses its own (`LIGHTBOX_STEERING_CONSTRUCTIONS`), and its counts
 * partition its instances.
 * - Being verbs: `expletive` (there or it + be), `progressive` (be + -ing),
 *   `passive` (be + past participle), `adjective` (be + adjective), `other`.
 * - Adverbs: `dialogue-tag` (said or asked + -ly), `before-adjective`,
 *   `with-verb`, `before-adverb`, `other`.
 * - Intensifiers and fillers: `generic` (before a plain or generic word),
 *   `before-modifier` (before an adjective or adverb), `other`.
 */
export type LightboxSteeringConstruction =
  | 'expletive'
  | 'progressive'
  | 'passive'
  | 'adjective'
  | 'dialogue-tag'
  | 'before-adjective'
  | 'with-verb'
  | 'before-adverb'
  | 'generic'
  | 'before-modifier'
  | 'other';

/** One construction's count, and the paragraphs holding it (1-based, ascending). */
export interface LightboxSteeringCount {
  construction: LightboxSteeringConstruction;
  count: number;
  paragraphs: number[];
}

/** One steering figure, as the host measured it. */
export interface LightboxSteeringFigure {
  stat: LightboxSteeringStatId;
  /** Instances by the figure's own detector: the numbers row's `instances`. */
  total: number;
  /** Per 1,000 words, unrounded: the numbers row's `value`. */
  rate: number;
  /** Instances outside and inside quoted dialogue (`findDialogueSpans`); they sum to `total`. */
  narration: number;
  dialogue: number;
  /**
   * The construction breakdown, in display order; the counts sum to `total`.
   * Empty when the tagger could not load (`LightboxSteeringMeasure.tagged`).
   */
  constructions: LightboxSteeringCount[];
  /** Adverbs only: of those with a verb, how many verbs are on Style Flags' weak-verbs list. */
  weakVerbs?: number;
  /** Instances inside a run of short sentences (the measure's `shortRun`). */
  inShortRuns: number;
  /** 1-based paragraphs holding an instance, ascending. */
  paragraphs: number[];
}

export interface LightboxSteeringMeasure {
  /** Being verbs, adverbs, intensifiers, in that order. */
  figures: LightboxSteeringFigure[];
  /** What a run of short sentences is: at least `sentences` in a row, each at most `maxWords` words, in one paragraph. */
  shortRun: { sentences: number; maxWords: number };
  /** False when the part-of-speech tagger could not load: the constructions are then not measured. */
  tagged: boolean;
}

/** How a figure works in this chapter, read; its quotes each hold an instance. */
export interface LightboxSteeringReadingTile extends LightboxReadingTileBase {
  kind: 'steering-reading';
  stat: LightboxSteeringStatId;
}

/**
 * One way a nudge could go, shown as an illustration (epic decision 23, the
 * writer's choice): `before` is a run of whole words of the note's checked
 * quote that holds the instance, as the chapter has it; `after` is a few
 * words the reading offers. Never a quote, never searched by the verifier.
 */
export interface LightboxSteeringExample {
  before: string;
  after: string;
}

/**
 * One instance of a figure: its quote (the tile's one evidence quote), the
 * stance, the why (`claim`) and, only when it leans or compensates, a nudge
 * and at most one example.
 */
export interface LightboxSteeringNoteTile extends LightboxReadingTileBase {
  kind: 'steering-note';
  stat: LightboxSteeringStatId;
  stance: LightboxSteeringStance;
  /** The craft move, worth a look; absent when the note earns. */
  nudge?: string;
  example?: LightboxSteeringExample;
  /** Why the reading's example is not shown, in host words; never with `example`. */
  exampleWithheld?: string;
  /** The note's place among its figure's notes as read, from 1: its title's number. */
  ordinal: number;
}
