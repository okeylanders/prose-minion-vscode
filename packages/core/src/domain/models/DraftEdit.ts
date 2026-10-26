/**
 * Draft Edit — the engine that turns intent into anchored, reviewable edits
 * on the writer's document (ADR 2026-10-21).
 *
 * Behaviors are passes, and passes are policies (D1): a new pass adds a
 * union member, a row in `DRAFT_EDIT_PASS_POLICIES`, and a producer, never
 * a branch in the code that places or applies edits. Only a pass may call a
 * model; target resolution and edit placement are deterministic.
 *
 * The Proofread pass flags (Slice 1) or fixes (Slice 2). Fix writes only
 * through `DraftEditApplier`, the one door to the writer's document (D4).
 */

import type { ModelScope, TokenUsage } from '@messages';

/** How a fix reaches the document: through the writer's review, or at once. */
export type DraftEditReview = 'preview' | 'direct';

/**
 * The spelling a Proofread run holds the text to (Slice 3). A run naming
 * none leaves the writer's choice open: a spelling correct in any of these
 * is not an error unless the text mixes them.
 */
export const PROOFREAD_SPELLING_CONVENTIONS = ['american', 'british', 'canadian', 'australian'] as const;

export type ProofreadSpellingConvention = typeof PROOFREAD_SPELLING_CONVENTIONS[number];

export function isProofreadSpellingConvention(value: unknown): value is ProofreadSpellingConvention {
  return typeof value === 'string' && (PROOFREAD_SPELLING_CONVENTIONS as readonly string[]).includes(value);
}

/**
 * What a run produces: flags only, or the safe fixes applied and the rest
 * flagged; held to the writer's spelling convention when one is named.
 */
export type DraftEditPass =
  | { readonly kind: 'proofread'; readonly output: 'flag'; readonly spelling?: ProofreadSpellingConvention }
  | { readonly kind: 'proofread'; readonly output: 'fix'; readonly review: DraftEditReview; readonly spelling?: ProofreadSpellingConvention };

export type DraftEditPassKind = DraftEditPass['kind'];

/** What every pass shares, looked up by kind. */
export interface DraftEditPassPolicy {
  /** The engine the pass's model calls run on. */
  readonly modelScope: ModelScope;
  /** Whether a fix may add, remove or move a line break (Proofread: never, D6). */
  readonly allowsNewlineChanges: boolean;
  /** Whether fixes must leave the document's Markdown structure as it was (Proofread: always, PR #172 F-03). */
  readonly preservesMarkdownStructure: boolean;
}

export const DRAFT_EDIT_PASS_POLICIES: Readonly<Record<DraftEditPassKind, DraftEditPassPolicy>> = {
  proofread: { modelScope: 'proofread', allowsNewlineChanges: false, preservesMarkdownStructure: true }
};

/** A half-open span of UTF-16 code units: `start` included, `end` excluded. */
export interface TextRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Where a pass means an edit to land: the exact text, with optional context
 * either side to choose among repeats. A model never reports offsets; the
 * host finds the quote (D2).
 */
export interface DraftEditAnchor {
  readonly quote: string;
  readonly before?: string;
  readonly after?: string;
}

/**
 * The document a run reads, captured at the writer's gesture (D5): the live
 * buffer's text and version, and the selection when there is one.
 */
export interface DraftEditTarget {
  readonly uri: string;
  readonly version: number;
  readonly text: string;
  readonly languageId: string;
  readonly relativePath?: string;
  /** The selection, in `text` offsets; absent when the whole document is the target. */
  readonly range?: TextRange;
}

/** Why findings were not shown, each counted, never guessed (D2, D4). */
export interface DraftEditDropCounts {
  /** The quote was not found, or was found more than once. */
  readonly unanchored: number;
  /** The quote touched front matter, code, a link target, or markup, as sent or as the live text now stands. */
  readonly protected: number;
  /** The quote overlapped one already placed. */
  readonly overlapping: number;
  /** The writer edited the quoted text while the run was in flight. */
  readonly stale: number;
  /** The reply's issue was malformed: a missing field or an unknown category. */
  readonly malformed: number;
}

/** Chunks whose reply could not be read: those whose capture for recovery was saved, and those whose save failed (PR #171 F-06). */
export interface DraftEditRejectedChunks {
  readonly saved: number;
  readonly unsaved: number;
}

/**
 * What became of a Fix run's fixes. The fixes it did not apply (unticked,
 * discarded, refused) are flagged instead, and counted in `flagged` too.
 */
export interface DraftEditFixReport {
  readonly review: DraftEditReview;
  /** What the editor answered; `none` when there was no fix to offer. */
  readonly answer: 'submitted' | 'declined' | 'stale' | 'failed' | 'none';
  readonly applied: number;
  /** Fixes still standing as they were, now flagged. */
  readonly notApplied: number;
  /** Fixes whose text the writer changed during review: left as they wrote it. */
  readonly unknown: number;
  /** The editor's reason, when it refused the change. */
  readonly failure?: string;
}

/** What a run did, for the host to present (the adapter's summary, a Workshop result). */
export type DraftEditOutcome =
  | { readonly kind: 'empty' }
  | { readonly kind: 'unconfigured' }
  | { readonly kind: 'busy' }
  /** The document was no longer open at the version the gesture read, so nothing was sent. */
  | { readonly kind: 'changed' }
  | { readonly kind: 'cancelled'; readonly usage?: TokenUsage }
  /** The document closed while the model worked, so nothing was shown (PR #171 F-04). */
  | { readonly kind: 'closed'; readonly rejectedChunks: DraftEditRejectedChunks; readonly usage?: TokenUsage }
  | {
      readonly kind: 'completed';
      /** Issues shown. */
      readonly flagged: number;
      /** Of those, the flag-only ones Fix never makes (tense, agreement, person; wrong, missing and extra words). */
      readonly judgmentCalls: number;
      readonly dropped: DraftEditDropCounts;
      readonly rejectedChunks: DraftEditRejectedChunks;
      /** Chunks requested, and chunks answered (read or rejected). */
      readonly chunks: { readonly total: number; readonly completed: number };
      /** A selection run's earlier flags outside the selection, still shown; absent when none were kept. */
      readonly kept?: number;
      /** Why later chunks were never sent: the API key changed mid-run, or the provider refused. */
      readonly interrupted?: { readonly cause: 'key-changed' | 'provider'; readonly message: string };
      /** A Fix run's fixes; absent for Flag. */
      readonly fix?: DraftEditFixReport;
      readonly usage?: TokenUsage;
    };

/** The languages Draft Edit reads (and the editor menus offer it for). */
export const DRAFT_EDIT_LANGUAGE_IDS: readonly string[] = ['markdown', 'plaintext'];
