/**
 * LightboxReadingRunner — runs a board's reading groups (ADR 2026-10-19 D6,
 * D7, D8). Built once at the composition root and carried in `CoreServices`.
 *
 * - **Preparation.** A group's exact messages are built once
 *   (`LightboxReadingPrompts`) and serve both the fit and cost estimate and
 *   the call, so the estimate measures what is sent.
 * - **Execution.** The `generateParallelDictionary` pattern: the groups fan
 *   out under bounded concurrency on the **assistant** engine with the
 *   `assistantWithoutResources` policy, each with its own timeout. One group
 *   failing never sinks another, and usage is summed. Token usage reaches the
 *   processed chip through the engine's own fan-out.
 * - **Lifecycle.** The widget handlers' pattern, per board: one active
 *   run with a host-minted token and an `AbortController`. A second press on
 *   a board with a run in flight is refused; Stop aborts it; a result that
 *   arrives after its run stopped, or for a run that is no longer the board's
 *   active one, is dropped.
 * - **Ownership from the press (PR #149 F-02).** A press `reserve`s its board
 *   before its first await: the token is minted and the board held while
 *   the prompt files load, so a second press is refused and `cancel` (Stop,
 *   or the tab closing) releases it. `startReserved` starts the engine only
 *   while the reservation is still held, so a press released during
 *   preparation never sends anything. `activeRun` reports only started
 *   runs: a reservation has nothing to stop yet.
 * - **Every started run finishes (PR #149 F-10).** `done` never rejects. A
 *   run whose setup over the chapter fails (the quote verifier, the term
 *   counter) fails every group with nothing sent; a group that throws past
 *   its call fails alone; a listener that throws is logged. The run is then
 *   released and finished like any other.
 * - **Validation.** A reply that came back becomes its group's outcome in
 *   `LightboxGroupReply`: one cut off at the output ceiling, or whose frame
 *   cannot be read, fails its group with its paid body quarantined; blocks
 *   and items that break their own rules are withheld, not failed.
 *
 * Logs carry groups, lenses, counts and reasons, never the chapter, the
 * context, or the model's prose. Every reason is host-owned (PR #149 F-05): a
 * failed call is described by its category (`LightboxCallFailure`), never by
 * the provider's text, and a rejected reply by the codec's own words. What a
 * rejection knows beyond that (an undefined field's name) is its
 * `diagnostic`, which goes only to the recovery store, beside the body.
 */

import { randomUUID } from 'node:crypto';
import pLimit from 'p-limit';
import type { LightboxActiveRun, LightboxReadingGroupId, LightboxRunEstimate } from '@messages';
import type { LogSink } from '@/platform';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import type { AgentRunEngine } from '@orchestration/AgentRunEngine';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import type { PromptLoader } from '@/tools/shared/prompts';
import type {
  RejectedModelResponseRecovery,
  RejectedModelResponseRecoveryPresenter
} from '@/infrastructure/storage/RejectedModelResponseRecoveryStore';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { describeLightboxCallFailure, describeLightboxHostFailure } from '@/infrastructure/lightbox/LightboxCallFailure';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { lightboxColumnKeys } from '@/infrastructure/lightbox/LightboxTileCounts';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { LIGHTBOX_READING_GROUPS } from '@shared/constants/lightbox';
import { readLightboxGroupReply, type LightboxGroupTools } from '@/infrastructure/lightbox/LightboxGroupReply';
import {
  buildLightboxUserMessage,
  lightboxSystemPromptFiles,
  type LightboxGroupRequest
} from '@/infrastructure/lightbox/LightboxReadingPrompts';
import {
  estimateLightboxRun,
  type LightboxModelFacts,
  type LightboxPreparedCall
} from '@/infrastructure/lightbox/LightboxRunEstimate';
import {
  failedLightboxGroup,
  OPENROUTER_LIGHTBOX_CATALOG,
  sumUsage,
  type LightboxGroupOutcome,
  type LightboxModelCatalog,
  type LightboxPricedSnapshot,
  type LightboxReadingEngines,
  type LightboxRunListener,
  type LightboxRunReservation,
  type LightboxRunReserve,
  type LightboxRunSource,
  type LightboxRunStart
} from '@/infrastructure/lightbox/LightboxReadingRunContracts';

