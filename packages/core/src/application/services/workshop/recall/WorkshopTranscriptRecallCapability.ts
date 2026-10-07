/**
 * Session recall for one persona turn (ADR 2026-10-05 §1, §7, D9, D11):
 * turns one validated `transcript.*` request into a capability result. The
 * service returns data and the renderers write the text; this adapter owns
 * the turn's recall limits and what a result records.
 *
 * - Reads per turn: at most `readsPerTurn`, beside the shared call ceiling.
 *   A read that reached the service counts, whatever became of it.
 * - Characters per turn: all reads together deliver at most
 *   `readCharactersPerTurn`, two full reads, when the window is known.
 * - The window clamp: a read takes at most half the room the model's
 *   context window has for evidence, by the preflight's own estimate of
 *   what was rendered (WorkshopRecallWindowClamp).
 * - An unknown window: no clamp, and no preflight either, so nothing local
 *   checks what a read costs. The turn's reads then share one read's worth,
 *   `readCharacters`, and a limited or refused read says why (Slice 5).
 * - A read whose limit leaves less than a minimum share per session named
 *   is refused, with the characters left and the minimum. It is never
 *   narrowed silently, and the renderer is never asked for less.
 * - Provenance comes from the rendered text: what each session delivered,
 *   with first and last turn ids, and the to-dos a list showed. Recall is
 *   deterministic, so a result carries no usage. Cancellation propagates.
 */

