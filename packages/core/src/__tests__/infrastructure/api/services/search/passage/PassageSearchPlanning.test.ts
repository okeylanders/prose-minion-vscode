/**
 * A Passage Search plan (ADR 2026-11-20 D2, D2a, D5a, D6, D12a, D14): the
 * call plan fitted to half a known window, the estimate priced from the
 * exact messages, and a key that moves with anything shown or sent.
 */
import { estimateRequestTokens } from '@orchestration/RequestContextPreflight';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { passageSearchMessages } from '@services/search/passage/PassageSearchMessages';
import { buildPassageSearchPlan, type PassageSearchPlanInput } from '@services/search/passage/PassageSearchPlanning';
import type { PassageSearchPlan } from '@services/search/passage/PassageSearchContracts';
import {
  PASSAGE_MODEL,
  QUEEN_CHAPTER,
  QUESTION,
  RABBIT_CHAPTER,
  SYSTEM_MESSAGE,
  fillerParagraph,
  sourceFile
} from '@/__tests__/infrastructure/api/services/search/passage/passageSearchFixtures';

const bounds = PROMPT_BUDGETS.passageSearch;
const PRICING = { promptUsdPerToken: 0.000001, completionUsdPerToken: 0.000004 };

function inputOf(overrides: Partial<PassageSearchPlanInput> = {}): PassageSearchPlanInput {
  return {
    model: PASSAGE_MODEL,
    question: QUESTION,
    organize: false,
    systemMessage: SYSTEM_MESSAGE,
    files: [sourceFile('chapters/1.md', RABBIT_CHAPTER), sourceFile('chapters/2.md', QUEEN_CHAPTER)],
    leftOut: [],
    facts: { pricing: PRICING },
    ...overrides
  };
}

function planOf(input: PassageSearchPlanInput, limits = bounds): PassageSearchPlan {
  const planned = buildPassageSearchPlan(input, limits);
  if (planned.kind !== 'planned') {
    throw new Error(`expected a plan, got ${planned.kind}`);
  }
  return planned.plan;
}

const longChapter = Array.from({ length: 40 }, (_unused, index) => fillerParagraph(`Alice${index}x`, 100)).join('\n\n');

