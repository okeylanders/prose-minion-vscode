/**
 * DraftEditUseCase — one Draft Edit run, from a gesture's target to flags on
 * the document (ADR 2026-10-21 D1, D2, D4, D6, D7). Slice 1: Proofread,
 * flagging only. Nothing here writes to a document.
 *
 * A run:
 * 1. masks the target's protected regions (found over the whole document,
 *    so a selection inside a fenced block is still protected), and chunks
 *    it on paragraph boundaries;
 * 2. hands the chunks to the pass (the only step that calls a model);
 * 3. places each finding by its quote in its own chunk; refuses one that
 *    touches a placeholder; applies the Proofread guard; and keeps the
 *    earlier of two overlapping issues;
 * 4. re-reads the live document. When the writer typed during the run, each
 *    issue is placed again by its quoted text, and one whose text changed is
 *    dropped as stale, never drawn on moved text;
 * 5. shows the issues as annotations, replacing the document's earlier ones.
 *
 * One run per document at a time. Everything dropped is counted, never
 * guessed.
 */

import type { LogSink } from '@/platform';
import type { DocumentEditor, DocumentSnapshot } from '@/platform/DocumentEditor';
import type { DocumentAnnotation, IssueAnnotator } from '@/platform/IssueAnnotator';
import {
  DRAFT_EDIT_PASS_POLICIES,
  type DraftEditOutcome,
  type DraftEditPass,
  type DraftEditTarget,
  type TextRange
} from '@/domain/models/DraftEdit';
import {
  proofreadCategoryDisposition,
  type ProofreadIssue
} from '@/domain/models/ProofreadIssue';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { anchorQuote } from '@/utils/draftEdit/anchorEdits';
import { chunkParagraphs, type TextChunk } from '@/utils/draftEdit/chunkParagraphs';
import {
  findProtectedRegions,
  maskProtectedRegions,
  type MaskedText
} from '@/utils/draftEdit/protectedRegions';
import { judgeProofreadFinding } from '@/utils/proofread/proofreadGuard';
import type { ProofreadRunRequest, ProofreadRunResult } from '@services/proofread/ProofreadService';

/** The Proofread pass as this use case needs it: chunks in, chunk-relative findings out. */
export interface ProofreadPassPort {
  proofread(request: ProofreadRunRequest): Promise<ProofreadRunResult>;
}

/** What a run would read, before anything is sent: the host's long-file confirmation reads it. */
export interface DraftEditRunPlan {
  readonly words: number;
  readonly chunks: number;
  readonly wholeFile: boolean;
  /** A whole-file run over `PROMPT_BUDGETS.proofread.confirmWholeFileWords`; a selection never needs it. */
  readonly needsConfirmation: boolean;
}

/** Context taken either side of an issue, to place it again after the writer types. */
const REANCHOR_CONTEXT_CHARACTERS = 40;

interface Prepared {
  readonly region: TextRange;
  readonly masked: MaskedText;
  readonly chunks: readonly TextChunk[];
  readonly words: number;
}

type Drops = { -readonly [K in keyof Extract<DraftEditOutcome, { kind: 'completed' }>['dropped']]: number };

export class DraftEditUseCase {
  private readonly inFlight = new Set<string>();
  private sequence = 0;

  constructor(
    private readonly proofreadPass: ProofreadPassPort,
    private readonly documents: DocumentEditor,
    private readonly annotations: IssueAnnotator,
    private readonly log: LogSink
  ) {}

  plan(target: DraftEditTarget): DraftEditRunPlan {
    const prepared = this.prepare(target);
    const wholeFile = target.range === undefined;
    return {
      words: prepared.words,
      chunks: prepared.chunks.length,
      wholeFile,
      needsConfirmation: wholeFile && prepared.words > PROMPT_BUDGETS.proofread.confirmWholeFileWords
    };
  }

  async run(target: DraftEditTarget, pass: DraftEditPass, signal?: AbortSignal): Promise<DraftEditOutcome> {
    if (this.inFlight.has(target.uri)) {
      return { kind: 'busy' };
    }
    const prepared = this.prepare(target);
    if (prepared.chunks.length === 0) {
      return { kind: 'empty' };
    }
    this.inFlight.add(target.uri);
    try {
      return await this.proofread(target, pass, prepared, signal);
    } finally {
      this.inFlight.delete(target.uri);
    }
  }

  /** Withdraw one flag (the Dismiss code action). */
  dismiss(uri: string, issueId: string): void {
    this.annotations.remove(uri, [issueId]);
  }

  /** Withdraw a document's flags, or every document's. */
  clear(uri?: string): void {
    this.annotations.clear(uri);
  }

  private prepare(target: DraftEditTarget): Prepared {
    const region = target.range ?? { start: 0, end: target.text.length };
    const regionProtected = findProtectedRegions(target.text, target.languageId)
      .filter((range) => range.end > region.start && range.start < region.end)
      .map((range) => ({
        start: Math.max(range.start, region.start) - region.start,
        end: Math.min(range.end, region.end) - region.start
      }));
    const masked = maskProtectedRegions(target.text.slice(region.start, region.end), regionProtected);
    const chunks = chunkParagraphs(masked.text, PROMPT_BUDGETS.proofread.chunkWords);
    return { region, masked, chunks, words: chunks.reduce((sum, chunk) => sum + chunk.words, 0) };
  }

