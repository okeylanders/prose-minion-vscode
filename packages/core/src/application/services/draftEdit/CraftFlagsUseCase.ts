/**
 * CraftFlagsUseCase — one Craft Flags run, from a gesture's target to flags
 * on the document (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c).
 *
 * Craft Flags only flags. This run takes no applier, and its flags carry no
 * replacement, so nothing here can change the writer's text. Its flags are
 * its own (`Platform.craftAnnotations`): a Craft Flags run never replaces
 * Proofread's flags, nor Proofread's run its flags.
 *
 * A run is a held gesture (PR #177 F-02): `begin` takes it synchronously, at
 * the writer's gesture, before anything is awaited; `plan` prices it; `run`
 * sends it, once, with the model the writer approved (F-01); `release` ends
 * it unsent. Each is idempotent at its end: a gesture runs once, and is
 * released however it ends.
 * 1. `begin` reads the whole document, protected regions masked, when it is
 *    at or under the word ceiling (`PROMPT_BUDGETS.craftFlags.chapterWords`).
 *    Over it, a selection run reads its selection alone, and a whole-file
 *    run is refused before anything is sent. It starts watching the open
 *    document at the version the gesture read, and notes, for a selection
 *    run, the flags outside the selection to keep.
 * 2. `plan` and `run` ask the watch whether its lifetime is over (a close, a
 *    reopen or a language change) before they price and before each call is
 *    sent. A lifetime that ended shows no confirmation and sends nothing
 *    (`changed`): a URI and a version do not name a lifetime.
 * 3. `run` sends one call per category, in parallel, every one to the
 *    approved model (the only step that calls a model).
 * 4. It places each flag by its quote; drops one that touches a protected
 *    placeholder, or speech in a category that leaves speech alone (read
 *    with protected syntax set aside, F-03); and keeps only the flags inside
 *    a selection. A continuity pair is placed on both sides, and dropped
 *    when a section starts inside it (Slice 3c part 4): when continuity runs,
 *    the chapter's sections are found at the gesture, and the lines that open
 *    them are sent with its request (`craftFlagsSections`).
 * 5. It settles the watch: each flag follows its own occurrence through the
 *    writer's edits since the gesture, and one an edit touched is dropped as
 *    stale. A document that closed shows nothing. The live text's protected
 *    regions and speech are read again, and a flag now inside either is
 *    dropped; so are its sections, when a pair is left, and a pair a section
 *    the writer added now divides is dropped across a break (PR #180 F-02).
 *    Each phrase is counted in the live text last (N-01).
 * 6. It shows the flags, replacing the document's earlier Craft Flags. A
 *    selection run replaces only those that overlap its selection, as the
 *    gesture read it (Slice 3's rule).
 *
 * One gesture per document at a time. Everything dropped is counted, never
 * guessed. Logs name the run, never the text.
 */