export interface LightboxReadingRunnerOptions {
  catalog?: LightboxModelCatalog;
  mintToken?: () => string;
  timeoutMilliseconds?: number;
  concurrency?: number;
}

/** Long enough for a book-sized chapter to be read and answered. */
const DEFAULT_GROUP_TIMEOUT_MILLISECONDS = 300_000;
/** One call per reading group at most, so this runs them all at once (five from Slice 4C). */
const DEFAULT_GROUP_CONCURRENCY = LIGHTBOX_READING_GROUPS.length;
const PROGRESS_REPORT_INTERVAL_CHARACTERS = 1_000;
const READING_TEMPERATURE = 0.4;

interface ActiveRunState {
  run: LightboxActiveRun;
  controller: AbortController;
  /** False while the press is reserved and its calls are being prepared. */
  started: boolean;
  outputCharacters: number;
  lastReportedCharacters: number;
}

const ALREADY_READING = 'This board is already being read. Stop that run first.';
const NO_API_KEY = 'Add an OpenRouter API key in Settings to read the chapter.';
const NOTHING_TO_READ = 'Every lens is off, so there is nothing to read.';

export class LightboxReadingRunner {
  private readonly active = new Map<string, ActiveRunState>();
  private readonly catalog: LightboxModelCatalog;
  private readonly mintToken: () => string;
  private readonly timeoutMilliseconds: number;
  private readonly concurrency: number;

  constructor(
    private readonly engines: LightboxReadingEngines,
    private readonly promptLoader: Pick<PromptLoader, 'loadPrompts'>,
    private readonly recovery: RejectedModelResponseRecovery,
    private readonly recoveryPresenter: RejectedModelResponseRecoveryPresenter,
    private readonly outputChannel: LogSink,
    options: LightboxReadingRunnerOptions = {}
  ) {
    this.catalog = options.catalog ?? OPENROUTER_LIGHTBOX_CATALOG;
    this.mintToken = options.mintToken ?? randomUUID;
    this.timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_GROUP_TIMEOUT_MILLISECONDS;
    this.concurrency = Math.max(1, options.concurrency ?? DEFAULT_GROUP_CONCURRENCY);
  }

  /** The exact messages each request would send. */
  async prepare(source: LightboxRunSource, requests: readonly LightboxGroupRequest[]): Promise<LightboxPreparedCall[]> {
    return Promise.all(requests.map(async (request) => {
      const systemMessage = await this.promptLoader.loadPrompts(lightboxSystemPromptFiles(request));
      const user = buildLightboxUserMessage(source.material, request);
      return {
        group: request.group,
        lenses: [...request.lenses],
        systemMessage,
        userMessage: user.message,
        chapterTokens: estimateTextTokens(user.chapterSection)
      };
    }));
  }

  /** The assistant model as the estimate sees it: its id, live window and live prices. */
  modelFacts(): LightboxModelFacts {
    const model = this.engines.getResolvedModel('assistant');
    if (!model) {
      return {};
    }
    const contextLength = this.catalog.contextLength(model);
    const pricing = this.catalog.pricing(model);
    return {
      model,
      ...(contextLength !== undefined ? { contextLength } : {}),
      ...(pricing ? { pricing } : {})
    };
  }

