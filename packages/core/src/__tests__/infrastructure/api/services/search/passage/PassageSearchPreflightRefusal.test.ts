/**
 * A read the engine's own preflight refuses before dispatch (ADR 2026-11-20
 * D7, D11; PR #295 re-review, finding 1): nothing was sent, so it leaves no
 * usage entry, is no request, is no provider failure, and is counted apart
 * (`tooLarge`). The report's scenario runs through the production manager,
 * run engine and organizer, with the provider's transport and the catalog's
 * window the only stand-ins; the read-stage cases use a stand-in engine.
 * Model ids and keys are placeholders; texts adapt *Alice*.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  // One at a time, in order, so the replies are taken in a known order.
  default: () => {
    let chain: Promise<unknown> = Promise.resolve();
    return (fn: () => Promise<unknown>) => {
      const run = chain.then(fn);
      chain = run.catch(() => undefined);
      return run;
    };
  }
}));

import type { TokenUsage } from '@messages';
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import { OpenRouterClient } from '@providers/OpenRouterClient';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { passageSearchMissingLines } from '@shared/utils/passageSearchWords';
import { passageSearchResultView } from '@/application/handlers/domain/PassageSearchViews';
import type { PassageSearchPlan, PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import { PassageSearchModelOrganizer } from '@services/search/passage/PassageSearchModelOrganizer';
import type { PassageSearchModelFacts } from '@services/search/passage/PassageSearchPrices';
import { PassageSearchService } from '@services/search/passage/PassageSearchService';
import {
  QUESTION,
  RABBIT_CHAPTER,
  fillerParagraph,
  replyOf,
  sourceFile
} from '@/__tests__/infrastructure/api/services/search/passage/passageSearchFixtures';
import { createHost } from '@/__tests__/infrastructure/api/services/search/passage/passageSearchOrganizeHarness';

const PASSAGE = 'placeholder/passage-model';
const PRICING = { promptUsdPerToken: 0.000001, completionUsdPerToken: 0.000004 };
const WINDOW = 16_384;
/** Each call the provider answers is fully metered: its cost and both cache counts. */
const METERED: TokenUsage = { promptTokens: 8, completionTokens: 4, totalTokens: 12, costUsd: 0.01, cachedTokens: 5, cacheWriteTokens: 3 };
const TOOK = replyOf({ quote: 'took a watch out of its waistcoat-pocket' });
const PASS = JSON.stringify({ headline: 'The Rabbit keeps checking the hour.', sections: [{ title: 'The watch', claims: [{ text: 'It "took a watch out of its waistcoat-pocket".', cites: [1] }] }] });

/** Two chapters: a long one that fits a call's word budget, and the short one. */
const FILES = [
  sourceFile('chapters/long.md', Array.from({ length: 6 }, (_unused, index) => fillerParagraph(`Hatter${index + 1}-`, 1_000)).join('\n\n')),
  sourceFile('chapters/1.md', RABBIT_CHAPTER)
];

/** Disposed after each test, passed or not: a live manager keeps the test process open. */
const managers: AIResourceManager[] = [];

