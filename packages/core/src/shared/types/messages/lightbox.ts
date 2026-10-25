/**
 * Lightbox message contracts (ADR 2026-10-19 D3, D4, D10, D12).
 *
 * The renderer sees only a `LightboxBoard`: a closed, ordered JSON document
 * the host builds from one source (a file or an editor selection). Slice 2A
 * fills its counted half (`paragraphs`, `ribbon`, `measured`) with no model
 * call; `readings` holds the reading groups (Slice 2B,
 * `lightboxReadings.ts`), which run only on the writer's press.
 * `boardVersion` is 1 from Slice 5A (D12 addendum, 2026-10-22): the board on
 * the wire is the board a saved file holds (`LightboxBoardCodec`, format 1),
 * with `rules` naming the rules that measured it.
 *
 * Every count on the board is host-computed. The register a tile is drawn in
 * (measured, read, counted-read) is derived from its kind by
 * `LIGHTBOX_TILE_REGISTER`, never supplied (D3).
 */

import { MessageEnvelope, MessageType } from './base';
import type { LightboxReadingGroup, LightboxReadingTileKind } from './lightboxReadings';
import type { LightboxNumbersMeasure, LightboxSentenceSummary } from './lightboxNumbers';
import type { LightboxSectionsMeasure } from './lightboxSections';
import type { LightboxSteeringMeasure } from './lightboxSteering';

// ---------------------------------------------------------------------------
// Tiles and registers
// ---------------------------------------------------------------------------

/** How a tile is drawn: solid (counted), dashed (read), or neutral (both). */
export type LightboxRegister = 'measured' | 'read' | 'counted-read';

/** The counted tiles the board always draws, from `LightboxBoard.measured`. */
export type LightboxMeasuredTileKind = 'stats' | 'top-words' | 'parts-of-speech';

/**
 * Every tile kind: the counted ones and the readings (`lightboxReadings.ts`).
 * The union grows by slice (D3): palette and borrowed-field kinds in 3;
 * lineage, subtext and spark in 4. Every map keyed by `LightboxTileKind` is
 * exhaustive, so a new kind does not compile until it has a register and a
 * renderer.
 */
export type LightboxTileKind = LightboxMeasuredTileKind | LightboxReadingTileKind;

// ---------------------------------------------------------------------------
// Source and paragraphs
// ---------------------------------------------------------------------------

export type LightboxSourceKind = 'file' | 'selection';

/** Where a board's text came from. Carries counts and provenance, never the text itself. */
export interface LightboxSource {
  kind: LightboxSourceKind;
  /** Workspace-relative path of the file (or of the selection's file). */
  displayPath: string;
  /** Opaque URI string, for provenance. */
  sourceUri?: string;
  /** 1-based inclusive line range, for a selection. */
  startLine?: number;
  endLine?: number;
  /** SHA-256 over the normalized text; a change marks the board stale (D4). */
  contentHash: string;
  wordCount: number;
  paragraphCount: number;
  /** Epoch ms when the host read the text. */
  capturedAt: number;
  /** The opening of the text, so the writer can see what was boarded. */
  preview: string;
}

/**
 * One paragraph, as the shared splitter (`/\n\s*\n/`) produces it (D4).
 * Offsets are UTF-16 indexes into the text as it was read.
 */
export interface LightboxParagraphMetric {
  /** Numbered from 1. */
  index: number;
  start: number;
  end: number;
  words: number;
  sentences: number;
  /** Words ÷ sentences, one decimal; 0 when the paragraph has no sentence. */
  avgWordsPerSentence: number;
  /** Words inside quoted dialogue (the shared dialogue-span matcher). */
  dialogueWords: number;
  /** `dialogueWords ÷ words`, 0–1, three decimals. */
  dialogueShare: number;
  /**
   * The words in each of the paragraph's sentences, in order, by the
   * prose-stats sentence splitter (`proseSentenceSpans`) and word rule
   * (Slice 4B). Its length is `sentences`.
   */
  sentenceWords: number[];
}

/**
 * One ribbon column: one paragraph up to `PROMPT_BUDGETS.lightbox.ribbonColumns`
 * paragraphs, a contiguous range above that (D4). Ranges are inclusive and
 * 1-based. Rhythm and dialogue are pooled over the range.
 */
export interface LightboxRibbonColumn {
  from: number;
  to: number;
  /** Total words ÷ total sentences in the range, one decimal. */
  avgWordsPerSentence: number;
  /** Dialogue words ÷ words in the range, 0–1, three decimals. */
  dialogueShare: number;
}

// ---------------------------------------------------------------------------
// The measured set (D5)
// ---------------------------------------------------------------------------

