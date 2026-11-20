/**
 * PassageSearchService — Passage Search's model work over files already in
 * hand (ADR 2026-11-20 D1, D2, D7–D12a): a search that reads.
 *
 * - **`plan` sends nothing to a model.** It chunks the files, measures the
 *   exact messages each read call will send, prices them through the
 *   engine's own price port, and returns the plan or a refusal.
 * - **`run` runs exactly the plan.** It searches the texts the plan holds
 *   and sends every call to the plan's model (`AgentRunOptions.model`); it
 *   never resolves the model or reads a file again. One capability-free
 *   call per chunk at temperature 0, a few at a time (`p-limit`), on the
 *   `passageSearch` engine that only the shared `AIResourceManager` builds.
 *   No reasoning setting is sent.
 * - **Stop and a key change start nothing more** (D7, D12a). Once the
 *   caller's signal is aborted, or the retired engine refuses a call as
 *   missing credentials, no queued read starts and no organizing pass is
 *   made. The result keeps what was found.
 * - **A failed call is that call's outcome,** counted; the run goes on. A
 *   reply cut off at its ceiling keeps its finished instances and is
 *   counted `cut`.
 * - **A run of provider failures stops the run** (`provider-failed`):
 *   `failureStreak` calls the provider failed in a row, in the order they
 *   came back, with no call answered between them. A key out of credits or
 *   rate-limited would fail every later call too. An unreadable reply is
 *   that call's failure, but the provider answered, so it neither adds to
 *   the streak nor ends it.
 * - **The organizing pass is a port** (`PassageSearchOrganizer`). Inside a
 *   run it starts only when the plan organizes, the reads ended `complete`
 *   or `instance-limit` with an instance, and the signal, read again
 *   immediately before dispatch, is not aborted.
 *
 * Callers own consent: nothing here asks the writer anything or shows
 * anything. Logs carry counts and fault kinds only (D22): never the
 * question, a quote, a note, a label or a path.
 */

import pLimit from 'p-limit';
import type { TokenUsage } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import { AgentRunUnavailableError, type AgentRunEngine } from '@orchestration/AgentRunEngine';
import { PromptLoader } from '@/tools/shared/prompts';
import type { LogSink } from '@/platform';
import { sumTokenUsage } from '@/utils/tokenUsage';
import {
  PASSAGE_SEARCH_DROP_REASONS,
  type PassageSearchDropReason,
  type PassageSearchEnded,
  type PassageSearchPlan,
  type PassageSearchPlanOutcome,
  type PassageSearchResult,
  type PassageSearchRunOptions,
  type PassageSearchSourceFile
} from '@services/search/passage/PassageSearchContracts';
import {
  anchorPassageSearchInstances,
  countPassageSearchMoments,
  mergePassageSearchInstances,
  type PassageSearchFound
} from '@services/search/passage/PassageSearchInstances';
import { PASSAGE_SEARCH_PROMPTS, buildPassageSearchMessage } from '@services/search/passage/PassageSearchMessages';
import {
  NO_PASSAGE_SEARCH_ORGANIZER,
  type PassageSearchOrganizePlan,
  type PassageSearchOrganizePlanOutcome,
  type PassageSearchOrganized,
  type PassageSearchOrganizer
} from '@services/search/passage/PassageSearchOrganizer';
import { buildPassageSearchPlan, type PassageSearchLeftOutFile } from '@services/search/passage/PassageSearchPlanning';
import type { PassageSearchModelFacts, PassageSearchPriceSource } from '@services/search/passage/PassageSearchPrices';
import { refusedPlan } from '@services/search/passage/PassageSearchRefusals';
import { PassageSearchReplyError, readPassageSearchReply } from '@services/search/passage/PassageSearchReplyCodec';

export const PASSAGE_SEARCH_MODEL_SCOPE = 'passageSearch';

export interface PassageSearchPlanRequest {
  /** The model the caller read before it awaited anything (`model()`): the plan is priced for it and runs on it. */
  readonly model: string;
  readonly question: string;
  readonly organize: boolean;
  /** In reading order, each once. */
  readonly files: readonly PassageSearchSourceFile[];
  /** Files the caller named and could not read as text. */
  readonly leftOut?: readonly PassageSearchLeftOutFile[];
}

