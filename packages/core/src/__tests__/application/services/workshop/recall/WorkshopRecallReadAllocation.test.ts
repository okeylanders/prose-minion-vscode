/**
 * Fair shares of a session-recall read (ADR 2026-10-05 D9): water-filling's
 * rules, pinned on their own. The read-level witnesses (a short chat's
 * leftover, a failing session's share, the sweep) live with the renderer.
 */

import { allocateWorkshopRecallReadShares } from '@/application/services/workshop/recall/WorkshopRecallReadAllocation';

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

/** A deterministic stream of needs (a linear congruential generator). */
function needsFrom(seed: number, count: number, largest: number): number[] {
  let state = seed;
  return Array.from({ length: count }, () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state % largest;
  });
}

describe('allocateWorkshopRecallReadShares', () => {
  it('gives a session that needs less only what it needs, and the rest to the others', () => {
    expect(allocateWorkshopRecallReadShares(30_000, [50_000, 1_000, 50_000])).toEqual([14_500, 1_000, 14_500]);
  });

  it('keeps passing leftovers on until every share is used or every need is met', () => {
    // 4,000 is under a quarter; then 9,000 is under a third of what is left; the last two split the rest.
    expect(allocateWorkshopRecallReadShares(40_000, [30_000, 9_000, 4_000, 30_000])).toEqual([13_500, 9_000, 4_000, 13_500]);
  });

  it('gives every need when all of them fit, and no more', () => {
    expect(allocateWorkshopRecallReadShares(150_000, [7_000, 12_000, 300])).toEqual([7_000, 12_000, 300]);
  });

  it('splits equally when every session needs more, the odd characters to the earliest asked', () => {
    expect(allocateWorkshopRecallReadShares(10, [100, 100, 100])).toEqual([4, 3, 3]);
    // 5 is more than an equal third of 10, so it shares equally too.
    expect(allocateWorkshopRecallReadShares(10, [100, 5, 100])).toEqual([4, 3, 3]);
  });

  it('depends on the needs, not the order they are asked in, beyond the odd characters', () => {
    const needs = [40_000, 2_000, 90_000, 15_000, 60_000];
    const shares = allocateWorkshopRecallReadShares(119_000, needs);
    const reversed = allocateWorkshopRecallReadShares(119_000, [...needs].reverse());

    expect(shares).toEqual([34_000, 2_000, 34_000, 15_000, 34_000]);
    expect([...reversed].reverse()).toEqual(shares);
  });

  it('returns nothing for no sessions, and refuses a budget or need that is not a count', () => {
    expect(allocateWorkshopRecallReadShares(1_000, [])).toEqual([]);
    expect(() => allocateWorkshopRecallReadShares(-1, [1])).toThrow(RangeError);
    expect(() => allocateWorkshopRecallReadShares(1.5, [1])).toThrow(RangeError);
    expect(() => allocateWorkshopRecallReadShares(10, [Number.NaN])).toThrow(RangeError);
  });

  it('never sums past the budget, never exceeds a need, and gives a short share at least an equal split', () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const count = 1 + (seed % 10);
      const needs = needsFrom(seed, count, 60_000);
      const budget = (seed * 7_919) % 200_000;
      const shares = allocateWorkshopRecallReadShares(budget, needs);
      const floor = Math.floor(budget / count);

      expect([seed, sum(shares) <= budget]).toEqual([seed, true]);
      shares.forEach((share, index) => {
        expect([seed, index, share <= needs[index]]).toEqual([seed, index, true]);
        if (share < needs[index]) {
          expect([seed, index, share >= floor]).toEqual([seed, index, true]);
        }
      });
      // Nothing is left unspent while a need is unmet.
      if (shares.some((share, index) => share < needs[index])) {
        expect([seed, sum(shares)]).toEqual([seed, budget]);
      }
    }
  });
});
