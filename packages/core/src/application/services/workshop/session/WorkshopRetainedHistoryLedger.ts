/**
 * Session-owned ledger of retained-history marks (ADR 2026-09-30 §3).
 *
 * A mark records "after turn T, participant K's history had N messages", so a
 * rewind can cut the room ledger and every retained history at the same
 * moment. `WorkshopSessionService` remains the aggregate root and decides
 * which turn commits which participant; this collaborator owns only mark
 * order, per-key monotonicity, pruning, lookup, and prepared hydration state.
 * It knows turn ids and ledger order, never provider vocabulary.
 *
 * Invariant: within one participant membership, every commit since the key's
 * first mark carries a mark. Anything that would break that — an unreadable
 * history, an out-of-order or shrinking history — prunes the key instead, so
 * a hole degrades rewindability rather than slicing a history at the wrong
 * commit.
 */

import type { WorkshopTurn } from '@messages';
import type {
  WorkshopConversationLogicalKey,
  WorkshopRetainedHistoryMarkV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  cloneRetainedHistoryMark,
  isValidRetainedHistoryCounts,
  lastRetainedHistoryMarksAtOrBefore,
  WorkshopCommittedRetainedHistory,
  WorkshopRetainedHistoryMarkOutcome,
  workshopRetainedHistoryKeyForCommitTurn
} from '@/application/services/workshop/session/WorkshopRetainedHistoryMarks';

/** What only the aggregate knows about a retained participant, as a mark records it. */
export interface WorkshopRetainedParticipantFacts {
  conversationId: string;
  writerSourceCount: number;
  lastSeenRoomTurnId?: string;
  /** Host only: the context revision it holds once the commit has settled. */
  contextRevision?: number;
}

export interface WorkshopRetainedHistoryLedgerState {
  marks: WorkshopRetainedHistoryMarkV1[];
}

export type WorkshopRetainedHistoryRecording =
  | {
      recorded: true;
      mark: WorkshopRetainedHistoryMarkV1;
      /** Earlier marks of this key discarded because the new mark broke their order. */
      prunedMarks: number;
    }
  | {
      recorded: false;
      reason: 'invalid-counts' | 'invalid-offset' | 'unknown-turn';
      prunedMarks: number;
    };

export class WorkshopRetainedHistoryLedger {
  private marks: WorkshopRetainedHistoryMarkV1[] = [];

  constructor(private readonly turnPosition: (turnId: string) => number | undefined) {}

  /**
   * Append the newest mark for its key. A mark that cannot describe a real
   * history prunes the key; a valid mark that breaks the key's order restarts
   * the key's sequence, because the new mark is still the truth at its turn.
   */
  record(mark: WorkshopRetainedHistoryMarkV1): WorkshopRetainedHistoryRecording {
    const position = this.turnPosition(mark.turnId);
    if (position === undefined) {
      return { recorded: false, reason: 'unknown-turn', prunedMarks: this.pruneKey(mark.conversationKey) };
    }
    if (
      !isValidRetainedHistoryCounts(mark)
      || !Number.isSafeInteger(mark.writerSourceCount)
      || mark.writerSourceCount < 0
      || (
        mark.contextRevision !== undefined
        && (!Number.isSafeInteger(mark.contextRevision) || mark.contextRevision < 0)
      )
    ) {
      return { recorded: false, reason: 'invalid-counts', prunedMarks: this.pruneKey(mark.conversationKey) };
    }
    const offsetPosition = mark.lastSeenRoomTurnId === undefined
      ? undefined
      : this.turnPosition(mark.lastSeenRoomTurnId);
    if (
      mark.lastSeenRoomTurnId !== undefined
      && (offsetPosition === undefined || offsetPosition > position)
    ) {
      return { recorded: false, reason: 'invalid-offset', prunedMarks: this.pruneKey(mark.conversationKey) };
    }
    const latest = this.latestFor(mark.conversationKey);
    const latestPosition = latest ? this.turnPosition(latest.turnId) : undefined;
    const latestOffsetPosition = latest?.lastSeenRoomTurnId === undefined
      ? undefined
      : this.turnPosition(latest.lastSeenRoomTurnId);
    const extendsSequence = latest === undefined || (
      latestPosition !== undefined
      && latestPosition < position
      && latest.messageCount <= mark.messageCount
      && latest.contextSourceCount <= mark.contextSourceCount
      && latest.writerSourceCount <= mark.writerSourceCount
      && (latest.contextRevision ?? 0) <= (mark.contextRevision ?? 0)
      && (
        latest.lastSeenRoomTurnId === undefined
        || (
          latestOffsetPosition !== undefined
          && offsetPosition !== undefined
          && latestOffsetPosition <= offsetPosition
        )
      )
    );
    const prunedMarks = extendsSequence ? 0 : this.pruneKey(mark.conversationKey);
    const stored = cloneRetainedHistoryMark(mark);
    this.marks.push(stored);
    return { recorded: true, mark: cloneRetainedHistoryMark(stored), prunedMarks };
  }

