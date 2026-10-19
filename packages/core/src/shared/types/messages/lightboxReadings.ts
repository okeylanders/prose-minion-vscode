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

import { MessageEnvelope, MessageType } from './base';
import type { TokenUsage } from './tokenUsage';

// ---------------------------------------------------------------------------
// Groups and lenses (D6)
// ---------------------------------------------------------------------------

export type LightboxReadingGroupId = 'A' | 'B' | 'C';

/**
 * The lenses Slice 2B reads, each in one reading group. A lens the writer
 * turns off is left out of its group's prompt, and a group with no lens on is
 * not called.
 */
export type LightboxLensId = 'headline' | 'motif' | 'tension' | 'characters' | 'voice' | 'genre';

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
 */
export type LightboxQuoteFailure = 'undeclared-paragraph' | 'not-in-paragraph' | 'not-in-chapter' | 'too-short';

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
 * Reading tile kinds (Slice 2B). The reader promise is its own kind because it
 * is its own claim, with its own quotes, and can be withheld on its own; the
 * genre tile draws it below the neighbors.
 */
export type LightboxReadingTileKind =
  | 'headline'
  | 'motif'
  | 'tension-arc'
  | 'character'
  | 'voice'
  | 'genre-neighbor'
  | 'reader-promise';

interface LightboxReadingTileBase {
  /** Host-minted, unique per run, so a pin from an older run never resolves to a newer reading. */
  id: string;
  lens: LightboxLensId;
  title: string;
  claim: string;
  /** Found quotes' paragraphs and counted terms' paragraphs, ascending. Never model-supplied. */
  paragraphs: number[];
  /** At least one; a claim with none is withheld instead. */
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
  /** One read score, 0–9, per ribbon column, in column order. A reading, not a measurement. */
  scores: number[];
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
  /** For a low-affinity neighbor: what matches and what does not. Empty otherwise. */
  nearMiss: string;
}

export interface LightboxReaderPromiseTile extends LightboxReadingTileBase {
  kind: 'reader-promise';
}

export type LightboxReadingTile =
  | LightboxHeadlineTile
  | LightboxMotifTile
  | LightboxTensionArcTile
  | LightboxCharacterTile
  | LightboxVoiceTile
  | LightboxGenreNeighborTile
  | LightboxReaderPromiseTile;

/** A lens block that failed validation, withheld by kind with its reason (D7). */
export interface LightboxWithheldBlock {
  kind: LightboxReadingTileKind;
  lens: LightboxLensId;
  reason: string;
}

/** A lens block's friction, kept apart from its tiles so an empty block still says where it strains. */
export interface LightboxLensFriction {
  lens: LightboxLensId;
  friction: string;
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
  /** Why the latest call failed or stopped (status `failed` or `cancelled`). Writer-facing. */
  error?: string;
}

// ---------------------------------------------------------------------------
// The estimate (D8)
// ---------------------------------------------------------------------------

/** Whether a request fits the model's window: known yes, known no, or unknown (no live catalog). */
export type LightboxFit = 'fits' | 'too-large' | 'unknown';

/** One prospective call: a group with its lenses, or a single-lens re-read. */
export interface LightboxCallEstimate {
  group: LightboxReadingGroupId;
  lenses: LightboxLensId[];
  /** The engine's own estimate of the request (system and user messages). */
  inputTokens: number;
  /** What the reply typically runs to; prices the call. */
  expectedOutputTokens: number;
  /** What the engine reserves for the reply in its fit check (the call's output ceiling). */
  reservedOutputTokens: number;
  fit: LightboxFit;
  /** Absent when the catalog has no live pricing. */
  costUsd?: number;
}

