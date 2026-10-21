/**
 * Lightbox reading contracts (ADR 2026-10-19 D3, D6–D9; Slice 2B).
 *
 * A reading is a model's interpretation, anchored to the chapter. Every claim
 * a tile shows carries quotes the host found in the paragraph the reading
 * named (D7); a quote the host could not find there is withheld with its
 * reason, a claim left with no found quote is withheld by title, and a lens
 * block that broke its rules is withheld by kind while its siblings survive.
 * Counted support (`support`) is computed by the host from the terms a
 * reading names, never taken from the model.
 *
 * Tiles are host-minted: their ids, their paragraphs (found quotes plus the
 * counted terms' paragraphs) and their register (`LIGHTBOX_TILE_REGISTER`)
 * never come from a model.
 */

import type { TokenUsage } from './tokenUsage';
import type { LightboxStaleLens } from './lightboxStale';
import type {
  LightboxLineageSetAside,
  LightboxLineageTile,
  LightboxSparkTile,
  LightboxSubtextTile
} from './lightboxStoryTiles';
import type {
  LightboxAirLockTile,
  LightboxEchoTile,
  LightboxFamiliarPhraseTile,
  LightboxHandoffTile,
  LightboxNumberUsageTile,
  LightboxRhythmEndingsTile,
  LightboxSignatureTile,
  LightboxStockTiersTile
} from './lightboxCraftTiles';
import type {
  LightboxArtifactTile,
  LightboxMovementTile,
  LightboxPressureThreadTile,
  LightboxSynopsisTile,
  LightboxTemplateBeatTile,
  LightboxTemplateTile
} from './lightboxPlotTiles';
import type { LightboxOpinionTile } from './lightboxOpinion';
import type {
  LightboxGravityCollisionTile,
  LightboxGravityFieldTile,
  LightboxGravityLiteralTile,
  LightboxPaletteClusterTile,
  LightboxSwatchTile
} from './lightboxGravity';

// ---------------------------------------------------------------------------
// Groups and lenses (D6)
// ---------------------------------------------------------------------------

/**
 * Groups A–E read the chapter; group F (Slice 4D) reads the board: the
 * Opinion runs after the other groups of a press settle, on the board's
 * verified digest, never on the chapter.
 */
export type LightboxReadingGroupId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * The lenses, each in one reading group: Slice 2B's six, Slice 3's lexical
 * gravity and palette in group A, Slice 4's subtext in group B and
 * lineage and Spark in group C, Slice 4B's craft lenses in group D
 * (stock and signature, rhythm and handoffs, the numbers), and Slice 4C's
 * story lenses in group E (template and freshness, pressure, artifacts,
 * summary and movements), and Slice 4D's Opinion, alone in group F. A lens
 * the writer turns off is left out of its group's prompt, and a group with
 * no lens on is not called.
 */
export type LightboxLensId =
  | 'headline'
  | 'motif'
  | 'tension'
  | 'gravity'
  | 'palette'
  | 'characters'
  | 'voice'
  | 'subtext'
  | 'genre'
  | 'lineage'
  | 'spark'
  | 'stock'
  | 'rhythm'
  | 'numbers'
  | 'template'
  | 'pressure'
  | 'artifacts'
  | 'summary'
  | 'opinion';

// ---------------------------------------------------------------------------
// Evidence (D7)
// ---------------------------------------------------------------------------

/** How a quote was found: verbatim, or after folding typography (NFKC, quotes, dashes, spaces). */
export type LightboxQuoteMatch = 'exact' | 'normalized';

/** A quote the host found in the paragraph the reading named. */
export interface LightboxVerifiedQuote {
  /** 1-based, a declared paragraph. */
  paragraph: number;
  /** The span as it stands in the chapter, not as the model typed it. */
  text: string;
  match: LightboxQuoteMatch;
  /** A tension peak's note; other quotes carry none. */
  note?: string;
}

/**
 * Why a quote was withheld.
 * - `undeclared-paragraph`: the reading named a paragraph the host never sent.
 * - `not-in-paragraph`: the words are in the chapter, but not in the paragraph named.
 * - `not-in-chapter`: the words are nowhere in the chapter (a paraphrase, or context).
 * - `too-short`: too few letters to anchor anything.
 * - `no-longer-in-chapter`: the quote was found when the chapter was read, but
 *   the chapter has changed since and its words are gone (stale readings, D4).
 * - `no-instance`: the words are in the paragraph, but hold no instance of
 *   the measured figure a numbers reading names (Slice 4B), by the detector
 *   that counted it.
 * - `out-of-order`: found, but an object's arc step that stands before the
 *   step it follows (Slice 4C), so the arc would no longer run in order.
 */
