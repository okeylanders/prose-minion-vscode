/**
 * Draft Edit — the engine that turns intent into anchored, reviewable edits
 * on the writer's document (ADR 2026-10-21).
 *
 * Behaviors are passes, and passes are policies (D1): a new pass adds a
 * union member, a row in `DRAFT_EDIT_PASS_POLICIES`, and a producer, never
 * a branch in the code that places or applies edits. Only a pass may call a
 * model; target resolution and edit placement are deterministic.
 *
 * Slice 1 ships the Proofread pass in flag mode only: nothing writes yet.
 */

import type { ModelScope, TokenUsage } from '@messages';

/** What a run produces. Slice 1: Proofread, flagging only. */
export type DraftEditPass = { readonly kind: 'proofread'; readonly output: 'flag' };

export type DraftEditPassKind = DraftEditPass['kind'];

/** What every pass shares, looked up by kind. */
export interface DraftEditPassPolicy {
  /** The engine the pass's model calls run on. */
  readonly modelScope: ModelScope;
  /** Whether a fix may add or remove a line break (Proofread: never, D6). */
  readonly allowsNewlineChanges: boolean;
}

export const DRAFT_EDIT_PASS_POLICIES: Readonly<Record<DraftEditPassKind, DraftEditPassPolicy>> = {
  proofread: { modelScope: 'proofread', allowsNewlineChanges: false }
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
      /** Of those, the judgment calls (tense, agreement). */
      readonly judgmentCalls: number;
      readonly dropped: DraftEditDropCounts;
      readonly rejectedChunks: DraftEditRejectedChunks;
      /** Chunks requested, and chunks answered (read or rejected). */
      readonly chunks: { readonly total: number; readonly completed: number };
      /** Why later chunks were never sent: the API key changed mid-run, or the provider refused. */
      readonly interrupted?: { readonly cause: 'key-changed' | 'provider'; readonly message: string };
      readonly usage?: TokenUsage;
    };

/** The languages Draft Edit reads (and the editor menus offer it for). */
export const DRAFT_EDIT_LANGUAGE_IDS: readonly string[] = ['markdown', 'plaintext'];
