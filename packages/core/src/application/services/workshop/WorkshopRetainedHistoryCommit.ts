/**
 * The one completion-boundary step that records a retained-history mark
 * (ADR 2026-09-30 §3).
 *
 * Both Workshop commit sites — `completeWorkshopRun` for host, guest, and
 * direct-tool replies, and `WorkshopAnalysisSidePass.adoptWriterReport` for
 * writer-requested tool reports — call this once their run has settled. An
 * architecture guard keeps it that way: no other code finalizes a Workshop
 * run or records a mark.
 *
 * It never throws. By the time it runs, the reply is committed and visible;
 * failing that turn over bookkeeping would be worse than the degradation the
 * aggregate applies instead (it prunes the participant's marks, so later cuts
 * refuse rather than slice at the wrong commit).
 */

import type { WorkshopTurn } from '@messages';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type {
  WorkshopCommittedRetainedHistory,
  WorkshopRetainedHistoryCounts,
  WorkshopRetainedHistoryMarkOutcome
} from '@/application/services/workshop/session/WorkshopRetainedHistoryMarks';

/** Reads committed history counts for a retained conversation id. */
export type WorkshopRetainedHistoryReader = (
  conversationId: string
) => WorkshopRetainedHistoryCounts | undefined;

export interface WorkshopRetainedHistoryCommitInput {
  session: WorkshopSessionService;
  turn: WorkshopTurn;
  /** The retained conversation the run committed into, when the provider named one. */
  conversationId: string | undefined;
  readRetainedHistory: WorkshopRetainedHistoryReader;
  log: (line: string) => void;
}

export function recordWorkshopRetainedHistoryCommit(
  input: WorkshopRetainedHistoryCommitInput
): WorkshopRetainedHistoryMarkOutcome | undefined {
  try {
    let committed: WorkshopCommittedRetainedHistory | undefined;
    let readFailure: string | undefined;
    if (input.conversationId) {
      try {
        const counts = input.readRetainedHistory(input.conversationId);
        committed = counts ? { conversationId: input.conversationId, ...counts } : undefined;
      } catch (error) {
        readFailure = error instanceof Error ? error.message : String(error);
      }
    }
    const outcome = input.session.recordRetainedHistoryMark(input.turn.id, committed);
    input.log(describeOutcome(input.turn.id, outcome, readFailure));
    return outcome;
  } catch (error) {
    input.log(
      `Retained-history mark not recorded for ${input.turn.id}: ` +
      `${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

function describeOutcome(
  turnId: string,
  outcome: WorkshopRetainedHistoryMarkOutcome,
  readFailure: string | undefined
): string {
  if (outcome.recorded) {
    const { mark } = outcome;
    return `Retained-history mark recorded (${mark.conversationKey} at ${turnId}: ` +
      `messages=${mark.messageCount}, context sources=${mark.contextSourceCount}, ` +
      `writer sources=${mark.writerSourceCount}` +
      `${mark.lastSeenRoomTurnId ? `, offset=${mark.lastSeenRoomTurnId}` : ''}` +
      `${outcome.prunedMarks > 0 ? `; restarted after pruning ${outcome.prunedMarks} out-of-order marks` : ''})`;
  }
  return `Retained-history mark not recorded (${outcome.conversationKey ?? 'no participant'} at ${turnId}: ` +
    `reason=${outcome.reason}` +
    `${readFailure ? `; read failed: ${readFailure}` : ''}` +
    `${outcome.prunedMarks > 0 ? `; pruned ${outcome.prunedMarks} earlier marks` : ''}); ` +
    'turns before this participant\'s next commit cannot be rewound exactly';
}
