/**
 * Craft Flags' vocabulary (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c):
 * the line notes a line editor leaves in a fiction draft, as flags with a
 * recommendation.
 *
 * Nothing here can change the writer's text. A Craft Flags issue has no
 * replacement field, so no annotation made from one carries a quick fix,
 * and the pass's run takes no applier. A category's kinds are decided here,
 * never by the model: a reply naming another is malformed.
 */

import type { TokenUsage } from '@messages';
import type { DraftEditAnchor, DraftEditRejectedChunks } from '@/domain/models/DraftEdit';
import type { FamiliarPhraseKind } from '@shared/constants/familiarPhrasing';

/** Part 1: cliché. Register shift, gesture strain and continuity join in later parts. */
export const CRAFT_FLAG_CATEGORIES = ['cliche'] as const;

export type CraftFlagCategory = typeof CRAFT_FLAG_CATEGORIES[number];

export function isCraftFlagCategory(value: unknown): value is CraftFlagCategory {
  return typeof value === 'string' && (CRAFT_FLAG_CATEGORIES as readonly string[]).includes(value);
}

/**
 * The kinds each category's flags carry. A cliché is `cliche` or `weighted`,
 * from the vocabulary the Lightbox shares (`FAMILIAR_PHRASE_KINDS`); an
 * `idiom` or a `stock` phrase is familiar, not a fault, and never flagged.
 */
export const CRAFT_FLAG_KINDS = {
  cliche: ['cliche', 'weighted']
} as const satisfies Readonly<Record<CraftFlagCategory, readonly FamiliarPhraseKind[]>>;

export type CraftFlagKind = typeof CRAFT_FLAG_KINDS[CraftFlagCategory][number];

export function isCraftFlagKind(category: CraftFlagCategory, value: unknown): value is CraftFlagKind {
  return typeof value === 'string' && (CRAFT_FLAG_KINDS[category] as readonly string[]).includes(value);
}

/**
 * Whether a category leaves speech alone: cliché does, since a character's
 * idiom is their voice (the Lightbox's rule, epic decision 26). Host code
 * drops such a flag where it touches speech, whatever the reply says.
 */
export const CRAFT_FLAG_LEAVES_SPEECH: Readonly<Record<CraftFlagCategory, boolean>> = {
  cliche: true
};

/** What a Craft Flags run reads: the categories it asks about, each in a call of its own. */
export interface CraftFlagsPass {
  readonly kind: 'craft';
  /** Never empty; each category at most once. */
  readonly categories: readonly CraftFlagCategory[];
}

/** One flag as a reply reports it: quoted, never located. */
export interface CraftFlagFinding {
  readonly anchor: DraftEditAnchor;
  readonly category: CraftFlagCategory;
  readonly kind: CraftFlagKind;
  /** What the phrase stands in for here; held to the phrasing fence. */
  readonly why: string;
  /** One way this scene could say it; absent when the reply gave none or the fence withheld it. */
  readonly suggestion?: string;
}

/** One flag placed in the document, with host-derived offsets and the host's repeat count. */
export interface CraftFlagIssue {
  readonly id: string;
  readonly category: CraftFlagCategory;
  readonly kind: CraftFlagKind;
  readonly start: number;
  readonly end: number;
  /** The exact text at `start..end` when the flag was placed. */
  readonly original: string;
  readonly why: string;
  readonly suggestion?: string;
  /**
   * How often the phrase stands in the live document's narration, this use
   * included, counted once the run has settled (PR #177 N-01); absent when it
   * was not counted (`PHRASE_REPEATS`' bound).
   */
  readonly repeats?: number;
}

/** Why flags were not shown, each counted, never guessed. */
export interface CraftFlagsDropCounts {
  /** The quote was not found, or was found more than once. */
  readonly unanchored: number;
  /** The quote touched front matter, code, a link target or markup, as sent or as the live text now stands. */
  readonly protected: number;
  /** The quote touched speech, in a category that leaves a character's words alone. */
  readonly dialogue: number;
  /** The quote overlapped an earlier flag of its category. */
  readonly overlapping: number;
  /** The writer edited the flagged text while the run was in flight. */
  readonly stale: number;
  /** The reply's flag was malformed: a missing field, or a kind outside its category's. */
  readonly malformed: number;
}

/** What a Craft Flags run did, for the host to present. */
export type CraftFlagsOutcome =
  | { readonly kind: 'empty' }
  /** Over the word ceiling, with no selection small enough to read alone; nothing was sent. */
  | { readonly kind: 'too-long'; readonly words: number; readonly limit: number }
  | { readonly kind: 'unconfigured' }
  | { readonly kind: 'busy' }
  /** The document was no longer open at the version the gesture read, so nothing was sent. */
  | { readonly kind: 'changed' }
  | { readonly kind: 'cancelled'; readonly usage?: TokenUsage }
  /** The document closed while the model worked, so nothing was shown. */
  | { readonly kind: 'closed'; readonly rejectedCalls: DraftEditRejectedChunks; readonly usage?: TokenUsage }
  | {
      readonly kind: 'completed';
      /** Flags shown. */
      readonly flagged: number;
      /** What the calls read: the whole document, or (over the word ceiling) the selection alone. */
      readonly reads: 'document' | 'selection';
      readonly dropped: CraftFlagsDropCounts;
      /** Flags in the replies whose why or suggestion the phrasing fence held back. */
      readonly notesWithheld: number;
      readonly rejectedCalls: DraftEditRejectedChunks;
      /** Calls requested (one per category), and calls answered (read or rejected). */
      readonly calls: { readonly total: number; readonly completed: number };
      /** A selection run's earlier flags outside the selection, still shown; absent when none were kept. */
      readonly kept?: number;
      /** Why later calls were never sent: the API key changed mid-run, or the provider refused. */
      readonly interrupted?: { readonly cause: 'key-changed' | 'provider'; readonly message: string };
      readonly usage?: TokenUsage;
    };
