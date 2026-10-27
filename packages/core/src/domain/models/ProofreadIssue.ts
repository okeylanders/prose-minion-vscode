/**
 * Proofread's vocabulary (ADR 2026-10-21 D6): the closed categories, which
 * of them a fix may correct, and the issue a run shows.
 *
 * Fix vs. flag is decided here, by category, never by the model. Tense,
 * agreement and person are judgment calls (dialogue, free indirect
 * discourse, a deliberate present-tense passage), so they are always
 * flagged. So are the categories Slice 3b added (wrong, missing and extra
 * words), until a recorded fixture run shows how often each is wrong.
 *
 * Host categories are found by host code over the whole document, never by
 * a model: a reply naming one is malformed. They are always flagged.
 */

import type { DraftEditAnchor } from '@/domain/models/DraftEdit';

export const PROOFREAD_CATEGORIES = [
  'spelling',
  'homophone',
  'punctuation',
  'capitalization',
  'spacing',
  'agreement',
  'tense',
  'wrong-word',
  'missing-word',
  'extra-word',
  'person'
] as const;

export type ProofreadCategory = typeof PROOFREAD_CATEGORIES[number];

/** A model's categories: what a reply may name. */
export function isProofreadCategory(value: unknown): value is ProofreadCategory {
  return typeof value === 'string' && (PROOFREAD_CATEGORIES as readonly string[]).includes(value);
}

/**
 * What host code finds over the whole document (Slice 3b): `name`, a rare
 * spelling of a common name (part 2); `quotation`, a double quotation mark
 * its paragraph leaves unpaired or misshapes, and `consistency`, a word the
 * document spells two ways (part 3).
 */
export const PROOFREAD_HOST_CATEGORIES = ['name', 'quotation', 'consistency'] as const;

export type ProofreadHostCategory = typeof PROOFREAD_HOST_CATEGORIES[number];

/** Any issue's category: a model's or the host's. */
export type ProofreadIssueCategory = ProofreadCategory | ProofreadHostCategory;

export type ProofreadDisposition = 'fix' | 'flag';

const FIXABLE_CATEGORIES: ReadonlySet<ProofreadIssueCategory> = new Set([
  'spelling',
  'homophone',
  'punctuation',
  'capitalization',
  'spacing'
]);

/** The most a category allows: a fix for surface errors, a flag for judgment calls. */
export function proofreadCategoryDisposition(category: ProofreadIssueCategory): ProofreadDisposition {
  return FIXABLE_CATEGORIES.has(category) ? 'fix' : 'flag';
}

/** Why a fixable issue is flagged instead. */
export type ProofreadDowngradeReason = 'non-mechanical-edit' | 'no-replacement' | 'markup-change';

/** One issue as a reply reports it: quoted, never located. */
export interface ProofreadFinding {
  readonly anchor: DraftEditAnchor;
  readonly category: ProofreadCategory;
  readonly replacement?: string;
  readonly explanation: string;
}

/** One issue placed in the document: host-derived offsets and a host-decided disposition. */
export interface ProofreadIssue {
  readonly id: string;
  readonly category: ProofreadIssueCategory;
  readonly disposition: ProofreadDisposition;
  readonly start: number;
  readonly end: number;
  /** The exact text at `start..end` when the issue was placed. */
  readonly original: string;
  readonly replacement?: string;
  readonly explanation: string;
  readonly downgradeReason?: ProofreadDowngradeReason;
}
