/** Shared selected-take eligibility used by host validation and webview blockers. */

import type { WorkshopCreativeVariationsDraft } from '@messages';

export type CreativeVariationsSelectionCommitIssueCode =
  | 'selection-not-in-workup'
  | 'hard-conflict-selection'
  | 'unaccepted-advisory-risk';

export interface CreativeVariationsSelectionCommitIssue {
  code: CreativeVariationsSelectionCommitIssueCode;
  message: string;
}

/**
 * Returns writer-actionable selected-take issues in stable priority order.
 * Structural integrity remains a separate host backstop.
 */
export function creativeVariationsSelectionCommitIssues(
  draft: WorkshopCreativeVariationsDraft
): CreativeVariationsSelectionCommitIssue[] {
  const issues: CreativeVariationsSelectionCommitIssue[] = [];
  for (const selection of draft.selections) {
    const card = draft.workup?.cards.find(
      (candidate) => candidate.position === selection.position
    );
    if (!card) {
      issues.push({
        code: 'selection-not-in-workup',
        message: 'A selected take is not part of the settled workup.'
      });
    }
  }
  if (issues.length > 0) {
    return issues;
  }

  for (const selection of draft.selections) {
    const card = draft.workup!.cards.find(
      (candidate) => candidate.position === selection.position
    )!;
    if (card.invariantFlags.some((flag) => flag.kind === 'hard-conflict')) {
      issues.push({
        code: 'hard-conflict-selection',
        message: `Take ${selection.position} has a hard conflict and cannot be committed.`
      });
    }
  }

  for (const selection of draft.selections) {
    const card = draft.workup!.cards.find(
      (candidate) => candidate.position === selection.position
    )!;
    const acceptedIds = new Set(selection.acceptedAdvisoryRiskIds);
    const advisoryIds = card.invariantFlags
      .filter((flag) => flag.kind === 'advisory-risk')
      .map((flag) => flag.id);
    if (
      acceptedIds.size !== selection.acceptedAdvisoryRiskIds.length
      || acceptedIds.size !== advisoryIds.length
      || advisoryIds.some((id) => !acceptedIds.has(id))
    ) {
      issues.push({
        code: 'unaccepted-advisory-risk',
        message: `Accept every advisory risk on Take ${selection.position} before committing.`
      });
    }
  }

  return issues;
}