/** What a run counts as it goes; one object, so every call's turn sees the others'. */
interface RunTally {
  readonly found: PassageSearchFound[];
  readonly usages: Array<TokenUsage | undefined>;
  readonly dropped: Record<PassageSearchDropReason, number>;
  readonly repairs: Map<string, number>;
  readonly faults: Map<string, number>;
  answered: number;
  failed: number;
  cut: number;
  unsent: number;
  ignoredFields: number;
  notesClipped: number;
  moments: number;
  keyChanged: boolean;
  limitReached: boolean;
  /** Provider failures in a row, in completion order, since the last answered call. */
  failureStreak: number;
  providerFailed: boolean;
}

export class PassageSearchService {
  constructor(
    private readonly aiResourceManager: AIResourceManager,
    private readonly promptLoader: PromptLoader,
    private readonly prices: PassageSearchPriceSource,
    private readonly log: LogSink,
    private readonly organizer: PassageSearchOrganizer = NO_PASSAGE_SEARCH_ORGANIZER
  ) {}

  /** The model a plan made now would run on; undefined with no API key. A caller reads it before it awaits anything else (D2). */
  async model(): Promise<string | undefined> {
    await this.aiResourceManager.ensureInitialized();
    return this.aiResourceManager.getEngine(PASSAGE_SEARCH_MODEL_SCOPE)?.getModel() || undefined;
  }

  async plan(request: PassageSearchPlanRequest): Promise<PassageSearchPlanOutcome> {
    const started = Date.now();
    const systemMessage = await this.promptLoader.loadPrompts([...PASSAGE_SEARCH_PROMPTS]);
    const planned = buildPassageSearchPlan({
      model: request.model,
      question: request.question,
      // With no organizer there is no pass to make: none is planned and none is priced.
      organize: request.organize && this.organizer.available,
      systemMessage,
      files: request.files,
      leftOut: request.leftOut ?? [],
      facts: await this.factsOf(request.model)
    });
    if (planned.kind !== 'planned') {
      this.log.appendLine(`[PassageSearch] Plan refused (${planned.kind}): ${request.files.length} file(s), ${Date.now() - started} ms.`);
      return refusedPlan(planned.kind, planned.kind === 'too-many-calls' ? planned.calls : 0);
    }
    const { estimate } = planned.plan;
    this.log.appendLine(
      `[PassageSearch] Plan: ${estimate.files} file(s), ${estimate.reads.calls} read call(s)${estimate.organize ? ' and an organizing allowance' : ''}, `
      + `${estimate.inputTokens} input and ${estimate.outputTokens} output token(s), ${planned.plan.chunkWords} words a call, `
      + `left out ${estimate.leftOut.unreadable} unreadable, ${estimate.leftOut.unsplittable} unsplittable, ${estimate.leftOut.empty} empty, `
      + `price ${estimate.usd === undefined ? 'unavailable' : 'known'}, ${Date.now() - started} ms.`
    );
    return planned;
  }

