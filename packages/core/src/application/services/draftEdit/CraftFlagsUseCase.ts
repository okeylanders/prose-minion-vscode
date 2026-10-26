/**
 * CraftFlagsUseCase — one Craft Flags run, from a gesture's target to flags
 * on the document (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c).
 *
 * Craft Flags only flags. This run takes no applier, and its flags carry no
 * replacement, so nothing here can change the writer's text. Its flags are
 * its own (`Platform.craftAnnotations`): a Craft Flags run never replaces
 * Proofread's flags, nor Proofread's run its flags.
 *
 * A run:
 * 1. reads the whole document, protected regions masked, when it is at or
 *    under the word ceiling (`PROMPT_BUDGETS.craftFlags.chapterWords`).
 *    Over it, a selection run reads its selection alone, and a whole-file
 *    run is refused before anything is sent;
 * 2. starts watching the open document at the version the gesture read,
 *    before anything is awaited;
 * 3. sends one call per category, in parallel (the only step that calls a
 *    model);
 * 4. places each flag by its quote; drops one that touches a protected
 *    placeholder, or speech in a category that leaves speech alone; keeps
 *    only the flags inside a selection; and counts each flagged phrase over
 *    the document's narration;
 * 5. settles the watch: each flag follows its own occurrence through the
 *    writer's edits, and one an edit touched is dropped as stale. A document
 *    that closed shows nothing;
 * 6. shows the flags, replacing the document's earlier Craft Flags. A
 *    selection run replaces only those that overlap its selection, as the
 *    gesture read it (Slice 3's rule).
 *
 * One run per document at a time. Everything dropped is counted, never
 * guessed. Logs name the run, never the text.
 */

