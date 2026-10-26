/**
 * DraftEditUseCase — one Draft Edit run, from a gesture's target to flags on
 * the document, or fixes in it (ADR 2026-10-21 D1, D2, D4, D6, D7).
 *
 * A run:
 * 1. masks the target's protected regions (found over the whole document,
 *    so a selection inside a fenced block is still protected), and chunks
 *    it on paragraph boundaries;
 * 2. starts watching the open document at the version the gesture read,
 *    before anything is awaited;
 * 3. hands the chunks to the pass (the only step that calls a model);
 * 4. places each finding by its quote in its own chunk; refuses one that
 *    touches a placeholder; applies the Proofread guard; and keeps the
 *    earlier of two overlapping issues;
 * 5. settles the watch. Each issue follows its own occurrence through the
 *    writer's edits: one an edit touched is dropped as stale, never moved to
 *    another occurrence of its words (PR #171 F-03). The live text's
 *    protected regions are found again, and an issue now inside one is
 *    dropped. A document that closed shows nothing, even if it opened again
 *    (F-04);
 * 6. Fix only (Slice 2): hands the fixes to `DraftEditApplier`, the one door
 *    to the document, and moves the rest through what it changed. A fix the
 *    writer left unticked, discarded or the editor refused is flagged instead;
 * 7. shows what is left as annotations, replacing the document's earlier ones,
 *    and keeps them for the session so a quick fix can name one by id. A
 *    selection run replaces only the flags it read again: those wholly
 *    outside the selection, as the gesture read it, stay where they now sit
 *    (Slice 3).
 *
 * A quick fix (*Replace with*, *Fix all*) asks the annotator where its flag
 * sits now and goes through the same applier; it never writes from a stale
 * range. One run or quick fix per document at a time. Everything dropped is
 * counted, never guessed.
 */

