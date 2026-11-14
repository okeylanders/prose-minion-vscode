/**
 * `transcript.read` for one persona turn (ADR 2026-10-05 §1, §7, D9, D11):
 * the turn's read limits and what a read records. One instance per turn, so
 * its counts are the turn's.
 *
 * - Reads per turn: at most `readsPerTurn`, beside the shared call ceiling.
 *   A read that reached the service counts, whatever became of it.
 * - Characters per turn: all reads together deliver at most
 *   `readCharactersPerTurn`, two full reads, when the window is known.
 * - The window clamp: a read takes at most half the room the model's
 *   context window has for evidence, by the preflight's own estimate of
 *   what was rendered (reads/WorkshopReadWindowFit).
 * - An unknown window: no clamp, and no preflight either, so nothing local
 *   checks what a read costs. The turn's reads then share one read's worth,
 *   `readCharacters`, and a limited or refused read says why (Slice 5).
 * - A read whose limit leaves less than a minimum share per session named
 *   is refused, with the characters left and the minimum. It is never
 *   narrowed silently, and the renderer is never asked for less.
 * - Provenance comes from the rendered text: what each session delivered,
 *   with first and last turn ids.
 */

import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopCapabilityResult } from '@shared/types/workshopCapabilities';
import type { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  renderWorkshopRecallRead,
  WorkshopRecallRenderedRead
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { workshopRecallMinimumReadCharacters } from '@/application/services/workshop/recall/WorkshopRecallReadSection';
import { formatWorkshopRecallTurnRanges } from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import { recallLabel, recallLabelList } from '@/application/services/workshop/recall/WorkshopRecallText';
import { recallCount, recallQuoted } from '@/application/services/workshop/recall/WorkshopRecallCopy';
import {
  workshopTranscriptRecallRefusedReadAdvice,
  workshopTranscriptRecallRequestSummary
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRequestCopy';
import {
  fitWorkshopReadToWindow,
  workshopReadEvidenceTokens,
  WorkshopMeasuredRead,
  WorkshopReadWindowFit
} from '@/application/services/workshop/reads/WorkshopReadWindowFit';
import type { WorkshopRecallReadResult } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import {
  assertNeverRecallValue,
  recallFailedResult,
  recallListedRanges,
  recallNumber as count,
  recallRejectedResult,
  recallScanCosts,
  throwIfRecallTurnAborted,
  WORKSHOP_RECALL_LISTED_RANGES,
  WorkshopRecallOperationContext,
  WorkshopRecallOperationOutcome,
  WorkshopRecallRequestOf
} from '@/application/services/workshop/recall/WorkshopRecallOperationResults';

type ReadRequest = WorkshopRecallRequestOf<'transcript.read'>;

/** What set a read's character limit; reported in metadata and, below the budget, in the text. */
type ReadLimitSource = 'read-budget' | 'per-turn-total' | 'context-window';

interface ReadLimit {
  readonly characters: number;
  readonly by: ReadLimitSource;
}

export class WorkshopRecallReadOperation {
  private reads = 0;
  private readCharacters = 0;

  constructor(
    private readonly recall: Pick<WorkshopTranscriptRecallService, 'read'>,
    private readonly context: WorkshopRecallOperationContext
  ) {}

  async run(request: ReadRequest, window?: CapabilityContextWindow): Promise<WorkshopRecallOperationOutcome> {
    const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
    if (this.reads >= budgets.readsPerTurn) {
      return {
        result: recallRejectedResult(this.context, request, 'recall-read-limit',
          `Only ${budgets.readsPerTurn} transcript reads are allowed per user turn. ` +
            'Answer from the reads you have, and tell the writer which sessions and turns are left for your next turn.')
      };
    }
    const minimum = workshopRecallMinimumReadCharacters(request.sessions.length);
    const limit = this.readLimit(window);
    if (limit.characters < minimum) {
      return { result: this.tooSmall(request, limit, minimum, window) };
    }
    this.reads += 1;
    const result = await this.recall.read({ sessions: request.sessions, detail: request.detail }, this.context.turn.signal);
    throwIfRecallTurnAborted(this.context.turn.signal);
    // Below the first guess, only the window limits a read.
    // Each rendering's manifest rows, by the result the window fit keeps.
    const sourcesOf = new Map<WorkshopCapabilityResult, WorkshopRecallOperationOutcome['sources']>();
    const render = (characters: number): WorkshopMeasuredRead => {
      const readLimit: ReadLimit = characters === limit.characters ? limit : { characters, by: 'context-window' };
      const rendered = renderWorkshopRecallRead(result, { now: this.context.now(), readCharacters: characters, notes: this.limitNotes(readLimit, window) });
      const recorded = this.readOutcome(request, result, rendered, readLimit);
      sourcesOf.set(recorded.result, recorded.sources);
      return { size: characters, outcome: recorded.result, tokens: window ? workshopReadEvidenceTokens(recorded.result) : 0 };
    };
    const half = window ? Math.floor(window.freeInputTokens / 2) : undefined;
    const fitted: WorkshopReadWindowFit = half === undefined
      ? { fit: render(limit.characters), renders: 1 }
      : fitWorkshopReadToWindow(render, limit.characters, half, minimum);
    if (!fitted.fit) {
      return { result: this.windowTooSmall(request, minimum, half!, fitted.minimum) };
    }
    const { outcome, tokens } = fitted.fit;
    this.readCharacters += outcome.content!.length;
    this.context.log(`read sessions=${request.sessions.length} limit=${fitted.fit.size} by=${String(outcome.metadata!.limitedBy)} ` +
      `characters=${outcome.content!.length} turnTotal=${this.readCharacters}` +
      (half === undefined ? ' window=unknown' : ` tokens=${tokens} halfWindow=${half} renders=${fitted.renders}`));
    return { result: outcome, sources: sourcesOf.get(outcome) };
  }

  /** The tightest of the read budget, what is left of the turn's total, and half the window. */
  private readLimit(window: CapabilityContextWindow | undefined): ReadLimit {
    const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
    let limit: ReadLimit = { characters: budgets.readCharacters, by: 'read-budget' };
    const left = turnTotal(window) - this.readCharacters;
    if (left < limit.characters) {
      limit = { characters: Math.max(0, left), by: 'per-turn-total' };
    }
    if (window) {
      // A first guess, at the estimate's characters per token; the rendered read is measured after.
      const half = Math.floor(window.freeInputTokens / 2) * PROMPT_BUDGETS.inferenceContext.bytesPerToken;
      if (half < limit.characters) {
        limit = { characters: half, by: 'context-window' };
      }
    }
    return limit;
  }

  private limitNotes(limit: ReadLimit, window: CapabilityContextWindow | undefined): string[] {
    switch (limit.by) {
      case 'read-budget':
        return [];
      case 'per-turn-total':
        return [`This read was limited to ${count(limit.characters)} characters: ${this.turnTotalWords(window)}.`];
      case 'context-window':
        return [`This read was limited to ${count(limit.characters)} characters, half the room left in your context window.`];
      default:
        return assertNeverRecallValue(limit.by);
    }
  }

  private turnTotalWords(window: CapabilityContextWindow | undefined): string {
    return `earlier reads this turn used ${count(this.readCharacters)} of the ${count(turnTotal(window))}-character total` +
      (window ? '' : ", one read's worth, because the size of your context window is unknown");
  }

  /** Decision 2: a bounded, recorded refusal naming what is left and what the read needs. */
  private tooSmall(
    request: ReadRequest,
    limit: ReadLimit,
    minimum: number,
    window: CapabilityContextWindow | undefined
  ): WorkshopCapabilityResult {
    const named = request.sessions.length;
    const why = limit.by === 'context-window' ? 'half the room left in your context window' : this.turnTotalWords(window);
    return recallRejectedResult(
      this.context,
      request,
      limit.by === 'context-window' ? 'recall-context-window' : 'recall-read-total',
      `This read names ${recallCount(named, 'saved session')} and needs at least ${count(minimum)} characters ` +
        `(${count(minimum / Math.max(1, named))} per session), but only ${count(limit.characters)} are left: ${why}. ` +
        // The turn's total resets with the next writer message; the window does not.
        workshopTranscriptRecallRefusedReadAdvice(named, limit.by === 'context-window' ? 'unread' : 'next-turn'),
      { charactersLeft: limit.characters, minimumCharacters: minimum, sessionsNamed: named }
    );
  }

  /**
   * Decision 2 after measuring: even the minimum read costs more than half
   * the window. The characters left are what that half holds of this text,
   * at the density the minimum read measured.
   */
  private windowTooSmall(
    request: ReadRequest,
    minimum: number,
    half: number,
    measured: WorkshopMeasuredRead | undefined
  ): WorkshopCapabilityResult {
    const tokens = measured?.tokens ?? Number.POSITIVE_INFINITY;
    const characters = Number.isFinite(tokens) && tokens > 0 ? Math.floor(minimum * (half / tokens)) : 0;
    const named = request.sessions.length;
    return recallRejectedResult(
      this.context,
      request,
      'recall-context-window',
      `This read names ${recallCount(named, 'saved session')} and needs at least ${count(minimum)} characters ` +
        `(${count(minimum / Math.max(1, named))} per session), but half the room left in your context window holds ` +
        `only about ${count(characters)} characters of these sessions: the minimum read measured ` +
        `${Number.isFinite(tokens) ? count(tokens) : 'more'} tokens against ${count(half)}. ` +
        workshopTranscriptRecallRefusedReadAdvice(named, 'unread'),
      {
        charactersLeft: characters,
        minimumCharacters: minimum,
        sessionsNamed: named,
        ...(Number.isFinite(tokens) ? { minimumTokens: tokens } : {}),
        halfWindowTokens: half
      }
    );
  }

  private readOutcome(
    request: ReadRequest,
    result: WorkshopRecallReadResult,
    rendered: WorkshopRecallRenderedRead,
    limit: ReadLimit
  ): WorkshopRecallOperationOutcome {
    if (!result.available) {
      return { result: recallFailedResult(request, rendered.content, { outcome: 'unavailable', unavailableReason: result.reason }) };
    }
    const read = result.sessions.flatMap((session) => (session.outcome === 'read' ? [session] : []));
    const titleOf = new Map(read.map((session) => [session.header.sessionId, session.header.title]));
    const sessions = rendered.sessions.map((session) => ({
      sessionId: recallLabel(session.sessionId),
      ...(titleOf.has(session.sessionId) ? { title: recallLabel(titleOf.get(session.sessionId)!) } : {}),
      outcome: session.outcome,
      delivered: session.delivered.slice(0, WORKSHOP_RECALL_LISTED_RANGES).map((range) => ({
        from: range.from,
        to: range.to,
        firstTurnId: recallLabel(range.firstTurnId),
        lastTurnId: recallLabel(range.lastTurnId),
        entryCount: range.entryCount
      })),
      continuation: formatWorkshopRecallTurnRanges(session.continuation.slice(0, WORKSHOP_RECALL_LISTED_RANGES)),
      collapsedReports: session.collapsed.length,
      ...(session.truncatedEntry ? { cutTurn: session.truncatedEntry.position } : {})
    }));
    const truncated = rendered.sessions.some((session) => session.continuation.length > 0 || session.truncatedEntry) ||
      result.bounds.notReadByByteBudget > 0;
    const outcome: WorkshopCapabilityResult = {
      capability: request.capability,
      status: read.length === 0 ? 'failed' : read.length < result.sessions.length ? 'partial' : 'success',
      requestSummary: readSummary(request, read.map((session) => session.header.title)),
      content: rendered.content,
      metadata: {
        outcome: 'read',
        detail: result.detail,
        sessionCount: read.length,
        sessionsNamed: result.sessions.length,
        sessions,
        readLimit: limit.characters,
        limitedBy: limit.by,
        notReadByByteBudget: result.bounds.notReadByByteBudget,
        ...recallScanCosts(result.bounds),
        truncated,
        characters: rendered.content.length
      },
      ...(read.length === 0 ? { error: 'None of the named sessions could be read.' } : {})
    };
    // One "Past session" row per session the read delivered turns from (ADR 2026-10-05 §7).
    return {
      result: outcome,
      sources: rendered.sessions.flatMap((session) => {
        const title = titleOf.get(session.sessionId);
        return title !== undefined && session.delivered.length > 0
          ? [{ kind: 'transcript' as const, label: `${recallQuoted(title)} · turns ${recallListedRanges(session.delivered)}`, sizeChars: session.characters }]
          : [];
      })
    };
  }
}

/**
 * What a turn's reads may deliver together: two full reads when the window
 * clamp measures each one, and one read's worth when the window is unknown,
 * since then nothing local checks what a read costs (Slice 5 decision 1).
 */
function turnTotal(window: CapabilityContextWindow | undefined): number {
  const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
  return window ? budgets.readCharactersPerTurn : budgets.readCharacters;
}

/** “Title” · turns 38-46, or the titles a read of several sessions read. */
function readSummary(request: ReadRequest, titles: readonly string[]): string {
  if (titles.length === 0) {
    return workshopTranscriptRecallRequestSummary(request);
  }
  if (request.sessions.length === 1) {
    const turns = request.sessions[0].turns;
    return `${recallQuoted(titles[0])}${turns ? ` · turns ${recallListedRanges(turns)}` : ''}`;
  }
  return `${recallCount(request.sessions.length, 'saved session')}: ${recallLabelList(titles.map(recallQuoted), 200)}`;
}
