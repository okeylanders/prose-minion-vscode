/**
 * DraftEditUseCase — one Draft Edit run, from a gesture's target to flags on
 * the document, or fixes in it (ADR 2026-10-21 D1, D2, D4, D6, D7).
 *
 * A run is a held gesture (PR #183 F-02, as Craft Flags' is since PR #177
 * F-02): `begin` takes it synchronously, at the writer's gesture, before
 * anything is awaited, and says what it would read, for the host's long-file
 * confirmation; `run` sends it, once; `release` ends it unsent. Each is
 * idempotent at its end: a gesture runs once, and is released however it
 * ends.
 * 1. `begin` masks the target's protected regions (found over the whole
 *    document, so a selection inside a fenced block is still protected), and
 *    chunks it on paragraph boundaries;
 * 2. it starts watching the open document at the version the gesture read,
 *    so a confirmation's await is inside the watched lifetime: a document
 *    that closes, reopens or changes language while the writer decides sends
 *    nothing (`changed`), since a URI and a version do not name a lifetime;
 * 3. `run` hands the chunks to the pass (the only step that calls a model),
 *    with what host code read of the whole document beside them: its
 *    narration, and the writer's listed words each chunk holds (Slice 3b).
 *    The pass asks the watch in the turn each chunk starts, so a lifetime
 *    that ends mid-run starts no more;
 * 4. places each finding by its quote in its own chunk; drops a spelling or
 *    wrong-word finding on a listed word; refuses one that touches a
 *    placeholder; applies the Proofread guard; keeps the earlier of two
 *    overlapping issues; and adds the host's issues (name variants), which
 *    win where they overlap a model's;
 * 5. settles the watch. Each issue follows its own occurrence through the
 *    writer's edits: one an edit touched is dropped as stale, never moved to
 *    another occurrence of its words (PR #171 F-03). The live text's
 *    protected regions are found again, and an issue now inside one is
 *    dropped. A document that closed shows nothing, even if it opened again
 *    (F-04);
 * 6. Fix only (Slice 2; `applyRunFixes`): hands the fixes to
 *    `DraftEditApplier`, the one door to the document, and moves the rest
 *    through what it changed. A fix the writer left unticked, discarded or
 *    the editor refused is flagged instead;
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
  type DraftEditRejectedChunks,
  type DraftEditReview,
  type DraftEditTarget,
  type ProofreadPass,
  type TextRange
} from '@/domain/models/DraftEdit';
import { proofreadCategoryDisposition, type ProofreadIssue } from '@/domain/models/ProofreadIssue';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { chunkParagraphs } from '@/utils/draftEdit/chunkParagraphs';
import { findProtectedRegions, maskProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import type { ProofreadRunRequest, ProofreadRunResult } from '@services/proofread/ProofreadService';
import type { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { applyRunFixes, fixReport, type DraftEditLeftovers } from '@/application/services/draftEdit/draftEditRunFixes';
import { placeFindings, type Prepared } from '@/application/services/draftEdit/draftEditPlacement';
import { readWholeDocument } from '@/application/services/draftEdit/draftEditHostRead';
import {
  byPlace,
  followIssues,
  hasReplacement,
  moveIssues,
  noDrops,
  outsideProtected,
  toAnnotation,
  toEdit
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

/** The writer's gesture, held from its first read until it runs or is released (PR #183 F-02). Opaque to the host. */
export interface DraftEditGesture {
  readonly uri: string;
}

/** A gesture taken, with what it would read, or why there is none: a run already held, nothing to read, or a document already moved on. */
export type DraftEditBegin =
  | { readonly kind: 'gesture'; readonly gesture: DraftEditGesture; readonly plan: DraftEditRunPlan }
  | Extract<DraftEditOutcome, { kind: 'busy' | 'empty' | 'changed' }>;

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


interface Held {
  readonly target: DraftEditTarget;
  readonly pass: ProofreadPass;
  readonly prepared: Prepared;
  readonly watch: DocumentWatch;
  /** A selection run's earlier flags outside its selection, chosen at the gesture. */
  readonly keep: ReadonlySet<string>;
  ran: boolean;
}

export class DraftEditUseCase {
  private readonly inFlight = new Set<string>();
  private readonly held = new Map<DraftEditGesture, Held>();
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