  /**
   * Record the mark for one committed reply turn, or prune its key when the
   * commit cannot be described: the participant is no longer retained, its
   * history was unreadable, or the counts came from another conversation. A
   * guess would leave a hole that slices a later cut at the wrong commit.
   */
  recordCommit(input: {
    turn: Readonly<WorkshopTurn> | undefined;
    committed: WorkshopCommittedRetainedHistory | undefined;
    participant: (
      key: WorkshopConversationLogicalKey,
      turn: Readonly<WorkshopTurn>
    ) => WorkshopRetainedParticipantFacts | undefined;
  }): WorkshopRetainedHistoryMarkOutcome {
    const conversationKey = input.turn
      ? workshopRetainedHistoryKeyForCommitTurn(input.turn)
      : undefined;
    if (!input.turn || !conversationKey) {
      return { recorded: false, reason: 'not-a-commit-turn', prunedMarks: 0 };
    }
    const refuse = (
      reason: 'participant-not-retained' | 'history-unreadable' | 'conversation-mismatch'
    ): WorkshopRetainedHistoryMarkOutcome => ({
      recorded: false,
      conversationKey,
      reason,
      prunedMarks: this.pruneKey(conversationKey)
    });
    const participant = input.participant(conversationKey, input.turn);
    if (!participant) {
      return refuse('participant-not-retained');
    }
    if (!input.committed) {
      return refuse('history-unreadable');
    }
    if (input.committed.conversationId !== participant.conversationId) {
      return refuse('conversation-mismatch');
    }
    const recording = this.record({
      turnId: input.turn.id,
      conversationKey,
      messageCount: input.committed.messageCount,
      contextSourceCount: input.committed.contextSourceCount,
      writerSourceCount: participant.writerSourceCount,
      ...(participant.lastSeenRoomTurnId !== undefined
        ? { lastSeenRoomTurnId: participant.lastSeenRoomTurnId }
        : {}),
      ...(participant.contextRevision !== undefined
        ? { contextRevision: participant.contextRevision }
        : {}),
      origin: 'commit'
    });
    return recording.recorded ? recording : { ...recording, conversationKey };
  }

  /** Discard every mark of a key whose conversation was discarded or replaced. */
  pruneKey(key: WorkshopConversationLogicalKey): number {
    const before = this.marks.length;
    this.marks = this.marks.filter((mark) => mark.conversationKey !== key);
    return before - this.marks.length;
  }

  /** Discard every mark: the assistant generation holding the histories is gone. */
  pruneAll(): number {
    const pruned = this.marks.length;
    this.marks = [];
    return pruned;
  }

  latestFor(key: WorkshopConversationLogicalKey): WorkshopRetainedHistoryMarkV1 | undefined {
    for (let index = this.marks.length - 1; index >= 0; index -= 1) {
      if (this.marks[index].conversationKey === key) {
        return cloneRetainedHistoryMark(this.marks[index]);
      }
    }
    return undefined;
  }

  /** The last mark per key at or before one ledger turn; empty for an unknown turn. */
  marksAtOrBefore(
    turnId: string
  ): Map<WorkshopConversationLogicalKey, WorkshopRetainedHistoryMarkV1> {
    const cutIndex = this.turnPosition(turnId);
    if (cutIndex === undefined) {
      return new Map();
    }
    return lastRetainedHistoryMarksAtOrBefore(this.marks, this.turnPosition, cutIndex);
  }

  all(): WorkshopRetainedHistoryMarkV1[] {
    return this.marks.map(cloneRetainedHistoryMark);
  }

  exportState(): WorkshopRetainedHistoryLedgerState {
    return { marks: this.marks.map(cloneRetainedHistoryMark) };
  }

  /** Complete every copy before aggregate hydration crosses its install barrier. */
  prepareState(state: WorkshopRetainedHistoryLedgerState): WorkshopRetainedHistoryLedgerState {
    return { marks: state.marks.map(cloneRetainedHistoryMark) };
  }

  /** Install state produced by this ledger's prepare phase; this must not throw. */
  installPreparedState(state: WorkshopRetainedHistoryLedgerState): void {
    this.marks = state.marks;
  }

  /** A fresh room retains no conversation, so no mark can describe one. */
  reset(): void {
    this.marks = [];
  }
}