export type LightboxQuoteFailure =
  | 'undeclared-paragraph'
  | 'not-in-paragraph'
  | 'not-in-chapter'
  | 'too-short'
  | 'no-longer-in-chapter'
  | 'no-instance'
  | 'out-of-order';

/**
 * A quote the host could not find where the reading said it was. Its text is
 * deliberately not carried: unverified words are never shown as the
 * chapter's.
 */
export interface LightboxWithheldQuote {
  /** The paragraph the reading named (possibly undeclared). */
  paragraph: number;
  reason: LightboxQuoteFailure;
  /** Where the quoted words do stand, for `not-in-paragraph` and `undeclared-paragraph`. */
  foundIn?: number[];
}

/** A term a reading named, counted by the host with the board's tokenizer. */
export interface LightboxCountedSupport {
  term: string;
  /** 0 when the term is not in the chapter, which is itself worth seeing. */
  count: number;
  /** 1-based, ascending. */
  paragraphs: number[];
}

// ---------------------------------------------------------------------------
// Tiles (D3)
// ---------------------------------------------------------------------------

/**
 * Reading tile kinds. Slice 2B: the reader promise is its own kind because it
 * is its own claim, with its own quotes, and can be withheld on its own; the
 * genre tile draws it below the neighbors. Slice 3: a borrowed field, a
 * collision, a literal set-aside, a diction cluster and a swatch
 * (`lightboxGravity.ts`). Slice 4: an adjacent story, a said/meant pair and
 * a spark (`lightboxStoryTiles.ts`). Slice 4B: the craft kinds
 * (`lightboxCraftTiles.ts`). Slice 4C: the story kinds (`lightboxPlotTiles.ts`).
 * Slice 4D: the Opinion (`lightboxOpinion.ts`), the one evaluative tile.
 */
export type LightboxReadingTileKind =
  | 'headline'
  | 'motif'
  | 'tension-arc'
  | 'palette-cluster'
  | 'swatch'
  | 'gravity-field'
  | 'gravity-collision'
  | 'gravity-literal'
  | 'character'
  | 'voice'
  | 'genre-neighbor'
  | 'reader-promise'
  | 'subtext'
  | 'lineage'
  | 'spark'
  | 'stock-tiers'
  | 'signature'
  | 'familiar-phrase'
  | 'air-lock'
  | 'echo'
  | 'rhythm-endings'
  | 'handoff'
  | 'number-usage'
  | 'template'
  | 'template-beat'
  | 'pressure-thread'
  | 'artifact'
  | 'synopsis'
  | 'movement'
  | 'opinion';

export interface LightboxReadingTileBase {
  /** Host-minted, unique per run, so a pin from an older run never resolves to a newer reading. */
  id: string;
  lens: LightboxLensId;
  title: string;
  claim: string;
  /**
   * Found quotes' paragraphs and counted terms' paragraphs, ascending; for a
   * movement, its range, and for a pressure thread, its span (Slice 4C).
   * Never model-supplied.
   */
  paragraphs: number[];
  /**
   * At least one; a claim with none is withheld instead. The Opinion alone
   * may hold none: it cites board items, and its evidence is only the
   * quotes those items hold (Slice 4D).
   */
  evidence: LightboxVerifiedQuote[];
  withheldQuotes: LightboxWithheldQuote[];
  support: LightboxCountedSupport[];
  /** Where this reading strains (required of every lens block). */
  friction: string;
}

export interface LightboxHeadlineTile extends LightboxReadingTileBase {
  kind: 'headline';
}

export interface LightboxMotifTile extends LightboxReadingTileBase {
  kind: 'motif';
  /** One line: how the motif moves. */
  gist: string;
}

export interface LightboxTensionArcTile extends LightboxReadingTileBase {
  kind: 'tension-arc';
  /** One read score, 0–9, per ribbon column; `null` where a carried arc's paragraphs changed (D4; PR #150 F-06). */
  scores: Array<number | null>;
  /** Host-private identity of each column's paragraphs as read, so a carried score follows its text. */
  columnKeys: string[];
}

export interface LightboxCharacterTile extends LightboxReadingTileBase {
  kind: 'character';
  archetype: string;
  energy: string;
  wants: string;
  hides: string;
}

export interface LightboxVoiceTrait {
  label: string;
  value: string;
  /** A host-measured figure shown beside the reading (sentence music only). */
  measured?: string;
}

