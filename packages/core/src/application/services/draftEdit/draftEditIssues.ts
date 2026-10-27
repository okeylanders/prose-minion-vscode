/**
 * Proofread issues as a run moves and shows them (ADR 2026-10-21 D3, D7):
 * through the document's changes, around its protected regions, into
 * annotations, and into the edits Fix and the quick fixes ask for. Pure.
 */

import type { DocumentAnnotation, DocumentTextChange } from '@/platform';
import type { DraftEditDropCounts, TextRange } from '@/domain/models/DraftEdit';
import { proofreadCategoryDisposition, type ProofreadIssue } from '@/domain/models/ProofreadIssue';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import { shiftRanges } from '@/utils/draftEdit/shiftRanges';
import type { DraftEditEdit } from '@/application/services/draftEdit/DraftEditApplier';

export type DraftEditDrops = { -readonly [K in keyof DraftEditDropCounts]: number };

export function noDrops(): DraftEditDrops {
  return { unanchored: 0, protected: 0, overlapping: 0, stale: 0, malformed: 0, accepted: 0 };
}

/** What any pass's placed issue holds that moving and protecting it reads (Proofread's, and Craft Flags' since Slice 3c). */
export interface PlacedText {
  readonly start: number;
  readonly end: number;
  /** The exact text at `start..end` when the issue was placed. */
  readonly original: string;
  /** Other places the issue is about (a continuity pair's earlier side, Slice 3c part 4), each held to its own text. */
  readonly related?: readonly PlacedRange[];
}

/** A placed range and the exact text at it when it was placed. */
export interface PlacedRange {
  readonly start: number;
  readonly end: number;
  readonly original: string;
}

/**
 * Issues moved through a document's change events, in order. An issue a
 * change touched, or whose text is no longer its original, is left out: it
 * follows its own occurrence, and is never searched for again (PR #171 F-03).
 * Its related ranges are held to the same rule.
 */
export function moveIssues<T extends PlacedText>(
  issues: readonly T[],
  events: ReadonlyArray<readonly DocumentTextChange[]>,
  liveText: string
): T[] {
  return events
    .reduce<T[]>((current, changes) => shiftRanges(current, changes), [...issues])
    .filter((issue) => placesOf(issue).every((place) => liveText.slice(place.start, place.end) === place.original));
}

/** Issues outside the live text's protected regions (found here unless the caller already has them), on every side; the rest are counted as protected. */
export function outsideProtected<T extends PlacedText>(
  issues: readonly T[],
  liveText: string,
  languageId: string,
  dropped: { protected: number },
  regions: readonly TextRange[] = findProtectedRegions(liveText, languageId)
): T[] {
  const kept = issues.filter((issue) =>
    !placesOf(issue).some((place) => regions.some((range) => range.start < place.end && place.start < range.end)));
  dropped.protected += issues.length - kept.length;
  return kept;
}

/** An issue's own place, then its related ones. */
export function placesOf(issue: PlacedText): readonly PlacedRange[] {
  return issue.related ? [issue, ...issue.related] : [issue];
}

export function byPlace(a: PlacedText, b: PlacedText): number {
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
