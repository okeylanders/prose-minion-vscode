/**
 * A result with its organizing pass, and one usage total over both stages
 * (ADR 2026-11-20 D11, D13).
 *
 * - **A failed pass leaves the list whole,** with the reason.
 * - **Usage is summed over every call's own entry,** the reads' and the
 *   pass's together (`sumTokenUsage`), never over two finished totals. So a
 *   call whose usage is unknown, in either stage, withholds the combined
 *   cost and cache totals and is still counted as a request; the token
 *   counts add up what was reported.
 * - **A pass that sent nothing adds no entry** (`usages` is empty): it is
 *   told apart from a pass that was dispatched and reported no usage, whose
 *   entry is `undefined`.
 * - **Requests are counted apart from usage** (`result.requests`): every
 *   call dispatched for the result, each pass and retry included, whether
 *   or not any reported usage. A pass adds the calls it dispatched.
 *
 * Logs carry fault kinds only.
 */

import type { TokenUsage } from '@messages';
import type { LogSink } from '@/platform';
import { sumTokenUsage } from '@/utils/tokenUsage';
import { passageSearchFaultKind } from '@services/search/passage/PassageSearchCallFailures';
import type { PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import type { PassageSearchOrganized } from '@services/search/passage/PassageSearchOrganizer';

/**
 * Every call a finished result already made, as usage entries, for a pass
 * made of it afterwards. A result with a usage total gives that total as
 * one entry: it carries its own request count, and a cost it already
 * withholds stays withheld. A result with none, whose calls were dispatched
 * all the same, gives one unknown entry per call it counts (`requests`: its
 * reads and every earlier pass), so those requests are counted however many
 * passes were tried, and no cost is shown as complete. A call that was never
 * sent is no request, and gives none: nothing here infers a dispatch from a
 * failure.
 */
export function passageSearchPriorUsages(result: Pick<PassageSearchResult, 'usage' | 'requests'>): ReadonlyArray<TokenUsage | undefined> {
  if (result.usage) {
    return [result.usage];
  }
  return Array.from({ length: result.requests }, () => undefined);
}

/**
 * `result` with what `pass` came to: its analysis, or why it has none, the
 * usage of both stages, and its requests with the pass's own. `priorUsages`
 * are the entries of every call `result` already made.
 */
export async function withPassageSearchPass(
  result: PassageSearchResult,
  priorUsages: ReadonlyArray<TokenUsage | undefined>,
  log: LogSink,
  pass: () => Promise<PassageSearchOrganized | undefined>
): Promise<PassageSearchResult> {
  let organized: PassageSearchOrganized | undefined;
  try {
    organized = await pass();
  } catch (error) {
    log.appendLine(`[PassageSearch] The organizing pass failed (${passageSearchFaultKind(error)}).`);
    return { ...result, analysisMissing: 'failed' };
  }
  if (!organized) {
    return result;
  }
  const usage = sumTokenUsage([...priorUsages, ...organized.usages]);
  const { analysis: _analysis, analysisMissing: _missing, usage: _usage, ...rest } = result;
  return {
    ...rest,
    // One per call the pass dispatched, metered or not: an attempt is never lost to a missing usage record.
    requests: result.requests + organized.usages.length,
    ...(organized.kind === 'analysis' ? { analysis: organized.analysis } : { analysisMissing: organized.reason }),
    ...(usage ? { usage } : {})
  };
}