/** A counted word or phrase and the paragraphs it occurs in. */
export interface LightboxCountedTerm {
  term: string;
  count: number;
  /** Percent of all words, one decimal, as the word-frequency tool reports it. */
  percentage: number;
  /** 1-based paragraph indexes, ascending. Empty when no single paragraph holds it. */
  paragraphs: number[];
}

/** The headline stats, from the prose-stats tool. Percentages are 0–100. */
export interface LightboxHeadlineStats {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageWordsPerSentence: number;
  averageSentencesPerParagraph: number;
  dialoguePercentage: number;
  lexicalDensity: number;
  /** `100 − 2 × words per sentence`, clamped to 0–100 (not Flesch). */
  readabilityScore: number;
  readabilityGrade?: number;
  pacing: string;
  readingTimeMinutes: number;
  uniqueWordCount: number;
  hapaxCount: number;
  hapaxPercent: number;
  vocabularyDiversity: number;
}

export type LightboxStandardsStatus = 'below' | 'within' | 'above' | 'n/a';

/** One metric compared with the writer's publishing-standards preset. */
export interface LightboxStandardsItem {
  key: string;
  label: string;
  value: number | string;
  standard?: { min?: number; max?: number };
  status: LightboxStandardsStatus;
}

export interface LightboxPublishingFormat {
  trimLabel: string;
  wordsPerPage: number;
  estimatedPageCount: number;
  pageCountRange?: { min?: number; max?: number };
  status: LightboxStandardsStatus;
}

/** Present only when a genre preset is selected. */
export interface LightboxStandardsComparison {
  items: LightboxStandardsItem[];
  publishingFormat?: LightboxPublishingFormat;
}

export interface LightboxPartsOfSpeech {
  /** False when the offline tagger could not load; the lists are then empty. */
  available: boolean;
  nouns: LightboxCountedTerm[];
  verbs: LightboxCountedTerm[];
  adjectives: LightboxCountedTerm[];
  adverbs: LightboxCountedTerm[];
}

/**
 * The style flags whose count is a count of instances, each found by its
 * Style Flags detector (Slice 4E). Repetitive Words and Clichés count the
 * words and phrases found, not their instances, so they have no id.
 */
export type LightboxStyleFlagId = 'adverbs' | 'passive-voice' | 'weak-verbs' | 'filler-words';

export interface LightboxStyleFlag {
  type: string;
  count: number;
  examples: string[];
  /** Set for a flag whose instances can be found (Slice 4E): the inspector lists their sentences. */
  id?: LightboxStyleFlagId;
  /** 1-based, ascending: the paragraphs an instance touches; empty for a flag without an id. */
  paragraphs: number[];
}

/**
 * A word the text uses once, by the rule the headline's `hapaxCount` counts
 * (Slice 4E): `proseStatsWords`, whitespace-split, lower-cased, letters and
 * apostrophes kept.
 */
export interface LightboxHapaxWord {
  /** As counted: "rabbithole" for "rabbit-hole". Names the word to the host. */
  term: string;
  /** As the text has it, from its first to its last counted character: "Rabbit-Hole". */
  written: string;
  /** Its one paragraph, 1-based. */
  paragraph: number;
}

