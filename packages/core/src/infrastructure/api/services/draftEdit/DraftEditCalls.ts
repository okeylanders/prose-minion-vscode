/**
 * What every Draft Edit pass's model calls share (ADR 2026-10-21 D6; Craft
 * Flags since Slice 3c): why a run stopped starting calls, a recovery
 * presenter that opens only a run's first capture, and why a reply that
 * reached its ceiling is rejected (reasoning levels, 2026-10-27).
 */

import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import type {
  RejectedModelResponseRecoveryPresenter,
  RejectedModelResponseRecoveryReceipt
} from '@/infrastructure/storage/RejectedModelResponseRecoveryStore';

/** Why a run stopped starting calls before it reached the end. */
export interface DraftEditInterruption {
  readonly cause: 'key-changed' | 'provider';
  /** Host-owned words for the writer. */
  readonly message: string;
}

/**
 * A provider refusal would refuse every later call too, so it stops the run.
 * A key removed or replaced mid-run is said apart (PR #169 F-01). `remaining`
 * names what was not sent: "chunks", "categories".
 */
export function draftEditInterruptionOf(error: unknown, remaining: string): DraftEditInterruption {
  if (error instanceof AgentRunUnavailableError) {
    return error.reason === 'missing-credentials'
      ? { cause: 'key-changed', message: `The API key changed during the run, so the remaining ${remaining} were not sent.` }
      : { cause: 'provider', message: error.message };
  }
  return {
    cause: 'provider',
    message: `The provider call failed, so the remaining ${remaining} were not sent: ${error instanceof Error ? error.message : String(error)}`
  };
}

/** A presenter that shows only the first capture of a run, so failed calls never open a pile of editors. */
export function presentOnce(presenter: RejectedModelResponseRecoveryPresenter): RejectedModelResponseRecoveryPresenter {
  let presented = false;
  return {
    present(receipt: RejectedModelResponseRecoveryReceipt): Promise<void> {
      if (presented) {
        return Promise.resolve();
      }
      presented = true;
      return presenter.present(receipt);
    }
  };
}

/**
 * Why a reply that reached its output ceiling is rejected, in host words.
 * When the provider reported more than half its output as reasoning, the
 * model spent the ceiling thinking: say so, with the setting that lowers it.
 * Otherwise name the ceiling, the request's whole `max_tokens`.
 */
export function draftEditCeilingRejection(
  result: Pick<ExecutionResult, 'usage' | 'reasoningTokens'>,
  maxTokens: number,
  setting: string
): string {
  const thinking = result.reasoningTokens;
  const output = result.usage?.completionTokens;
  const ceiling = `${maxTokens.toLocaleString('en-US')}-token`;
  if (thinking !== undefined && output !== undefined && thinking * 2 > output) {
    return `the model spent ${thinking.toLocaleString('en-US')} of ${output.toLocaleString('en-US')} output tokens thinking `
      + `and reached the ${ceiling} ceiling; lower ${setting} or choose another model`;
  }
  return `the reply reached the ${ceiling} output ceiling`;
}

/** The thinking a run's calls reported, summed; undefined when none reported any. */
export function reportedThinking(results: ReadonlyArray<Pick<ExecutionResult, 'reasoningTokens'>>): number | undefined {
  const reported = results.flatMap((result) => (result.reasoningTokens !== undefined ? [result.reasoningTokens] : []));
  return reported.length > 0 ? reported.reduce((sum, tokens) => sum + tokens, 0) : undefined;
}