import type { LogSink } from '@/platform';
import type { WorkshopPersonaId } from '@messages';
import type { CapabilityContextWindow, CapabilityDeliveredSource } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type {
  WorkshopCapabilityResult,
  WorkshopTranscriptRecallRequest
} from '@shared/types/workshopCapabilities';
import type { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  renderWorkshopRecallCatalog,
  renderWorkshopRecallRead,
  renderWorkshopRecallSearch,
  WorkshopRecallRenderedRead
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { renderWorkshopRecallTodos } from '@/application/services/workshop/recall/WorkshopRecallTodoList';
import { workshopRecallMinimumReadCharacters } from '@/application/services/workshop/recall/WorkshopRecallReadSection';
import { formatWorkshopRecallTurnRanges } from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import { recallLabel, recallLabelList } from '@/application/services/workshop/recall/WorkshopRecallText';
import { recallCount, recallQuoted } from '@/application/services/workshop/recall/WorkshopRecallCopy';
import {
  workshopTranscriptRecallRefusedReadAdvice,
  workshopTranscriptRecallRequestSummary
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRequestCopy';
import {
  fitWorkshopRecallReadToWindow,
  workshopRecallEvidenceTokens,
  WorkshopRecallMeasuredRead,
  WorkshopRecallWindowFit
} from '@/application/services/workshop/recall/WorkshopRecallWindowClamp';
import type { WorkshopRecallReadResult } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';

/** The service's four questions; satisfied by WorkshopTranscriptRecallService. */
export type WorkshopTranscriptRecallPort = Pick<WorkshopTranscriptRecallService, 'catalog' | 'search' | 'read' | 'todos'>;

export interface WorkshopTranscriptRecallTurnContext {
  readonly requestId: string;
  readonly personaId: WorkshopPersonaId;
  readonly signal: AbortSignal;
}

type Request<C extends WorkshopTranscriptRecallRequest['capability']> = Extract<WorkshopTranscriptRecallRequest, { capability: C }>;

/** What set a read's character limit; reported in metadata and, below the budget, in the text. */
type ReadLimitSource = 'read-budget' | 'per-turn-total' | 'context-window';

interface ReadLimit {
  readonly characters: number;
  readonly by: ReadLimitSource;
}

/** Ranges a read's provenance or a manifest label names before counting the rest. */
const LISTED_RANGES = 12;
/** Session titles in a to-do list's manifest label. */
const TODO_LABEL_TITLES = 400;

export class WorkshopTranscriptRecallCapability {
  private reads = 0;
  private readCharacters = 0;
  private readonly sources = new WeakMap<WorkshopCapabilityResult, CapabilityDeliveredSource[]>();

  constructor(
    private readonly recall: WorkshopTranscriptRecallPort,
    private readonly outputChannel: LogSink,
    private readonly turn: WorkshopTranscriptRecallTurnContext,
    private readonly now: () => number = Date.now
  ) {}

  async fulfill(request: WorkshopTranscriptRecallRequest, window?: CapabilityContextWindow): Promise<WorkshopCapabilityResult> {
    this.throwIfAborted();
    switch (request.capability) {
      case 'transcript.catalog':
        return this.catalog(request);
      case 'transcript.search':
        return this.search(request);
      case 'transcript.read':
        return this.read(request, window);
      case 'transcript.todos':
        return this.todos(request);
      default:
        return assertNever(request);
    }
  }

  /** Manifest rows for what a result put in context: none for a catalog, a search, or a failure. */
  deliveredSources(result: WorkshopCapabilityResult): readonly CapabilityDeliveredSource[] {
    return this.sources.get(result) ?? [];
  }

  private async catalog(request: Request<'transcript.catalog'>): Promise<WorkshopCapabilityResult> {
    const result = await this.recall.catalog({ personaId: request.personaId, match: request.match }, this.turn.signal);
    this.throwIfAborted();
    const content = renderWorkshopRecallCatalog(result, { now: this.now() });
    if (!result.available) {
      return this.failed(request, content, { outcome: 'unavailable', unavailableReason: result.reason });
    }
    return {
      capability: request.capability,
      status: 'success',
      requestSummary: workshopTranscriptRecallRequestSummary(request),
      content,
      metadata: {
        outcome: 'catalog',
        sessionCount: result.sessions.length,
        matchingSessions: result.matchingSessions,
        ...(result.match ? { matchMode: result.match.mode ?? 'none' } : {}),
        listingTruncated: result.listingTruncated,
        truncated: result.sessions.length < result.matchingSessions || result.listingTruncated,
        characters: content.length
      }
    };
  }

  private async search(request: Request<'transcript.search'>): Promise<WorkshopCapabilityResult> {
    const result = await this.recall.search(
      { query: request.query, sessionId: request.sessionId, personaId: request.personaId },
      this.turn.signal
    );
    this.throwIfAborted();
    const content = renderWorkshopRecallSearch(result, { now: this.now() });
    if (!result.available || result.outcome === 'unknown-session') {
      return this.failed(request, content, result.available
        ? { outcome: 'unknown-session', liveSession: result.liveSession }
        : { outcome: 'unavailable', unavailableReason: result.reason });
    }
    const { bounds, search } = result;
    const notSearched = bounds.notSearchedBySessionLimit + bounds.notSearchedByByteBudget;
    return {
      capability: request.capability,
      status: 'success',
      requestSummary: workshopTranscriptRecallRequestSummary(request),
      content,
      metadata: {
        outcome: 'searched',
        sessionCount: bounds.sessionsSearched,
        corpusSessions: bounds.corpusSessions,
        notSearched,
        matchMode: search.mode ?? 'none',
        matchedHits: search.matchedHits,
        shownHits: search.shownHits,
        ...scanCosts(bounds),
        truncated: search.shownHits < search.matchedHits || notSearched > 0 || bounds.listingTruncated,
        characters: content.length
      }
    };
  }

  private async read(request: Request<'transcript.read'>, window?: CapabilityContextWindow): Promise<WorkshopCapabilityResult> {
    const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
    if (this.reads >= budgets.readsPerTurn) {
      return this.rejected(request, 'recall-read-limit',
        `Only ${budgets.readsPerTurn} transcript reads are allowed per user turn. ` +
          'Answer from the reads you have, and tell the writer which sessions and turns are left for your next turn.');
    }
    const minimum = workshopRecallMinimumReadCharacters(request.sessions.length);
    let limit = this.readLimit(window);
    if (limit.characters < minimum) {
      return this.tooSmall(request, limit, minimum, window);
    }
    this.reads += 1;
    const result = await this.recall.read({ sessions: request.sessions, detail: request.detail }, this.turn.signal);
    this.throwIfAborted();
    // Below the first guess, only the window limits a read.
    const render = (characters: number): WorkshopRecallMeasuredRead => {
      const readLimit: ReadLimit = characters === limit.characters ? limit : { characters, by: 'context-window' };
      const rendered = renderWorkshopRecallRead(result, { now: this.now(), readCharacters: characters, notes: this.limitNotes(readLimit, window) });
      const outcome = this.readOutcome(request, result, rendered, readLimit);
      return { characters, outcome, tokens: window ? workshopRecallEvidenceTokens(outcome) : 0 };
    };
    const half = window ? Math.floor(window.freeInputTokens / 2) : undefined;
    const fitted: WorkshopRecallWindowFit = half === undefined
      ? { fit: render(limit.characters), renders: 1 }
      : fitWorkshopRecallReadToWindow(render, limit.characters, half, minimum);
    if (!fitted.fit) {
      return this.windowTooSmall(request, minimum, half!, fitted.minimum);
    }
    const { outcome, tokens } = fitted.fit;
    this.readCharacters += outcome.content!.length;
    this.log(`read sessions=${request.sessions.length} limit=${fitted.fit.characters} by=${String(outcome.metadata!.limitedBy)} ` +
      `characters=${outcome.content!.length} turnTotal=${this.readCharacters}` +
      (half === undefined ? ' window=unknown' : ` tokens=${tokens} halfWindow=${half} renders=${fitted.renders}`));
    return outcome;
  }

  private async todos(request: Request<'transcript.todos'>): Promise<WorkshopCapabilityResult> {
    const { capability: _capability, ...filters } = request;
    const result = await this.recall.todos(filters, this.turn.signal);
    this.throwIfAborted();
    const rendered = renderWorkshopRecallTodos(result, { now: this.now() });
    if (!result.available || result.outcome === 'unknown-session') {
      return this.failed(request, rendered.content, result.available
        ? { outcome: 'unknown-session', liveSession: result.liveSession }
        : { outcome: 'unavailable', unavailableReason: result.reason });
    }
    const { bounds } = result;
    const shown = rendered.shown.map(({ sessionId, todoId }) => ({ sessionId: recallLabel(sessionId), todoId: recallLabel(todoId) }));
    const titles = result.sessions
      .filter(({ header }) => rendered.shown.some((pair) => pair.sessionId === header.sessionId))
      .map(({ header }) => recallQuoted(header.title));
    const outcome: WorkshopCapabilityResult = {
      capability: request.capability,
      status: 'success',
      requestSummary: workshopTranscriptRecallRequestSummary(request),
      content: rendered.content,
      metadata: {
        outcome: 'todos',
        status: result.status,
        sessionCount: bounds.sessionsScanned,
        sessionsShown: titles.length,
        shown,
        notShownForSpace: rendered.notShownForSpace,
        omittedByItemLimit: bounds.omittedByItemLimit,
        ...scanCosts(bounds),
        truncated: rendered.notShownForSpace > 0 || bounds.omittedByItemLimit > 0 ||
          bounds.notScannedBySessionLimit > 0 || bounds.notScannedByByteBudget > 0 || bounds.listingTruncated,
        characters: rendered.content.length
      }
    };
    // One row per call, naming the sessions whose to-dos it showed (Slice 3 decision 3).
    if (shown.length > 0) {
      this.sources.set(outcome, [{
        kind: 'transcript',
        label: `To-dos · ${recallLabelList(titles, TODO_LABEL_TITLES)}`,
        sizeChars: rendered.content.length
      }]);
    }
    return outcome;
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
        return assertNever(limit.by);
    }
  }

  private turnTotalWords(window: CapabilityContextWindow | undefined): string {
    return `earlier reads this turn used ${count(this.readCharacters)} of the ${count(turnTotal(window))}-character total` +
      (window ? '' : ", one read's worth, because the size of your context window is unknown");
  }

  /** Decision 2: a bounded, recorded refusal naming what is left and what the read needs. */
  private tooSmall(
    request: Request<'transcript.read'>,
    limit: ReadLimit,
    minimum: number,
    window: CapabilityContextWindow | undefined
  ): WorkshopCapabilityResult {
    const named = request.sessions.length;
    const why = limit.by === 'context-window' ? 'half the room left in your context window' : this.turnTotalWords(window);
    return this.rejected(
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
    request: Request<'transcript.read'>,
    minimum: number,
    half: number,
    measured: WorkshopRecallMeasuredRead | undefined
  ): WorkshopCapabilityResult {
    const tokens = measured?.tokens ?? Number.POSITIVE_INFINITY;
    const characters = Number.isFinite(tokens) && tokens > 0 ? Math.floor(minimum * (half / tokens)) : 0;
    const named = request.sessions.length;
    return this.rejected(
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
    request: Request<'transcript.read'>,
    result: WorkshopRecallReadResult,
    rendered: WorkshopRecallRenderedRead,
    limit: ReadLimit
  ): WorkshopCapabilityResult {
    if (!result.available) {
      return this.failed(request, rendered.content, { outcome: 'unavailable', unavailableReason: result.reason });
    }
    const read = result.sessions.flatMap((session) => (session.outcome === 'read' ? [session] : []));
    const titleOf = new Map(read.map((session) => [session.header.sessionId, session.header.title]));
    const sessions = rendered.sessions.map((session) => ({
      sessionId: recallLabel(session.sessionId),
      ...(titleOf.has(session.sessionId) ? { title: recallLabel(titleOf.get(session.sessionId)!) } : {}),
      outcome: session.outcome,
      delivered: session.delivered.slice(0, LISTED_RANGES).map((range) => ({
        from: range.from,
        to: range.to,
        firstTurnId: recallLabel(range.firstTurnId),
        lastTurnId: recallLabel(range.lastTurnId),
        entryCount: range.entryCount
      })),
      continuation: formatWorkshopRecallTurnRanges(session.continuation.slice(0, LISTED_RANGES)),
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
        ...scanCosts(result.bounds),
        truncated,
        characters: rendered.content.length
      },
      ...(read.length === 0 ? { error: 'None of the named sessions could be read.' } : {})
    };
    // One "Past session" row per session the read delivered turns from (ADR 2026-10-05 §7).
    this.sources.set(outcome, rendered.sessions.flatMap((session) => {
      const title = titleOf.get(session.sessionId);
      return title !== undefined && session.delivered.length > 0
        ? [{ kind: 'transcript' as const, label: `${recallQuoted(title)} · turns ${listedRanges(session.delivered)}`, sizeChars: session.characters }]
        : [];
    }));
    return outcome;
  }

  private failed(
    request: WorkshopTranscriptRecallRequest,
    content: string,
    metadata: Readonly<Record<string, unknown>>
  ): WorkshopCapabilityResult {
    return {
      capability: request.capability,
      status: 'failed',
      requestSummary: workshopTranscriptRecallRequestSummary(request),
      content,
      metadata: { ...metadata, characters: content.length },
      error: 'Nothing from saved sessions was recalled.'
    };
  }

  private rejected(
    request: WorkshopTranscriptRecallRequest,
    rejectionReason: string,
    error: string,
    metadata: Readonly<Record<string, unknown>> = {}
  ): WorkshopCapabilityResult {
    this.log(`refused ${request.capability} reason=${rejectionReason}`);
    return {
      capability: request.capability,
      status: 'rejected',
      requestSummary: workshopTranscriptRecallRequestSummary(request),
      error,
      metadata: { rejectionReason, ...metadata }
    };
  }

  private throwIfAborted(): void {
    if (this.turn.signal.aborted) {
      const error = new Error('Session recall was cancelled.');
      error.name = 'AbortError';
      throw error;
    }
  }

  private log(line: string): void {
    this.outputChannel.appendLine(
      `[WorkshopTranscriptRecallCapability] request=${this.turn.requestId} persona=${this.turn.personaId} ${line}`
    );
  }
}

/** What reading many sessions cost, as the result log and the evidence report it. */
function scanCosts(bounds: {
  readonly parsedBytes: number;
  readonly unreadableSessions: number;
  readonly unreadableBytesCharged: number;
  readonly cacheHits: number;
  readonly listingTruncated: boolean;
}): Record<string, number | boolean> {
  return {
    parsedBytes: bounds.parsedBytes,
    unreadableSessions: bounds.unreadableSessions,
    unreadableBytesCharged: bounds.unreadableBytesCharged,
    cacheHits: bounds.cacheHits,
    listingTruncated: bounds.listingTruncated
  };
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
function readSummary(request: Request<'transcript.read'>, titles: readonly string[]): string {
  if (titles.length === 0) {
    return workshopTranscriptRecallRequestSummary(request);
  }
  if (request.sessions.length === 1) {
    const turns = request.sessions[0].turns;
    return `${recallQuoted(titles[0])}${turns ? ` · turns ${listedRanges(turns)}` : ''}`;
  }
  return `${recallCount(request.sessions.length, 'saved session')}: ${recallLabelList(titles.map(recallQuoted), 200)}`;
}

function listedRanges(ranges: ReadonlyArray<{ readonly from: number; readonly to: number }>): string {
  const listed = formatWorkshopRecallTurnRanges(ranges.slice(0, LISTED_RANGES));
  return ranges.length > LISTED_RANGES ? `${listed}, and ${ranges.length - LISTED_RANGES} more` : listed;
}

function count(value: number): string {
  return value.toLocaleString('en-US');
}

function assertNever(value: never): never {
  throw new Error(`Unhandled session-recall request: ${JSON.stringify(value)}`);
}
