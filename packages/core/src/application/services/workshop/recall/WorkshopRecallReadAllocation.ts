/**
 * Fair shares of one session-recall read (ADR 2026-10-05 D9): water-filling.
 *
 * Every session is offered an equal share of the read's characters. A
 * session that needs less takes only what it needs, and what it leaves is
 * offered equally to the sessions still open, until each one either has all
 * it needs or an equal share of what is left. No session can crowd another
 * out, and none is given room it cannot use.
 *
 * Pure and deterministic: shares depend on the budget and the needs alone.
 * The few characters an equal split leaves over go to the earliest of the
 * sessions still open, in the order asked.
 *
 * What a read relies on, and the tests pin:
 * - the shares never sum past the budget;
 * - no session gets more than it needs;
 * - a session that gets less than it needs gets at least
 *   floor(budget / sessions), so when the budget holds one per-session
 *   minimum for every session, so does every share that falls short.
 */

/** Each session's share of `budget`, in the order of `needs`. */
export function allocateWorkshopRecallReadShares(budget: number, needs: readonly number[]): number[] {
  if (!Number.isSafeInteger(budget) || budget < 0) {
    throw new RangeError(`A session-recall read budget must be a non-negative integer; got ${budget}.`);
  }
  for (const need of needs) {
    if (!Number.isSafeInteger(need) || need < 0) {
      throw new RangeError(`A session-recall read need must be a non-negative integer; got ${need}.`);
    }
  }
  const shares = needs.map(() => 0);
  // Smallest need first; equal needs in the order asked.
  const byNeed = needs
    .map((need, index) => ({ need, index }))
    .sort((left, right) => left.need - right.need || left.index - right.index);
  let remaining = budget;
  let satisfied = 0;
  // An equal share of what is left never shrinks as satisfied sessions leave
  // (each took no more than that share), so the first need that exceeds it
  // marks every larger one as unsatisfiable too.
  while (satisfied < byNeed.length) {
    const { need, index } = byNeed[satisfied];
    if (need > Math.floor(remaining / (byNeed.length - satisfied))) {
      break;
    }
    shares[index] = need;
    remaining -= need;
    satisfied += 1;
  }
  const open = byNeed.slice(satisfied).map(({ index }) => index).sort((left, right) => left - right);
  if (open.length > 0) {
    const equal = Math.floor(remaining / open.length);
    const leftOver = remaining - equal * open.length;
    open.forEach((index, order) => {
      shares[index] = equal + (order < leftOver ? 1 : 0);
    });
  }
  return shares;
}