export interface LightboxVoiceTile extends LightboxReadingTileBase {
  kind: 'voice';
  traits: LightboxVoiceTrait[];
}

export interface LightboxGenreNeighborTile extends LightboxReadingTileBase {
  kind: 'genre-neighbor';
  /** Claimed resemblance, 0–1. A claim, not a score, and drawn even when low. */
  affinity: number;
  /**
   * For a low-affinity neighbor (0.40 or below): what matches and what does
   * not, never blank. Empty for every closer neighbor.
   */
  nearMiss: string;
}

export interface LightboxReaderPromiseTile extends LightboxReadingTileBase {
  kind: 'reader-promise';
}

export type LightboxReadingTile =
  | LightboxHeadlineTile
  | LightboxMotifTile
  | LightboxTensionArcTile
  | LightboxPaletteClusterTile
  | LightboxSwatchTile
  | LightboxGravityFieldTile
  | LightboxGravityCollisionTile
  | LightboxGravityLiteralTile
  | LightboxCharacterTile
  | LightboxVoiceTile
  | LightboxGenreNeighborTile
  | LightboxReaderPromiseTile
  | LightboxSubtextTile
  | LightboxLineageTile
  | LightboxSparkTile
  | LightboxStockTiersTile
  | LightboxSignatureTile
  | LightboxFamiliarPhraseTile
  | LightboxAirLockTile
  | LightboxEchoTile
  | LightboxRhythmEndingsTile
  | LightboxHandoffTile
  | LightboxNumberUsageTile
  | LightboxTemplateTile
  | LightboxTemplateBeatTile
  | LightboxPressureThreadTile
  | LightboxArtifactTile
  | LightboxSynopsisTile
  | LightboxMovementTile
  | LightboxOpinionTile;

/** A lens block that failed validation, withheld by kind with its reason (D7). */
export interface LightboxWithheldBlock {
  kind: LightboxReadingTileKind;
  lens: LightboxLensId;
  reason: string;
}

/**
 * A lens block's own notes, kept apart from its tiles so an empty block still
 * says where it strains: its friction and, for lineage alone, the stories it
 * checked and set aside. They follow the block's lifecycle exactly (replaced
 * with its lens, carried stale with it), which is why they share one record.
 */
export interface LightboxLensFriction {
  lens: LightboxLensId;
  friction: string;
  /** Lineage only: stories the reading considered and set aside, with why. The model's notes, never quoted evidence. */
  setAside?: LightboxLineageSetAside[];
}

/**
 * How many quotes the host checked for one lens's block in the latest call
 * that read it, and how many it withheld (PR #149 F-07). Counted as the
 * checks ran, so a claim withheld for another reason (a motif found in one
 * paragraph only) still counts the quotes that were found.
 */
export interface LightboxLensQuoteChecks {
  lens: LightboxLensId;
  checked: number;
  withheld: number;
}

/** A claim left with no found quote, withheld by title (D7). */
export interface LightboxWithheldClaim {
  kind: LightboxReadingTileKind;
  lens: LightboxLensId;
  title: string;
  reason: string;
  quotes: LightboxWithheldQuote[];
}

// ---------------------------------------------------------------------------
// Groups on the board
// ---------------------------------------------------------------------------

export type LightboxReadingStatus = 'not-run' | 'running' | 'ok' | 'failed' | 'cancelled';

export interface LightboxReadingGroup {
  group: LightboxReadingGroupId;
  status: LightboxReadingStatus;
  /** The lenses the group's readings came from, in rail order. Empty before any call. */
  lenses: LightboxLensId[];
  /**
   * While `running`: the lenses the call in flight reads. A full run reads
   * all of the group's lenses that are on and clears the group first; a
   * tile's re-read reads one lens and leaves the others' tiles in place.
   */
  pending?: LightboxLensId[];
  /** The provider-reported model of the latest call, not the selection. */
  model?: string;
  /** Usage of every call this group has made on this board, summed. */
  usage?: TokenUsage;
  /** Ordered; closed `kind` union. */
  tiles: LightboxReadingTile[];
  withheldBlocks: LightboxWithheldBlock[];
  withheldClaims: LightboxWithheldClaim[];
  /** Every block that decoded, with its friction, in lens order. */
  frictions: LightboxLensFriction[];
  /** Every block that decoded, with the quotes checked for it, in lens order. */
  quoteChecks: LightboxLensQuoteChecks[];
  /** Why the latest call failed or stopped (status `failed` or `cancelled`). Writer-facing. */
  error?: string;
  /** Lenses read against an earlier version of the text; absent when every reading is current. */
  staleLenses?: LightboxStaleLens[];
}
