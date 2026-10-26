/**
 * Proofread's vocabulary (ADR 2026-10-21 D6): the closed categories, which
 * of them a fix may correct, and the issue a run shows.
 *
 * Fix vs. flag is decided here, by category, never by the model. Tense,
 * agreement and person are judgment calls (dialogue, free indirect
 * discourse, a deliberate present-tense passage), so they are always
 * flagged. So are the categories Slice 3b added (wrong, missing and extra
 * words), until a recorded fixture run shows how often each is wrong.
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

export function isProofreadCategory(value: unknown): value is ProofreadCategory {
  return typeof value === 'string' && (PROOFREAD_CATEGORIES as readonly string[]).includes(value);
}

export type ProofreadDisposition = 'fix' | 'flag';

const FIXABLE_CATEGORIES: ReadonlySet<ProofreadCategory> = new Set([
  'spelling',
  'homophone',
  'punctuation',
  'capitalization',
  'spacing'
]);

/** The most a category allows: a fix for surface errors, a flag for judgment calls. */
export function proofreadCategoryDisposition(category: ProofreadCategory): ProofreadDisposition {
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
  readonly category: ProofreadCategory;
  readonly disposition: ProofreadDisposition;
  readonly start: number;
  readonly end: number;
  /** The exact text at `start..end` when the issue was placed. */
  readonly original: string;
  readonly replacement?: string;
  readonly explanation: string;
  readonly downgradeReason?: ProofreadDowngradeReason;
}
