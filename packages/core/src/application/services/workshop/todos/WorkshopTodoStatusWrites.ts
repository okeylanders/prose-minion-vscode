/**
 * A reply's saved-session to-do writes and the writer's Undo of a row (ADR
 * 2026-11-19 D5, D6, D8), owned by `WorkshopTodoHandler` beside the
 * writer's own to-do actions.
 *
 * - **The context.** `context(reply)` resolves a reply's frames before its
 *   completion (`resolveWorkshopReplyTodoStatus`) and hands completion a
 *   hook it calls once the reply is in the ledger, with each saved session's
 *   rows. The run awaits `settled()` as its tail, as it awaits a memory
 *   card's automatic save.
 * - **One write per session,** one after another, each carrying all of that
 *   session's rows. Before each, the room checks the reply is still in its
 *   ledger: a Rewind or a new room that removed it first leaves the rows
 *   unwritten (they left with the reply). Each row settles to `applied` or
 *   `refused` with its reason, and the room is saved and redrawn.
 * - **Undo** reopens only while the to-do still holds the status the row set
 *   and `closedBy` names this turn (and, for a saved session, this room);
 *   otherwise it says the to-do changed since. A saved session's Undo reads
 *   the file again and writes through the port's compare.
 * - **Logs** carry turn, session and to-do ids, counts and reasons, never a
 *   to-do's text, a note or a title.
 */

import type { WorkshopTodoStatusUndoRefusal, WorkshopTurn } from '@messages';
import { WORKSHOP_TODO_STATUS_CURRENT_SESSION } from '@shared/types/messages/workshop/todoStatus';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  resolveWorkshopReplyTodoStatus,
  type WorkshopReplyTodoStatusContext,
  type WorkshopTodoStatusSavedWrite
} from '@/application/services/workshop/todos/WorkshopReplyTodoStatus';
import type {
  WorkshopSavedSessionTodos,
  WorkshopSavedTodoRead,
  WorkshopSavedTodoWrite,
  WorkshopTodoStatusOpenRoom
} from '@/application/services/workshop/todos/WorkshopSavedSessionTodos';
import { workshopTodoClosedBy, workshopTodoStatusChangeAt } from '@/application/services/workshop/todos/WorkshopTodoStatusRows';

export type WorkshopTodoStatusWritesSession = Pick<
  WorkshopSessionService,
  'readRoomRevision' | 'readRoomLedger' | 'setTodoStatusChangeStates' | 'findTodo' | 'setTodoStatus'
>;

export interface WorkshopTodoStatusWritesRoom {
  isSessionOperationPending(): boolean;
  waitForSessionOperations(): Promise<void>;
}

export interface WorkshopTodoStatusWritesHooks {
  /** The room changed: save it and redraw. */
  settleRoom(reason: string): void;
  log(line: string): void;
}

export type WorkshopTodoStatusUndoOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: WorkshopTodoStatusUndoRefusal };

export class WorkshopTodoStatusWrites {
  constructor(
    private readonly session: WorkshopTodoStatusWritesSession,
    private readonly port: WorkshopSavedSessionTodos,
    private readonly room: WorkshopTodoStatusWritesRoom,
    private readonly hooks: WorkshopTodoStatusWritesHooks
  ) {}

  /** A reply's to-do context, or undefined for a reply holding no frame (no read, no await). */
  async context(reply: string): Promise<WorkshopReplyTodoStatusContext | undefined> {
    const resolved = await resolveWorkshopReplyTodoStatus(reply, this.port);
    if (!resolved) {
      return undefined;
    }
    let pending: Promise<void> | undefined;
    return {
      ...resolved,
      afterCommit: (turnId, writes) => {
        pending = this.write(turnId, writes, resolved.openRoom);
      },
      settled: () => pending
    };
  }

