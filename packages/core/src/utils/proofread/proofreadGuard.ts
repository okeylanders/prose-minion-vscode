/**
 * The Proofread guard (ADR 2026-10-21 D6): host code, not the model, decides
 * whether a finding may be fixed or only flagged.
 *
 * - Tense and agreement are flag-only, whatever the reply says.
 * - A fixable finding stays a fix only when the edit is small:
 *   - spelling and homophone edits stay within a bounded edit distance;
 *   - punctuation, spacing, and capitalization edits change nothing but
 *     punctuation, whitespace, or case.
 *   Anything larger is downgraded to a flag, so the model cannot slip a
 *   stylistic rewrite in as a "correction".
 * - A fix never adds, removes or moves a line break, unless the pass allows
 *   it (`changesLineBreaks`: counting them is not enough).
 * - A fix never adds or removes a character that makes Markdown: a backtick
 *   would turn prose into code, a pipe would split a table cell, `<` would
 *   open a tag. Letters unchanged is not enough once Fix writes (Slice 2).
 */

import type { DraftEditPassPolicy } from '@/domain/models/DraftEdit';
import { changesLineBreaks } from '@/utils/draftEdit/lineBreaks';
import {
  proofreadCategoryDisposition,
  type ProofreadCategory,
  type ProofreadDisposition,
  type ProofreadDowngradeReason
} from '@/domain/models/ProofreadIssue';

/** Starting thresholds (the ADR's Thresholds table): a spelling fix may change max(2, 30% of the quote's length) characters. */
export const PROOFREAD_GUARD = Object.freeze({
  minimumEditDistance: 2,
  editDistanceShare: 0.3
});

export type ProofreadVerdict =
  | { readonly kind: 'keep'; readonly disposition: ProofreadDisposition; readonly downgradeReason?: ProofreadDowngradeReason }
  /** The replacement is the original: nothing to say. */
  | { readonly kind: 'drop' };

export function judgeProofreadFinding(
  finding: { readonly category: ProofreadCategory; readonly original: string; readonly replacement?: string },
  policy: Pick<DraftEditPassPolicy, 'allowsNewlineChanges'>
): ProofreadVerdict {
  const { category, original, replacement } = finding;
  if (replacement !== undefined && replacement === original) {
    return { kind: 'drop' };
  }
  if (proofreadCategoryDisposition(category) === 'flag') {
    return { kind: 'keep', disposition: 'flag' };
  }
  if (replacement === undefined) {
    return { kind: 'keep', disposition: 'flag', downgradeReason: 'no-replacement' };
  }
  if (changesMarkup(original, replacement)) {
    return { kind: 'keep', disposition: 'flag', downgradeReason: 'markup-change' };
  }
  const small = (policy.allowsNewlineChanges || !changesLineBreaks(original, replacement))
    && isMechanicalEdit(category, original, replacement);
  return small
    ? { kind: 'keep', disposition: 'fix' }
    : { kind: 'keep', disposition: 'flag', downgradeReason: 'non-mechanical-edit' };
}

/** Characters that make Markdown structure: code, tags, tables, emphasis, links, headings, escapes. */
const MARKUP_CHARACTERS = ['`', '<', '>', '|', '*', '_', '~', '[', ']', '#', '\\'] as const;

function changesMarkup(original: string, replacement: string): boolean {
  const count = (text: string, char: string) => text.split(char).length - 1;
  return MARKUP_CHARACTERS.some((char) => count(original, char) !== count(replacement, char));
}

function isMechanicalEdit(category: ProofreadCategory, original: string, replacement: string): boolean {
  switch (category) {
    case 'spelling':
    case 'homophone':
      return collapseRepeatedWords(original) === replacement
        || editDistance(original, replacement) <= Math.max(
          PROOFREAD_GUARD.minimumEditDistance,
          Math.floor(PROOFREAD_GUARD.editDistanceShare * original.length)
        );
    case 'punctuation':
    case 'spacing':
    case 'capitalization':
      return lettersAndDigits(original) === lettersAndDigits(replacement);
    case 'agreement':
    case 'tense':
      return false;
    default: {
      const unknown: never = category;
      return unknown;
    }
  }
}

/** A doubled word ("the the") collapsed to one: a typo fix, however many characters it removes. */
const REPEATED_WORD = /(?<![\p{L}\p{N}])([\p{L}\p{N}’']+)(?:[ \t]+\1)+(?![\p{L}\p{N}])/giu;

function collapseRepeatedWords(text: string): string {
  return text.replace(REPEATED_WORD, '$1');
}

/** The text's letters and digits, case-folded: what punctuation, spacing, and case edits must leave alone. */
function lettersAndDigits(text: string): string {
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).join('').toLocaleLowerCase();
}

/** Levenshtein distance over UTF-16 code units; quotes are short (clipped by the codec). */
export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, substitution));
    }
    previous = current;
  }
  return previous[b.length];
}
