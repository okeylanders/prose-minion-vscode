/**
 * What every Draft Edit pass's model calls share (ADR 2026-10-21 D6; Craft
 * Flags since Slice 3c): why a run stopped starting calls, and a recovery
 * presenter that opens only a run's first capture.
 */

import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
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