import type { DocumentAnnotation, DocumentSnapshot, DocumentTextChange, LogSink } from '@/platform';
import type { DocumentEditor, DocumentWatch } from '@/platform/DocumentEditor';
import type { IssueAnnotator } from '@/platform/IssueAnnotator';
import {
  DRAFT_EDIT_PASS_POLICIES,
  type DraftEditFixReport,
  type DraftEditOutcome,
  type DraftEditPass,
  type DraftEditRejectedChunks,
  type DraftEditReview,
  type DraftEditTarget,
  type TextRange
} from '@/domain/models/DraftEdit';
import { proofreadCategoryDisposition, type ProofreadIssue } from '@/domain/models/ProofreadIssue';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { chunkParagraphs } from '@/utils/draftEdit/chunkParagraphs';
import { findProtectedRegions, maskProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import type { ProofreadRunRequest, ProofreadRunResult } from '@services/proofread/ProofreadService';
import type { DraftEditApplier, DraftEditApplyResult } from '@/application/services/draftEdit/DraftEditApplier';
import { placeFindings, type Prepared } from '@/application/services/draftEdit/draftEditPlacement';
import {
  byPlace,
  hasReplacement,
  moveIssues,
  noDrops,
  outsideProtected,
  toAnnotation,
  toEdit,
  type DraftEditDrops
} from '@/application/services/draftEdit/draftEditIssues';

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

/** What a host hears while a run works. */
export interface DraftEditRunHooks {
  /** A Fix run is handing `fixes` fixes to the writer's review. */
  onReview?(fixes: number): void;
}

/** The shown issues a quick fix asks for: some by id, or every fix Proofread would make itself. */
export type DraftEditQuickFixRequest = { readonly issueIds: readonly string[] } | 'all-fixes';

export type DraftEditQuickFixOutcome =
  | { readonly kind: 'busy' }
  /** The document moved since the quick fix was offered. */
  | { readonly kind: 'changed' }
  /** No shown flag carries the fix asked for any more (dismissed, or its text edited). */
  | { readonly kind: 'nothing' }
  | { readonly kind: 'closed' }
  /** What the editor did with the fixes; `refused` counts those the applier would not ask for. */
  | ({ readonly kind: 'done'; readonly refused: number } & DraftEditFixReport);


/** What a run shows, at which version; a Fix run's report of its fixes beside it. */
type Leftovers =
  | { readonly kind: 'closed' }
  | { readonly kind: 'show'; readonly version: number; readonly issues: ProofreadIssue[]; readonly report?: DraftEditFixReport };

export class DraftEditUseCase {
  private readonly inFlight = new Set<string>();
  /** Each document's shown issues, by id, for the session only (D6): a quick fix's handle back to them. */
  private readonly shownIssues = new Map<string, Map<string, ProofreadIssue>>();
  private sequence = 0;

  constructor(
    private readonly proofreadPass: ProofreadPassPort,
    private readonly documents: DocumentEditor,
    private readonly annotations: IssueAnnotator,
    private readonly applier: DraftEditApplier,
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

  async run(target: DraftEditTarget, pass: DraftEditPass, signal?: AbortSignal, hooks: DraftEditRunHooks = {}): Promise<DraftEditOutcome> {
    if (this.inFlight.has(target.uri)) {
      return { kind: 'busy' };
    }
    const prepared = this.prepare(target);
    if (prepared.chunks.length === 0) {
      return { kind: 'empty' };
    }
    const watch = this.documents.watch(target.uri, target.version);
    if (!watch) {
      return { kind: 'changed' };
    }
    const keep = this.flagsOutside(target);
    this.inFlight.add(target.uri);
    try {
      return await this.proofread(target, pass, prepared, watch, keep, signal, hooks);
    } finally {
      watch.dispose();
      this.inFlight.delete(target.uri);
    }
  }

  /**
   * Apply shown issues' replacements (the quick fixes), where the annotator
   * says their flags sit now in `document`, the gesture's read of it.
   */
  async applyShown(document: DocumentSnapshot, request: DraftEditQuickFixRequest, review: DraftEditReview): Promise<DraftEditQuickFixOutcome> {
    if (this.inFlight.has(document.uri)) {
      return { kind: 'busy' };
    }
    const shown = this.annotations.current(document.uri);
    if (!shown) {
      return { kind: 'nothing' };
    }
    if (shown.version !== document.version) {
      return { kind: 'changed' };
    }
    const issues = this.shownIssues.get(document.uri) ?? new Map<string, ProofreadIssue>();
    const wanted = request === 'all-fixes'
      ? [...issues.values()].filter((issue) => issue.disposition === 'fix')
      : request.issueIds.map((id) => issues.get(id)).filter((issue): issue is ProofreadIssue => issue !== undefined);
    const places = new Map(shown.annotations.map((annotation) => [annotation.id, annotation]));
    const edits = wanted.filter(hasReplacement).flatMap((issue) => {
      const place = places.get(issue.id);
      return place ? [toEdit(issue, place.start, place.end)] : [];
    });
    if (edits.length === 0) {
      return { kind: 'nothing' };
    }

    this.inFlight.add(document.uri);
    try {
      const result = await this.applier.apply({ document, edits, review, policy: DRAFT_EDIT_PASS_POLICIES.proofread });
      if (result.outcome === 'closed') {
        return { kind: 'closed' };
      }
      if (result.outcome === 'changed') {
        return { kind: 'changed' };
      }
      // A Clear made while the write was out withdrew these flags for good: they are shown again only while this
      // map still holds the document's flags (PR #172 F-05). A Dismiss deletes from it, so it holds too.
      if (result.applied.length > 0 && result.settled && this.shownIssues.get(document.uri) === issues) {
        this.reshow(document.uri, shown.annotations, issues, new Set(result.applied), result.settled);
      }
      this.log.appendLine(`[DraftEdit] Quick fix: ${result.applied.length}/${edits.length} applied (${result.outcome})`);
      return { kind: 'done', refused: result.refused.length, ...fixReport(review, result) };
    } finally {
      this.inFlight.delete(document.uri);
    }
  }

  /**
   * After a quick fix: the flags still shown, moved through what changed, and
   * shown again. The fixed ones go (an insertion at a flag's edge would leave
   * it beside its fixed text), and the rest stay on their text even when the
   * editor made the fixes as one change spanning them (PR #172 F-04), which
   * the annotator, moving flags change by change, could not follow.
   */
  private reshow(
    uri: string,
    before: readonly DocumentAnnotation[],
    issues: Map<string, ProofreadIssue>,
    applied: ReadonlySet<string>,
    settled: { readonly snapshot: DocumentSnapshot; readonly edits: ReadonlyArray<readonly DocumentTextChange[]> }
  ): void {
    applied.forEach((id) => issues.delete(id));
    const placed = before.flatMap((annotation) => {
      const issue = issues.get(annotation.id);
      return issue ? [{ ...issue, start: annotation.start, end: annotation.end }] : [];
    });
    const moved = moveIssues(placed, settled.edits, settled.snapshot.text);
    // Nothing is awaited since the applier settled, so the version still holds unless the host refuses it.
    if (this.annotations.show(uri, settled.snapshot.version, moved.map(toAnnotation))) {
      this.shownIssues.set(uri, new Map(moved.map((issue) => [issue.id, issue])));
    } else {
      this.annotations.remove(uri, [...applied]);
    }
  }

  /**
   * The flags a selection run will not read again: those wholly outside its
   * selection, chosen at the gesture, against the text the selection's
   * offsets name, so no range is moved through the writer's edits. A
   * whole-file run keeps none.
   */
  private flagsOutside(target: DraftEditTarget): ReadonlySet<string> {
    const shown = target.range ? this.annotations.current(target.uri) : undefined;
    if (!target.range || !shown || shown.version !== target.version) {
      return new Set();
    }
    const { start, end } = target.range;
    return new Set(shown.annotations.filter((annotation) => annotation.end <= start || annotation.start >= end).map((annotation) => annotation.id));
  }

  /**
   * Of the flags a run chose to keep, those still shown at `version`, where
   * they sit now. One the writer dismissed, edited or cleared during the run
   * is gone from the annotator, so it is not kept.
   */
  private keptFlags(uri: string, version: number, keep: ReadonlySet<string>): ProofreadIssue[] {
    const shown = keep.size > 0 ? this.annotations.current(uri) : undefined;
    const issues = this.shownIssues.get(uri);
    if (!shown || !issues || shown.version !== version) {
      return [];
    }
    return shown.annotations.flatMap((annotation) => {
      const issue = keep.has(annotation.id) ? issues.get(annotation.id) : undefined;
      return issue ? [{ ...issue, start: annotation.start, end: annotation.end }] : [];
    });
  }

  /** Withdraw one flag (the Dismiss code action). */
  dismiss(uri: string, issueId: string): void {
    this.annotations.remove(uri, [issueId]);
    this.shownIssues.get(uri)?.delete(issueId);
  }

  /** Withdraw a document's flags, or every document's. */
  clear(uri?: string): void {
    this.annotations.clear(uri);
    if (uri === undefined) {
      this.shownIssues.clear();
    } else {
      this.shownIssues.delete(uri);
    }
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
    watch: DocumentWatch,
    keep: ReadonlySet<string>,
    signal: AbortSignal | undefined,
    hooks: DraftEditRunHooks
  ): Promise<DraftEditOutcome> {
    const label = runLabel(target);
    const result = await this.proofreadPass.proofread({
      chunks: prepared.chunks.map((chunk) => chunk.text),
      label,
      ...(pass.spelling ? { spelling: pass.spelling } : {}),
      ...(signal ? { signal } : {})
    });
    if (result.kind === 'unconfigured') {
      return { kind: 'unconfigured' };
    }
    if (result.kind === 'cancelled') {
      return { kind: 'cancelled', ...(result.usage ? { usage: result.usage } : {}) };
    }

    const rejectedChunks: DraftEditRejectedChunks = {
      saved: result.chunks.filter((chunk) => chunk.kind === 'rejected' && chunk.saved).length,
      unsaved: result.chunks.filter((chunk) => chunk.kind === 'rejected' && !chunk.saved).length
    };
    const closed = (): DraftEditOutcome => {
      this.log.appendLine(`[DraftEdit] Proofread ${label}: the document closed during the run; nothing shown`);
      return { kind: 'closed', rejectedChunks, ...(result.usage ? { usage: result.usage } : {}) };
    };
    const dropped = noDrops();
    const placed = placeFindings(target, DRAFT_EDIT_PASS_POLICIES[pass.kind], prepared, result, dropped, () => `proofread-${++this.sequence}`);
    const settled = watch.settle();
    if (settled.kind === 'closed') {
      return closed();
    }
    const live = settled.snapshot;
    const current = outsideProtected(this.followed(placed, settled.edits, live.text, dropped), live.text, live.languageId, dropped);

    // Fix: nothing is awaited between settling and asking the applier, so its first watch begins at `live.version`.
    const leftovers: Leftovers = pass.output === 'fix'
      ? await this.fix(pass, live, current, dropped, hooks)
      : { kind: 'show', version: live.version, issues: current };
    if (leftovers.kind === 'closed') {
      return closed();
    }
    let shown: ProofreadIssue[] = [];
    let kept: ProofreadIssue[] = [];
    // Nothing is awaited between the last settle and `show`, so the version still holds unless the host refuses it.
    const others = this.keptFlags(target.uri, leftovers.version, keep);
    if (this.annotations.show(target.uri, leftovers.version, [...others, ...leftovers.issues].sort(byPlace).map(toAnnotation))) {
      shown = leftovers.issues;
      kept = others;
      this.shownIssues.set(target.uri, new Map([...kept, ...shown].map((issue) => [issue.id, issue])));
    } else {
      dropped.stale += leftovers.issues.length;
    }

    const answered = result.chunks.filter((chunk) => chunk.kind !== 'unsent').length;
    const fix = leftovers.report;
    this.log.appendLine(
      `[DraftEdit] Proofread ${label}: ${shown.length} flagged${kept.length > 0 ? `, ${kept.length} earlier flags kept` : ''}`
      + `, ${answered}/${result.chunks.length} chunks answered`
      + `, dropped ${JSON.stringify(dropped)}`
      + (fix ? `; fixes ${fix.answer}: ${fix.applied} applied, ${fix.notApplied} not applied, ${fix.unknown} unknown` : '')
      + (result.interrupted ? `; interrupted (${result.interrupted.cause})` : '')
    );
    return {
      kind: 'completed',
      flagged: shown.length,
      judgmentCalls: shown.filter((issue) => proofreadCategoryDisposition(issue.category) === 'flag').length,
      dropped,
      rejectedChunks,
      chunks: { total: result.chunks.length, completed: answered },
      ...(kept.length > 0 ? { kept: kept.length } : {}),
      ...(result.interrupted ? { interrupted: result.interrupted } : {}),
      ...(fix ? { fix } : {}),
      ...(result.usage ? { usage: result.usage } : {})
    };
  }

  /**
   * The fixes made through the applier, and what is left to flag: the
   * judgment calls and downgraded fixes moved through what it changed, and
   * the fixes still standing as they were (unticked, discarded, refused).
   */
  private async fix(
    pass: Extract<DraftEditPass, { output: 'fix' }>,
    live: DocumentSnapshot,
    current: readonly ProofreadIssue[],
    dropped: DraftEditDrops,
    hooks: DraftEditRunHooks
  ): Promise<Leftovers> {
    const fixes = current.filter((issue) => issue.disposition === 'fix').filter(hasReplacement);
    if (fixes.length === 0) {
      return { kind: 'show', version: live.version, issues: [...current], report: { review: pass.review, answer: 'none', applied: 0, notApplied: 0, unknown: 0 } };
    }
    if (pass.review === 'preview') {
      hooks.onReview?.(fixes.length);
    }
    const result = await this.applier.apply({
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
    const moved = this.followed([...others, ...standing], result.settled.edits, after.text, dropped);
    const unticked = result.notApplied.map(({ id, start, end }) => ({ ...byId.get(id)!, start, end }));
    return {
      kind: 'show',
      version: after.version,
      issues: outsideProtected([...moved, ...unticked], after.text, after.languageId, dropped).sort(byPlace),
      report: fixReport(pass.review, result)
    };
  }

  /** Issues moved through `events`; those an edit touched are counted as stale. */
  private followed(
    issues: readonly ProofreadIssue[],
    events: ReadonlyArray<readonly DocumentTextChange[]>,
    liveText: string,
    dropped: DraftEditDrops
  ): ProofreadIssue[] {
    const moved = moveIssues(issues, events, liveText);
    dropped.stale += issues.length - moved.length;
    return moved;
  }

}

/** Names a run in logs and recovery files: a path, never the text. */
function runLabel(target: DraftEditTarget): string {
  return `${target.relativePath ?? 'untitled document'}${target.range ? ' (selection)' : ''}`;
}

function fixReport(review: DraftEditReview, result: DraftEditApplyResult): DraftEditFixReport {
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
