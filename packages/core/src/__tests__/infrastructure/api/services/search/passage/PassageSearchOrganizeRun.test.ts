/**
 * The organizing pass through PassageSearchService (ADR 2026-11-20 D12,
 * D12a, D13): the allowance in the first estimate; one pass after complete
 * reads; no pass after Stop, a key change or a run of failures; a failed
 * pass leaves the list whole; and organizing a stopped result afterwards is
 * its own priced action. The real organizer and service over a stand-in
 * engine; no provider is reached. Texts adapt *Alice's Adventures in
 * Wonderland*.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  // One at a time, in order, so the reads and then the pass take replies in a known order.
  default: () => {
    let chain: Promise<unknown> = Promise.resolve();
    return (fn: () => Promise<unknown>) => {
      const run = chain.then(fn);
      chain = run.catch(() => undefined);
      return run;
    };
  }
}));

import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import { PassageSearchService } from '@services/search/passage/PassageSearchService';
import {
  PASSAGE_MODEL,
  QUEEN_CHAPTER,
  QUESTION,
  RABBIT_CHAPTER,
  replyOf,
  resultOf,
  sourceFile
} from '@/__tests__/infrastructure/api/services/search/passage/passageSearchFixtures';
import {
  PRICING,
  RESULT,
  createHost,
  ok,
  organize,
  planOf
} from '@/__tests__/infrastructure/api/services/search/passage/passageSearchOrganizeHarness';

describe('The organizing pass through PassageSearchService', () => {
  const FILES = [sourceFile('chapters/1.md', RABBIT_CHAPTER), sourceFile('chapters/2.md', QUEEN_CHAPTER)];
  const TOOK = { content: replyOf({ quote: 'took a watch out of its waistcoat-pocket' }) };
  const GLANCED = { content: replyOf({ quote: 'glanced at its watch again' }) };
  const NONE = { content: replyOf() };
  const PASS = ok(JSON.stringify({ headline: 'The Rabbit keeps checking the hour.', sections: [{ title: 'The watch', claims: [{ text: 'It "took a watch out of its waistcoat-pocket".', cites: [1] }] }] }));

  async function searchPlan(service: PassageSearchService, organizeAsked = true) {
    const outcome = await service.plan({ model: PASSAGE_MODEL, question: QUESTION, organize: organizeAsked, files: FILES });
    if (outcome.kind !== 'planned') {
      throw new Error(`expected a plan, got ${outcome.refusal.reason}`);
    }
    return outcome.plan;
  }

  it('prices the allowance in the first estimate, now that an organizer is present', async () => {
    const { service } = createHost();
    const asked = await searchPlan(service);
    const unasked = await searchPlan(service, false);
    expect(asked.organize).toBe(true);
    expect(asked.estimate.calls).toBe(unasked.estimate.calls + 1);
    expect(asked.estimate.organize).toEqual({ inputTokens: organize.allowanceInputTokens, outputTokens: organize.typicalOutputTokens });
    expect(asked.estimate.inputTokens).toBe(unasked.estimate.inputTokens + organize.allowanceInputTokens);
    expect(asked.planKey).not.toBe(unasked.planKey);
  });

  it('organizes a complete run: the reads, then one pass over the checked instances, on the plan\'s model', async () => {
    const { service, runInitial } = createHost([TOOK, NONE, PASS]);
    const result = await service.run(await searchPlan(service));
    expect(runInitial).toHaveBeenCalledTimes(3);
    expect(runInitial.mock.calls[2][0]).toMatchObject({ toolName: 'passage-search-organize', options: { model: PASSAGE_MODEL, temperature: 0 } });
    expect(runInitial.mock.calls[2][0].userMessage).toContain('[1] chapters/1.md, line 3, label: checks its watch\nquote: took a watch out of its waistcoat-pocket');
    expect(result.ended).toBe('complete');
    expect(result.analysis).toMatchObject({ headline: 'The Rabbit keeps checking the hour.', read: { instances: 1, of: 1 } });
    expect(result).not.toHaveProperty('analysisMissing');
    expect(result.usage).toMatchObject({ totalTokens: 360, requestCount: 3 });
  });

  it('does not call the pass when Stop lands after the last read and before it', async () => {
    const stop = new AbortController();
    const { service, runInitial } = createHost([TOOK, () => {
      stop.abort();
      return NONE;
    }, PASS]);
    const result = await service.run(await searchPlan(service), { signal: stop.signal });
    expect(runInitial).toHaveBeenCalledTimes(2);
    expect(runInitial.mock.calls.map(([request]) => request.toolName)).toEqual(['passage-search', 'passage-search']);
    expect(result.ended).toBe('stopped');
    expect(result.instances).toHaveLength(1);
    expect(result).not.toHaveProperty('analysis');
    expect(result).not.toHaveProperty('analysisMissing');
  });

  it('does not call the pass when Stop lands inside the pass\'s own preparation', async () => {
    const stop = new AbortController();
    const { service, runInitial, promptLoader } = createHost([TOOK, NONE, PASS]);
    const plan = await searchPlan(service);
    // The pass loads its prompt after the reads; the stop arrives while it does.
    promptLoader.loadPrompts.mockImplementationOnce(async () => {
      stop.abort();
      return 'SYSTEM';
    });
    const result = await service.run(plan, { signal: stop.signal });
    expect(runInitial).toHaveBeenCalledTimes(2);
    expect(result.ended).toBe('stopped');
    expect(result.instances).toHaveLength(1);
    expect(result).not.toHaveProperty('analysis');
    expect(result).not.toHaveProperty('analysisMissing');
  });

  it('never calls the pass after a key change or a run of provider failures, and ends the run on a key change during it', async () => {
    const changed = createHost([TOOK, new AgentRunUnavailableError('missing-credentials'), PASS]);
    const first = await changed.service.run(await searchPlan(changed.service));
    expect(first.ended).toBe('key-changed');
    expect(changed.runInitial).toHaveBeenCalledTimes(2);

    const during = createHost([TOOK, NONE, new AgentRunUnavailableError('missing-credentials')]);
    const second = await during.service.run(await searchPlan(during.service));
    expect(second.ended).toBe('key-changed');
    expect(second.instances).toHaveLength(1);
    expect(second).not.toHaveProperty('analysis');
    expect(second).not.toHaveProperty('analysisMissing');
  });

  it('leaves the list whole, with its reason, when the pass is cut off, malformed or fails', async () => {
    for (const [reply, reason] of [
      [{ content: '{"headline":"The Rab', finishReason: 'length' }, 'cut'],
      [ok('not json at all'), 'malformed'],
      [new Error('503'), 'failed']
    ] as const) {
      const { service } = createHost([TOOK, GLANCED, reply]);
      const files = [sourceFile('chapters/1.md', RABBIT_CHAPTER), sourceFile('chapters/3.md', RABBIT_CHAPTER)];
      const outcome = await service.plan({ model: PASSAGE_MODEL, question: QUESTION, organize: true, files });
      if (outcome.kind !== 'planned') {
        throw new Error('expected a plan');
      }
      const result = await service.run(outcome.plan);
      expect(result).toMatchObject({ analysisMissing: reason, ended: 'complete' });
      expect(result).not.toHaveProperty('analysis');
      expect(result.instances.map((instance) => instance.quote)).toEqual(['took a watch out of its waistcoat-pocket', 'glanced at its watch again']);
      expect(result.labels).toEqual([{ key: 'checks its watch', label: 'checks its watch', count: 2, files: 2 }]);
    }
  });

  it('organizes a stopped result afterwards as its own priced action, and a changed price is a different key', async () => {
    const stop = new AbortController();
    const host = createHost([TOOK, () => {
      stop.abort();
      return NONE;
    }, PASS]);
    const stopped = await host.service.run(await searchPlan(host.service), { signal: stop.signal });
    expect(stopped.ended).toBe('stopped');
    expect(host.runInitial).toHaveBeenCalledTimes(2);

    const priced = await host.service.planOrganize(stopped);
    if (priced.kind !== 'planned') {
      throw new Error('expected an organize plan');
    }
    expect(priced.plan.estimate).toMatchObject({ model: PASSAGE_MODEL, calls: 1, outputTokens: organize.typicalOutputTokens });
    expect(priced.plan.estimate.usd).toBeGreaterThan(0);
    expect(priced.plan.instances).toEqual({ read: 1, of: 1 });
    expect(host.runInitial).toHaveBeenCalledTimes(2);

    // The price moves before the press: planning again gives another key, so a caller comparing keys sends nothing.
    host.state.facts = { pricing: { ...PRICING, promptUsdPerToken: 0.000003 } };
    const repriced = await host.service.planOrganize(stopped);
    expect(repriced.kind === 'planned' && repriced.plan.planKey).not.toBe(priced.plan.planKey);
    expect(repriced.kind === 'planned' && repriced.plan.userMessage).toBe(priced.plan.userMessage);
    host.state.facts = undefined;
    const again = await host.service.planOrganize(stopped);
    expect(again.kind === 'planned' && again.plan.planKey).toBe(priced.plan.planKey);

    const organized = await host.service.organize(stopped, priced.plan);
    expect(host.runInitial).toHaveBeenCalledTimes(3);
    expect(host.runInitial.mock.calls[2][0]).toMatchObject({ systemMessage: priced.plan.systemMessage, userMessage: priced.plan.userMessage, options: { model: PASSAGE_MODEL } });
    expect(organized.analysis?.headline).toBe('The Rabbit keeps checking the hour.');
    // A new result: the stopped one is as it was, and how its reads ended still stands.
    expect(stopped).not.toHaveProperty('analysis');
    expect(organized.ended).toBe('stopped');
    expect(organized.instances).toBe(stopped.instances);
    expect(organized.usage).toMatchObject({ requestCount: 3 });
  });

  it('says why an explicit pass left no analysis, a stop and a key change included, and sends nothing once stopped', async () => {
    const result = resultOf(RESULT.instances, { ended: 'key-changed' });
    const cut = createHost([{ content: '{', finishReason: 'length' }]);
    expect(await cut.service.organize(result, await planOf(cut.organizer, result))).toMatchObject({ analysisMissing: 'cut', ended: 'key-changed' });
    const gone = createHost([ok()]);
    const plan = await planOf(gone.organizer, result);
    gone.state.engine = false;
    expect(await gone.service.organize(result, plan)).toMatchObject({ analysisMissing: 'key-changed' });
    const stop = new AbortController();
    stop.abort();
    const stopped = createHost([ok()]);
    expect(await stopped.service.organize(result, await planOf(stopped.organizer, result), { signal: stop.signal })).toBe(result);
    expect(gone.runInitial).not.toHaveBeenCalled();
    expect(stopped.runInitial).not.toHaveBeenCalled();
    await expect(createHost().service.planOrganize(resultOf([]))).resolves.toMatchObject({ kind: 'unavailable' });
  });
});
