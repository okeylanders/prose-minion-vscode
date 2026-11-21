/**
 * Passage Search four calls wide (ADR 2026-11-20 D7, D10, D11; PR #293 F2,
 * F3, F4, F6): what a run does when several reads are in flight at once.
 * The limiter is a faithful stand-in for `p-limit` (which is ESM, so jest
 * cannot load it): it runs up to the limit at a time and admits the next as
 * each settles. The provider is deferred, so each test decides which call
 * comes back when. No provider is reached; the text is made-up filler.
 */
/* eslint-disable @typescript-eslint/naming-convention -- drops keyed by their closed reasons. */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: (concurrency: number) => {
    let active = 0;
    const queue: Array<() => void> = [];
    const next = (): void => {
      if (active < concurrency && queue.length > 0) {
        active += 1;
        queue.shift()!();
      }
    };
    return <T>(fn: () => Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
      queue.push(() => {
        Promise.resolve().then(fn).then(resolve, reject).finally(() => {
          active -= 1;
          next();
        });
      });
      next();
    });
  }
}));

import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { PassageSearchPlan, PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import { PassageSearchService } from '@services/search/passage/PassageSearchService';
import { PASSAGE_MODEL, QUESTION, replyOf, sourceFile } from '@/__tests__/infrastructure/api/services/search/passage/passageSearchFixtures';

const USAGE = { promptTokens: 100, completionTokens: 20, totalTokens: 120, costUsd: 0.001 };
const bounds = PROMPT_BUDGETS.passageSearch as { -readonly [Key in keyof typeof PROMPT_BUDGETS.passageSearch]: (typeof PROMPT_BUDGETS.passageSearch)[Key] };
const ANALYSIS = { headline: 'x', sections: [], read: { instances: 1, of: 1 }, dropped: { claims: 0, uncited: 0, misquoted: 0, malformed: 0, sections: 0, cites: 0 }, replaced: { headline: false, titles: 0 }, clipped: 0 };

interface Dispatched {
  readonly request: Record<string, any>;
  answer(content: string, extra?: { cancelled?: boolean }): void;
  fail(error: Error): void;
}

function createHost() {
  const dispatched: Dispatched[] = [];
  let available = true;
  const engine = {
    getModel: () => PASSAGE_MODEL,
    isProviderAvailable: () => available,
    runInitial: jest.fn((request: Record<string, any>) => new Promise((resolve, reject) => {
      dispatched.push({
        request,
        answer: (content, extra = {}) => resolve({ usedGuides: [], requestedResources: [], artifacts: [], finishReason: 'stop', usage: USAGE, cancelled: false, content, ...extra }),
        fail: reject
      });
    }))
  };
  const organizer = {
    available: true,
    plan: jest.fn(async () => ({ kind: 'unavailable' as const, message: 'not used' })),
    organize: jest.fn(async (_result: PassageSearchResult) => ({ kind: 'analysis' as const, analysis: ANALYSIS, usages: [] }))
  };
  const service = new PassageSearchService(
    { ensureInitialized: async () => undefined, getEngine: () => engine } as never,
    { loadPrompts: async () => 'SYSTEM' } as never,
    { facts: async () => ({}) },
    { appendLine: jest.fn() } as never,
    organizer
  );
  return { service, dispatched, organizer, retire: () => { available = false; } };
}

/** Lets every settled call's turn, and the admissions that follow it, run. */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const chapter = (index: number): string => `Chapter ${index}: the Rabbit looked at watch number ${index}, and hurried on.`;
const chapters = (count: number) => Array.from({ length: count }, (_unused, index) => sourceFile(`chapters/${index + 1}.md`, chapter(index + 1)));
const found = (index: number): string => replyOf({ quote: `looked at watch number ${index}` });

async function planOf(service: PassageSearchService, files = chapters(12), organize = true): Promise<PassageSearchPlan> {
  const outcome = await service.plan({ model: PASSAGE_MODEL, question: QUESTION, organize, files });
  if (outcome.kind !== 'planned') {
    throw new Error(`expected a plan, got ${outcome.refusal.reason}`);
  }
  return outcome.plan;
}

describe('a Passage Search run, four calls wide', () => {
  it('admits four at a time, the next as each settles', async () => {
    expect(bounds.concurrency).toBe(4);
    const { service, dispatched } = createHost();
    const run = service.run(await planOf(service, chapters(6), false));
    await settle();
    expect(dispatched).toHaveLength(4);
    dispatched[2].answer(found(3));
    await settle();
    expect(dispatched).toHaveLength(5);
    dispatched.filter((_call, index) => index !== 2).forEach((call) => call.answer(replyOf()));
    await settle();
    dispatched[5].answer(replyOf());
    const result = await run;
    expect(result).toMatchObject({ ended: 'complete', calls: { planned: 6, answered: 6, unsent: 0 } });
  });

  it('stops admitting at the fifth provider failure in a row, keeps the successes still in flight, and never organizes', async () => {
    const { service, dispatched, organizer } = createHost();
    const run = service.run(await planOf(service));
    await settle();
    // Four fail: each makes room for one more, so eight have been dispatched.
    dispatched.slice(0, 4).forEach((call) => call.fail(new AgentRunUnavailableError('rate-limited')));
    await settle();
    expect(dispatched).toHaveLength(8);
    // The fifth failure in a row stops admission, with three calls still in flight.
    dispatched[4].fail(new AgentRunUnavailableError('rate-limited'));
    await settle();
    expect(dispatched).toHaveLength(8);
    [5, 6, 7].forEach((index) => dispatched[index].answer(found(index + 1)));
    const result = await run;

    expect(dispatched).toHaveLength(8);
    expect(result.ended).toBe('provider-failed');
    expect(result.calls).toEqual({ planned: 12, answered: 3, failed: 5, cut: 0, cancelled: 0, unsent: 4 });
    expect(result.instances.map((instance) => instance.quote)).toEqual([6, 7, 8].map((index) => `looked at watch number ${index}`));
    expect(result.files.searched).toEqual({ full: 3, partial: 0, none: 9 });
    expect(result.files.planned.map((file) => file.chunks.admitted)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]);
    expect(organizer.organize).not.toHaveBeenCalled();
  });

  it('does not stop when an answer comes back between the failures, whatever order they were sent in', async () => {
    const { service, dispatched } = createHost();
    const run = service.run(await planOf(service, chapters(9), false));
    await settle();
    // Completion order: fail, fail, answer, fail, fail, fail, fail, answer, fail.
    const failing = (index: number) => dispatched[index].fail(new AgentRunUnavailableError('rate-limited'));
    failing(1);
    failing(3);
    dispatched[0].answer(found(1));
    await settle();
    [2, 4, 5, 6].forEach(failing);
    await settle();
    expect(dispatched).toHaveLength(9);
    dispatched[7].answer(found(8));
    await settle();
    failing(8);
    const result = await run;
    expect(result.ended).toBe('complete');
    expect(result.calls).toEqual({ planned: 9, answered: 2, failed: 7, cut: 0, cancelled: 0, unsent: 0 });
  });

  it('on Stop counts the four calls in flight as cancelled, with their usage, and only the queued ones as unsent', async () => {
    const stop = new AbortController();
    const { service, dispatched, organizer } = createHost();
    const run = service.run(await planOf(service), { signal: stop.signal });
    await settle();
    expect(dispatched).toHaveLength(4);
    stop.abort();
    // Two come back flagged cancelled, with the usage the provider reported; two are aborted in flight.
    dispatched[0].answer('', { cancelled: true });
    dispatched[1].answer(found(2), { cancelled: true });
    dispatched[2].fail(new Error('aborted'));
    dispatched[3].fail(new Error('aborted'));
    const result = await run;

    expect(dispatched).toHaveLength(4);
    expect(result.ended).toBe('stopped');
    expect(result.calls).toEqual({ planned: 12, answered: 0, failed: 0, cut: 0, cancelled: 4, unsent: 8 });
    // Four requests were made; two reported nothing, so the known tokens stand and no cost or cache total is claimed.
    expect(result.usage).toMatchObject({ totalTokens: 240, requestCount: 4 });
    expect(result.usage?.costUsd).toBeUndefined();
    expect(result.usage?.cachedTokens).toBeUndefined();
    expect(result.files.planned.map((file) => file.chunks.admitted)).toEqual([1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(result.files.searched).toEqual({ full: 0, partial: 0, none: 12 });
    expect(result.instances).toEqual([]);
    expect(organizer.organize).not.toHaveBeenCalled();
  });

  it('keeps what finished before Stop, and what was in flight is cancelled', async () => {
    const stop = new AbortController();
    const { service, dispatched } = createHost();
    const run = service.run(await planOf(service, chapters(6)), { signal: stop.signal });
    await settle();
    dispatched[0].answer(found(1));
    await settle();
    expect(dispatched).toHaveLength(5);
    stop.abort();
    dispatched.slice(1).forEach((call) => call.answer('', { cancelled: true }));
    const result = await run;
    expect(result.calls).toEqual({ planned: 6, answered: 1, failed: 0, cut: 0, cancelled: 4, unsent: 1 });
    expect(result.instances.map((instance) => instance.quote)).toEqual(['looked at watch number 1']);
    expect(result.ended).toBe('stopped');
  });

  describe('a key rotated after the last reads were admitted (PR #293 F2)', () => {
    it('ends key-changed with exactly four reads in flight and none left to refuse, keeps their results, and never organizes', async () => {
      const { service, dispatched, organizer, retire } = createHost();
      const run = service.run(await planOf(service, chapters(4)));
      await settle();
      expect(dispatched).toHaveLength(4);
      // Every read is already in flight: retirement refuses no later call.
      retire();
      dispatched.forEach((call, index) => call.answer(found(index + 1)));
      const result = await run;

      expect(result.ended).toBe('key-changed');
      expect(result.calls).toEqual({ planned: 4, answered: 4, failed: 0, cut: 0, cancelled: 0, unsent: 0 });
      expect(result.instances).toHaveLength(4);
      expect(result.files.searched).toEqual({ full: 4, partial: 0, none: 0 });
      expect(organizer.organize).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('analysis');
    });

    it('organizes the same run when the key did not change', async () => {
      const { service, dispatched, organizer } = createHost();
      const run = service.run(await planOf(service, chapters(4)));
      await settle();
      dispatched.forEach((call, index) => call.answer(found(index + 1)));
      const result = await run;
      expect(result.ended).toBe('complete');
      expect(organizer.organize).toHaveBeenCalledTimes(1);
      expect(result.analysis).toEqual(ANALYSIS);
    });

    it('leaves queued reads unsent when the key rotates with more to send, and keeps key-changed over Stop', async () => {
      const stop = new AbortController();
      const { service, dispatched, organizer, retire } = createHost();
      const run = service.run(await planOf(service, chapters(6)), { signal: stop.signal });
      await settle();
      retire();
      dispatched.forEach((call, index) => call.answer(found(index + 1)));
      await settle();
      stop.abort();
      const result = await run;
      expect(dispatched).toHaveLength(4);
      expect(result.ended).toBe('key-changed');
      expect(result.calls).toEqual({ planned: 6, answered: 4, failed: 0, cut: 0, cancelled: 0, unsent: 2 });
      expect(organizer.organize).not.toHaveBeenCalled();
    });
  });

  describe('one file in two chunks', () => {
    const paragraphs = [
      'Alice was beginning to get very tired of sitting.',
      'The Rabbit looked at its watch and then hurried on.',
      'Down, down, down she fell past shelves and cupboards.'
    ];
    const text = paragraphs.join('\n\n');
    const QUOTE = 'looked at its watch';
    const first = replyOf({ quote: 'Alice was beginning' }, { quote: QUOTE, note: 'From the first chunk.', label: 'first' });
    const second = replyOf({ quote: QUOTE, note: 'From the second chunk.', label: 'second' }, { quote: 'Down, down, down' });

    /** Planned at a budget that splits the text in two, the second chunk opening with the middle paragraph again. */
    async function twoChunkRun(extra = chapters(2)) {
      const original = { chunkWords: bounds.chunkWords, overlapWords: bounds.overlapWords };
      Object.assign(bounds, { chunkWords: 22, overlapWords: 12 });
      try {
        const host = createHost();
        const plan = await planOf(host.service, [sourceFile('chapters/0.md', text), ...extra], false);
        expect(plan.chunks.filter((chunk) => chunk.file === 0).map((chunk) => text.slice(chunk.start, chunk.end))).toEqual([
          `${paragraphs[0]}\n\n${paragraphs[1]}`,
          `${paragraphs[1]}\n\n${paragraphs[2]}`
        ]);
        return { ...host, plan };
      } finally {
        Object.assign(bounds, original);
      }
    }

    it('keeps the same instance, note and label whichever chunk\'s reply comes back first (PR #293 F6)', async () => {
      const results: PassageSearchResult[] = [];
      for (const order of [[0, 1], [1, 0]]) {
        const { service, dispatched, plan } = await twoChunkRun([]);
        const run = service.run(plan);
        await settle();
        expect(dispatched).toHaveLength(2);
        for (const index of order) {
          dispatched[index].answer(index === 0 ? first : second);
          await settle();
        }
        results.push(await run);
      }
      expect(results[0].instances).toEqual(results[1].instances);
      expect(results[0].labels).toEqual(results[1].labels);
      expect(results[0].dropped).toEqual(results[1].dropped);
      expect(results[0].instances.map((instance) => [instance.quote, instance.note, instance.label])).toEqual([
        ['Alice was beginning', 'A note.', 'checks its watch'],
        [QUOTE, 'From the first chunk.', 'first'],
        ['Down, down, down', 'A note.', 'checks its watch']
      ]);
      expect(results[0].dropped.duplicate).toBe(1);
    });

    it('says of each file whether it was searched in full, in part or not at all, hits or none (PR #293 F4)', async () => {
      const { service, dispatched, plan } = await twoChunkRun(chapters(2));
      const run = service.run(plan);
      await settle();
      expect(dispatched).toHaveLength(4);
      // The two-chunk file: one chunk answered, one unreadable. Then a file answered with no hit, and one whose call failed.
      dispatched[0].answer(replyOf());
      dispatched[1].answer('not json');
      dispatched[2].answer(replyOf());
      dispatched[3].fail(new Error('503'));
      const result = await run;
      expect(result.instances).toEqual([]);
      expect(result.files.planned.map((file) => [file.displayPath, file.chunks, file.searched, file.instances])).toEqual([
        ['chapters/0.md', { planned: 2, admitted: 2, answered: 1 }, 'partial', 0],
        ['chapters/1.md', { planned: 1, admitted: 1, answered: 1 }, 'full', 0],
        ['chapters/2.md', { planned: 1, admitted: 1, answered: 0 }, 'none', 0]
      ]);
      expect(result.files.searched).toEqual({ full: 1, partial: 1, none: 1 });
      expect(result.ended).toBe('complete');
    });
  });
});
