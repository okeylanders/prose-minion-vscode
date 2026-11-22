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
 *
 * Logs carry fault kinds only.
 */

import type { TokenUsage } from '@messages';
import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import type { LogSink } from '@/platform';
import { sumTokenUsage } from '@/utils/tokenUsage';
import type { PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import type { PassageSearchOrganized } from '@services/search/passage/PassageSearchOrganizer';

/**
 * A finished result's read calls as usage entries, for a pass made of it
 * afterwards. A result with a usage total gives that total as one entry: it
 * carries its own request count, and a cost it already withholds stays
 * withheld. A result with none, whose reads were dispatched all the same,
 * gives one unknown entry per read that was dispatched (answered, failed or
 * stopped in flight: every planned read that is not `unsent`), exactly the
 * entries the run itself recorded, so those requests are counted and no
 * cost is shown as complete.
 */
export function passageSearchReadUsages(result: Pick<PassageSearchResult, 'usage' | 'calls'>): ReadonlyArray<TokenUsage | undefined> {
  if (result.usage) {
    return [result.usage];
  }
  return Array.from({ length: result.calls.answered + result.calls.failed + result.calls.cancelled }, () => undefined);
}

/**
 * `result` with what `pass` came to: its analysis, or why it has none, and
 * the usage of both stages. `readUsages` are the read calls' own entries.
 */
export async function withPassageSearchPass(
  result: PassageSearchResult,
  readUsages: ReadonlyArray<TokenUsage | undefined>,
  log: LogSink,
  pass: () => Promise<PassageSearchOrganized | undefined>
): Promise<PassageSearchResult> {
  let organized: PassageSearchOrganized | undefined;
  try {
    organized = await pass();
  } catch (error) {
    const kind = error instanceof AgentRunUnavailableError ? error.reason : error instanceof Error ? error.name : 'unknown';
    log.appendLine(`[PassageSearch] The organizing pass failed (${kind}).`);
    return { ...result, analysisMissing: 'failed' };
  }
  if (!organized) {
    return result;
  }
  const usage = sumTokenUsage([...readUsages, ...organized.usages]);
  const { analysis: _analysis, analysisMissing: _missing, usage: _usage, ...rest } = result;
  return {
    ...rest,
    ...(organized.kind === 'analysis' ? { analysis: organized.analysis } : { analysisMissing: organized.reason }),
    ...(usage ? { usage } : {})
  };
}
