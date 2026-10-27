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

/** Cliché (part 1) and register shift (part 2). Gesture strain and continuity join in later parts. */
export const CRAFT_FLAG_CATEGORIES = ['cliche', 'register'] as const;

export type CraftFlagCategory = typeof CRAFT_FLAG_CATEGORIES[number];

export function isCraftFlagCategory(value: unknown): value is CraftFlagCategory {
  return typeof value === 'string' && (CRAFT_FLAG_CATEGORIES as readonly string[]).includes(value);
}

/**
 * The categories a run asks about, from `proseMinion.craftFlags.categories`
 * as the writer set it: known ids, each once, in the canonical order;
 * anything else is ignored. Empty when none is on.
 */
export function craftFlagCategoriesOf(value: unknown): CraftFlagCategory[] {
  const named = Array.isArray(value) ? value : [];
  return CRAFT_FLAG_CATEGORIES.filter((category) => named.includes(category));
}

/**
 * Register shift's kinds (Slice 3c part 2): what the words bring into
 * narration that keeps another register. No other surface names them.
 */
export const REGISTER_SHIFT_KINDS = ['period', 'slang', 'jargon', 'ornate'] as const;

export type RegisterShiftKind = typeof REGISTER_SHIFT_KINDS[number];

/** What each kind is, in the words the register prompt uses. */
export const REGISTER_SHIFT_DEFINITIONS: Readonly<Record<RegisterShiftKind, string>> = {
  period: 'a word or phrase from outside the period the narration sets',
  slang: 'casual or slang wording in narration that keeps a plainer or more formal register',
  jargon: 'technical, legal, clinical or corporate wording in narration that keeps none',
  ornate: 'a sudden heightened, ornate passage in narration that keeps a plain register'
};

/**
 * The kinds each category's flags carry. A cliché is `cliche` or `weighted`,
 * from the vocabulary the Lightbox shares (`FAMILIAR_PHRASE_KINDS`); an
 * `idiom` or a `stock` phrase is familiar, not a fault, and never flagged. A
 * register shift is one of `REGISTER_SHIFT_KINDS`.
 */
export const CRAFT_FLAG_KINDS = {
  cliche: ['cliche', 'weighted'],
  register: REGISTER_SHIFT_KINDS
} as const satisfies Readonly<Record<CraftFlagCategory, readonly (FamiliarPhraseKind | RegisterShiftKind)[]>>;

export type CraftFlagKind = typeof CRAFT_FLAG_KINDS[CraftFlagCategory][number];

export function isCraftFlagKind(category: CraftFlagCategory, value: unknown): value is CraftFlagKind {
  return typeof value === 'string' && (CRAFT_FLAG_KINDS[category] as readonly string[]).includes(value);
}

/**
 * Whether a category leaves speech alone. Both do: a character's idiom, and
 * their register, are their voice (the Lightbox's rule, epic decision 26).
 * Host code drops such a flag where it touches speech, whatever the reply
 * says.
 */
export const CRAFT_FLAG_LEAVES_SPEECH: Readonly<Record<CraftFlagCategory, boolean>> = {
  cliche: true,
  register: true
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
  /**
   * A register shift's ground: the register the reply says the narration
   * keeps (its root's `register` line); absent for other categories, and when
   * the fence withheld the line.
   */
  readonly register?: string;
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
  /** A register shift's ground, as its finding carried it. */
  readonly register?: string;
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