  /**
   * Fit and cost of the calls, priced with `priced.facts` (read once, beside
   * the key that names them) rather than whatever the catalog says after the
   * prompt files load.
   */
  async estimate(
    source: LightboxRunSource,
    groups: readonly LightboxGroupRequest[],
    rereads: readonly LightboxGroupRequest[],
    priced: LightboxPricedSnapshot
  ): Promise<LightboxRunEstimate> {
    const [preparedGroups, preparedRereads] = await Promise.all([
      this.prepare(source, groups),
      this.prepare(source, rereads)
    ]);
    return estimateLightboxRun({
      boardId: source.boardId,
      key: priced.key,
      sourceWords: source.sourceWords,
      contextWords: source.contextWords,
      columnCount: source.material.columns.length,
      groups: preparedGroups,
      rereads: preparedRereads,
      facts: priced.facts
    });
  }

  /** The board's started run; a press still preparing has nothing to stop yet. */
  activeRun(boardId: string): LightboxActiveRun | undefined {
    const state = this.active.get(boardId);
    return state?.started ? state.run : undefined;
  }

  /**
   * Hold the board for a press, before anything is awaited: the run's token
   * is minted now. Refused while the board is held or read, or without an
   * engine.
   */
  reserve(
    boardId: string,
    groups: readonly LightboxReadingGroupId[],
    scope: { lens?: LightboxActiveRun['lens'] } = {}
  ): LightboxRunReserve {
    if (this.active.has(boardId)) {
      return { reserved: false, message: ALREADY_READING };
    }
    if (!this.engines.getEngine('assistant')) {
      return { reserved: false, message: NO_API_KEY };
    }
    const run: LightboxActiveRun = {
      boardId,
      token: this.mintToken(),
      groups: [...groups],
      ...(scope.lens ? { lens: scope.lens } : {})
    };
    const state: ActiveRunState = {
      run,
      controller: new AbortController(),
      started: false,
      outputCharacters: 0,
      lastReportedCharacters: 0
    };
    this.active.set(boardId, state);
    return { reserved: true, reservation: state };
  }

  /** Whether the reservation still holds its board: not stopped, released or disposed. */
  holds(reservation: LightboxRunReservation): boolean {
    const state = reservation as ActiveRunState;
    return this.active.get(state.run.boardId) === state && !state.controller.signal.aborted;
  }

  /** Give up a reservation that will not start (refused after preparation). */
  release(reservation: LightboxRunReservation): void {
    const state = reservation as ActiveRunState;
    if (this.active.get(state.run.boardId) === state && !state.started) {
      this.active.delete(state.run.boardId);
    }
  }

  /**
   * Reserve and start at once: for calls prepared without a reservation.
   * Refused (nothing sent) with no calls, without an engine, or while the
   * board has a run in flight.
   */
  start(
    source: LightboxRunSource,
    calls: readonly LightboxPreparedCall[],
    listener: LightboxRunListener,
    scope: { lens?: LightboxActiveRun['lens'] } = {}
  ): LightboxRunStart {
    if (calls.length === 0) {
      return { started: false, message: NOTHING_TO_READ };
    }
    const held = this.reserve(source.boardId, calls.map((call) => call.group), scope);
    return held.reserved ? this.startReserved(held.reservation, source, calls, listener) : { started: false, message: held.message };
  }

  /**
   * Start a reservation's prepared calls, if it still holds its board.
   * `done` settles when every call has, whether or not the run was stopped.
   */
  startReserved(
    reservation: LightboxRunReservation,
    source: LightboxRunSource,
    calls: readonly LightboxPreparedCall[],
    listener: LightboxRunListener
  ): LightboxRunStart {
    const state = reservation as ActiveRunState;
    if (!this.holds(reservation) || state.started || state.run.boardId !== source.boardId) {
      return { started: false, message: 'This press was stopped before it started.' };
    }
    // The run names the groups it was reserved for; the calls must be exactly those.
    const reservedCalls = calls.length === state.run.groups.length &&
      calls.every((call, index) => call.group === state.run.groups[index]);
    const engine = this.engines.getEngine('assistant');
    if (calls.length === 0 || !reservedCalls || !engine) {
      this.release(reservation);
      const message = calls.length === 0 ? NOTHING_TO_READ : !reservedCalls ? 'The prepared calls are not the ones this press reserved.' : NO_API_KEY;
      return { started: false, message };
    }
    state.started = true;
    const { run } = state;
    this.outputChannel.appendLine(
      `[LightboxReadingRunner] Run ${run.token} started: groups ${run.groups.join(', ')}` +
        (run.lens ? ` (re-read ${run.lens})` : '')
    );
    // Begun on the next microtask: the listener hears nothing before the caller holds the run.
    const done = Promise.resolve().then(() => this.execute(engine, state, source, calls, listener));
    return { started: true, run, done };
  }

