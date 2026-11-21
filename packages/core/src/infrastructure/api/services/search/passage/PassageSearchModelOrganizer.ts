/**
 * PassageSearchModelOrganizer — the organizing pass (ADR 2026-11-20 D12,
 * D12a, D13): one call over a result's checked instances, never the text.
 *
 * - **`plan` sends nothing to a model.** It renders the pass's whole
 *   request over the result, fitted to its input bound, measures it, and
 *   prices it through the engine's own price port. The price is exact in
 *   its input: the instances exist. The plan holds the messages, and a pass
 *   made of it sends exactly those.
 * - **`organize` makes one call,** on the result's model
 *   (`AgentRunOptions.model`), under `AGENT_RUN_POLICIES.passageSearch`, at
 *   temperature 0. No reasoning setting is sent. Inside a run it has no
 *   plan (the pass was priced as an allowance) and renders its request then.
 * - **Nothing starts after Stop or a key change.** The caller's signal is
 *   read again immediately before dispatch, with nothing awaited between;
 *   a retired engine's refusal is `key-changed`.
 * - **The reply is checked by host code** (`PassageSearchOrganizeChecks`).
 *   A failed, malformed or cut-off pass, and one whose every claim the
 *   checks dropped, returns why and no analysis; the caller's list of
 *   instances is never touched here.
 *
 * Built once, at the composition root. Logs carry counts and fault kinds
 * only (D22): never the question, a quote, a note, a label, a headline, a
 * claim or a path.
 */

import { createHash } from 'crypto';
import type { TokenUsage } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import { PromptLoader } from '@/tools/shared/prompts';
import type { LogSink } from '@/platform';
import type {
  PassageSearchAnalysis,
  PassageSearchAnalysisMissing,
  PassageSearchResult
} from '@services/search/passage/PassageSearchContracts';
import { checkPassageSearchOrganizeReply } from '@services/search/passage/PassageSearchOrganizeChecks';
import {
  PassageSearchOrganizeReplyError,
  readPassageSearchOrganizeReply,
  type PassageSearchOrganizeReply
} from '@services/search/passage/PassageSearchOrganizeReplyCodec';
import {
  PASSAGE_SEARCH_ORGANIZE_PROMPTS,
  buildPassageSearchOrganizeMessage,
  fitPassageSearchOrganizeRequest,
  passageSearchOrganizeInputLimit
} from '@services/search/passage/PassageSearchOrganizeRequest';
import type {
  PassageSearchOrganizePlan,
  PassageSearchOrganizePlanOutcome,
  PassageSearchOrganized,
  PassageSearchOrganizer
} from '@services/search/passage/PassageSearchOrganizer';
import type { PassageSearchModelFacts, PassageSearchPriceSource } from '@services/search/passage/PassageSearchPrices';
import { PASSAGE_SEARCH_MODEL_SCOPE } from '@services/search/passage/PassageSearchService';

/** What a pass sends, and which instances it shows. */
interface PassRequest {
  readonly model: string;
  readonly systemMessage: string;
  readonly userMessage: string;
  readonly shown: readonly number[];
}

const NOTHING_TO_ORGANIZE = 'There is nothing to organize: the search found no instances.';
const NO_ROOM = 'These results cannot be organized: not one instance fits what the model can read in one call.';

export class PassageSearchModelOrganizer implements PassageSearchOrganizer {
  readonly available = true;

  constructor(
    private readonly aiResourceManager: AIResourceManager,
    private readonly promptLoader: PromptLoader,
    private readonly prices: PassageSearchPriceSource,
    private readonly log: LogSink
  ) {}

