/**
 * The handoff from a run's reads to its organizing pass (ADR 2026-11-20
 * D12a, D11; PR #295): the pass goes out only on the engine the run holds,
 * never on a replacement; credentials retired while it is in flight leave
 * no analysis; and one usage total covers both stages, an unknown entry in
 * either withholding the combined cost while still counting as a request.
 * The real organizer and service over stand-in engines; no provider is
 * reached. Texts adapt *Alice's Adventures in Wonderland*.
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

import type { PassageSearchPlan } from '@services/search/passage/PassageSearchContracts';
import type { PassageSearchService } from '@services/search/passage/PassageSearchService';
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
  RESULT,
  USAGE,
  createHost,
  ok,
  planOf
} from '@/__tests__/infrastructure/api/services/search/passage/passageSearchOrganizeHarness';

const FILES = [sourceFile('chapters/1.md', RABBIT_CHAPTER), sourceFile('chapters/2.md', QUEEN_CHAPTER)];
const TOOK = { content: replyOf({ quote: 'took a watch out of its waistcoat-pocket' }) };
const NONE = { content: replyOf() };
const PASS = ok(JSON.stringify({ headline: 'The Rabbit keeps checking the hour.', sections: [{ title: 'The watch', claims: [{ text: 'It "took a watch out of its waistcoat-pocket".', cites: [1] }] }] }));
const UNMETERED = { usage: undefined };

async function searchPlan(service: PassageSearchService): Promise<PassageSearchPlan> {
  const outcome = await service.plan({ model: PASSAGE_MODEL, question: QUESTION, organize: true, files: FILES });
  if (outcome.kind !== 'planned') {
    throw new Error(`expected a plan, got ${outcome.refusal.reason}`);
  }
  return outcome.plan;
}

/** A second engine, as the manager holds one after the key is replaced. */
const replacementEngine = () => ({ runInitial: jest.fn(async () => ({ ...PASS, usage: USAGE, cancelled: false, finishReason: 'stop' })), isProviderAvailable: jest.fn(() => true), getModel: jest.fn(() => PASSAGE_MODEL) });

