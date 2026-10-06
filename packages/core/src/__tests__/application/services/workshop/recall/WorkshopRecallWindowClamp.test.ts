/**
 * The window search (ADR 2026-10-05 D11; PR 130 review F-01): the largest
 * read whose measured cost fits half the window, within a bounded number of
 * renders, and a refusal only when the minimum itself does not fit.
 */

import {
  fitWorkshopRecallReadToWindow,
  WORKSHOP_RECALL_CLAMP_RENDERS,
  WorkshopRecallMeasuredRead
} from '@/application/services/workshop/recall/WorkshopRecallWindowClamp';

const MINIMUM = 12_000;

/** A render whose cost is `cost(characters)`, counting the renders. */
const renderer = (cost: (characters: number) => number) => {
  const limits: number[] = [];
  const render = (characters: number): WorkshopRecallMeasuredRead => {
    limits.push(characters);
    return { characters, tokens: cost(characters), outcome: { capability: 'transcript.read', status: 'success', requestSummary: '' } };
  };
  return { render, limits };
};

describe('fitting a read to half the window', () => {
  it('keeps the first guess when it fits', () => {
    const { render, limits } = renderer((characters) => Math.ceil(characters / 4));
    const fitted = fitWorkshopRecallReadToWindow(render, 40_000, 10_000, MINIMUM);

    expect(fitted.fit?.characters).toBe(40_000);
    expect(limits).toEqual([40_000]);
  });

  it('takes one proportional step for text of even density', () => {
    const { render, limits } = renderer((characters) => Math.ceil(characters * 0.27));
    const fitted = fitWorkshopRecallReadToWindow(render, 40_000, 10_000, MINIMUM);

    expect(limits).toHaveLength(2);
    expect(fitted.fit!.tokens).toBeLessThanOrEqual(10_000);
    expect(fitted.fit!.characters).toBeGreaterThan(36_000);
  });

  it('still finds a fit when fair shares keep a dense section whole as the limit shrinks', () => {
    // Two sessions: a dense one that needs 33,000 characters at 0.75 tokens each, and a plain one
    // at 0.25. Each gets half the limit; the dense one keeps all it needs while it fits.
    const cost = (characters: number): number => {
      const share = characters / 2;
      const dense = Math.min(33_000, characters - Math.min(share, characters - Math.min(33_000, share)));
      return Math.ceil(Math.min(dense, 33_000) * 0.75 + (characters - Math.min(dense, 33_000)) * 0.25);
    };
    const { render, limits } = renderer(cost);
    const half = 33_000;
    const fitted = fitWorkshopRecallReadToWindow(render, 4 * half, half, MINIMUM);

    expect(fitted.fit).toBeDefined();
    expect(fitted.fit!.tokens).toBeLessThanOrEqual(half);
    expect(limits.length).toBeLessThanOrEqual(WORKSHOP_RECALL_CLAMP_RENDERS);
  });

  it('refuses only when the minimum itself does not fit, and says what the minimum cost', () => {
    const { render, limits } = renderer((characters) => Math.ceil(characters * 0.75));
    const fitted = fitWorkshopRecallReadToWindow(render, 4 * 2_000, 2_000, 6_000);

    expect(fitted.fit).toBeUndefined();
    expect(fitted.minimum).toMatchObject({ characters: 6_000, tokens: 4_500 });
    expect(limits).toContain(6_000);
  });

  it('holds its guarantees over many cost curves', () => {
    let seed = 7;
    const random = (): number => {
      seed = (seed * 48_271) % 2_147_483_647;
      return seed / 2_147_483_647;
    };
    for (let trial = 0; trial < 2_000; trial += 1) {
      // A non-decreasing cost whose density changes at a random point, plus a fixed overhead.
      const breakAt = 6_000 + Math.floor(random() * 140_000);
      const before = 0.2 + random() * 0.6;
      const after = 0.2 + random() * 0.6;
      const overhead = Math.floor(random() * 2_000);
      const cost = (characters: number): number => overhead +
        Math.ceil(Math.min(characters, breakAt) * before + Math.max(0, characters - breakAt) * after);
      const half = 2_000 + Math.floor(random() * 60_000);
      const first = Math.min(150_000, 4 * half);
      const minimum = 6_000 * (1 + Math.floor(random() * 3));
      if (first < minimum) {
        continue;
      }
      const { render, limits } = renderer(cost);
      const fitted = fitWorkshopRecallReadToWindow(render, first, half, minimum);

      expect(limits.length).toBeLessThanOrEqual(WORKSHOP_RECALL_CLAMP_RENDERS);
      if (cost(minimum) <= half) {
        // A read fits, so one is delivered, and it is the largest the search measured.
        expect(fitted.fit).toBeDefined();
        expect(fitted.fit!.tokens).toBeLessThanOrEqual(half);
        expect(fitted.fit!.characters).toBe(Math.max(...limits.filter((limit) => cost(limit) <= half)));
      } else {
        expect(fitted.fit).toBeUndefined();
      }
    }
  });
});