  async plan(result: PassageSearchResult): Promise<PassageSearchOrganizePlanOutcome> {
    const started = Date.now();
    if (result.instances.length === 0) {
      return { kind: 'unavailable', message: NOTHING_TO_ORGANIZE };
    }
    const facts = await this.factsOf(result.model);
    const request = await this.render(result, facts);
    if (!request) {
      this.log.appendLine(`[PassageSearch] Organize plan unavailable (no-room): ${result.instances.length} instance(s).`);
      return { kind: 'unavailable', message: NO_ROOM };
    }
    const outputTokens = PROMPT_BUDGETS.passageSearch.organize.typicalOutputTokens;
    const ceilings = { organizeOutputTokens: PROMPT_BUDGETS.passageSearch.organize.outputTokens };
    const pricing = facts.pricing;
    const plan: PassageSearchOrganizePlan = {
      planKey: sha256(JSON.stringify({
        version: 1,
        model: request.model,
        system: sha256(request.systemMessage),
        user: sha256(request.userMessage),
        shown: request.shown,
        tokens: [request.inputTokens, outputTokens],
        ceilings: [ceilings.organizeOutputTokens],
        // The basis, not the product: a price that moved, appeared or went away is a different plan.
        pricing: pricing ? [pricing.promptUsdPerToken, pricing.completionUsdPerToken] : null
      })),
      model: request.model,
      estimate: {
        model: request.model,
        calls: 1,
        inputTokens: request.inputTokens,
        outputTokens,
        ...(pricing ? { usd: request.inputTokens * pricing.promptUsdPerToken + outputTokens * pricing.completionUsdPerToken } : {})
      },
      instances: { read: request.shown.length, of: result.instances.length },
      systemMessage: request.systemMessage,
      userMessage: request.userMessage,
      shown: request.shown,
      ceilings
    };
    this.log.appendLine(
      `[PassageSearch] Organize plan: ${plan.instances.read} of ${plan.instances.of} instance(s), ${result.labels.length} label(s), `
      + `${request.inputTokens} input and ${outputTokens} output token(s), price ${pricing ? 'known' : 'unavailable'}, ${Date.now() - started} ms.`
    );
    return { kind: 'planned', plan };
  }

  async organize(
    result: PassageSearchResult,
    options: { readonly plan?: PassageSearchOrganizePlan; readonly outputTokens?: number; readonly signal?: AbortSignal }
  ): Promise<PassageSearchOrganized | undefined> {
    const started = Date.now();
    if (result.instances.length === 0) {
      return undefined;
    }
    const request = options.plan ? this.planned(result, options.plan) : await this.render(result, await this.factsOf(result.model));
    if (request === 'plan-mismatch') {
      return this.missing('failed', 'plan-mismatch', started);
    }
    if (!request) {
      return this.missing('no-room', 'no-room', started);
    }
    await this.aiResourceManager.ensureInitialized();
    const engine = this.aiResourceManager.getEngine(PASSAGE_SEARCH_MODEL_SCOPE);
    if (!engine) {
      return this.missing('key-changed', 'no-engine', started);
    }
    // Read again immediately before dispatch: nothing is awaited between this and the call's start.
    if (options.signal?.aborted) {
      return this.missing('stopped', 'stopped', started);
    }
    let execution: ExecutionResult;
    try {
      execution = await engine.runInitial({
        toolName: 'passage-search-organize',
        systemMessage: request.systemMessage,
        userMessage: request.userMessage,
        policy: AGENT_RUN_POLICIES.passageSearch,
        options: {
          model: request.model,
          temperature: 0,
          // The ceiling a plan froze: the pass's own plan, else the run's; the budget only when neither is in hand.
          maxTokens: options.plan?.ceilings.organizeOutputTokens ?? options.outputTokens ?? PROMPT_BUDGETS.passageSearch.organize.outputTokens,
          ...(options.signal ? { signal: options.signal } : {})
        }
      });
    } catch (error) {
      if (error instanceof AgentRunUnavailableError && error.reason === 'missing-credentials') {
        return this.missing('key-changed', error.reason, started);
      }
      return options.signal?.aborted
        ? this.missing('stopped', 'stopped', started)
        : this.missing('failed', faultKindOf(error), started);
    }
    const usage = execution.usage;
    if (execution.cancelled) {
      return this.missing('stopped', 'stopped', started, usage);
    }
    let reply: PassageSearchOrganizeReply;
    try {
      reply = readPassageSearchOrganizeReply(execution.rawContent ?? execution.content, execution.finishReason === 'length');
    } catch (error) {
      if (!(error instanceof PassageSearchOrganizeReplyError)) {
        throw error;
      }
      return this.missing(error.fault === 'cut' ? 'cut' : 'malformed', error.fault, started, usage);
    }
    const analysis = checkPassageSearchOrganizeReply(reply, result.instances, request.shown);
    this.logPass(analysis, reply, usage, Date.now() - started);
    return analysis.sections.length === 0
      ? { kind: 'missing', reason: 'nothing-kept', ...(usage ? { usage } : {}) }
      : { kind: 'analysis', analysis, ...(usage ? { usage } : {}) };
  }