import type { DocumentAnnotation, LogSink } from '@/platform';
import type { DocumentEditor } from '@/platform/DocumentEditor';
import type { IssueAnnotator } from '@/platform/IssueAnnotator';
import type { DraftEditRejectedChunks, DraftEditTarget, TextRange } from '@/domain/models/DraftEdit';
import type { CraftFlagsOutcome, CraftFlagsPass } from '@/domain/models/CraftFlag';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { countWords } from '@/utils/textUtils';
import { findProtectedRegions, maskProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import { findSpeechSpans } from '@/utils/draftEdit/speechSpans';
import { phraseRepeats } from '@/utils/craftFlags/phraseRepeats';
import type { CraftFlagsEstimate, CraftFlagsRunRequest, CraftFlagsRunResult } from '@services/craftFlags/CraftFlagsService';
import { moveIssues, outsideProtected } from '@/application/services/draftEdit/draftEditIssues';
import {
  craftFlagAnnotation,
  noCraftFlagDrops,
  placeCraftFlags,
  type CraftFlagsPrepared
} from '@/application/services/draftEdit/craftFlagsPlacement';

/** The Craft Flags pass as this use case needs it: a passage in, passage-relative flags out, and their price before. */
export interface CraftFlagsPassPort {
  estimate(request: Pick<CraftFlagsRunRequest, 'passage' | 'categories'>): Promise<CraftFlagsEstimate>;
  flag(request: CraftFlagsRunRequest): Promise<CraftFlagsRunResult>;
}

/** What a run would read and cost, before anything is sent: the host's confirmation reads it. */
export type CraftFlagsRunPlan =
  | { readonly kind: 'empty' }
  | { readonly kind: 'too-long'; readonly words: number; readonly limit: number }
  /** No API key: the run would send nothing, so there is nothing to price. */
  | { readonly kind: 'unconfigured' }
  | {
      readonly kind: 'ready';
      /** Words the calls read. */
      readonly words: number;
      /** The whole document, or (over the word ceiling) the selection alone. */
      readonly reads: 'document' | 'selection';
      /** Whether the run shows only a selection's flags. */
      readonly selection: boolean;
      readonly estimate: CraftFlagsEstimate;
    };

type Prepared = CraftFlagsPrepared | Extract<CraftFlagsRunPlan, { kind: 'empty' | 'too-long' }>;

export class CraftFlagsUseCase {
  private readonly inFlight = new Set<string>();
  private sequence = 0;

  constructor(
    private readonly craftPass: CraftFlagsPassPort,
    private readonly documents: DocumentEditor,
    private readonly annotations: IssueAnnotator,
    private readonly log: LogSink
  ) {}

  async plan(target: DraftEditTarget, pass: CraftFlagsPass): Promise<CraftFlagsRunPlan> {
    const prepared = this.prepare(target);
    if (!('masked' in prepared)) {
      return prepared;
    }
    const estimate = await this.craftPass.estimate({ passage: prepared.masked.text, categories: pass.categories });
    if (estimate.model === undefined) {
      return { kind: 'unconfigured' };
    }
    return { kind: 'ready', words: prepared.words, reads: prepared.reads, selection: target.range !== undefined, estimate };
  }

  async run(target: DraftEditTarget, pass: CraftFlagsPass, signal?: AbortSignal): Promise<CraftFlagsOutcome> {
    if (this.inFlight.has(target.uri)) {
      return { kind: 'busy' };
    }
    const prepared = this.prepare(target);
    if (!('masked' in prepared)) {
      return prepared;
    }
    const watch = this.documents.watch(target.uri, target.version);
    if (!watch) {
      return { kind: 'changed' };
    }
    const keep = this.flagsOutside(target);
    this.inFlight.add(target.uri);
    try {
      const label = `${target.relativePath ?? 'untitled document'}${target.range ? ' (selection)' : ''}`;
      const speech = findSpeechSpans(target.text);
      const host = { speech, repeats: phraseRepeats(target.text, [...speech, ...findProtectedRegions(target.text, target.languageId)]) };
      const result = await this.craftPass.flag({
        passage: prepared.masked.text,
        categories: pass.categories,
        label,
        ...(signal ? { signal } : {})
      });
      if (result.kind === 'unconfigured') {
        return { kind: 'unconfigured' };
      }
      if (result.kind === 'cancelled') {
        return { kind: 'cancelled', ...(result.usage ? { usage: result.usage } : {}) };
      }

      const rejectedCalls: DraftEditRejectedChunks = {
        saved: result.calls.filter((call) => call.kind === 'rejected' && call.saved).length,
        unsaved: result.calls.filter((call) => call.kind === 'rejected' && !call.saved).length
      };
      const dropped = noCraftFlagDrops();
      const shownRegion = target.range ?? { start: 0, end: target.text.length };
      const placed = placeCraftFlags(target.text, prepared, result, host, shownRegion, dropped, () => `craft-${++this.sequence}`);
      const settled = watch.settle();
      if (settled.kind === 'closed') {
        this.log.appendLine(`[DraftEdit] Craft Flags ${label}: the document closed during the run; nothing shown`);
        return { kind: 'closed', rejectedCalls, ...(result.usage ? { usage: result.usage } : {}) };
      }
      const live = settled.snapshot;
      const moved = moveIssues(placed.issues, settled.edits, live.text);
      dropped.stale += placed.issues.length - moved.length;
      const current = outsideProtected(moved, live.text, live.languageId, dropped);

      // Nothing is awaited between the settle and `show`, so the version still holds unless the host refuses it.
      const kept = this.keptFlags(target.uri, live.version, keep);
      let flagged = 0;
      if (this.annotations.show(target.uri, live.version, [...kept, ...current.map(craftFlagAnnotation)].sort(byStart))) {
        flagged = current.length;
      } else {
        dropped.stale += current.length;
      }
      const notesWithheld = result.calls.reduce((sum, call) => sum + (call.kind === 'read' ? call.notesWithheld : 0), 0);
      const answered = result.calls.filter((call) => call.kind !== 'unsent').length;
      this.log.appendLine(
        `[DraftEdit] Craft Flags ${label}: ${flagged} flagged${kept.length > 0 ? `, ${kept.length} earlier flags kept` : ''}`
        + `, ${answered}/${result.calls.length} categories answered`
        + `, dropped ${JSON.stringify(dropped)}`
        + (placed.outside > 0 ? `, ${placed.outside} outside the selection` : '')
        + (notesWithheld > 0 ? `, ${notesWithheld} notes not shown as written` : '')
        + (result.interrupted ? `; interrupted (${result.interrupted.cause})` : '')
      );
      return {
        kind: 'completed',
        flagged,
        reads: prepared.reads,
        dropped,
        notesWithheld,
        rejectedCalls,
        calls: { total: result.calls.length, completed: answered },
        ...(kept.length > 0 ? { kept: kept.length } : {}),
        ...(result.interrupted ? { interrupted: result.interrupted } : {}),
        ...(result.usage ? { usage: result.usage } : {})
      };
    } finally {
      watch.dispose();
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

  /**
   * What the calls read: the whole document at or under the word ceiling;
   * over it, a selection alone when it fits; otherwise nothing. A selection
   * with no words in it is empty, whatever the document holds.
   */
  private prepare(target: DraftEditTarget): Prepared {
    const limit = PROMPT_BUDGETS.craftFlags.chapterWords;
    const protectedRegions = findProtectedRegions(target.text, target.languageId);
    const whole = this.masked(target.text, protectedRegions, { start: 0, end: target.text.length }, 'document');
    const selection = target.range ? this.masked(target.text, protectedRegions, target.range, 'selection') : undefined;
    if ((selection ?? whole).words === 0) {
      return { kind: 'empty' };
    }
    if (whole.words <= limit) {
      return whole;
    }
    return selection && selection.words <= limit ? selection : { kind: 'too-long', words: (selection ?? whole).words, limit };
  }

  private masked(text: string, protectedRegions: readonly TextRange[], region: TextRange, reads: CraftFlagsPrepared['reads']): CraftFlagsPrepared {
    const regionProtected = protectedRegions
      .filter((range) => range.end > region.start && range.start < region.end)
      .map((range) => ({ start: Math.max(range.start, region.start) - region.start, end: Math.min(range.end, region.end) - region.start }));
    const masked = maskProtectedRegions(text.slice(region.start, region.end), regionProtected);
    return { region, masked, words: countWords(masked.text), reads };
  }

  /** The flags a selection run will not read again: those wholly outside its selection, chosen at the gesture. */
  private flagsOutside(target: DraftEditTarget): ReadonlySet<string> {
    const shown = target.range ? this.annotations.current(target.uri) : undefined;
    if (!target.range || !shown || shown.version !== target.version) {
      return new Set();
    }
    const { start, end } = target.range;
    return new Set(shown.annotations.filter((annotation) => annotation.end <= start || annotation.start >= end).map((annotation) => annotation.id));
  }

  /** Of the flags a run chose to keep, those still shown at `version`, where they sit now. */
  private keptFlags(uri: string, version: number, keep: ReadonlySet<string>): DocumentAnnotation[] {
    const shown = keep.size > 0 ? this.annotations.current(uri) : undefined;
    if (!shown || shown.version !== version) {
      return [];
    }
    return shown.annotations.filter((annotation) => keep.has(annotation.id));
  }
}

function byStart(a: DocumentAnnotation, b: DocumentAnnotation): number {
  return a.start - b.start || a.end - b.end;
}
