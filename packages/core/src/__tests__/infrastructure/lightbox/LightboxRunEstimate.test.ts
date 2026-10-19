/**
 * LightboxRunEstimate (ADR 2026-10-19 D8): fit against the live window with
 * the engine's own estimator, cost from live prices, and the book-sized
 * warning. Also the catalog's live-only pricing lookup.
 */
import {
  LIGHTBOX_TYPICAL_OUTPUT_TOKENS,
  estimateLightboxRun,
  lightboxExpectedOutputTokens,
  type LightboxEstimateInput,
  type LightboxPreparedCall
} from '@/infrastructure/lightbox/LightboxRunEstimate';
import { estimateTextTokens, measureContextWindow } from '@orchestration/RequestContextPreflight';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { buildLightboxChapterSection } from '@/infrastructure/lightbox/LightboxReadingPrompts';
import { aliceWords } from './lightboxProseFixtures';

/** A chapter of `words` words in paragraphs of about 120. */
function chapter(words: number): string[] {
  return aliceWords(words).split('\n\n');
}

function call(group: 'A' | 'B' | 'C', paragraphs: string[], system = 'rules '.repeat(400)): LightboxPreparedCall {
  const chapterSection = buildLightboxChapterSection(paragraphs);
  return {
    group,
    lenses: group === 'A' ? ['headline', 'motif', 'tension'] : group === 'B' ? ['characters', 'voice'] : ['genre'],
    systemMessage: system,
    userMessage: `${chapterSection}\n\n# Task\n\nRead group ${group}.`,
    chapterTokens: estimateTextTokens(chapterSection)
  };
}

function input(words: number, facts: LightboxEstimateInput['facts'], groups: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C']): LightboxEstimateInput {
  const paragraphs = chapter(words);
  return {
    boardId: 'board-1',
    key: 'key-1',
    sourceWords: words,
    contextWords: 0,
    columnCount: Math.min(paragraphs.length, 96),
    groups: groups.map((group) => call(group, paragraphs)),
    rereads: [call('A', paragraphs)],
    facts
  };
}

const PRICES = { promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 };

describe('estimateLightboxRun', () => {
  it('fits a chapter in a large window, priced from the catalog', () => {
    const estimate = estimateLightboxRun(input(3_000, { model: 'provider/model', contextLength: 200_000, pricing: PRICES }));
    expect(estimate.fit).toBe('fits');
    expect(estimate.groups.map((group) => group.fit)).toEqual(['fits', 'fits', 'fits']);
    expect(estimate.bookSized).toBe(false);
    const [a] = estimate.groups;
    // The engine's own measure of the same messages.
    expect(a.inputTokens).toBe(measureContextWindow(
      [{ role: 'system', content: input(3_000, {}).groups[0].systemMessage }, { role: 'user', content: input(3_000, {}).groups[0].userMessage }],
      200_000,
      PROMPT_BUDGETS.lightbox.groupOutputTokens
    ).requestTokens);
    expect(a.reservedOutputTokens).toBe(PROMPT_BUDGETS.lightbox.groupOutputTokens);
    expect(a.costUsd).toBeCloseTo(a.inputTokens * PRICES.promptUsdPerToken + a.expectedOutputTokens * PRICES.completionUsdPerToken, 10);
    expect(estimate.costUsd).toBeCloseTo(estimate.groups.reduce((sum, group) => sum + (group.costUsd ?? 0), 0), 10);
    expect(estimate.rereads).toHaveLength(1);
    expect(estimate.largestFittingWords).toBeUndefined();
  });

  it('refuses a chapter too large for the window, with the reason and the largest size that fits', () => {
    const estimate = estimateLightboxRun(input(40_000, { model: 'provider/small', contextLength: 32_000, pricing: PRICES }));
    expect(estimate.fit).toBe('too-large');
    expect(estimate.bookSized).toBe(true);
    expect(estimate.largestFittingWords).toBeGreaterThan(5_000);
    expect(estimate.largestFittingWords).toBeLessThan(25_000);
    expect(estimate.largestFittingWords! % 100).toBe(0);
    expect(estimate.reason).toMatch(/^Group A would send about [\d,]+ tokens and reserve 8,000 for the reply, more than provider\/small's 32,000-token window allows\./);
    expect(estimate.reason).toContain(`about ${estimate.largestFittingWords!.toLocaleString('en-US')} words of chapter would fit`);

    // The largest size it names does fit.
    const smaller = estimateLightboxRun(input(estimate.largestFittingWords!, { model: 'provider/small', contextLength: 32_000 }));
    expect(smaller.fit).toBe('fits');
  });

  it('allows the press when the window is unknown, and says so', () => {
    const estimate = estimateLightboxRun(input(3_000, { model: 'provider/new', pricing: PRICES }));
    expect(estimate.fit).toBe('unknown');
    expect(estimate.contextLength).toBeUndefined();
    expect(estimate.groups[0].inputTokens).toBeGreaterThan(0);
    expect(estimate.costUsd).toBeGreaterThan(0);
  });

  it('leaves the cost absent when the catalog has no live pricing', () => {
    const estimate = estimateLightboxRun(input(3_000, { model: 'provider/model', contextLength: 200_000 }));
    expect(estimate.costUsd).toBeUndefined();
    expect(estimate.groups.every((group) => group.costUsd === undefined)).toBe(true);
    expect(estimate.fit).toBe('fits');
  });

  it('warns book-sized above the chapter threshold without refusing', () => {
    const over = PROMPT_BUDGETS.lightbox.chapterWords + 100;
    const estimate = estimateLightboxRun(input(over, { model: 'provider/model', contextLength: 1_000_000 }));
    expect(estimate).toMatchObject({ bookSized: true, fit: 'fits', sourceWords: over });
  });

  it('prices only the lenses a call reads, and the tension arc by its columns', () => {
    expect(lightboxExpectedOutputTokens(['headline'], 31)).toBe(LIGHTBOX_TYPICAL_OUTPUT_TOKENS.headline + 40);
    expect(lightboxExpectedOutputTokens(['tension'], 96) - lightboxExpectedOutputTokens(['tension'], 31)).toBe(130);
  });
});

describe('OpenRouterModels.getCachedPricing', () => {
  afterEach(() => OpenRouterModels.clearCache());

  it('reads live prices and refuses the offline fallback', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        // eslint-disable-next-line @typescript-eslint/naming-convention -- the catalog's own field name.
        data: [{ id: 'provider/model', name: 'Model', pricing: { prompt: '0.000003', completion: '0.000015' }, context_length: 200_000 }]
      })
    } as never);
    await OpenRouterModels.fetchModels();
    expect(OpenRouterModels.getCachedPricing('provider/model:nitro')).toEqual({
      promptUsdPerToken: 0.000003,
      completionUsdPerToken: 0.000015
    });
    expect(OpenRouterModels.getCachedPricing('provider/unknown')).toBeUndefined();
    fetchMock.mockRestore();

    OpenRouterModels.clearCache();
    const failing = jest.spyOn(global, 'fetch' as never).mockRejectedValueOnce(new Error('offline') as never);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fallback = await OpenRouterModels.fetchModels();
    expect(OpenRouterModels.getCachedPricing(fallback[0].id)).toBeUndefined();
    failing.mockRestore();
    spy.mockRestore();
  });
});