  /** Take the gesture: synchronously, before anything is awaited, so any confirmation is inside its watched lifetime. */
  begin(target: DraftEditTarget, pass: ProofreadPass): DraftEditBegin {
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
    const gesture: DraftEditGesture = { uri: target.uri };
    this.inFlight.add(target.uri);
    this.held.set(gesture, { target, pass, prepared, watch, keep: this.flagsOutside(target), ran: false });
    const wholeFile = target.range === undefined;
    return {
      kind: 'gesture',
      gesture,
      plan: {
        words: prepared.words,
        chunks: prepared.chunks.length,
        wholeFile,
        needsConfirmation: wholeFile && prepared.words > PROMPT_BUDGETS.proofread.confirmWholeFileWords
      }
    };
  }

  /** End a gesture unsent: declined, failed or cancelled before it ran. Nothing happens to one already ended. */
  release(gesture: DraftEditGesture): void {
    const held = this.held.get(gesture);
    if (held && !held.ran) {
      this.finish(gesture, held);
    }
  }

  /** Send a held gesture, once; it ends however the run does. A lifetime that ended since `begin` sends nothing. */
  async run(gesture: DraftEditGesture, signal?: AbortSignal, hooks: DraftEditRunHooks = {}): Promise<DraftEditOutcome> {
    const held = this.open(gesture);
    held.ran = true;
    try {
      if (held.watch.ended()) {
        this.log.appendLine(`[DraftEdit] Proofread ${runLabel(held.target)}: the document closed or changed language before anything was sent; nothing sent`);
        return { kind: 'changed' };
      }
      return await this.proofread(held.target, held.pass, held.prepared, held.watch, held.keep, signal, hooks);
    } finally {
      this.finish(gesture, held);
    }
  }

  /** A gesture still held and not yet sent; anything else is a host's mistake, never a second run. */
  private open(gesture: DraftEditGesture): Held {
    const held = this.held.get(gesture);
    if (!held || held.ran) {
      throw new Error('This Proofread gesture has already run or been released');
    }
    return held;
  }

  private finish(gesture: DraftEditGesture, held: Held): void {
    held.ran = true;
    held.watch.dispose();
    this.held.delete(gesture);
    this.inFlight.delete(gesture.uri);
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
    pass: ProofreadPass,
    prepared: Prepared,
    watch: DocumentWatch,
    keep: ReadonlySet<string>,
    signal: AbortSignal | undefined,
    hooks: DraftEditRunHooks
  ): Promise<DraftEditOutcome> {
    const label = runLabel(target);
    const host = readWholeDocument(target, pass, this.log, label);
    const result = await this.proofreadPass.proofread({
      chunks: prepared.chunks.map((chunk) => chunk.text),
      label,
      ...(pass.spelling ? { spelling: pass.spelling } : {}),
      ...(pass.wordList ? { wordList: pass.wordList } : {}),
      ...(pass.reasoning ? { reasoning: pass.reasoning } : {}),
      ...(host.narration ? { narration: host.narration } : {}),
      stillCurrent: () => !watch.ended(),
      ...(signal ? { signal } : {})
    });
    if (result.kind === 'unconfigured') {
      return { kind: 'unconfigured' };
    }
    if (result.kind === 'reasoning-required') {
      return { kind: 'reasoning-required', model: result.model };
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
    const placed = placeFindings(target, DRAFT_EDIT_PASS_POLICIES[pass.kind], prepared, result, host, dropped, () => `proofread-${++this.sequence}`);
    const settled = watch.settle();
    if (settled.kind === 'closed') {
      return closed();
    }
    const live = settled.snapshot;
    const current = outsideProtected(followIssues(placed, settled.edits, live.text, dropped), live.text, live.languageId, dropped);

    // Fix: nothing is awaited between settling and asking the applier, so its first watch begins at `live.version`.
    const leftovers: DraftEditLeftovers = pass.output === 'fix'
      ? await applyRunFixes(this.applier, pass, live, current, dropped, (fixes) => hooks.onReview?.(fixes))
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
}

/** Names a run in logs and recovery files: a path, never the text. */
function runLabel(target: DraftEditTarget): string {
  return `${target.relativePath ?? 'untitled document'}${target.range ? ' (selection)' : ''}`;
}