  async run(plan: PassageSearchPlan, options: PassageSearchRunOptions = {}): Promise<PassageSearchResult> {
    const started = Date.now();
    const bounds = PROMPT_BUDGETS.passageSearch;
    await this.aiResourceManager.ensureInitialized();
    const engine = this.aiResourceManager.getEngine(PASSAGE_SEARCH_MODEL_SCOPE);
    const tally: RunTally = {
      found: [],
      usages: [],
      // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the closed drop reasons.
      dropped: { 'quote-not-found': 0, 'quote-ambiguous': 0, malformed: 0, duplicate: 0 },
      repairs: new Map(),
      faults: new Map(),
      answered: 0,
      failed: 0,
      cut: 0,
      unsent: 0,
      ignoredFields: 0,
      notesClipped: 0,
      moments: 0,
      // No engine at all: the key was removed between the plan and the run.
      keyChanged: !engine,
      limitReached: false,
      failureStreak: 0,
      providerFailed: false
    };
    let done = 0;
    const limit = pLimit(bounds.concurrency);

    await Promise.all(plan.chunks.map((_chunk, index) => limit(async (): Promise<void> => {
      // Asked in the turn the call below starts, so it answers for that call.
      if (!engine || tally.keyChanged || tally.providerFailed || tally.limitReached || options.signal?.aborted) {
        tally.unsent += 1;
      } else {
        await this.read(engine, plan, index, tally, options.signal);
      }
      done += 1;
      options.onProgress?.({ calls: { planned: plan.chunks.length, done }, found: tally.moments });
    })));

    const merged = mergePassageSearchInstances(plan.files, tally.found, bounds.instances, bounds.contextCharacters);
    const ended: PassageSearchEnded = tally.keyChanged
      ? 'key-changed'
      : options.signal?.aborted
        ? 'stopped'
        : tally.providerFailed
          ? 'provider-failed'
          : tally.limitReached && (tally.unsent > 0 || merged.overLimit > 0) ? 'instance-limit' : 'complete';
    const usage = sumTokenUsage(tally.usages);
    const reads: PassageSearchResult = {
      question: plan.question,
      model: plan.model,
      instances: merged.instances,
      labels: merged.labels,
      dropped: { ...tally.dropped, duplicate: merged.duplicates },
      overLimit: merged.overLimit,
      calls: { planned: plan.chunks.length, answered: tally.answered, failed: tally.failed, cut: tally.cut, unsent: tally.unsent },
      files: { read: merged.files, leftOut: plan.estimate.leftOut },
      ended,
      ...(usage ? { usage } : {})
    };
    const result = plan.organize ? await this.organizeWithin(reads, options.signal) : reads;
    this.logRun(result, tally, Date.now() - started);
    return result;
  }

  /** Price a pass over a result that has none, as its own explicit action (D12a). Sends nothing to a model. */
  planOrganize(result: PassageSearchResult): Promise<PassageSearchOrganizePlanOutcome> {
    return this.organizer.plan(result);
  }

  /** Make the pass the caller priced. The result comes back with its analysis, or as it was with why not. */
  async organize(result: PassageSearchResult, plan: PassageSearchOrganizePlan, options: Pick<PassageSearchRunOptions, 'signal'> = {}): Promise<PassageSearchResult> {
    if (result.instances.length === 0 || options.signal?.aborted) {
      return result;
    }
    return this.withPass(result, () => this.organizer.organize(result, { plan, ...(options.signal ? { signal: options.signal } : {}) }));
  }

  /** The pass inside a run: never after Stop, a key change or a run of provider failures, and never over nothing (D12a). */
  private async organizeWithin(reads: PassageSearchResult, signal?: AbortSignal): Promise<PassageSearchResult> {
    if ((reads.ended !== 'complete' && reads.ended !== 'instance-limit') || reads.instances.length === 0) {
      return reads;
    }
    // Read again immediately before dispatch: nothing is awaited between this and the pass's start.
    if (signal?.aborted) {
      return { ...reads, ended: 'stopped' };
    }
    return this.withPass(reads, () => this.organizer.organize(reads, signal ? { signal } : {}));
  }

  /** A failed pass leaves the list whole, with the reason (D13). */
  private async withPass(result: PassageSearchResult, pass: () => Promise<PassageSearchOrganized | undefined>): Promise<PassageSearchResult> {
    let organized: PassageSearchOrganized | undefined;
    try {
      organized = await pass();
    } catch (error) {
      this.log.appendLine(`[PassageSearch] The organizing pass failed (${faultKindOf(error)}).`);
      return { ...result, analysisMissing: 'failed' };
    }
    if (!organized) {
      return result;
    }
    const usage = sumTokenUsage([result.usage, organized.usage].filter((entry) => entry !== undefined));
    const { analysis: _analysis, analysisMissing: _missing, ...rest } = result;
    return {
      ...rest,
      ...(organized.kind === 'analysis' ? { analysis: organized.analysis } : { analysisMissing: organized.reason }),
      ...(usage ? { usage } : {})
    };
  }