describe('The pass goes out only on the engine the run holds (PR #295 P1)', () => {
  it('sends nothing on a replacement engine when the key is rotated while the pass is being prepared', async () => {
    const host = createHost([TOOK, NONE, PASS]);
    const plan = await searchPlan(host.service);
    const replacement = replacementEngine();
    // The pass loads its prompt after the reads. The rotation lands while it does:
    // the run's engine is retired and the manager now answers with another.
    host.promptLoader.loadPrompts.mockImplementationOnce(async () => {
      host.engine.isProviderAvailable.mockReturnValue(false);
      host.manager.getEngine.mockReturnValue(replacement as never);
      return 'SYSTEM';
    });
    const result = await host.service.run(plan);
    expect(replacement.runInitial).not.toHaveBeenCalled();
    expect(host.runInitial).toHaveBeenCalledTimes(2);
    expect(host.runInitial.mock.calls.map(([request]) => request.toolName)).toEqual(['passage-search', 'passage-search']);
    expect(result.ended).toBe('key-changed');
    expect(result.instances).toHaveLength(1);
    expect(result).not.toHaveProperty('analysis');
    expect(result).not.toHaveProperty('analysisMissing');
    // Nothing was dispatched for the pass: the total is the two reads', whole.
    expect(result.usage).toMatchObject({ requestCount: 2, totalTokens: 240, costUsd: 0.002 });
  });

  it('sends nothing on a replacement when the rotation lands in the catalog read before it', async () => {
    const host = createHost([TOOK, NONE, PASS]);
    const plan = await searchPlan(host.service);
    const replacement = replacementEngine();
    host.prices.facts.mockImplementationOnce(async () => {
      host.engine.isProviderAvailable.mockReturnValue(false);
      host.manager.getEngine.mockReturnValue(replacement as never);
      return {};
    });
    const result = await host.service.run(plan);
    expect(replacement.runInitial).not.toHaveBeenCalled();
    expect(host.runInitial).toHaveBeenCalledTimes(2);
    expect(result.ended).toBe('key-changed');
  });

  it('never asks the manager for an engine again once the run holds one', async () => {
    const host = createHost([TOOK, NONE, PASS]);
    const plan = await searchPlan(host.service);
    host.manager.getEngine.mockClear();
    const result = await host.service.run(plan);
    expect(result.analysis?.headline).toBe('The Rabbit keeps checking the hour.');
    // Once, by the run, for its reads; the pass is sent on that same engine.
    expect(host.manager.getEngine).toHaveBeenCalledTimes(1);
    expect(host.runInitial).toHaveBeenCalledTimes(3);
  });

  it('keeps no analysis from a pass that answers after the credentials were retired, and keeps what it spent', async () => {
    const host = createHost([TOOK, NONE, () => {
      // Admitted and in flight when the key is retired; it then answers in full.
      host.engine.isProviderAvailable.mockReturnValue(false);
      return PASS;
    }]);
    const result = await host.service.run(await searchPlan(host.service));
    expect(host.runInitial).toHaveBeenCalledTimes(3);
    expect(result.ended).toBe('key-changed');
    expect(result).not.toHaveProperty('analysis');
    expect(result).not.toHaveProperty('analysisMissing');
    expect(result.instances).toHaveLength(1);
    expect(result.usage).toMatchObject({ requestCount: 3, totalTokens: 360 });
  });

  it('keeps no analysis even from an organizer that returns one after retirement', async () => {
    // The service's own check when the pass resolves, whatever organizer is behind the port.
    const host = createHost([TOOK, NONE]);
    const plan = await searchPlan(host.service);
    jest.spyOn(host.organizer, 'organize').mockImplementationOnce(async () => {
      host.engine.isProviderAvailable.mockReturnValue(false);
      return {
        kind: 'analysis',
        analysis: { headline: 'x', sections: [], read: { instances: 1, of: 1 }, dropped: { claims: 0, uncited: 0, misquoted: 0, malformed: 0, sections: 0, cites: 0 }, replaced: { headline: false, titles: 0 }, clipped: 0 },
        usages: [USAGE]
      };
    });
    const result = await host.service.run(plan);
    expect(result.ended).toBe('key-changed');
    expect(result).not.toHaveProperty('analysis');
    expect(result.usage).toMatchObject({ requestCount: 3 });
  });

  it('the caller\'s own later organize action takes the engine current then, once', async () => {
    const host = createHost([ok()]);
    const plan = await planOf(host.organizer);
    host.manager.getEngine.mockClear();
    const organized = await host.service.organize(RESULT, plan);
    expect(host.manager.getEngine).toHaveBeenCalledTimes(1);
    expect(organized.analysis?.headline).toBe('The Rabbit frets aloud once and reaches for its watch twice.');
    // And it, too, keeps no analysis from a pass whose credentials were retired in flight.
    const retired = createHost([() => {
      retired.engine.isProviderAvailable.mockReturnValue(false);
      return ok();
    }]);
    const late = await retired.service.organize(RESULT, await planOf(retired.organizer));
    expect(late).toMatchObject({ analysisMissing: 'key-changed' });
    expect(late).not.toHaveProperty('analysis');
  });
});

