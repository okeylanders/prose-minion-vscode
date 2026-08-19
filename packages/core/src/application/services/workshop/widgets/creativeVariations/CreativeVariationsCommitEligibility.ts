/** Shared selected-take eligibility used by host validation and webview blockers. */

import type { WorkshopCreativeVariationsDraft } from '@messages';

export type CreativeVariationsSelectionCommitIssueCode =
  'selection-not-in-workup';

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

  return issues;
}
