/**
 * Proofread issues as a run moves and shows them (ADR 2026-10-21 D3, D7):
 * through the document's changes, around its protected regions, into
 * annotations, and into the edits Fix and the quick fixes ask for. Pure.
 */

import type { DocumentAnnotation, DocumentTextChange } from '@/platform';
import type { DraftEditDropCounts } from '@/domain/models/DraftEdit';
import { proofreadCategoryDisposition, type ProofreadIssue } from '@/domain/models/ProofreadIssue';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import { shiftRanges } from '@/utils/draftEdit/shiftRanges';
import type { DraftEditEdit } from '@/application/services/draftEdit/DraftEditApplier';

export type DraftEditDrops = { -readonly [K in keyof DraftEditDropCounts]: number };

export function noDrops(): DraftEditDrops {
  return { unanchored: 0, protected: 0, overlapping: 0, stale: 0, malformed: 0 };
}

/**
 * Issues moved through a document's change events, in order. An issue a
 * change touched, or whose text is no longer its original, is left out: it
 * follows its own occurrence, and is never searched for again (PR #171 F-03).
 */
export function moveIssues(
  issues: readonly ProofreadIssue[],
  events: ReadonlyArray<readonly DocumentTextChange[]>,
  liveText: string
): ProofreadIssue[] {
  return events
    .reduce<ProofreadIssue[]>((current, changes) => shiftRanges(current, changes), [...issues])
    .filter((issue) => liveText.slice(issue.start, issue.end) === issue.original);
}

/** Issues outside the live text's protected regions; the rest are counted as protected. */
export function outsideProtected(
  issues: readonly ProofreadIssue[],
  liveText: string,
  languageId: string,
  dropped: DraftEditDrops
): ProofreadIssue[] {
  const regions = findProtectedRegions(liveText, languageId);
  const kept = issues.filter((issue) => !regions.some((range) => range.start < issue.end && issue.start < range.end));
  dropped.protected += issues.length - kept.length;
  return kept;
}

export function byPlace(a: ProofreadIssue, b: ProofreadIssue): number {
  return a.start - b.start || a.end - b.end;
}

export function toAnnotation(issue: ProofreadIssue): DocumentAnnotation {
  return {
    id: issue.id,
    start: issue.start,
    end: issue.end,
    // Severity follows the category: a downgraded spelling fix is still a surface error.
    severity: proofreadCategoryDisposition(issue.category) === 'fix' ? 'info' : 'warning',
    code: `proofread.${issue.category}`,
    message: `${issue.explanation}${suggestionOf(issue)}`,
    ...(issue.replacement !== undefined
      // Only a fix Proofread would make itself is the preferred quick fix; a judgment call's suggestion is the writer's to choose.
      ? { fix: { replacement: issue.replacement, preferred: issue.disposition === 'fix' } }
      : {})
  };
}

/** The edit an issue's replacement asks for, at `start..end` in the document it is applied to. */
export function toEdit(issue: ProofreadIssue & { readonly replacement: string }, start = issue.start, end = issue.end): DraftEditEdit {
  return {
    id: issue.id,
    start,
    end,
    original: issue.original,
    replacement: issue.replacement,
    label: `Proofread: ${issue.category}`,
    description: issue.explanation
  };
}

export function hasReplacement(issue: ProofreadIssue): issue is ProofreadIssue & { readonly replacement: string } {
  return issue.replacement !== undefined;
}

function suggestionOf(issue: ProofreadIssue): string {
  if (issue.replacement === undefined) {
    return '';
  }
  return issue.replacement.length === 0 ? ' Suggested: delete it.' : ` Suggested: “${issue.replacement}”.`;
}