describe('One usage total over the reads and the pass (PR #295 P2)', () => {
  it('adds a metered pass to metered reads as a complete total', async () => {
    const host = createHost([TOOK, NONE, PASS]);
    const result = await host.service.run(await searchPlan(host.service));
    expect(result.usage).toEqual({ promptTokens: 300, completionTokens: 60, totalTokens: 360, requestCount: 3, costUsd: 0.003 });
  });

  it('withholds the cost when the pass was dispatched and reported no usage, and still counts it', async () => {
    const host = createHost([TOOK, NONE, { ...PASS, ...UNMETERED }]);
    const result = await host.service.run(await searchPlan(host.service));
    expect(result.analysis).toBeDefined();
    // The reads' tokens are a known subtotal; the cost of three calls is not known, so none is shown.
    expect(result.usage).toEqual({ promptTokens: 200, completionTokens: 40, totalTokens: 240, requestCount: 3 });
  });

  it('withholds the cost when the pass was stopped in flight, and still counts it', async () => {
    const stop = new AbortController();
    const host = createHost([TOOK, NONE, () => {
      stop.abort();
      throw new Error('aborted');
    }]);
    const result = await host.service.run(await searchPlan(host.service), { signal: stop.signal });
    expect(result.ended).toBe('stopped');
    expect(result).not.toHaveProperty('analysis');
    expect(result.usage).toEqual({ promptTokens: 200, completionTokens: 40, totalTokens: 240, requestCount: 3 });
  });

  it('counts unmetered reads beside a metered pass: three requests, the pass\'s tokens, no cost', async () => {
    const host = createHost([{ ...TOOK, ...UNMETERED }, { ...NONE, ...UNMETERED }, PASS]);
    const result = await host.service.run(await searchPlan(host.service));
    expect(result.analysis).toBeDefined();
    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120, requestCount: 3 });
  });

  it('keeps the reads\' total whole when the pass sent nothing', async () => {
    // Retired before the pass: nothing dispatched, so nothing is added and nothing withheld.
    const host = createHost([TOOK, () => {
      host.engine.isProviderAvailable.mockReturnValue(false);
      return NONE;
    }, PASS]);
    const result = await host.service.run(await searchPlan(host.service));
    expect(host.runInitial).toHaveBeenCalledTimes(2);
    expect(result.usage).toEqual({ promptTokens: 200, completionTokens: 40, totalTokens: 240, requestCount: 2, costUsd: 0.002 });
    // The same for a pass that could not be made at all.
    const noRoom = createHost([TOOK, NONE, PASS], { facts: { contextLength: 8_040 } });
    const plan = await searchPlan(createHost().service);
    const unfitted = await noRoom.service.run(plan);
    expect(unfitted).toMatchObject({ analysisMissing: 'no-room', usage: { requestCount: 2, costUsd: 0.002 } });
  });

  it('does the same for a pass made afterwards of a finished result', async () => {
    const metered = resultOf(RESULT.instances, { ended: 'stopped', usage: { promptTokens: 200, completionTokens: 40, totalTokens: 240, requestCount: 2, costUsd: 0.002 } });
    const whole = createHost([ok()]);
    expect((await whole.service.organize(metered, await planOf(whole.organizer, metered))).usage)
      .toEqual({ promptTokens: 300, completionTokens: 60, totalTokens: 360, requestCount: 3, costUsd: 0.003 });
    const unmeteredPass = createHost([{ ...ok(), ...UNMETERED }]);
    expect((await unmeteredPass.service.organize(metered, await planOf(unmeteredPass.organizer, metered))).usage)
      .toEqual({ promptTokens: 200, completionTokens: 40, totalTokens: 240, requestCount: 3 });
    // Reads that were dispatched and reported nothing: counted from the result's own calls, the cost withheld.
    const unmeteredReads = resultOf(RESULT.instances, { ended: 'stopped', calls: { planned: 3, answered: 1, failed: 0, cut: 0, cancelled: 1, unsent: 1 } });
    const host = createHost([ok()]);
    expect((await host.service.organize(unmeteredReads, await planOf(host.organizer, unmeteredReads))).usage)
      .toEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120, requestCount: 3 });
    // A pass that sent nothing leaves a result's usage exactly as it was.
    const none = createHost([ok()], { engine: false });
    const plan = await planOf(createHost().organizer, metered);
    expect((await none.service.organize(metered, plan)).usage).toEqual(metered.usage);
  });

  it('counts a pass whose request went out and whose response could not be read, and shows no complete cost (re-review)', async () => {
    // The provider answered, and the reply would not decode: the engine throws after dispatch.
    const reads = { usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, costUsd: 0.01, cachedTokens: 5, cacheWriteTokens: 3 } };
    const inline = createHost([{ ...TOOK, ...reads } as never, { ...NONE, ...reads } as never, new Error('response body could not be decoded')]);
    const result = await inline.service.run(await searchPlan(inline.service));
    expect(inline.runInitial).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ analysisMissing: 'failed', ended: 'complete' });
    expect(result.usage).toStrictEqual({ promptTokens: 200, completionTokens: 40, totalTokens: 240, requestCount: 3 });

    // The same pass made afterwards, of a result whose two reads were metered in full.
    const metered = resultOf(RESULT.instances, { ended: 'stopped', usage: { promptTokens: 200, completionTokens: 40, totalTokens: 240, requestCount: 2, costUsd: 0.02, cachedTokens: 10, cacheWriteTokens: 6 } });
    const later = createHost([new Error('response body could not be decoded')]);
    const organized = await later.service.organize(metered, await planOf(later.organizer, metered));
    expect(later.runInitial).toHaveBeenCalledTimes(1);
    expect(organized.usage).toStrictEqual({ promptTokens: 200, completionTokens: 40, totalTokens: 240, requestCount: 3 });
  });

  it('counts a cut-off, too-long or malformed pass reply with the usage it reported, or as unknown when it reported none', async () => {
    for (const reply of [{ content: '{"headline":"The Rab', finishReason: 'length' }, ok('not json at all'), ok(' '.repeat(120_001))]) {
      const metered = createHost([TOOK, NONE, reply]);
      expect((await metered.service.run(await searchPlan(metered.service))).usage)
        .toStrictEqual({ promptTokens: 300, completionTokens: 60, totalTokens: 360, requestCount: 3, costUsd: 0.003 });
      const unmetered = createHost([TOOK, NONE, { ...reply, ...UNMETERED }]);
      expect((await unmetered.service.run(await searchPlan(unmetered.service))).usage)
        .toStrictEqual({ promptTokens: 200, completionTokens: 40, totalTokens: 240, requestCount: 3 });
    }
  });

  it('counts a read whose call failed after dispatch, or whose reply was unreadable, the same way', async () => {
    // One read fails at the provider: it may have been charged, so the total is not complete.
    const failed = createHost([TOOK, new Error('502')]);
    const plan = await failed.service.plan({ model: PASSAGE_MODEL, question: QUESTION, organize: false, files: FILES });
    if (plan.kind !== 'planned') {
      throw new Error('expected a plan');
    }
    const first = await failed.service.run(plan.plan);
    expect(first.calls).toMatchObject({ answered: 1, failed: 1 });
    expect(first.usage).toStrictEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120, requestCount: 2 });
    // One read comes back unreadable, with the usage the provider reported: counted, and its cost known.
    const unreadable = createHost([TOOK, ok('not json at all')]);
    const second = await unreadable.service.run(plan.plan);
    expect(second.calls).toMatchObject({ answered: 1, failed: 1 });
    expect(second.usage).toStrictEqual({ promptTokens: 200, completionTokens: 40, totalTokens: 240, requestCount: 2, costUsd: 0.002 });
  });

  it('counts the same requests inline and afterwards when no read reported usage (re-review)', async () => {
    // One valid unmetered read, one malformed unmetered reply, then a metered pass: three requests either way.
    const host = createHost([{ ...TOOK, ...UNMETERED }, { ...ok('not json at all'), ...UNMETERED }, PASS]);
    const inline = await host.service.run(await searchPlan(host.service));
    expect(inline.calls).toMatchObject({ answered: 1, failed: 1, cancelled: 0, unsent: 0 });
    expect(inline.usage).toStrictEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120, requestCount: 3 });

    const reads = createHost([{ ...TOOK, ...UNMETERED }, { ...ok('not json at all'), ...UNMETERED }]);
    const plain = await reads.service.plan({ model: PASSAGE_MODEL, question: QUESTION, organize: false, files: FILES });
    if (plain.kind !== 'planned') {
      throw new Error('expected a plan');
    }
    const unorganized = await reads.service.run(plain.plan);
    expect(unorganized).not.toHaveProperty('usage');
    const later = createHost([PASS]);
    const explicit = await later.service.organize(unorganized, await planOf(later.organizer, unorganized));
    expect(explicit.usage).toStrictEqual(inline.usage);
  });
});