  /** Stop the board's run or reservation, if it is the one named. Finished groups stay as they landed. */
  cancel(boardId: string, token: string): boolean {
    const state = this.active.get(boardId);
    if (!state || state.run.token !== token) {
      return false;
    }
    this.active.delete(boardId);
    state.controller.abort();
    this.outputChannel.appendLine(`[LightboxReadingRunner] Run ${token} ${state.started ? 'stopped' : 'released before it started'}`);
    return true;
  }

  /** Stop every run (composition-root teardown). */
  dispose(): void {
    for (const state of this.active.values()) {
      state.controller.abort();
    }
    this.active.clear();
  }

  private isCurrent(state: ActiveRunState): boolean {
    return this.active.get(state.run.boardId) === state && !state.controller.signal.aborted;
  }

  private async execute(
    engine: Pick<AgentRunEngine, 'runInitial'>,
    state: ActiveRunState,
    source: LightboxRunSource,
    calls: readonly LightboxPreparedCall[],
    listener: LightboxRunListener
  ): Promise<void> {
    const settled: LightboxGroupOutcome[] = [];
    const settle = (outcome: LightboxGroupOutcome): void => {
      settled.push(outcome);
      this.notify(state, () => listener.onGroup(outcome));
    };
    const tools = this.readingTools(state, source);
    if ('failure' in tools) {
      // Nothing was sent: every group fails, in the host's own words.
      if (this.isCurrent(state)) {
        calls.forEach((call) => settle(failedLightboxGroup(call, tools.failure)));
      }
    } else {
      const limit = pLimit(this.concurrency);
      await Promise.all(calls.map((call) => limit(async () => {
        const outcome = this.isCurrent(state) ? await this.settleGroup(engine, state, source, call, tools, listener) : undefined;
        // Stale when the run was stopped, or the board's run is no longer this one.
        if (outcome && this.isCurrent(state)) {
          settle(outcome);
        }
      })));
    }
    if (!this.isCurrent(state)) {
      return;
    }
    this.active.delete(state.run.boardId);
    const outcomes = calls.flatMap((call) => settled.filter((outcome) => outcome.group === call.group));
    this.outputChannel.appendLine(
      `[LightboxReadingRunner] Run ${state.run.token} finished: ` +
        outcomes.map((outcome) => `${outcome.group} ${outcome.status}`).join(', ')
    );
    this.notify(state, () => listener.onFinished({ outcomes, usage: sumUsage(outcomes.map((outcome) => outcome.usage)) }));
  }

  /** The quote verifier and term counter over the whole chapter, built before any call is sent. */
  private readingTools(state: ActiveRunState, source: LightboxRunSource): LightboxGroupTools | { failure: string } {
    try {
      return {
        verifier: createLightboxQuoteVerifier(source.material.paragraphs),
        counter: createLightboxTermCounter(source.material.paragraphs),
        // Each ribbon column's text as read, so a stale tension score stays on it (PR #150 F-06).
        columnKeys: lightboxColumnKeys(source.material.paragraphs, source.material.columns),
        // What a numbers reading may name, and how its quotes are checked (Slice 4B).
        standouts: lightboxStandoutRows(source.material.numbers)
      };
    } catch (error) {
      const failure = describeLightboxHostFailure(error, 'setup');
      this.outputChannel.appendLine(`[LightboxReadingRunner] Run ${state.run.token} could not be set up: ${failure.log}`);
      return { failure: failure.message };
    }
  }