function managerOf(): AIResourceManager {
  const manager = new AIResourceManager(
    { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
    { getApiKey: jest.fn().mockResolvedValue('sk-placeholder') } as never,
    { get: jest.fn((_section, key, fallback) => (key === 'passageSearchModel' ? PASSAGE : fallback)) } as never,
    { createProvider: jest.fn() } as never
  );
  managers.push(manager);
  return manager;
}

/** The production manager, engine and organizer; a catalog that knows no window until `learn()`. */
function productionHost(replies: Array<{ content: string; usage?: TokenUsage }>) {
  const catalog: { window: number | undefined } = { window: undefined };
  jest.spyOn(OpenRouterModels, 'getCachedContextLength').mockImplementation(() => catalog.window);
  const queue = [...replies];
  const provider = jest.spyOn(OpenRouterClient.prototype, 'createChatCompletion').mockImplementation(async () => {
    const next = queue.shift();
    if (!next) {
      throw new Error('no reply queued');
    }
    return { content: next.content, finishReason: 'stop', ...('usage' in next ? { usage: next.usage } : { usage: METERED }) } as never;
  });
  const manager = managerOf();
  const prompts = { loadPrompts: jest.fn(async (files: string[]) => `SYSTEM ${files.join(' + ')}`) };
  // One catalog read for the estimate and the run alike: the window it knows is the engine's too.
  const prices = { facts: jest.fn(async (): Promise<PassageSearchModelFacts> => ({ pricing: PRICING, ...(catalog.window !== undefined ? { contextLength: catalog.window } : {}) })) };
  const log = { appendLine: jest.fn() };
  const organizer = new PassageSearchModelOrganizer(manager, prompts as never, prices, log as never);
  const service = new PassageSearchService(manager, prompts as never, prices, log as never, organizer);
  return { service, provider, log, learn: () => { catalog.window = WINDOW; } };
}

async function planned(service: PassageSearchService, organize: boolean): Promise<PassageSearchPlan> {
  const outcome = await service.plan({ model: PASSAGE, question: QUESTION, organize, files: FILES });
  if (outcome.kind !== 'planned') {
    throw new Error(`expected a plan, got ${outcome.refusal.reason}`);
  }
  return outcome.plan;
}

afterEach(() => {
  managers.splice(0).forEach((manager) => manager.dispose());
  jest.restoreAllMocks();
});

describe('A plan priced on an unknown window, run once the catalog knows a 16,384-token one (the report\'s scenario)', () => {
  it('inline: the long read is refused unsent, and the short read and the pass give complete cost and cache totals', async () => {
    const host = productionHost([{ content: TOOK }, { content: PASS }]);
    const plan = await planned(host.service, true);
    // Priced with no window known: the word budget stands, so the long chapter is one call.
    expect(plan.chunks).toHaveLength(2);
    host.learn();

    const result = await host.service.run(plan);

    // Only the short read and the pass reached the provider.
    expect(host.provider).toHaveBeenCalledTimes(2);
    expect(result.calls).toEqual({ planned: 2, answered: 1, failed: 0, cut: 0, cancelled: 0, unsent: 0, tooLarge: 1, dispatched: 1 });
    expect(result.ended).toBe('complete');
    expect(result.requests).toBe(2);
    expect(result.analysis?.headline).toBe('The Rabbit keeps checking the hour.');
    expect(result.usage).toStrictEqual({ promptTokens: 16, completionTokens: 8, totalTokens: 24, requestCount: 2, costUsd: 0.02, cachedTokens: 10, cacheWriteTokens: 6 });
    expect(result.files.planned.map((file) => [file.displayPath, file.chunks.admitted, file.searched])).toEqual([['chapters/long.md', 0, 'none'], ['chapters/1.md', 1, 'full']]);
    // The sidebar says it apart from a failure and from a call not made.
    const lines = passageSearchMissingLines(passageSearchResultView(result, 'result-1', false));
    expect(lines).toContain('1 call did not fit the model\'s window and was not sent, so the text it covers was not searched.');
    expect(lines.some((line) => line.includes('failed') || line.includes('not made'))).toBe(false);
  });

  it('explicit: organizing the result afterwards counts the same two requests, with complete totals', async () => {
    const host = productionHost([{ content: TOOK }, { content: PASS }]);
    const plan = await planned(host.service, false);
    host.learn();
    const reads = await host.service.run(plan);
    expect(reads.calls).toMatchObject({ answered: 1, tooLarge: 1, dispatched: 1 });
    expect(reads.usage).toStrictEqual({ ...METERED, requestCount: 1 });

    const priced = await host.service.planOrganize(reads);
    if (priced.kind !== 'planned') {
      throw new Error(`expected an organize plan, got: ${priced.message}`);
    }
    const organized = await host.service.organize(reads, priced.plan);

    expect(host.provider).toHaveBeenCalledTimes(2);
    expect(organized.analysis?.headline).toBe('The Rabbit keeps checking the hour.');
    expect([reads.requests, organized.requests]).toEqual([1, 2]);
    expect(organized.usage).toStrictEqual({ promptTokens: 16, completionTokens: 8, totalTokens: 24, requestCount: 2, costUsd: 0.02, cachedTokens: 10, cacheWriteTokens: 6 });
  });

  it('explicit, no read metered: the request count is rebuilt from what was dispatched, never from what failed', async () => {
    const host = productionHost([{ content: TOOK, usage: undefined }, { content: PASS }]);
    const plan = await planned(host.service, false);
    host.learn();
    const reads = await host.service.run(plan);
    expect(reads).not.toHaveProperty('usage');
    expect(reads.calls).toMatchObject({ answered: 1, failed: 0, tooLarge: 1, dispatched: 1 });

    const priced = await host.service.planOrganize(reads);
    if (priced.kind !== 'planned') {
      throw new Error('expected an organize plan');
    }
    const organized = await host.service.organize(reads, priced.plan);
    // One read and the pass: two requests. The read's usage is unknown, so no cost or cache total is claimed.
    expect(organized.usage).toStrictEqual({ promptTokens: 8, completionTokens: 4, totalTokens: 12, requestCount: 2 });
    expect(organized.requests).toBe(2);
  });
});

describe('A read refused before dispatch, in the read stage', () => {
  const tooLarge = () => new AgentRunUnavailableError('context-window-exceeded');
  const files = (count: number) => Array.from({ length: count }, (_unused, index) => sourceFile(`chapters/${index + 1}.md`, RABBIT_CHAPTER, { identity: `/book/${index + 1}` }));
  const planOf = async (service: PassageSearchService, count: number): Promise<PassageSearchPlan> => {
    const outcome = await service.plan({ model: PASSAGE, question: QUESTION, organize: false, files: files(count) });
    if (outcome.kind !== 'planned') {
      throw new Error('expected a plan');
    }
    return outcome.plan;
  };

  it('neither adds to the provider-failure streak nor ends it', async () => {
    const streak = PROMPT_BUDGETS.passageSearch.failureStreak;
    // Two failures, a refusal, then the rest of the streak: the refusal leaves the count where it was.
    const replies = [new Error('503'), new Error('503'), tooLarge(), ...Array.from({ length: streak - 2 }, () => new Error('503'))];
    const host = createHost(replies, { facts: { pricing: PRICING } });
    const count = replies.length + 2;
    const result = await host.service.run(await planOf(host.service, count));
    expect(result.ended).toBe('provider-failed');
    expect(result.calls).toEqual({ planned: count, answered: 0, failed: streak, cut: 0, cancelled: 0, unsent: 2, tooLarge: 1, dispatched: streak });
  });

  it('never stops a run however many there are, and leaves no usage entry', async () => {
    const count = PROMPT_BUDGETS.passageSearch.failureStreak + 2;
    const host = createHost(Array.from({ length: count }, tooLarge), { facts: { pricing: PRICING } });
    const result: PassageSearchResult = await host.service.run(await planOf(host.service, count));
    expect(result.ended).toBe('complete');
    expect(result.calls).toEqual({ planned: count, answered: 0, failed: 0, cut: 0, cancelled: 0, unsent: 0, tooLarge: count, dispatched: 0 });
    expect(result).not.toHaveProperty('usage');
    expect(result.files.planned.every((file) => file.chunks.admitted === 0 && file.searched === 'none')).toBe(true);
    // Logged as its own count, never among the failures.
    expect(host.logged()).toContain(`0 unsent, ${count} too large; 0 dispatched`);
    expect(host.logged()).toContain('failures none');
  });

  it('keeps the counts whole beside every other outcome: answered, failed, cancelled, unsent and too large add up to planned', async () => {
    const stop = new AbortController();
    const host = createHost([
      { content: TOOK },
      new Error('503'),
      tooLarge(),
      () => {
        stop.abort();
        return { content: replyOf(), cancelled: true };
      }
    ], { facts: { pricing: PRICING } });
    const result = await host.service.run(await planOf(host.service, 6), { signal: stop.signal });
    const { calls } = result;
    expect(calls).toEqual({ planned: 6, answered: 1, failed: 1, cut: 0, cancelled: 1, unsent: 2, tooLarge: 1, dispatched: 3 });
    expect(calls.answered + calls.failed + calls.cancelled + calls.unsent + calls.tooLarge).toBe(calls.planned);
    expect(calls.dispatched).toBe(calls.answered + calls.failed + calls.cancelled);
    // One entry per dispatched read: two known, one unknown, so no cost total is claimed.
    expect(result.usage).toMatchObject({ requestCount: 3 });
    expect(result.usage).not.toHaveProperty('costUsd');
  });
});