  /** The request over `result`, fitted to its bound; undefined when not one instance fits. */
  private async render(result: PassageSearchResult, facts: PassageSearchModelFacts): Promise<(PassRequest & { inputTokens: number }) | undefined> {
    const systemMessage = await this.promptLoader.loadPrompts([...PASSAGE_SEARCH_ORGANIZE_PROMPTS]);
    const fitted = fitPassageSearchOrganizeRequest(systemMessage, result, passageSearchOrganizeInputLimit(facts.contextLength));
    return fitted
      ? { model: result.model, systemMessage, userMessage: fitted.messages[1].content, shown: fitted.shown, inputTokens: fitted.inputTokens }
      : undefined;
  }

  /** The plan's own request, once it is seen to be this result's: its instances render to the plan's message, on the result's model. */
  private planned(result: PassageSearchResult, plan: PassageSearchOrganizePlan): PassRequest | 'plan-mismatch' {
    const byNumber = new Map(result.instances.map((instance) => [instance.number, instance]));
    const shown = plan.shown.flatMap((number) => byNumber.get(number) ?? []);
    const same = plan.model === result.model
      && shown.length > 0
      && shown.length === plan.shown.length
      && buildPassageSearchOrganizeMessage(result, shown, result.instances.length) === plan.userMessage;
    return same ? { model: plan.model, systemMessage: plan.systemMessage, userMessage: plan.userMessage, shown: plan.shown } : 'plan-mismatch';
  }

  private missing(reason: PassageSearchAnalysisMissing, fault: string, started: number, usage?: TokenUsage): PassageSearchOrganized {
    this.log.appendLine(`[PassageSearch] The organizing pass left no analysis (${reason}; ${fault}), ${usage?.totalTokens ?? 0} token(s), ${Date.now() - started} ms.`);
    return { kind: 'missing', reason, ...(usage ? { usage } : {}) };
  }

  private async factsOf(model: string): Promise<PassageSearchModelFacts> {
    try {
      return await this.prices.facts(model);
    } catch (error) {
      this.log.appendLine(`[PassageSearch] The model catalog could not be read for the organizing pass (${faultKindOf(error)}).`);
      return {};
    }
  }

  private logPass(analysis: PassageSearchAnalysis, reply: PassageSearchOrganizeReply, usage: TokenUsage | undefined, milliseconds: number): void {
    const claims = analysis.sections.reduce((total, section) => total + section.claims.length, 0);
    const { dropped, replaced } = analysis;
    this.log.appendLine(
      `[PassageSearch] Organizing pass ${analysis.sections.length === 0 ? 'kept nothing' : 'checked'}: read ${analysis.read.instances} of ${analysis.read.of} instance(s), `
      + `kept ${analysis.sections.length} section(s) and ${claims} claim(s), `
      + `dropped ${dropped.claims} claim(s) (uncited ${dropped.uncited}, misquoted ${dropped.misquoted}, malformed ${dropped.malformed}), `
      + `${dropped.sections} section(s) and ${dropped.cites} cite(s), `
      + `host headline ${replaced.headline ? 'yes' : 'no'}, ${replaced.titles} host title(s), ${analysis.clipped} clipped, `
      + `${reply.ignoredFields} ignored field(s), repairs ${reply.repairs.join(', ') || 'none'}, `
      + `${usage?.totalTokens ?? 0} token(s), ${milliseconds} ms.`
    );
  }
}

/** A failure's kind for a log: a closed reason or a class name, never a message, which may quote the writer's text. */
function faultKindOf(error: unknown): string {
  if (error instanceof AgentRunUnavailableError) {
    return error.reason;
  }
  return error instanceof Error ? error.name : 'unknown';
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
