/**
 * Token usage arithmetic for fan-out callers (Draft Edit's chunked Proofread
 * runs). Each entry is one provider call that came back; `undefined` is a
 * call whose reply carried no usage record at all.
 *
 * - Token counts add up what was reported. A call with no record adds none.
 * - A cost or cache count is a total only when every call reported it. A
 *   call that left it out, or left out its whole record, makes that total
 *   unknown rather than understated, so a summary shows nothing instead of a
 *   cost that is too low (PR #171 F-05). An unreported value is never
 *   counted as zero.
 * - `requestCount` counts every call, reported or not.
 *
 * (The Lightbox's own `sumUsage` counts a missing cost as zero; adopting this
 * helper there is tracked separately.)
 */

import type { TokenUsage } from '@messages';

/** Sum the usage of several provider calls; undefined when none reported any. */
export function sumTokenUsage(usages: ReadonlyArray<TokenUsage | undefined>): TokenUsage | undefined {
  const reported = usages.filter((usage): usage is TokenUsage => usage !== undefined);
  if (reported.length === 0) {
    return undefined;
  }
  const everyCallReported = reported.length === usages.length;
  const optionalSum = (pick: (usage: TokenUsage) => number | undefined): number | undefined =>
    everyCallReported && reported.every((usage) => pick(usage) !== undefined)
      ? reported.reduce((sum, usage) => sum + (pick(usage) as number), 0)
      : undefined;
  const cachedTokens = optionalSum((usage) => usage.cachedTokens);
  const cacheWriteTokens = optionalSum((usage) => usage.cacheWriteTokens);
  const costUsd = optionalSum((usage) => usage.costUsd);
  return {
    promptTokens: reported.reduce((sum, usage) => sum + usage.promptTokens, 0),
    completionTokens: reported.reduce((sum, usage) => sum + usage.completionTokens, 0),
    totalTokens: reported.reduce((sum, usage) => sum + usage.totalTokens, 0),
    requestCount: usages.reduce((sum, usage) => sum + (usage?.requestCount ?? 1), 0),
    ...(costUsd !== undefined ? { costUsd } : {}),
    ...(cachedTokens !== undefined ? { cachedTokens } : {}),
    ...(cacheWriteTokens !== undefined ? { cacheWriteTokens } : {})
  };
}
