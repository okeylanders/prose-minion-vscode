/**
 * A Proofread and Fix run's write step (Draft Edit Slice 2; ADR 2026-10-21
 * D4, D7), split from `DraftEditUseCase` (PR #183): its fixes go to
 * `DraftEditApplier`, the one door to the document, and what is left to flag
 * is moved through what it changed. A fix the writer left unticked,
 * discarded or the editor refused is flagged instead.
 */

import type { DocumentSnapshot } from '@/platform';
import { DRAFT_EDIT_PASS_POLICIES, type DraftEditFixReport, type DraftEditReview, type ProofreadPass } from '@/domain/models/DraftEdit';
import type { ProofreadIssue } from '@/domain/models/ProofreadIssue';
import type { DraftEditApplier, DraftEditApplyResult } from '@/application/services/draftEdit/DraftEditApplier';
import {
  byPlace,
  followIssues,
  hasReplacement,
  outsideProtected,
  toEdit,
  type DraftEditDrops
} from '@/application/services/draftEdit/draftEditIssues';

/** What a run shows, at which version; a Fix run's report of its fixes beside it. */
export type DraftEditLeftovers =
  | { readonly kind: 'closed' }
  | { readonly kind: 'show'; readonly version: number; readonly issues: ProofreadIssue[]; readonly report?: DraftEditFixReport };

/**
 * The fixes made through the applier, and what is left to flag: the
 * judgment calls and downgraded fixes moved through what it changed, and
 * the fixes still standing as they were (unticked, discarded, refused).
 */
export async function applyRunFixes(
  applier: Pick<DraftEditApplier, 'apply'>,
  pass: Extract<ProofreadPass, { output: 'fix' }>,
  live: DocumentSnapshot,
  current: readonly ProofreadIssue[],
  dropped: DraftEditDrops,
  onReview: ((fixes: number) => void) | undefined
): Promise<DraftEditLeftovers> {
  const fixes = current.filter((issue) => issue.disposition === 'fix').filter(hasReplacement);
  if (fixes.length === 0) {
    return { kind: 'show', version: live.version, issues: [...current], report: { review: pass.review, answer: 'none', applied: 0, notApplied: 0, unknown: 0 } };
  }
  if (pass.review === 'preview') {
    onReview?.(fixes.length);
  }
  const result = await applier.apply({
    document: live,
    edits: fixes.map((issue) => toEdit(issue)),
    review: pass.review,
    policy: DRAFT_EDIT_PASS_POLICIES[pass.kind]
  });
  if (!result.settled) {
    return { kind: 'closed' };
  }

  const after = result.settled.snapshot;
  const fixIds = new Set(fixes.map((issue) => issue.id));
  const byId = new Map(fixes.map((issue) => [issue.id, issue]));
  const others = current.filter((issue) => !fixIds.has(issue.id));
  const standing: ProofreadIssue[] = [];
  for (const refusal of result.refused) {
    if (refusal.reason === 'changed') {
      dropped.stale += 1;
    } else if (refusal.reason === 'protected') {
      dropped.protected += 1;
    } else {
      // Refused for its own shape (Markdown, a line break, an overlap): still true where it was, so flagged,
      // and no longer offered as Proofread's own fix, so Fix all never tries it again.
      const issue = byId.get(refusal.id)!;
      standing.push(refusal.reason === 'overlapping'
        ? issue
        : { ...issue, disposition: 'flag', downgradeReason: refusal.reason === 'markup' ? 'markup-change' : 'non-mechanical-edit' });
    }
  }
  const moved = followIssues([...others, ...standing], result.settled.edits, after.text, dropped);
  const unticked = result.notApplied.map(({ id, start, end }) => ({ ...byId.get(id)!, start, end }));
  return {
    kind: 'show',
    version: after.version,
    issues: outsideProtected([...moved, ...unticked], after.text, after.languageId, dropped).sort(byPlace),
    report: fixReport(pass.review, result)
  };
}

/** What the editor did with a run's or a quick fix's fixes. */
export function fixReport(review: DraftEditReview, result: DraftEditApplyResult): DraftEditFixReport {
  const answer: DraftEditFixReport['answer'] =
    result.outcome === 'submitted' || result.outcome === 'declined' || result.outcome === 'stale' || result.outcome === 'failed'
      ? result.outcome
      : 'none';
  return {
    review,
    answer,
    applied: result.applied.length,
    notApplied: result.notApplied.length,
    unknown: result.unknown.length,
    ...(result.failure !== undefined ? { failure: result.failure } : {})
  };
}