export interface LightboxRunEstimate {
  boardId: string;
  /**
   * The identity of every input this estimate priced: the board and its
   * text, the lenses that are on, the context files, and the assistant model
   * with its window and prices (PR #149 F-02). Host-computed and opaque. A
   * press names the key of the estimate it was shown, and the host runs it
   * only while that key is still the current one, so a press never inherits
   * another model's price or another input's call count.
   */
  key: string;
  /** The assistant model the press would use. */
  model?: string;
  /** The model's live context length; absent when unknown. */
  contextLength?: number;
  /** One per group with a lens on, in group order. */
  groups: LightboxCallEstimate[];
  /** One per lens that is on: what "Re-read this tile" would send. */
  rereads: LightboxCallEstimate[];
  /** The worst fit across `groups`. */
  fit: LightboxFit;
  /** The groups' summed cost; absent when unavailable. */
  costUsd?: number;
  /** The source is over `PROMPT_BUDGETS.lightbox.chapterWords` (a warning, not a refusal). */
  bookSized: boolean;
  sourceWords: number;
  contextWords: number;
  /** When too large: about how many chapter words would fit with these lenses and this context. */
  largestFittingWords?: number;
  /** Writer-facing, when too large. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Context files (D9)
// ---------------------------------------------------------------------------

/** A project file that informs readings. It is never searched for quotes. */
export interface LightboxContextFile {
  /** Host-minted. */
  id: string;
  displayPath: string;
  wordCount: number;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

/**
 * What a press reads: every group with a lens on, only the groups not yet
 * read (after a stop or a failure), or one lens (a tile's "Re-read").
 */
export type LightboxRunScope =
  | { mode: 'all' }
  | { mode: 'rest' }
  | { mode: 'lens'; lens: LightboxLensId };

/**
 * - `started`: the host accepted the press; `token` names the run.
 * - `streaming`: throttled; `outputCharacters` grew.
 * - `finished`: every group settled (ok or failed).
 * - `cancelled`: the writer stopped it; finished groups are kept.
 * - `refused`: nothing was sent; `message` says why.
 */
export type LightboxRunPhase = 'started' | 'streaming' | 'finished' | 'cancelled' | 'refused';

export interface LightboxRunProgress {
  boardId: string;
  /** Host-minted; absent on a refusal. */
  token?: string;
  phase: LightboxRunPhase;
  /** The groups this run calls, in group order. */
  groups: LightboxReadingGroupId[];
  /** The lens of a single-lens re-read. */
  lens?: LightboxLensId;
  groupsBack: number;
  outputCharacters: number;
  /** Writer-facing, for a refusal or a stop. */
  message?: string;
  /**
   * On a refusal: the press named an estimate whose inputs are no longer
   * current (a model, price, lens, context or board change), so the webview
   * asks for a fresh one before the writer presses again.
   */
  reestimate?: true;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** The webview's lens toggles. The host answers with a fresh estimate (also sent after a model change). */
export interface LightboxSetLensesPayload {
  lensesOff: LightboxLensId[];
}

export interface LightboxSetLensesMessage extends MessageEnvelope<LightboxSetLensesPayload> {
  type: MessageType.LIGHTBOX_SET_LENSES;
}

/** The run a board has in flight, so a reloaded or revealed tab can still stop it. */
export interface LightboxActiveRun {
  boardId: string;
  token: string;
  groups: LightboxReadingGroupId[];
  lens?: LightboxLensId;
}

export interface LightboxRunEstimatePayload {
  /** `null` when there is no board to read. */
  estimate: LightboxRunEstimate | null;
  /** The current board's run, while one is active. */
  activeRun?: LightboxActiveRun;
}

export interface LightboxRunEstimateMessage extends MessageEnvelope<LightboxRunEstimatePayload> {
  type: MessageType.LIGHTBOX_RUN_ESTIMATE;
}

export interface LightboxRunPayload {
  boardId: string;
  scope: LightboxRunScope;
  /** `LightboxRunEstimate.key` of the estimate the press was shown. */
  estimateKey: string;
}

export interface LightboxRunMessage extends MessageEnvelope<LightboxRunPayload> {
  type: MessageType.LIGHTBOX_RUN;
}

export interface LightboxCancelRunPayload {
  boardId: string;
  token: string;
}

export interface LightboxCancelRunMessage extends MessageEnvelope<LightboxCancelRunPayload> {
  type: MessageType.LIGHTBOX_CANCEL_RUN;
}

export interface LightboxRunProgressMessage extends MessageEnvelope<LightboxRunProgress> {
  type: MessageType.LIGHTBOX_RUN_PROGRESS;
}

/** One group, as it now stands on the host's board, the moment its call settles. */
export interface LightboxGroupResultPayload {
  boardId: string;
  token: string;
  group: LightboxReadingGroup;
}

export interface LightboxGroupResultMessage extends MessageEnvelope<LightboxGroupResultPayload> {
  type: MessageType.LIGHTBOX_GROUP_RESULT;
}

/** "Add context file": the host's file picker is the input. Zero payload. */
export interface LightboxAddContextFilesMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.LIGHTBOX_ADD_CONTEXT_FILES;
}

export interface LightboxRemoveContextFilePayload {
  id: string;
}

export interface LightboxRemoveContextFileMessage extends MessageEnvelope<LightboxRemoveContextFilePayload> {
  type: MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE;
}

export interface LightboxContextFilesPayload {
  files: LightboxContextFile[];
  totalWords: number;
  /** `PROMPT_BUDGETS.contextFiles.words`. */
  ceilingWords: number;
  /** Writer-facing, when an add was refused. */
  notice?: string;
}

export interface LightboxContextFilesMessage extends MessageEnvelope<LightboxContextFilesPayload> {
  type: MessageType.LIGHTBOX_CONTEXT_FILES;
}