describe('buildPassageSearchPlan', () => {
  it('reads a file that fits in one call, keyed in reading order with its hash', () => {
    const plan = planOf(inputOf());
    expect(plan.files.map((file) => [file.key, file.displayPath])).toEqual([['f1', 'chapters/1.md'], ['f2', 'chapters/2.md']]);
    expect(plan.files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(plan.files[0].text).toBe(RABBIT_CHAPTER);
    expect(plan.chunks).toEqual([
      { file: 0, start: 0, bodyStart: 0, end: RABBIT_CHAPTER.length },
      { file: 1, start: 0, bodyStart: 0, end: QUEEN_CHAPTER.length }
    ]);
    expect(plan).toMatchObject({ model: PASSAGE_MODEL, question: QUESTION, organize: false, systemMessage: SYSTEM_MESSAGE, chunkWords: bounds.chunkWords });
  });

  it('prices the exact messages the read calls send, at a typical reply each', () => {
    const { estimate } = planOf(inputOf());
    const inputTokens = estimateRequestTokens(passageSearchMessages(SYSTEM_MESSAGE, QUESTION, RABBIT_CHAPTER))
      + estimateRequestTokens(passageSearchMessages(SYSTEM_MESSAGE, QUESTION, QUEEN_CHAPTER));
    const outputTokens = 2 * bounds.typicalOutputTokens;
    expect(estimate).toEqual({
      model: PASSAGE_MODEL,
      files: 2,
      calls: 2,
      inputTokens,
      outputTokens,
      usd: inputTokens * PRICING.promptUsdPerToken + outputTokens * PRICING.completionUsdPerToken,
      reads: { calls: 2, inputTokens, outputTokens },
      leftOut: { unreadable: 0, unsplittable: 0, empty: 0 }
    });
  });

  it('adds the organizing pass as an allowance: one more call, its tokens apart from the reads', () => {
    const reads = planOf(inputOf()).estimate;
    const { estimate } = planOf(inputOf({ organize: true }));
    expect(estimate.calls).toBe(reads.calls + 1);
    expect(estimate.reads).toEqual(reads.reads);
    expect(estimate.organize).toEqual({ inputTokens: bounds.organize.allowanceInputTokens, outputTokens: bounds.organize.typicalOutputTokens });
    expect(estimate.inputTokens).toBe(reads.inputTokens + bounds.organize.allowanceInputTokens);
    expect(estimate.outputTokens).toBe(reads.outputTokens + bounds.organize.typicalOutputTokens);
    expect(estimate.usd).toBeCloseTo(estimate.inputTokens * PRICING.promptUsdPerToken + estimate.outputTokens * PRICING.completionUsdPerToken, 12);
  });

  it('has calls and tokens and no price when the catalog has none', () => {
    const { estimate } = planOf(inputOf({ facts: {} }));
    expect(estimate.calls).toBe(2);
    expect(estimate.inputTokens).toBeGreaterThan(0);
    expect(estimate).not.toHaveProperty('usd');
  });

  it('leaves out a file with no words or with a sentence over the budget, and counts each', () => {
    const limits = { ...bounds, chunkWords: 30, overlapWords: 10 };
    const unsplittable = Array.from({ length: 60 }, () => 'tea').join(' ');
    const plan = planOf(inputOf({
      files: [sourceFile('a.md', '\n\n'), sourceFile('b.md', unsplittable), sourceFile('c.md', QUEEN_CHAPTER)],
      leftOut: [{ identity: '/book/x.md', reason: 'unreadable' }]
    }), limits);
    expect(plan.files.map((file) => [file.key, file.displayPath])).toEqual([['f1', 'c.md']]);
    expect(plan.estimate.leftOut).toEqual({ unreadable: 1, unsplittable: 1, empty: 1 });
    expect(plan.estimate.files).toBe(1);
  });

  it('refuses when nothing is left to read, or the calls pass their bound', () => {
    expect(buildPassageSearchPlan(inputOf({ files: [sourceFile('a.md', ' ')] }))).toEqual({ kind: 'no-files' });
    expect(buildPassageSearchPlan(inputOf(), { ...bounds, calls: 1 })).toEqual({ kind: 'too-many-calls', calls: 2, organizing: false });
  });

  it('bounds the whole plan: a planned organizing call takes one of the places (PR #293 F5)', () => {
    // Two reads fit a bound of two; with the organizing call they are three.
    const limits = { ...bounds, calls: 2 };
    expect(buildPassageSearchPlan(inputOf(), limits).kind).toBe('planned');
    expect(buildPassageSearchPlan(inputOf({ organize: true }), limits)).toEqual({ kind: 'too-many-calls', calls: 3, organizing: true });
    const fits = planOf(inputOf({ organize: true }), { ...bounds, calls: 3 });
    expect(fits.estimate.calls).toBe(3);
    expect(fits.chunks).toHaveLength(2);
  });

  it('freezes the output ceilings the calls are sent with', () => {
    expect(planOf(inputOf()).ceilings).toEqual({ readOutputTokens: bounds.outputTokens });
    expect(planOf(inputOf({ organize: true })).ceilings).toEqual({ readOutputTokens: bounds.outputTokens, organizeOutputTokens: bounds.organize.outputTokens });
  });

  describe('fitting half a known window (D5a)', () => {
    const limits = { ...bounds, chunkWords: 4_000, minChunkWords: 200, overlapWords: 50, outputTokens: 500 };
    const files = [sourceFile('long.md', longChapter)];

    it('keeps the budget when the window is unknown, however long the call', () => {
      const plan = planOf(inputOf({ files, facts: {} }), limits);
      expect(plan.chunkWords).toBe(4_000);
      expect(plan.chunks).toHaveLength(1);
    });

    it('lowers the budget until every rendered request and its output ceiling fit half the window', () => {
      const contextLength = 6_000;
      const plan = planOf(inputOf({ files, facts: { contextLength } }), limits);
      expect(plan.chunkWords).toBeLessThan(4_000);
      expect(plan.chunkWords).toBeGreaterThanOrEqual(200);
      expect(plan.chunks.length).toBeGreaterThan(1);
      for (const chunk of plan.chunks) {
        const request = estimateRequestTokens(passageSearchMessages(SYSTEM_MESSAGE, QUESTION, longChapter.slice(chunk.start, chunk.end)));
        expect(request + limits.outputTokens).toBeLessThanOrEqual(contextLength / 2);
      }
      // Every later chunk opens with an overlap, and the chunks' own texts tile the chapter.
      plan.chunks.slice(1).forEach((chunk) => expect(chunk.start).toBeLessThan(chunk.bodyStart));
      expect(plan.chunks.map((chunk) => longChapter.slice(chunk.bodyStart, chunk.end)).join('\n\n')).toBe(longChapter);
    });

    it('refuses a model whose window cannot hold the smallest call', () => {
      expect(buildPassageSearchPlan(inputOf({ files, facts: { contextLength: 800 } }), limits)).toEqual({ kind: 'model-too-small' });
    });
  });

  describe('planKey (D2a)', () => {
    const key = (overrides: Partial<PassageSearchPlanInput> = {}, limits = bounds): string => planOf(inputOf(overrides), limits).planKey;

    it('is the same for the same plan', () => {
      expect(key()).toBe(key());
      expect(key()).toMatch(/^[0-9a-f]{64}$/);
    });

    it('moves when a price changes, appears or goes away, the files unchanged', () => {
      const priced = key();
      expect(key({ facts: { pricing: { ...PRICING, promptUsdPerToken: 0.000002 } } })).not.toBe(priced);
      expect(key({ facts: { pricing: { ...PRICING, completionUsdPerToken: 0.000005 } } })).not.toBe(priced);
      expect(key({ facts: {} })).not.toBe(priced);
    });

    it('moves when the chunk budget or the context length changes the calls', () => {
      const files = [sourceFile('long.md', longChapter)];
      const limits = { ...bounds, chunkWords: 4_000, minChunkWords: 200, overlapWords: 50, outputTokens: 500 };
      const whole = key({ files }, limits);
      expect(key({ files }, { ...limits, chunkWords: 1_000 })).not.toBe(whole);
      expect(key({ files, facts: { pricing: PRICING, contextLength: 6_000 } }, limits)).not.toBe(whole);
      // A window that changes nothing about what is sent is the same plan.
      expect(key({ files, facts: { pricing: PRICING, contextLength: 2_000_000 } }, limits)).toBe(whole);
    });

    it('moves when an output ceiling changes, the estimate unchanged (PR #293 follow-up)', () => {
      const base = planOf(inputOf({ organize: true }));
      const read = planOf(inputOf({ organize: true }), { ...bounds, outputTokens: bounds.outputTokens + 1 });
      const organize = planOf(inputOf({ organize: true }), { ...bounds, organize: { ...bounds.organize, outputTokens: bounds.organize.outputTokens + 1 } });
      expect(read.estimate).toEqual(base.estimate);
      expect(organize.estimate).toEqual(base.estimate);
      expect(read.planKey).not.toBe(base.planKey);
      expect(organize.planKey).not.toBe(base.planKey);
      expect(organize.planKey).not.toBe(read.planKey);
    });

    it('moves with a file\'s text, the files named, the files left out, the question, the model, the prompt and the organize option', () => {
      const base = key();
      const changed: Array<Partial<PassageSearchPlanInput>> = [
        { files: [sourceFile('chapters/1.md', `${RABBIT_CHAPTER} `), sourceFile('chapters/2.md', QUEEN_CHAPTER)] },
        { files: [sourceFile('chapters/1.md', RABBIT_CHAPTER)] },
        { files: [sourceFile('chapters/1.md', RABBIT_CHAPTER), sourceFile('other/2.md', QUEEN_CHAPTER)] },
        { leftOut: [{ identity: '/book/x.md', reason: 'unreadable' }] },
        { question: `${QUESTION} Really.` },
        { model: 'placeholder/another-model' },
        { systemMessage: `${SYSTEM_MESSAGE} v2` },
        { organize: true }
      ];
      const keys = changed.map((overrides) => key(overrides));
      keys.forEach((changedKey) => expect(changedKey).not.toBe(base));
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