import type { DocumentAnnotation, LogSink } from '@/platform';
import type { DocumentEditor, DocumentWatch } from '@/platform/DocumentEditor';
import type { IssueAnnotator } from '@/platform/IssueAnnotator';
import type { DraftEditRejectedChunks, DraftEditTarget, TextRange } from '@/domain/models/DraftEdit';
import type { CraftFlagsOutcome, CraftFlagsPass } from '@/domain/models/CraftFlag';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { countWords } from '@/utils/textUtils';
import { findProtectedRegions, maskProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import { findSpeechSpansOutsideProtected } from '@/utils/draftEdit/speechSpans';
import type { CraftFlagsEstimate, CraftFlagsRunRequest, CraftFlagsRunResult } from '@services/craftFlags/CraftFlagsService';
import { moveIssues, outsideProtected } from '@/application/services/draftEdit/draftEditIssues';
import {
  craftFlagAnnotation,
  noCraftFlagDrops,
  outsideSpeech,
  placeCraftFlags,
  withRepeats,
  type CraftFlagsPrepared
} from '@/application/services/draftEdit/craftFlagsPlacement';
import { continuitySections, withinOneSection } from '@/application/services/draftEdit/craftFlagsSections';

/** The Craft Flags pass as this use case needs it: a passage in, passage-relative flags out, and their price before. */
export interface CraftFlagsPassPort {
  estimate(request: Pick<CraftFlagsRunRequest, 'passage' | 'categories' | 'breaks' | 'reasoning'>): Promise<CraftFlagsEstimate>;
  flag(request: CraftFlagsRunRequest): Promise<CraftFlagsRunResult>;
}

/** The writer's gesture, held from its first read until it runs or is released (PR #177 F-02). Opaque to the host. */
export interface CraftFlagsGesture {
  readonly uri: string;
}

/** A gesture taken, or why there is none: nothing to read, too much, a run already held, or a document already moved on. */
export type CraftFlagsBegin =
  | { readonly kind: 'gesture'; readonly gesture: CraftFlagsGesture }
  | Extract<CraftFlagsOutcome, { kind: 'empty' | 'too-long' | 'busy' | 'changed' }>;

/** What a gesture would read and cost, before anything is sent: the host's confirmation reads it. */
export type CraftFlagsRunPlan =
  /** No API key: the run would send nothing, so there is nothing to price. */
  | { readonly kind: 'unconfigured' }
  /** The document closed, reopened or changed language while it was priced: no confirmation, nothing sent. */
  | { readonly kind: 'changed' }
  | {
      readonly kind: 'ready';
      /** Words the calls read. */
      readonly words: number;
      /** The whole document, or (over the word ceiling) the selection alone. */
      readonly reads: 'document' | 'selection';
      /** Whether the run shows only a selection's flags. */
      readonly selection: boolean;
      /** The price of the model it names, which is the model a run approved from it goes to. */
      readonly estimate: CraftFlagsEstimate & { readonly model: string };
    };

/** What the writer approved: the model the confirmation named, which every call goes to (PR #177 F-01). */
export interface CraftFlagsApproval {
  readonly model: string;
}

interface Held {
  readonly target: DraftEditTarget;
  readonly pass: CraftFlagsPass;
  readonly prepared: CraftFlagsPrepared;
  /** The gesture text's protected regions, over the whole document. */
  readonly protectedRegions: readonly TextRange[];
  /** Where each of the gesture text's sections after the first begins, ascending. */
  readonly sectionStarts: readonly number[];
  /** The lines that open the read passage's sections after the first, masked as the passage is: continuity's request lists them. */
  readonly breaks: readonly string[];
  readonly watch: DocumentWatch;
  /** A selection run's earlier flags outside its selection, chosen at the gesture. */
  readonly keep: ReadonlySet<string>;
  ran: boolean;
}

type Prepared =
  | (CraftFlagsPrepared & { readonly protectedRegions: readonly TextRange[] })
  | Extract<CraftFlagsOutcome, { kind: 'empty' | 'too-long' }>;

export class CraftFlagsUseCase {
  private readonly inFlight = new Set<string>();
  private readonly held = new Map<CraftFlagsGesture, Held>();
  private sequence = 0;

  constructor(
    private readonly craftPass: CraftFlagsPassPort,
    private readonly documents: DocumentEditor,
    private readonly annotations: IssueAnnotator,
    private readonly log: LogSink
  ) {}

  /** Take the gesture: synchronously, before anything is awaited. */
  begin(target: DraftEditTarget, pass: CraftFlagsPass): CraftFlagsBegin {
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
    const gesture: CraftFlagsGesture = { uri: target.uri };
    const sections = continuitySections(target.text, prepared.protectedRegions, prepared.region, pass.categories);
    this.inFlight.add(target.uri);
    this.held.set(gesture, {
      target,
      pass,
      prepared,
      protectedRegions: prepared.protectedRegions,
      sectionStarts: sections.starts,
      breaks: sections.breaks,
      watch,
      keep: this.flagsOutside(target),
      ran: false
    });
    return { kind: 'gesture', gesture };
  }

  /** Price a held gesture. A lifetime that ends while it is priced shows no confirmation. */
  async plan(gesture: CraftFlagsGesture): Promise<CraftFlagsRunPlan> {
    const held = this.open(gesture);
    const estimate = await this.craftPass.estimate({
      passage: held.prepared.masked.text,
      categories: held.pass.categories,
      breaks: held.breaks,
      ...(held.pass.reasoning ? { reasoning: held.pass.reasoning } : {})
    });
    // Asked once the price is in: nothing could end the lifetime before pricing began, since `begin` took it synchronously.
    if (held.watch.ended()) {
      this.release(gesture);
      return { kind: 'changed' };
    }
    const { model } = estimate;
    if (model === undefined) {
      this.release(gesture);
      return { kind: 'unconfigured' };
    }
    return {
      kind: 'ready',
      words: held.prepared.words,
      reads: held.prepared.reads,
      selection: held.target.range !== undefined,
      estimate: { ...estimate, model }
    };
  }

  /** End a gesture unsent: declined, failed or cancelled before it ran. Nothing happens to one already ended. */
  release(gesture: CraftFlagsGesture): void {
    const held = this.held.get(gesture);
    if (held && !held.ran) {
      this.finish(gesture, held);
    }
  }

  /** Send a held gesture, once, to the approved model; it ends however the run does. */
  async run(gesture: CraftFlagsGesture, approval: CraftFlagsApproval, signal?: AbortSignal): Promise<CraftFlagsOutcome> {
    const held = this.open(gesture);
    held.ran = true;
    try {
      return await this.flag(held, approval, signal);
    } finally {
      this.finish(gesture, held);
    }
  }

  private async flag(held: Held, approval: CraftFlagsApproval, signal?: AbortSignal): Promise<CraftFlagsOutcome> {
    const { target, prepared, watch } = held;
    if (watch.ended()) {
      return { kind: 'changed' };
    }
    const label = `${target.relativePath ?? 'untitled document'}${target.range ? ' (selection)' : ''}`;
    const speech = findSpeechSpansOutsideProtected(target.text, held.protectedRegions);
    const result = await this.craftPass.flag({
      passage: prepared.masked.text,
      categories: held.pass.categories,
      breaks: held.breaks,
      label,
      model: approval.model,
      ...(held.pass.reasoning ? { reasoning: held.pass.reasoning } : {}),
      stillCurrent: () => !watch.ended(),
      ...(signal ? { signal } : {})
    });
    if (result.kind === 'unconfigured') {
      return { kind: 'unconfigured' };
    }
    if (result.kind === 'ended') {
      this.log.appendLine(`[DraftEdit] Craft Flags ${label}: the document closed or changed language before the calls were sent; nothing sent`);
      return { kind: 'changed' };
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
    const scope = { speech, shown: shownRegion, sectionStarts: held.sectionStarts };
    const placed = placeCraftFlags(target.text, prepared, result, scope, dropped, () => `craft-${++this.sequence}`);
    const settled = watch.settle();
    if (settled.kind === 'closed') {
      this.log.appendLine(`[DraftEdit] Craft Flags ${label}: the document closed during the run; nothing shown`);
      return { kind: 'closed', rejectedCalls, ...(result.usage ? { usage: result.usage } : {}) };
    }
    const live = settled.snapshot;
    const moved = moveIssues(placed.issues, settled.edits, live.text);
    dropped.stale += placed.issues.length - moved.length;
    const liveRegions = findProtectedRegions(live.text, live.languageId);
    const liveSpeech = findSpeechSpansOutsideProtected(live.text, liveRegions);
    const current = withRepeats(
      withinOneSection(
        outsideSpeech(outsideProtected(moved, live.text, live.languageId, dropped, liveRegions), liveSpeech, dropped),
        live.text,
        liveRegions,
        dropped
      ),
      live.text,
      [...liveSpeech, ...liveRegions]
    );

    // Nothing is awaited between the settle and `show`, so the version still holds unless the host refuses it.
    const kept = this.keptFlags(target.uri, live.version, held.keep);
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
  }

  /** A gesture still held and not yet sent; anything else is a host's mistake, never a second run. */
  private open(gesture: CraftFlagsGesture): Held {
    const held = this.held.get(gesture);
    if (!held || held.ran) {
      throw new Error('This Craft Flags gesture has already run or been released');
    }
    return held;
  }

  private finish(gesture: CraftFlagsGesture, held: Held): void {
    held.ran = true;
    held.watch.dispose();
    this.held.delete(gesture);
    this.inFlight.delete(gesture.uri);
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
      return { ...whole, protectedRegions };
    }
    return selection && selection.words <= limit
      ? { ...selection, protectedRegions }
      : { kind: 'too-long', words: (selection ?? whole).words, limit };
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
