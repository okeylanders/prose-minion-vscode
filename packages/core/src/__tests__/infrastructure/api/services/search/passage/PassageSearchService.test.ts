/**
 * PassageSearchService (ADR 2026-11-20 D2, D7–D12a, D22): a plan sends
 * nothing; a run sends exactly the plan's messages to the plan's model, one
 * capability-free call per chunk; Stop and a key change start nothing more;
 * a failed call is counted and the run goes on. The engine is a stand-in; no
 * provider is reached. Texts adapt *Alice's Adventures in Wonderland*.
 */
/* eslint-disable @typescript-eslint/naming-convention -- drops keyed by their closed reasons. */
const pLimitCalls: number[] = [];
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  // One at a time, in order, so "later calls" is deterministic; the limit asked for is recorded.
  default: (concurrency: number) => {
    pLimitCalls.push(concurrency);
    let chain: Promise<unknown> = Promise.resolve();
    return (fn: () => Promise<unknown>) => {
      const run = chain.then(fn);
      chain = run.catch(() => undefined);
      return run;
    };
  }
}));

import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { estimateRequestTokens } from '@orchestration/RequestContextPreflight';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { PassageSearchPlan, PassageSearchProgress, PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import { PASSAGE_SEARCH_PROMPTS, buildPassageSearchMessage } from '@services/search/passage/PassageSearchMessages';
import type { PassageSearchOrganizer } from '@services/search/passage/PassageSearchOrganizer';
import type { PassageSearchModelFacts } from '@services/search/passage/PassageSearchPrices';
import { PassageSearchService } from '@services/search/passage/PassageSearchService';
import {
  PASSAGE_MODEL,
  QUEEN_CHAPTER,
  QUESTION,
  RABBIT_CHAPTER,
  replyOf,
  sourceFile
} from '@/__tests__/infrastructure/api/services/search/passage/passageSearchFixtures';

const USAGE = { promptTokens: 100, completionTokens: 20, totalTokens: 120, costUsd: 0.001 };
const bounds = PROMPT_BUDGETS.passageSearch;

type Reply = { content: string; finishReason?: string; cancelled?: boolean } | Error | (() => { content: string; cancelled?: boolean });

interface HostOptions {
  engine?: boolean;
  facts?: PassageSearchModelFacts | Error;
  organizer?: PassageSearchOrganizer;
  /** The model the engine names by the time of the run. */
  engineModel?: string;
}

function createService(replies: Reply[] = [], options: HostOptions = {}) {
  const queue = [...replies];
  const runInitial = jest.fn(async (_request: Record<string, any>) => {
    const next = queue.shift();
    if (!next) {
      throw new Error('no reply queued');
    }
    if (next instanceof Error) {
      throw next;
    }
    const reply = typeof next === 'function' ? next() : next;
    return { usedGuides: [], requestedResources: [], artifacts: [], finishReason: 'stop', usage: USAGE, cancelled: false, ...reply };
  });
  const engine = { runInitial, getModel: jest.fn(() => options.engineModel ?? PASSAGE_MODEL) };
  const manager = {
    ensureInitialized: jest.fn(async () => undefined),
    getEngine: jest.fn(() => (options.engine === false ? undefined : engine))
  };
  const promptLoader = { loadPrompts: jest.fn(async (files: string[]) => `SYSTEM ${files.join(' + ')}`) };
  const prices = {
    facts: jest.fn(async () => {
      if (options.facts instanceof Error) {
        throw options.facts;
      }
      return options.facts ?? { pricing: { promptUsdPerToken: 0.000001, completionUsdPerToken: 0.000004 } };
    })
  };
  const log = { appendLine: jest.fn() };
  const service = new PassageSearchService(manager as never, promptLoader as never, prices, log as never, options.organizer);
  return { service, runInitial, engine, manager, promptLoader, prices, log };
}

const FILES = [sourceFile('chapters/1.md', RABBIT_CHAPTER), sourceFile('chapters/2.md', QUEEN_CHAPTER), sourceFile('chapters/3.md', RABBIT_CHAPTER, { identity: '/book/chapters/3.md' })];

async function planOf(service: PassageSearchService, overrides: { organize?: boolean; files?: typeof FILES } = {}): Promise<PassageSearchPlan> {
  const outcome = await service.plan({ model: PASSAGE_MODEL, question: QUESTION, organize: overrides.organize ?? false, files: overrides.files ?? FILES });
  if (outcome.kind !== 'planned') {
    throw new Error(`expected a plan, got ${outcome.refusal.reason}`);
  }
  return outcome.plan;
}

const reply = (...instances: Parameters<typeof replyOf>): { content: string } => ({ content: replyOf(...instances) });
const TOOK = reply({ quote: 'took a watch out of its waistcoat-pocket' });
const GLANCED = reply({ quote: 'glanced at its watch again' });
const NONE = reply();

function organizerOf(outcome: Awaited<ReturnType<PassageSearchOrganizer['organize']>> = undefined) {
  return {
    available: true,
    plan: jest.fn(async () => ({ kind: 'unavailable' as const, message: 'not built' })),
    organize: jest.fn(async (_result: PassageSearchResult) => outcome)
  };
}

beforeEach(() => {
  pLimitCalls.length = 0;
});

describe('PassageSearchService.model', () => {
  it('names the passageSearch engine\'s model, or nothing with no key', async () => {
    const { service, manager } = createService();
    await expect(service.model()).resolves.toBe(PASSAGE_MODEL);
    expect(manager.getEngine).toHaveBeenCalledWith('passageSearch');
    await expect(createService([], { engine: false }).service.model()).resolves.toBeUndefined();
  });
});

describe('PassageSearchService.plan', () => {
  it('sends nothing to a model, and prices through the engine\'s own price port', async () => {
    const { service, runInitial, promptLoader, prices } = createService();
    const plan = await planOf(service);
    expect(runInitial).not.toHaveBeenCalled();
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith([...PASSAGE_SEARCH_PROMPTS]);
    expect(prices.facts).toHaveBeenCalledWith(PASSAGE_MODEL);
    expect(plan.estimate).toMatchObject({ model: PASSAGE_MODEL, files: 3, calls: 3 });
    expect(plan.estimate.usd).toBeGreaterThan(0);
  });

  it('still plans, without a price, when the catalog cannot be read', async () => {
    const { service } = createService([], { facts: new Error('offline: /secret/path') });
    const plan = await planOf(service);
    expect(plan.estimate.calls).toBe(3);
    expect(plan.estimate).not.toHaveProperty('usd');
  });

  it('refuses in host words when nothing can be read or the model is too small', async () => {
    const { service } = createService([], { facts: { contextLength: 100 } });
    await expect(service.plan({ model: PASSAGE_MODEL, question: QUESTION, organize: false, files: FILES }))
      .resolves.toMatchObject({ kind: 'refused', refusal: { reason: 'model-too-small' } });
    await expect(createService().service.plan({ model: PASSAGE_MODEL, question: QUESTION, organize: false, files: [sourceFile('a.md', '')] }))
      .resolves.toMatchObject({ kind: 'refused', refusal: { reason: 'no-files' } });
  });
});

describe('PassageSearchService.run', () => {
  it('sends exactly the messages the estimate priced, to the plan\'s model: capability-free, temperature 0, no reasoning setting', async () => {
    // The engine's model moved after the plan: the run still goes to the plan's.
    const { service, runInitial } = createService([TOOK, NONE, GLANCED], { engineModel: 'placeholder/changed-since' });
    const plan = await planOf(service);
    await service.run(plan);

    expect(pLimitCalls).toEqual([bounds.concurrency]);
    expect(runInitial).toHaveBeenCalledTimes(3);
    const requests = runInitial.mock.calls.map(([request]) => request);
    requests.forEach((request, index) => {
      const chunk = plan.chunks[index];
      expect(request).toMatchObject({
        toolName: 'passage-search',
        systemMessage: plan.systemMessage,
        userMessage: buildPassageSearchMessage(QUESTION, plan.files[chunk.file].text.slice(chunk.start, chunk.end)),
        policy: AGENT_RUN_POLICIES.passageSearch,
        options: { model: PASSAGE_MODEL, temperature: 0, maxTokens: bounds.outputTokens }
      });
      expect(request.options).not.toHaveProperty('reasoning');
      expect(request).not.toHaveProperty('capability');
    });
    const sent = requests.reduce((total, request) => total + estimateRequestTokens([
      { role: 'system', content: request.systemMessage },
      { role: 'user', content: request.userMessage }
    ]), 0);
    expect(sent).toBe(plan.estimate.reads.inputTokens);
  });

  it('returns checked instances in reading order, with the host\'s counts and summed usage', async () => {
    const { service } = createService([TOOK, NONE, reply({ quote: 'took a watch out of its waistcoat-pocket' }, { quote: 'glanced at its watch again', label: 'Checks  its WATCH' })]);
    const progress: PassageSearchProgress[] = [];
    const result = await service.run(await planOf(service), { onProgress: (update) => progress.push(update) });

    expect(result.instances.map((instance) => [instance.number, instance.file, instance.displayPath, instance.line, instance.quote])).toEqual([
      [1, 'f1', 'chapters/1.md', 3, 'took a watch out of its waistcoat-pocket'],
      [2, 'f3', 'chapters/3.md', 3, 'took a watch out of its waistcoat-pocket'],
      [3, 'f3', 'chapters/3.md', 5, 'glanced at its watch again']
    ]);
    expect(result.labels).toEqual([{ key: 'checks its watch', label: 'checks its watch', count: 3, files: 2 }]);
    expect(result).toMatchObject({
      question: QUESTION,
      model: PASSAGE_MODEL,
      ended: 'complete',
      overLimit: 0,
      calls: { planned: 3, answered: 3, failed: 0, cut: 0, unsent: 0 },
      dropped: { 'quote-not-found': 0, 'quote-ambiguous': 0, malformed: 0, duplicate: 0 },
      usage: { promptTokens: 300, completionTokens: 60, totalTokens: 360, requestCount: 3 }
    });
    expect(result.files.read.map((file) => [file.key, file.instances])).toEqual([['f1', 1], ['f2', 0], ['f3', 2]]);
    expect(result).not.toHaveProperty('analysis');
    expect(progress).toEqual([
      { calls: { planned: 3, done: 1 }, found: 1 },
      { calls: { planned: 3, done: 2 }, found: 1 },
      { calls: { planned: 3, done: 3 }, found: 3 }
    ]);
  });

  it('counts every drop by its reason', async () => {
    const { service } = createService([
      { content: JSON.stringify({ instances: [
        { quote: 'took a watch out of its waistcoat-pocket', note: 'n', label: 'checks' },
        { quote: 'a watch out of its waistcoat-pocket, and hurried', note: 'n', label: 'checks' },
        { quote: 'drew a pocket-knife', note: 'n', label: 'checks' },
        { quote: 'Oh dear!', note: 'n', label: 'speaks' },
        { quote: 'ran close by her', note: 'n' },
        { quote: 'hurried on', note: 'n', label: 'hurries', line: 3 }
      ] }) },
      NONE,
      NONE
    ]);
    const result = await service.run(await planOf(service));
    expect(result.dropped).toEqual({ 'quote-not-found': 1, 'quote-ambiguous': 1, malformed: 1, duplicate: 1 });
    expect(result.instances.map((instance) => instance.quote)).toEqual(['took a watch out of its waistcoat-pocket', 'hurried on']);
  });

  it('counts a failed call and goes on: a provider error, an unreadable reply', async () => {
    const { service, runInitial } = createService([new Error('503 from /secret/path'), { content: 'I could not find any.' }, GLANCED]);
    const result = await service.run(await planOf(service));
    expect(runInitial).toHaveBeenCalledTimes(3);
    expect(result.calls).toEqual({ planned: 3, answered: 1, failed: 2, cut: 0, unsent: 0 });
    expect(result.ended).toBe('complete');
    expect(result.instances.map((instance) => instance.quote)).toEqual(['glanced at its watch again']);
  });

  it('keeps the finished instances of a reply cut off at its ceiling, and counts the call cut', async () => {
    const cut = `{"instances":[${JSON.stringify({ quote: 'took a watch out of its waistcoat-pocket', note: 'n', label: 'checks' })},{"quote":"glanced at its wa`;
    const { service } = createService([{ content: cut, finishReason: 'length' }, NONE, NONE]);
    const result = await service.run(await planOf(service));
    expect(result.calls).toEqual({ planned: 3, answered: 3, failed: 0, cut: 1, unsent: 0 });
    expect(result.instances.map((instance) => instance.quote)).toEqual(['took a watch out of its waistcoat-pocket']);
  });

  it('on Stop mid-flight keeps what was found, starts no further call, and never organizes', async () => {
    const stop = new AbortController();
    const organizer = organizerOf();
    const { service, runInitial } = createService([
      TOOK,
      () => {
        stop.abort();
        return { content: '', cancelled: true };
      },
      GLANCED
    ], { organizer });
    const result = await service.run(await planOf(service, { organize: true }), { signal: stop.signal });
    expect(runInitial).toHaveBeenCalledTimes(2);
    expect(runInitial.mock.calls[0][0].options.signal).toBe(stop.signal);
    expect(result.ended).toBe('stopped');
    expect(result.calls).toEqual({ planned: 3, answered: 1, failed: 0, cut: 0, unsent: 2 });
    expect(result.instances.map((instance) => instance.quote)).toEqual(['took a watch out of its waistcoat-pocket']);
    expect(organizer.organize).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('analysis');
  });

  it('never organizes when Stop lands after the last read', async () => {
    const stop = new AbortController();
    const organizer = organizerOf();
    const { service } = createService([TOOK, NONE, () => {
      stop.abort();
      return { content: GLANCED.content };
    }], { organizer });
    const result = await service.run(await planOf(service, { organize: true }), { signal: stop.signal });
    expect(result.ended).toBe('stopped');
    expect(result.calls.answered).toBe(3);
    expect(result.instances).toHaveLength(2);
    expect(organizer.organize).not.toHaveBeenCalled();
  });

  it('stops starting calls when the API key changes mid-run, keeps what finished, and never organizes', async () => {
    const organizer = organizerOf();
    const { service, runInitial } = createService([TOOK, new AgentRunUnavailableError('missing-credentials'), GLANCED], { organizer });
    const result = await service.run(await planOf(service, { organize: true }));
    expect(runInitial).toHaveBeenCalledTimes(2);
    expect(result.ended).toBe('key-changed');
    expect(result.calls).toEqual({ planned: 3, answered: 1, failed: 0, cut: 0, unsent: 2 });
    expect(result.instances).toHaveLength(1);
    expect(organizer.organize).not.toHaveBeenCalled();
  });

  it('sends nothing when the key is gone before the run starts', async () => {
    const planner = createService();
    const plan = await planOf(planner.service);
    const { service, runInitial } = createService([], { engine: false });
    const result = await service.run(plan);
    expect(runInitial).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ended: 'key-changed', calls: { planned: 3, answered: 0, unsent: 3 }, instances: [] });
  });

  describe('a run of provider failures (D7)', () => {
    const MANY = [sourceFile('chapters/1.md', RABBIT_CHAPTER), ...Array.from({ length: 8 }, (_unused, index) => sourceFile(`chapters/${index + 2}.md`, QUEEN_CHAPTER))];
    const refused = (): Error => new AgentRunUnavailableError('insufficient-credits');

    it('stops starting calls after failureStreak failures in a row, keeps what was found, and never organizes', async () => {
      expect(bounds.failureStreak).toBe(5);
      const organizer = organizerOf({ kind: 'analysis', analysis: { headline: 'x', sections: [], read: { instances: 1, of: 1 }, dropped: { claims: 0, sections: 0 } } });
      const { service, runInitial } = createService([TOOK, refused(), refused(), new Error('429'), refused(), refused(), NONE, NONE, NONE], { organizer });
      const plan = await planOf(service, { organize: true, files: MANY });
      expect(plan.organize).toBe(true);
      const result = await service.run(plan);
      expect(runInitial).toHaveBeenCalledTimes(6);
      expect(result.ended).toBe('provider-failed');
      expect(result.calls).toEqual({ planned: 9, answered: 1, failed: 5, cut: 0, unsent: 3 });
      expect(result.instances.map((instance) => instance.quote)).toEqual(['took a watch out of its waistcoat-pocket']);
      expect(organizer.organize).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('analysis');
    });

    it('goes on when an answered call stands between the failures', async () => {
      const { service, runInitial } = createService([refused(), refused(), refused(), refused(), NONE, refused(), refused(), refused(), refused()]);
      const result = await service.run(await planOf(service, { files: MANY }));
      expect(runInitial).toHaveBeenCalledTimes(9);
      expect(result.ended).toBe('complete');
      expect(result.calls).toEqual({ planned: 9, answered: 1, failed: 8, cut: 0, unsent: 0 });
    });

    it('counts only the provider\'s failures: an unreadable reply neither adds to the streak nor ends it', async () => {
      const unreadable = { content: 'I found nothing.' };
      const all = createService([unreadable, unreadable, unreadable, unreadable, unreadable, unreadable, unreadable, unreadable, unreadable]);
      expect((await all.service.run(await planOf(all.service, { files: MANY }))).ended).toBe('complete');
      const mixed = createService([refused(), refused(), refused(), refused(), unreadable, refused(), NONE, NONE, NONE]);
      const result = await mixed.service.run(await planOf(mixed.service, { files: MANY }));
      expect(mixed.runInitial).toHaveBeenCalledTimes(6);
      expect(result.ended).toBe('provider-failed');
      expect(result.calls).toEqual({ planned: 9, answered: 0, failed: 6, cut: 0, unsent: 3 });
    });
  });

  it('stops starting calls at the instance limit, and says so', async () => {
    const quotes = ['ran close by her', 'took a watch out of its waistcoat-pocket', 'hurried on'];
    const original = bounds.instances;
    (PROMPT_BUDGETS.passageSearch as { instances: number }).instances = 2;
    try {
      const { service, runInitial } = createService([reply(...quotes.map((quote) => ({ quote }))), GLANCED, GLANCED]);
      const result = await service.run(await planOf(service));
      expect(runInitial).toHaveBeenCalledTimes(1);
      expect(result.ended).toBe('instance-limit');
      expect(result.instances.map((instance) => instance.quote)).toEqual(quotes.slice(0, 2));
      expect(result.overLimit).toBe(1);
      expect(result.calls).toMatchObject({ answered: 1, unsent: 2 });
    } finally {
      (PROMPT_BUDGETS.passageSearch as { instances: number }).instances = original;
    }
  });

  describe('the organizing pass\'s seam (D12a)', () => {
    const ANALYSIS = { headline: 'The Rabbit checks its watch twice.', sections: [], read: { instances: 2, of: 2 }, dropped: { claims: 0, sections: 0 } };

    it('plans no organizing call and prices no allowance when there is no organizer', async () => {
      const { service } = createService();
      const asked = await planOf(service, { organize: true });
      const unasked = await planOf(service);
      expect(asked.organize).toBe(false);
      expect(asked.estimate.calls).toBe(3);
      expect(asked.estimate).not.toHaveProperty('organize');
      expect(asked.estimate).toEqual(unasked.estimate);
      expect(asked.planKey).toBe(unasked.planKey);
    });

    it('plans the call and its allowance when an organizer is present', async () => {
      const { service } = createService([], { organizer: organizerOf() });
      const asked = await planOf(service, { organize: true });
      const unasked = await planOf(service);
      expect(asked.organize).toBe(true);
      expect(asked.estimate.calls).toBe(4);
      expect(asked.estimate.organize).toEqual({ inputTokens: bounds.organize.allowanceInputTokens, outputTokens: bounds.organize.typicalOutputTokens });
      expect(asked.estimate.inputTokens).toBe(unasked.estimate.inputTokens + bounds.organize.allowanceInputTokens);
      expect(asked.planKey).not.toBe(unasked.planKey);
      expect(unasked.organize).toBe(false);
    });

    it('leaves analysis absent with no organizer, organize asked or not', async () => {
      const { service } = createService([TOOK, NONE, GLANCED]);
      const result = await service.run(await planOf(service, { organize: true }));
      expect(result.ended).toBe('complete');
      expect(result).not.toHaveProperty('analysis');
      expect(result).not.toHaveProperty('analysisMissing');
    });

    it('calls the organizer once, after complete reads with an instance, and adds its analysis and usage', async () => {
      const organizer = organizerOf({ kind: 'analysis', analysis: ANALYSIS, usage: USAGE });
      const { service } = createService([TOOK, NONE, GLANCED], { organizer });
      const result = await service.run(await planOf(service, { organize: true }));
      expect(organizer.organize).toHaveBeenCalledTimes(1);
      expect(organizer.organize.mock.calls[0][0]).toMatchObject({ ended: 'complete', question: QUESTION, model: PASSAGE_MODEL });
      expect(organizer.organize.mock.calls[0][0].instances).toHaveLength(2);
      expect(result.analysis).toEqual(ANALYSIS);
      expect(result.usage).toMatchObject({ totalTokens: 480, requestCount: 4 });
    });

    it('never calls it when the plan does not organize, or nothing was found', async () => {
      const organizer = organizerOf({ kind: 'analysis', analysis: ANALYSIS });
      const unasked = createService([TOOK, NONE, GLANCED], { organizer });
      await unasked.service.run(await planOf(unasked.service));
      const empty = createService([NONE, NONE, NONE], { organizer });
      await empty.service.run(await planOf(empty.service, { organize: true }));
      expect(organizer.organize).not.toHaveBeenCalled();
    });

    it('leaves the list whole, with the reason, when the pass fails or reports why it has no analysis', async () => {
      const throwing = { available: true, plan: jest.fn(), organize: jest.fn(async () => { throw new Error('boom: “Oh dear!”'); }) };
      const failed = createService([TOOK, NONE, GLANCED], { organizer: throwing as never });
      const first = await failed.service.run(await planOf(failed.service, { organize: true }));
      expect(first).toMatchObject({ analysisMissing: 'failed', ended: 'complete' });
      expect(first.instances).toHaveLength(2);

      const cut = createService([TOOK, NONE, GLANCED], { organizer: organizerOf({ kind: 'missing', reason: 'cut' }) });
      const second = await cut.service.run(await planOf(cut.service, { organize: true }));
      expect(second).toMatchObject({ analysisMissing: 'cut' });
      expect(second.instances).toHaveLength(2);
    });

    it('offers the pass afterwards as its own planned action', async () => {
      const organizer = organizerOf({ kind: 'analysis', analysis: ANALYSIS });
      const { service } = createService([TOOK, new AgentRunUnavailableError('missing-credentials')], { organizer });
      const stopped = await service.run(await planOf(service, { organize: true }));
      expect(stopped.ended).toBe('key-changed');
      await expect(service.planOrganize(stopped)).resolves.toEqual({ kind: 'unavailable', message: 'not built' });
      const plan = { planKey: 'k', model: PASSAGE_MODEL, estimate: { model: PASSAGE_MODEL, calls: 1, inputTokens: 10, outputTokens: 5 }, instances: { read: 1, of: 1 } };
      const organized = await service.organize(stopped, plan);
      expect(organizer.organize).toHaveBeenCalledWith(stopped, { plan });
      expect(organized.analysis).toEqual(ANALYSIS);
      expect(organized.ended).toBe('key-changed');
    });
  });

  describe('logs (D22)', () => {
    it('carry counts and fault kinds only: never the question, a quote, a note, a label or a path', async () => {
      const { service, log } = createService([
        reply({ quote: 'took a watch out of its waistcoat-pocket', note: 'A secret note.', label: 'secret label' }, { quote: 'nowhere in the text' }),
        new Error('ENOENT /book/chapters/2.md'),
        { content: 'not json', finishReason: 'stop' }
      ], { facts: new Error('offline at /book/chapters/1.md') });
      const plan = await planOf(service);
      await service.run(plan);
      const lines = log.appendLine.mock.calls.map(([line]) => String(line));
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.some((line) => line.startsWith('[PassageSearch] Plan:'))).toBe(true);
      expect(lines.some((line) => line.startsWith('[PassageSearch] Run ended complete'))).toBe(true);
      const logged = lines.join('\n');
      for (const secret of [QUESTION, 'White Rabbit', 'took a watch', 'nowhere in the text', 'A secret note', 'secret label', 'chapters/', '/book', 'ENOENT', 'not json']) {
        expect(logged).not.toContain(secret);
      }
      expect(logged).toContain('quote-not-found 1');
      expect(logged).toContain('unparseable 1');
    });
  });
});