export interface LightboxMeasuredSet {
  headline: LightboxHeadlineStats;
  standards?: LightboxStandardsComparison;
  topWords: LightboxCountedTerm[];
  partsOfSpeech: LightboxPartsOfSpeech;
  /** Repeated two- and three-word phrases with at least one content word. */
  phrases: {
    bigrams: LightboxCountedTerm[];
    trigrams: LightboxCountedTerm[];
  };
  styleFlags: LightboxStyleFlag[];
  /** Every word used once, in order of first appearance; exactly `headline.hapaxCount` of them (Slice 4E). */
  hapax: LightboxHapaxWord[];
  /** The longest and the very short sentences, per paragraph (Slice 4B). */
  sentences: LightboxSentenceSummary;
  /** The figures that stand out, against the preset and the writer's own average (Slice 4B). */
  numbers: LightboxNumbersMeasure;
  /** The chapter's headings, scene breaks or chapter lines, detected by code (Slice 4C). */
  sections: LightboxSectionsMeasure;
  /** Being verbs, adverbs and intensifiers by construction, for craft steering (Slice 4F). */
  steering: LightboxSteeringMeasure;
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

/**
 * The ids of the rules that measured a board (D12 addendum, 2026-10-22): a
 * fresh board carries this build's, a saved board keeps its own, so a
 * comparison across boards can say when a rule, not the text, moved a
 * figure (Slice 5B). Each id is defined beside its rule and pinned to its
 * output by `measurementRuleIds.test.ts`.
 */
export interface LightboxMeasureRules {
  /** The blank-line paragraph splitter (`LIGHTBOX_PARAGRAPH_RULE_ID`). */
  paragraphs: string;
  /** The sentence rule, closing marks and speech tags (`PROSE_SENTENCE_RULE_ID`, ADR 2026-10-21). */
  sentences: string;
  /** The dialogue matcher, double quotation marks (`DIALOGUE_SPANS_RULE_ID`). */
  dialogue: string;
  /** The being-verbs detector, contractions included (`BEING_VERBS_RULE_ID`, epic decision 26). */
  beingVerbs: string;
  /** The Opinion's citation basis, the cited item's data (`LIGHTBOX_OPINION_BASIS_RULE_ID`, epic decision 25). */
  opinionBasis: string;
}

export interface LightboxBoard {
  /** 1 from Slice 5A: the board a saved file holds (D12 addendum). */
  boardVersion: 1;
  /** Host-minted. A rebuild of unchanged text keeps its id. */
  boardId: string;
  /** The rules that measured it: this build's for a board built now, a saved board's own. */
  rules: LightboxMeasureRules;
  source: LightboxSource;
  paragraphs: LightboxParagraphMetric[];
  ribbon: LightboxRibbonColumn[];
  measured: LightboxMeasuredSet;
  /** Groups A–E, G and F, in that order: A–E and G read the chapter, F, last, the board (Slices 4D, 4F). */
  readings: LightboxReadingGroup[];
}

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

/**
 * Why a source was not boarded.
 * - `over-ceiling`: more words than `PROMPT_BUDGETS.lightbox.sourceWords` (D8).
 * - `empty`: the source holds no text.
 * - `unreadable`: the host could not resolve or read it.
 * - `not-refreshable`: there is no file-backed source to re-read.
 */
export type LightboxRefusalReason = 'over-ceiling' | 'empty' | 'unreadable' | 'not-refreshable';

export interface LightboxSourceRefusal {
  /** Host-minted. Names this refusal when the writer dismisses it. */
  id: string;
  reason: LightboxRefusalReason;
  /** Writer-facing sentence. */
  message: string;
  /** The source that was refused, so a refusal shown over an older board names it. */
  displayPath?: string;
  /** The source's word count, for an `over-ceiling` refusal. */
  wordCount?: number;
  ceilingWords?: number;
  /** What to do instead. */
  suggestion?: string;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** Mount and reveal: ask for the host's current outcome (`LIGHTBOX_BOARD`). Zero payload. */
export interface LightboxRequestBoardMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.LIGHTBOX_REQUEST_BOARD;
}

/**
 * Board a source. With `text`, the text is an editor selection; without it,
 * `relativePath` names a workspace file the host reads. The editor commands
 * board this payload through the panel's own handler (the `seedExcerpt`
 * pattern), under a source-request ticket they hold host-side; a ticket is
 * never part of the payload (PR #152 F-01).
 */
export interface LightboxSetSourcePayload {
  text?: string;
  sourceUri?: string;
  relativePath?: string;
  startLine?: number;
  endLine?: number;
}

export interface LightboxSetSourceMessage extends MessageEnvelope<LightboxSetSourcePayload> {
  type: MessageType.LIGHTBOX_SET_SOURCE;
}

/** "Choose file": the host's file picker is the input. Zero payload. */
export interface LightboxPickSourceFileMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.LIGHTBOX_PICK_SOURCE_FILE;
}

/** "Re-read file": board the current file-backed source again. Zero payload. */
export interface LightboxRefreshSourceMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.LIGHTBOX_REFRESH_SOURCE;
}

/**
 * The writer dismissed a refusal. The host forgets it, so a later mount or
 * reveal does not show it again; a newer refusal is unaffected.
 */
export interface LightboxDismissRefusalPayload {
  refusalId: string;
}

export interface LightboxDismissRefusalMessage extends MessageEnvelope<LightboxDismissRefusalPayload> {
  type: MessageType.LIGHTBOX_DISMISS_REFUSAL;
}

/**
 * The host's current outcome: the latest board (`null` when nothing has been
 * boarded this session) and the refusal of a newer source, if the writer has
 * not dismissed it. A refusal leaves the board as it was, so both can be set.
 * Answers every `LIGHTBOX_REQUEST_BOARD`, so a refusal produced before the
 * webview was listening is still shown (PR #148 F-02).
 */
export interface LightboxBoardPayload {
  board: LightboxBoard | null;
  refusal: LightboxSourceRefusal | null;
}

export interface LightboxBoardMessage extends MessageEnvelope<LightboxBoardPayload> {
  type: MessageType.LIGHTBOX_BOARD;
}

/** A source was just refused; the board, if any, stays as it was. */
export interface LightboxSourceRefusedPayload {
  refusal: LightboxSourceRefusal;
}

export interface LightboxSourceRefusedMessage extends MessageEnvelope<LightboxSourceRefusedPayload> {
  type: MessageType.LIGHTBOX_SOURCE_REFUSED;
}