  private async proofread(
    target: DraftEditTarget,
    pass: DraftEditPass,
    prepared: Prepared,
    signal?: AbortSignal
  ): Promise<DraftEditOutcome> {
    const label = runLabel(target);
    const result = await this.proofreadPass.proofread({
      chunks: prepared.chunks.map((chunk) => chunk.text),
      label,
      ...(signal ? { signal } : {})
    });
    if (result.kind === 'unconfigured') {
      return { kind: 'unconfigured' };
    }
    if (result.kind === 'cancelled') {
      return { kind: 'cancelled', ...(result.usage ? { usage: result.usage } : {}) };
    }

    const dropped: Drops = { unanchored: 0, protected: 0, overlapping: 0, stale: 0, malformed: 0 };
    const placed = this.place(target, pass, prepared, result, dropped);
    const live = await this.documents.snapshot(target.uri);
    let shown: ProofreadIssue[] = [];
    if (!live) {
      dropped.stale += placed.length;
    } else {
      const current = this.reanchor(target, live, placed, dropped);
      // No await between the snapshot and `show`, so the version still holds unless the host refuses it.
      if (this.annotations.show(target.uri, live.version, current.map(toAnnotation))) {
        shown = current;
      } else {
        dropped.stale += current.length;
      }
    }

    const answered = result.chunks.filter((chunk) => chunk.kind !== 'unsent').length;
    this.log.appendLine(
      `[DraftEdit] Proofread ${label}: ${shown.length} flagged, ${answered}/${result.chunks.length} chunks answered`
      + `, dropped ${JSON.stringify(dropped)}`
      + (result.interrupted ? `; interrupted (${result.interrupted.cause})` : '')
    );
    return {
      kind: 'completed',
      flagged: shown.length,
      judgmentCalls: shown.filter((issue) => proofreadCategoryDisposition(issue.category) === 'flag').length,
      dropped,
      rejectedChunks: result.chunks.filter((chunk) => chunk.kind === 'rejected').length,
      chunks: { total: result.chunks.length, completed: answered },
      ...(result.interrupted ? { interrupted: result.interrupted } : {}),
      ...(result.usage ? { usage: result.usage } : {})
    };
  }

  /** Each finding placed in the gesture's snapshot, guarded, and with overlaps resolved. */
  private place(
    target: DraftEditTarget,
    pass: DraftEditPass,
    prepared: Prepared,
    result: Extract<ProofreadRunResult, { kind: 'completed' }>,
    dropped: Drops
  ): ProofreadIssue[] {
    const policy = DRAFT_EDIT_PASS_POLICIES[pass.kind];
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
          id: `proofread-${++this.sequence}`,
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

    issues.sort((a, b) => a.start - b.start || a.end - b.end);
    const kept: ProofreadIssue[] = [];
    for (const issue of issues) {
      const last = kept[kept.length - 1];
      if (last && issue.start < last.end) {
        dropped.overlapping += 1;
      } else {
        kept.push(issue);
      }
    }
    return kept;
  }

  /** The issues at their place in the live text; an issue whose quoted text changed is dropped as stale. */
  private reanchor(
    target: DraftEditTarget,
    live: DocumentSnapshot,
    issues: readonly ProofreadIssue[],
    dropped: Drops
  ): ProofreadIssue[] {
    if (live.version === target.version) {
      return [...issues];
    }
    const moved: ProofreadIssue[] = [];
    for (const issue of issues) {
      const anchored = anchorQuote(live.text, {
        quote: issue.original,
        before: target.text.slice(Math.max(0, issue.start - REANCHOR_CONTEXT_CHARACTERS), issue.start),
        after: target.text.slice(issue.end, issue.end + REANCHOR_CONTEXT_CHARACTERS)
      });
      if (anchored.kind !== 'anchored' || live.text.slice(anchored.start, anchored.end) !== issue.original) {
        dropped.stale += 1;
        continue;
      }
      moved.push({ ...issue, start: anchored.start, end: anchored.end });
    }
    return moved;
  }
}

/** Names a run in logs and recovery files: a path, never the text. */
function runLabel(target: DraftEditTarget): string {
  return `${target.relativePath ?? 'untitled document'}${target.range ? ' (selection)' : ''}`;
}

function toAnnotation(issue: ProofreadIssue): DocumentAnnotation {
  return {
    id: issue.id,
    start: issue.start,
    end: issue.end,
    // Severity follows the category: a downgraded spelling fix is still a surface error.
    severity: proofreadCategoryDisposition(issue.category) === 'fix' ? 'info' : 'warning',
    code: `proofread.${issue.category}`,
    message: `${issue.explanation}${suggestionOf(issue)}`
  };
}

function suggestionOf(issue: ProofreadIssue): string {
  if (issue.replacement === undefined) {
    return '';
  }
  return issue.replacement.length === 0 ? ' Suggested: delete it.' : ` Suggested: “${issue.replacement}”.`;
}