  /** One group; it fails alone if anything past its call throws. */
  private async settleGroup(
    engine: Pick<AgentRunEngine, 'runInitial'>,
    state: ActiveRunState,
    source: LightboxRunSource,
    call: LightboxPreparedCall,
    tools: LightboxGroupTools,
    listener: LightboxRunListener
  ): Promise<LightboxGroupOutcome | undefined> {
    try {
      return await this.runGroup(engine, state, source, call, tools, listener);
    } catch (error) {
      const failure = describeLightboxHostFailure(error, 'check');
      this.outputChannel.appendLine(`[LightboxReadingRunner] Group ${call.group} could not be checked: ${failure.log}`);
      return failedLightboxGroup(call, failure.message);
    }
  }

  /** A listener that throws is logged by its class and never keeps the run from finishing. */
  private notify(state: ActiveRunState, deliver: () => void): void {
    try {
      deliver();
    } catch (error) {
      this.outputChannel.appendLine(`[LightboxReadingRunner] Run ${state.run.token} listener failed: ${describeLightboxCallFailure(error).log}`);
    }
  }

  private async runGroup(
    engine: Pick<AgentRunEngine, 'runInitial'>,
    state: ActiveRunState,
    source: LightboxRunSource,
    call: LightboxPreparedCall,
    tools: LightboxGroupTools,
    listener: LightboxRunListener
  ): Promise<LightboxGroupOutcome | undefined> {
    let result: ExecutionResult;
    try {
      result = await engine.runInitial({
        toolName: `lightbox-group-${call.group.toLowerCase()}`,
        systemMessage: call.systemMessage,
        userMessage: call.userMessage,
        policy: AGENT_RUN_POLICIES.assistantWithoutResources,
        options: {
          temperature: READING_TEMPERATURE,
          maxTokens: PROMPT_BUDGETS.lightbox.groupOutputTokens,
          timeoutMs: this.timeoutMilliseconds,
          signal: state.controller.signal,
          onToken: (chunk) => this.reportProgress(state, chunk, listener)
        }
      });
    } catch (error) {
      if (!this.isCurrent(state)) {
        return undefined;
      }
      // The provider's text is never repeated: only the host's category is logged and shown.
      const failure = describeLightboxCallFailure(error);
      this.outputChannel.appendLine(`[LightboxReadingRunner] Group ${call.group} call failed: ${failure.log}`);
      return failedLightboxGroup(call, failure.message);
    }
    if (!this.isCurrent(state)) {
      return undefined;
    }
    if (result.cancelled) {
      // Not stopped by the writer, so the call's own timeout aborted it.
      const minutes = Math.round(this.timeoutMilliseconds / 60_000);
      this.outputChannel.appendLine(`[LightboxReadingRunner] Group ${call.group} timed out`);
      return failedLightboxGroup(call, `The call took longer than ${minutes} minutes and was stopped. Read the rest to try again.`, result);
    }

    const ports = { recovery: this.recovery, recoveryPresenter: this.recoveryPresenter, outputChannel: this.outputChannel };
    return readLightboxGroupReply(ports, { call, result, source, tools, token: state.run.token });
  }

  private reportProgress(state: ActiveRunState, chunk: string, listener: LightboxRunListener): void {
    if (!this.isCurrent(state)) {
      return;
    }
    state.outputCharacters += chunk.length;
    if (state.outputCharacters - state.lastReportedCharacters < PROGRESS_REPORT_INTERVAL_CHARACTERS) {
      return;
    }
    state.lastReportedCharacters = state.outputCharacters;
    listener.onProgress(state.outputCharacters);
  }
}