  /** Write each saved session's rows, one session after another; resolves once each settles, and never rejects. */
  async write(turnId: string, writes: readonly WorkshopTodoStatusSavedWrite[], openRoom: WorkshopTodoStatusOpenRoom | undefined): Promise<void> {
    const revision = this.session.readRoomRevision();
    for (const write of writes) {
      const target = `turnId=${turnId} sessionId=${write.read.sessionId} rows=${write.indexes.length}`;
      try {
        const turn = this.liveTurn(turnId, revision);
        if (!turn) {
          this.hooks.log(`To-do write skipped ${target} reason=room-changed`);
          continue;
        }
        const changes = write.indexes.flatMap((index) => {
          const row = workshopTodoStatusChangeAt(turn, index);
          const closedBy = row && workshopTodoClosedBy(turn, { sessionId: row.roomSessionId ?? openRoom?.sessionId ?? WORKSHOP_TODO_STATUS_CURRENT_SESSION, title: openRoom?.title ?? '' }, row.note);
          return row ? [{ todoId: row.todoId, status: row.status, ...(closedBy ? { closedBy } : {}) }] : [];
        });
        const result = await this.port.write(write.read, changes);
        await this.settleOperations();
        if (!this.liveTurn(turnId, revision)) {
          this.hooks.log(`To-do write ${result.kind} ${target}; receipt not recorded reason=room-changed`);
          continue;
        }
        this.session.setTodoStatusChangeStates(turnId, result.kind === 'written'
          ? { indexes: write.indexes, state: 'applied' }
          : { indexes: write.indexes, state: 'refused', reason: result.reason });
        this.hooks.log(`To-do write ${result.kind === 'written' ? 'applied' : `refused reason=${result.reason}`} ${target}`);
        this.hooks.settleRoom('persona to-do write settled');
      } catch (error) {
        this.hooks.log(`To-do write failed ${target} reason=${error instanceof Error ? error.name : 'unknown'}`);
      }
    }
  }

  /** The writer's Undo of one row, checked as D8 states; the row becomes `undone`. */
  async undo(turnId: string, index: number, roomRevision: number): Promise<WorkshopTodoStatusUndoOutcome> {
    if (roomRevision !== this.session.readRoomRevision()) {
      return { ok: false, reason: 'room-changed' };
    }
    const turn = this.liveTurn(turnId, roomRevision);
    const row = workshopTodoStatusChangeAt(turn, index);
    if (!turn || !row) {
      return { ok: false, reason: 'no-row' };
    }
    if (row.state !== 'applied') {
      return { ok: false, reason: 'not-undoable' };
    }
    if (row.session === WORKSHOP_TODO_STATUS_CURRENT_SESSION) {
      const todo = this.session.findTodo(row.todoId);
      if (!todo || todo.status !== row.status || todo.closedBy?.turnId !== turnId) {
        return { ok: false, reason: 'todo-changed' };
      }
      this.session.setTodoStatus(row.todoId, 'open');
      this.session.setTodoStatusChangeStates(turnId, { indexes: [index], state: 'undone' });
      return { ok: true };
    }
    if (!row.roomSessionId || row.roomSessionId !== this.port.openRoom()?.sessionId) {
      return { ok: false, reason: 'elsewhere' };
    }
    const read = await this.port.read(row.session);
    if (read.kind === 'refused') {
      return { ok: false, reason: undoReadRefusal(read) };
    }
    const todo = read.todos.find((candidate) => candidate.id === row.todoId);
    if (!todo || todo.status !== row.status || todo.closedBy?.turnId !== turnId || todo.closedBy.sessionId !== row.roomSessionId) {
      return { ok: false, reason: 'todo-changed' };
    }
    const written = await this.port.write(read, [{ todoId: row.todoId, status: 'open' }]);
    if (written.kind === 'refused') {
      return { ok: false, reason: undoWriteRefusal(written) };
    }
    await this.settleOperations();
    if (this.liveTurn(turnId, roomRevision)) {
      this.session.setTodoStatusChangeStates(turnId, { indexes: [index], state: 'undone' });
    }
    return { ok: true };
  }

  private liveTurn(turnId: string, revision: number): WorkshopTurn | undefined {
    return this.session.readRoomRevision() === revision
      ? this.session.readRoomLedger().find((turn) => turn.id === turnId)
      : undefined;
  }

  private async settleOperations(): Promise<void> {
    while (this.room.isSessionOperationPending()) {
      await this.room.waitForSessionOperations();
    }
  }
}

function undoReadRefusal(read: Extract<WorkshopSavedTodoRead, { kind: 'refused' }>): WorkshopTodoStatusUndoRefusal {
  switch (read.reason) {
    case 'unknown-session':
      return 'session-not-found';
    case 'store-unavailable':
    case 'workspace-changed':
      return 'sessions-unavailable';
    case 'unreadable-session':
    case 'session-needs-recovery':
      return 'failed';
    default:
      return assertNever(read.reason);
  }
}

function undoWriteRefusal(written: Extract<WorkshopSavedTodoWrite, { kind: 'refused' }>): WorkshopTodoStatusUndoRefusal {
  switch (written.reason) {
    case 'session-changed':
      return 'session-changed';
    case 'session-not-found':
      return 'session-not-found';
    case 'sessions-unavailable':
      return 'sessions-unavailable';
    case 'room-changed':
      return 'elsewhere';
    case 'write-failed':
      return 'failed';
    default:
      return assertNever(written.reason);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unmapped to-do refusal: ${String(value)}`);
}
