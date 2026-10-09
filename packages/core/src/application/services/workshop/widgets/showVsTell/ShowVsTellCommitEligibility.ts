/**
 * Show vs. Tell commit gates shared by the webview's blockers and the host's
 * validation (Sprint 05, Slice 4).
 *
 * One list, one order, one ceiling: the sheet disables Commit from exactly the
 * issues the host would reject on, and the 600-character check measures the
 * body with the same projection the payload meter uses. Invariant flags are
 * passive, so they appear nowhere here: they never change eligibility or the
 * counted length. Pure and webview-safe (no codec, integrity, or workup-id).
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  buildShowVsTellArtifact,
  type ShowVsTellArtifactSource
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact';
import {
  showVsTellWorkupVariants
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';

export type ShowVsTellCommitIssueCode =
  | 'no-workup'
  | 'no-keep'
  | 'kept-not-in-workup'
  | 'kept-out-of-order'
  | 'kept-duplicated'
  | 'artifact-compilation-failed'
  | 'over-artifact-budget';

export interface ShowVsTellCommitIssue {
  code: ShowVsTellCommitIssueCode;
  message: string;
}

/** The authored fields the gates read; a draft satisfies it structurally. */
export type ShowVsTellCommitSource = ShowVsTellArtifactSource;

export function showVsTellArtifactOverBudgetMessage(): string {
  const budget = PROMPT_BUDGETS.workshopWidgets.showVsTellArtifactCharacters;
  return `The commit payload is over its ${budget.toLocaleString()}-character ceiling — `
    + 'switch variants to direction only, keep fewer, or shorten the note.';
}

/**
 * Writer-actionable commit issues in stable priority order. Structural
 * integrity stays a separate host backstop; the host also runs it.
 */
export function showVsTellCommitIssues(
  draft: ShowVsTellCommitSource
): ShowVsTellCommitIssue[] {
  if (!draft.workup) {
    return [{ code: 'no-workup', message: 'Generate a settled workup before committing.' }];
  }
  if (draft.kept.length === 0) {
    return [{ code: 'no-keep', message: 'Keep at least one variant before committing.' }];
  }

  const ordinals = new Map(
    showVsTellWorkupVariants(draft.workup).map((variant, index) => [variant.id, index])
  );
  const issues: ShowVsTellCommitIssue[] = [];
  const seen = new Set<string>();
  let previous = -1;
  let outOfOrder = false;
  let duplicated = false;
  let missing = false;
  for (const kept of draft.kept) {
    const ordinal = ordinals.get(kept.variantId);
    if (ordinal === undefined) {
      missing = true;
      continue;
    }
    if (seen.has(kept.variantId)) {
      duplicated = true;
    } else if (ordinal < previous) {
      outOfOrder = true;
    }
    seen.add(kept.variantId);
    previous = Math.max(previous, ordinal);
  }
  if (missing) {
    issues.push({
      code: 'kept-not-in-workup',
      message: 'A kept variant is not part of the settled workup.'
    });
  }
  if (duplicated) {
    issues.push({
      code: 'kept-duplicated',
      message: 'A variant is kept more than once.'
    });
  }
  if (outOfOrder) {
    issues.push({
      code: 'kept-out-of-order',
      message: 'Kept variants are not in workup order.'
    });
  }
  if (issues.length > 0) {
    return issues;
  }

  let body: string;
  try {
    body = buildShowVsTellArtifact(draft);
  } catch {
    return [{
      code: 'artifact-compilation-failed',
      message: 'The kept variants could not be compiled.'
    }];
  }
  if (body.length > PROMPT_BUDGETS.workshopWidgets.showVsTellArtifactCharacters) {
    return [{
      code: 'over-artifact-budget',
      message: showVsTellArtifactOverBudgetMessage()
    }];
  }
  return [];
}
