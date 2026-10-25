/**
 * sumTokenUsage (PR #171 F-05): a call that came back with no usage record
 * leaves the run's cost and cache counts unknown, never a subtotal shown as
 * the total, and still counts as a request.
 */
import type { TokenUsage } from '@messages';
import { sumTokenUsage } from '@/utils/tokenUsage';

const REPORTED: TokenUsage = { promptTokens: 10, completionTokens: 10, totalTokens: 20, costUsd: 0.1, cachedTokens: 3 };

describe('sumTokenUsage', () => {
  it('adds every field when every call reported it', () => {
    expect(sumTokenUsage([REPORTED, { ...REPORTED, costUsd: 0.2, cachedTokens: 0 }])).toEqual({
      promptTokens: 20,
      completionTokens: 20,
      totalTokens: 40,
      requestCount: 2,
      costUsd: expect.closeTo(0.3, 10),
      cachedTokens: 3
    });
  });

  it('leaves cost and cache unknown when one call reported no usage at all, and still counts that call', () => {
    const usage = sumTokenUsage([REPORTED, undefined]);

    expect(usage).toEqual({ promptTokens: 10, completionTokens: 10, totalTokens: 20, requestCount: 2 });
    expect(usage).not.toHaveProperty('costUsd');
    expect(usage).not.toHaveProperty('cachedTokens');
  });

  it('leaves a field unknown when a reported record left that field out', () => {
    const { costUsd: _omitted, ...withoutCost } = REPORTED;
    expect(sumTokenUsage([REPORTED, withoutCost])).toEqual({
      promptTokens: 20, completionTokens: 20, totalTokens: 40, requestCount: 2, cachedTokens: 6
    });
  });

  it('keeps a reported zero cost as zero', () => {
    expect(sumTokenUsage([{ ...REPORTED, costUsd: 0 }])).toMatchObject({ costUsd: 0, requestCount: 1 });
  });

  it('is undefined when no call reported usage, or when there were no calls', () => {
    expect(sumTokenUsage([undefined, undefined])).toBeUndefined();
    expect(sumTokenUsage([])).toBeUndefined();
  });

  it('counts an aggregated record by its own request count', () => {
    expect(sumTokenUsage([{ ...REPORTED, requestCount: 3 }, undefined])).toMatchObject({ requestCount: 4 });
  });
});
