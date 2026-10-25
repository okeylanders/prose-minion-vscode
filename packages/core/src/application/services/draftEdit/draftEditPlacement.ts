/**
 * Placing a pass's findings in the document a run read (ADR 2026-10-21 D2,
 * D6). Pure: each finding is anchored by its quote in its own chunk, refused
 * when it touches a protected placeholder, judged by the Proofread guard, and
 * kept only when it does not overlap an earlier one.
 *
 * A fix that would change the document's Markdown structure is flagged
 * instead (`markup-change`), the batch judged together as Fix would apply it
 * (PR #172 F-03). So Flag's quick fixes never prefer one, and Fix never offers
 * one; the applier checks again against the live text before anything lands.
 */

import type { DraftEditPassPolicy, DraftEditTarget, TextRange } from '@/domain/models/DraftEdit';
import type { ProofreadIssue } from '@/domain/models/ProofreadIssue';
import { anchorQuote } from '@/utils/draftEdit/anchorEdits';
import type { TextChunk } from '@/utils/draftEdit/chunkParagraphs';
import { editsChangingStructure } from '@/utils/draftEdit/markdownStructure';
import type { MaskedText } from '@/utils/draftEdit/protectedRegions';
import { judgeProofreadFinding } from '@/utils/proofread/proofreadGuard';
import type { ProofreadRunResult } from '@services/proofread/ProofreadService';
import { byPlace, hasReplacement, type DraftEditDrops } from '@/application/services/draftEdit/draftEditIssues';

/** The target as a run sends it: its region, masked, and chunked. */
export interface Prepared {
  readonly region: TextRange;
  readonly masked: MaskedText;
  readonly chunks: readonly TextChunk[];
  readonly words: number;
}

/** Each finding placed in the gesture's snapshot, guarded, with overlaps resolved; `nextId` names each issue. */
export function placeFindings(
  target: DraftEditTarget,
  policy: DraftEditPassPolicy,
  prepared: Prepared,
  result: Extract<ProofreadRunResult, { kind: 'completed' }>,
  dropped: DraftEditDrops,
  nextId: () => string
): ProofreadIssue[] {
  const issues: ProofreadIssue[] = [];
  result.chunks.forEach((chunkResult, index) => {
    if (chunkResult.kind !== 'read') {
      return;
    }
    dropped.malformed += chunkResult.malformed;
    const chunk = prepared.chunks[index];
    for (const finding of chunkResult.findings) {
      const anchored = anchorQuote(chunk.text, finding.anchor);
      if (anchored.kind !== 'anchored') {
        dropped.unanchored += 1;
        continue;
      }
      const maskedRange = { start: chunk.start + anchored.start, end: chunk.start + anchored.end };
      const sourceStart = prepared.masked.toSource(maskedRange.start);
      const sourceEnd = prepared.masked.toSource(maskedRange.end);
      if (prepared.masked.touchesPlaceholder(maskedRange) || sourceStart === undefined || sourceEnd === undefined) {
        dropped.protected += 1;
        continue;
      }
      const start = prepared.region.start + sourceStart;
      const end = prepared.region.start + sourceEnd;
      const original = target.text.slice(start, end);
      const verdict = judgeProofreadFinding({ category: finding.category, original, replacement: finding.replacement }, policy);
      if (verdict.kind === 'drop') {
        continue;
      }
      issues.push({
        id: nextId(),
        category: finding.category,
        disposition: verdict.disposition,
        start,
        end,
        original,
        ...(finding.replacement !== undefined ? { replacement: finding.replacement } : {}),
        explanation: finding.explanation,
        ...(verdict.downgradeReason ? { downgradeReason: verdict.downgradeReason } : {})
      });
    }
  });

  issues.sort(byPlace);
  const kept: ProofreadIssue[] = [];
  for (const issue of issues) {
    const last = kept[kept.length - 1];
    if (last && issue.start < last.end) {
      dropped.overlapping += 1;
    } else {
      kept.push(issue);
    }
  }
  return policy.preservesMarkdownStructure ? flagStructureChanges(kept, target) : kept;
}

/** Fixes that would change the Markdown structure, together as Fix would make them, flagged instead. */
function flagStructureChanges(issues: ProofreadIssue[], target: DraftEditTarget): ProofreadIssue[] {
  const fixes = issues.filter((issue) => issue.disposition === 'fix').filter(hasReplacement);
  const unsafe = editsChangingStructure(target.text, target.languageId, fixes);
  if (unsafe.size === 0) {
    return issues;
  }
  const downgraded = new Set(fixes.filter((_, index) => unsafe.has(index)).map((issue) => issue.id));
  return issues.map((issue) => (downgraded.has(issue.id)
    ? { ...issue, disposition: 'flag', downgradeReason: 'markup-change' }
    : issue));
}