  /** One chunk's call, read and placed. Every outcome lands in the tally; nothing is thrown. */
  private async read(engine: AgentRunEngine, plan: PassageSearchPlan, index: number, tally: RunTally, signal?: AbortSignal): Promise<void> {
    const chunk = plan.chunks[index];
    const file = plan.files[chunk.file];
    let result: ExecutionResult;
    try {
      result = await engine.runInitial({
        toolName: 'passage-search',
        systemMessage: plan.systemMessage,
        userMessage: buildPassageSearchMessage(plan.question, file.text.slice(chunk.start, chunk.end)),
        policy: AGENT_RUN_POLICIES.passageSearch,
        options: {
          model: plan.model,
          temperature: 0,
          maxTokens: PROMPT_BUDGETS.passageSearch.outputTokens,
          ...(signal ? { signal } : {})
        }
      });
    } catch (error) {
      if (error instanceof AgentRunUnavailableError && error.reason === 'missing-credentials') {
        // The key was removed or replaced: the retired engine starts nothing, and neither does this run.
        tally.keyChanged = true;
        tally.unsent += 1;
      } else if (signal?.aborted) {
        tally.unsent += 1;
      } else {
        this.fail(tally, faultKindOf(error));
        tally.failureStreak += 1;
        tally.providerFailed ||= tally.failureStreak >= PROMPT_BUDGETS.passageSearch.failureStreak;
      }
      return;
    }
    tally.usages.push(result.usage);
    if (result.cancelled) {
      tally.unsent += 1;
      return;
    }
    try {
      const reply = readPassageSearchReply(result.rawContent ?? result.content, result.finishReason === 'length');
      const anchored = anchorPassageSearchInstances(file, chunk, reply.instances);
      tally.answered += 1;
      tally.failureStreak = 0;
      tally.cut += reply.cut ? 1 : 0;
      tally.dropped.malformed += reply.malformed;
      tally.dropped['quote-not-found'] += anchored.notFound;
      tally.dropped['quote-ambiguous'] += anchored.ambiguous;
      tally.ignoredFields += reply.ignoredFields;
      tally.notesClipped += reply.notesClipped;
      reply.repairs.forEach((kind) => tally.repairs.set(kind, (tally.repairs.get(kind) ?? 0) + 1));
      tally.found.push(...anchored.found);
      tally.moments = countPassageSearchMoments(tally.found);
      tally.limitReached ||= tally.moments >= PROMPT_BUDGETS.passageSearch.instances;
    } catch (error) {
      if (!(error instanceof PassageSearchReplyError)) {
        throw error;
      }
      this.fail(tally, error.fault);
    }
  }

  private fail(tally: RunTally, fault: string): void {
    tally.failed += 1;
    tally.faults.set(fault, (tally.faults.get(fault) ?? 0) + 1);
  }

  private async factsOf(model: string): Promise<PassageSearchModelFacts> {
    try {
      return await this.prices.facts(model);
    } catch (error) {
      this.log.appendLine(`[PassageSearch] The model catalog could not be read for the estimate (${faultKindOf(error)}).`);
      return {};
    }
  }

  private logRun(result: PassageSearchResult, tally: RunTally, milliseconds: number): void {
    const counted = (counts: Map<string, number>): string => [...counts.entries()].map(([kind, count]) => `${kind} ${count}`).join(', ') || 'none';
    this.log.appendLine(
      `[PassageSearch] Run ended ${result.ended}: ${result.files.read.length} file(s), `
      + `${result.calls.answered} of ${result.calls.planned} call(s) answered (${result.calls.failed} failed, ${result.calls.cut} cut, ${result.calls.unsent} unsent), `
      + `${result.instances.length} instance(s) under ${result.labels.length} label(s), ${result.overLimit} over the limit, `
      + `dropped ${PASSAGE_SEARCH_DROP_REASONS.map((reason) => `${reason} ${result.dropped[reason]}`).join(', ')}, `
      + `failures ${counted(tally.faults)}, repairs ${counted(tally.repairs)}, `
      + `${tally.ignoredFields} ignored field(s), ${tally.notesClipped} clipped note(s), `
      + `analysis ${result.analysis ? 'made' : result.analysisMissing ?? 'none'}, `
      + `${result.usage?.totalTokens ?? 0} token(s), ${milliseconds} ms.`
    );
  }
}

/** A failure's kind for a log: a closed reason or a class name, never a message, which may quote a path or the writer's text. */
function faultKindOf(error: unknown): string {
  if (error instanceof AgentRunUnavailableError) {
    return error.reason;
  }
  return error instanceof Error ? error.name : 'unknown';
}
