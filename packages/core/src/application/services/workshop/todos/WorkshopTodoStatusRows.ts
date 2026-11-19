/**
 * A reply's to-do receipt rows (ADR 2026-11-19 D5, D8, D9): the commit that
 * lands the open room's changes with the reply, `closedBy` as a reply names
 * it, and the later settlements a row takes (a saved write's outcome, an
 * Undo). Pure over the turn it is handed; the session service calls it
 * inside its own commit and `turnLedger.update`.
 */

import type {
  WorkshopTodoClosedBy,
  WorkshopTodoStatus,
  WorkshopTodoStatusChange,
  WorkshopTodoStatusChangeState,
  WorkshopTodoStatusWriteRefusal,
  WorkshopTurn
} from '@messages';
import { WORKSHOP_TODO_STATUS_CURRENT_SESSION } from '@shared/types/messages/workshop/todoStatus';

/** The open room as it stood when the reply was settled: what `closedBy` names. */
export interface WorkshopTodoStatusRoom {
  readonly sessionId: string;
  readonly title: string;
}

/** What `completeRun` is handed: the rows, and the room that makes them. */
export interface WorkshopReplyTodoStatusCommit {
  readonly rows: readonly WorkshopTodoStatusChange[];
  readonly room: WorkshopTodoStatusRoom;
}

/** A later step's settlement of some of a reply's rows. */
export interface WorkshopTodoStatusChangeSettlement {
  readonly indexes: readonly number[];
  readonly state: Exclude<WorkshopTodoStatusChangeState, 'saving'>;
  /** With `refused` only. */
  readonly reason?: WorkshopTodoStatusWriteRefusal;
}

/** Who closed a to-do: the reply's persona, from this room, on this turn. Undefined for a turn with no persona. */
export function workshopTodoClosedBy(
  turn: Pick<WorkshopTurn, 'id' | 'personaId' | 'personaLabel' | 'timestamp'>,
  room: WorkshopTodoStatusRoom,
  note: string | undefined
): WorkshopTodoClosedBy | undefined {
  if (!turn.personaId) {
    return undefined;
  }
  return {
    personaId: turn.personaId,
    personaLabel: turn.personaLabel ?? turn.personaId,
    sessionId: room.sessionId,
    sessionTitle: room.title,
    turnId: turn.id,
    at: turn.timestamp,
    ...(note ? { note } : {})
  };
}

/**
 * Land the open room's rows (`current`) through the room's own setter, in
 * reply order, and return the rows the reply keeps. Settlement checked each
 * to-do was open in the same synchronous step, so nothing can have changed.
 */
export function commitWorkshopReplyTodoStatus(
  commit: WorkshopReplyTodoStatusCommit,
  turn: WorkshopTurn,
  setStatus: (todoId: string, status: WorkshopTodoStatus, closedBy: WorkshopTodoClosedBy | undefined) => void
): WorkshopTodoStatusChange[] {
  for (const row of commit.rows) {
    if (row.session === WORKSHOP_TODO_STATUS_CURRENT_SESSION) {
      setStatus(row.todoId, row.status, workshopTodoClosedBy(turn, commit.room, row.note));
    }
  }
  return commit.rows.map(cloneWorkshopTodoStatusChange);
}

/** Settle the rows at `indexes`; a row that is not there is left alone. */
export function settleWorkshopTodoStatusChanges(turn: WorkshopTurn, settle: WorkshopTodoStatusChangeSettlement): void {
  if (!turn.todoStatusChanges) {
    return;
  }
  const at = new Set(settle.indexes);
  turn.todoStatusChanges = turn.todoStatusChanges.map((row, index) => {
    if (!at.has(index)) {
      return row;
    }
    const { reason: _previous, ...rest } = row;
    return settle.state === 'refused' && settle.reason ? { ...rest, state: settle.state, reason: settle.reason } : { ...rest, state: settle.state };
  });
}

export function cloneWorkshopTodoStatusChange(row: WorkshopTodoStatusChange): WorkshopTodoStatusChange {
  return { ...row };
}

/** The row at `index` on a turn, or undefined. */
export function workshopTodoStatusChangeAt(turn: Pick<WorkshopTurn, 'todoStatusChanges'> | undefined, index: number): WorkshopTodoStatusChange | undefined {
  return Number.isSafeInteger(index) && index >= 0 ? turn?.todoStatusChanges?.[index] : undefined;
}

/**
 * The rows as the card gets them (D5, D8): the host-only `roomSessionId`
 * dropped, and a saved row made in another room (a branch's copy) marked
 * `elsewhere`, so it offers no Undo. With no live id known, nothing is marked.
 */
export function workshopTodoStatusChangesForWebview(rows: readonly WorkshopTodoStatusChange[], liveSessionId: string | undefined): WorkshopTodoStatusChange[] {
  return rows.map(({ roomSessionId, elsewhere: _webviewOnly, ...row }) =>
    row.session !== WORKSHOP_TODO_STATUS_CURRENT_SESSION && liveSessionId !== undefined && roomSessionId !== liveSessionId
      ? { ...row, elsewhere: true }
      : row);
}
