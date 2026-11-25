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
 * - **The receipt is durable first.** Before any saved session is written,
 *   the room holding the `saving` rows is checkpointed and read back,
 *   host and guest replies alike (`checkpointTodoReceipt`). If that fails,
 *   no saved session is written and the rows read `receipt-not-saved`, so a
 *   restart can never leave a to-do closed with no receipt to reconcile.
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
  /** Persist the room holding the reply's `saving` receipt, and read it back (D5): ok only when it is durable. */
  checkpointTodoReceipt(generation: number, turnId: string): Promise<{ readonly ok: boolean; readonly reason?: string }>;
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
  /** This window's writes still under way, by operation id: reconciliation leaves their rows alone. */
  private readonly inFlight = new Set<string>();

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
    // Every write this reply owes is held from the start, so reconciliation never settles a row still waiting its turn.
    const held = (this.liveTurn(turnId, revision)?.todoStatusChanges ?? []).map((row) => row.operationId);
    held.forEach((id) => this.inFlight.add(id));
    try {
      if (await this.receiptDurable(turnId, writes, revision)) {
        await this.writeEach(turnId, writes, openRoom, revision);
      }
    } finally {
      held.forEach((id) => this.inFlight.delete(id));
    }
  }

  /** Checkpoint the receipt; when it cannot be made durable, refuse every row and write nothing. */
  private async receiptDurable(turnId: string, writes: readonly WorkshopTodoStatusSavedWrite[], revision: number): Promise<boolean> {
    const checkpoint = await this.room.checkpointTodoReceipt(revision, turnId).catch(() => ({ ok: false, reason: 'checkpoint-failed' }));
    if (checkpoint.ok) {
      return true;
    }
    const indexes = writes.flatMap((write) => write.indexes);
    this.hooks.log(`To-do writes not started turnId=${turnId} rows=${indexes.length} reason=receipt-not-saved checkpoint=${checkpoint.reason ?? 'unknown'}`);
    if (this.liveTurn(turnId, revision)) {
      this.session.setTodoStatusChangeStates(turnId, { indexes, state: 'refused', reason: 'receipt-not-saved' });
      this.hooks.settleRoom('persona to-do writes not started');
    }
    return false;
  }

  private async writeEach(turnId: string, writes: readonly WorkshopTodoStatusSavedWrite[], openRoom: WorkshopTodoStatusOpenRoom | undefined, revision: number): Promise<void> {
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
          const closedBy = row && workshopTodoClosedBy(turn, { sessionId: row.roomSessionId ?? openRoom?.sessionId ?? WORKSHOP_TODO_STATUS_CURRENT_SESSION, title: openRoom?.title ?? '' }, row.note, row.operationId);
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

  /**
   * Settle every row still `saving` or `unverified` that no write in this
   * window holds (D8a, D8b): at each hydrate, Open or restore, and before
   * Undo. A to-do whose `closedBy.operationId` is the row's reads `applied`;
   * a target read without the stamp reads `interrupted` (final); one that
   * could not be read reads `unverified` (not final, checked again). It
   * never writes the target and never retries.
   */
  async reconcile(): Promise<void> {
    const revision = this.session.readRoomRevision();
    const owed = this.session.readRoomLedger().flatMap((turn) => (turn.todoStatusChanges ?? []).flatMap((row, index) =>
      (row.state === 'saving' || row.state === 'unverified') && !this.inFlight.has(row.operationId) ? [{ turnId: turn.id, index, row }] : []));
    if (owed.length === 0) {
      return;
    }
    const reads = new Map<string, Promise<WorkshopSavedTodoRead>>();
    let settled = 0;
    for (const { turnId, index, row } of owed) {
      const pending = reads.get(row.session) ?? this.port.read(row.session);
      reads.set(row.session, pending);
      const read = await pending.catch((): WorkshopSavedTodoRead => ({ kind: 'refused', reason: 'unreadable-session' }));
      if (this.session.readRoomRevision() !== revision || this.inFlight.has(row.operationId)) {
        return;
      }
      const landed = read.kind === 'read' && read.todos.some((todo) => todo.id === row.todoId && todo.closedBy?.operationId === row.operationId);
      const state = landed ? 'applied' : read.kind === 'read' ? 'interrupted' : 'unverified';
      if (state === row.state) {
        continue;
      }
      this.session.setTodoStatusChangeStates(turnId, { indexes: [index], state });
      this.hooks.log(`To-do row reconciled turnId=${turnId} index=${index} sessionId=${row.session} state=${state}`);
      settled += 1;
    }
    if (settled > 0) {
      this.hooks.settleRoom('persona to-do rows reconciled');
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
    // D8b: a row still saving or unverified is re-checked, read-only, before Undo; Undo stays off until it reads applied.
    if ((row.state === 'saving' || row.state === 'unverified') && !this.inFlight.has(row.operationId)) {
      // Undo is enabled only on a recognized write (D8a).
      await this.reconcile();
      const after = workshopTodoStatusChangeAt(this.liveTurn(turnId, roomRevision), index);
      return after?.state === 'applied' ? this.undo(turnId, index, roomRevision) : { ok: false, reason: 'not-undoable' };
    }
    if (row.state !== 'applied') {
      return { ok: false, reason: 'not-undoable' };
    }
    if (row.session === WORKSHOP_TODO_STATUS_CURRENT_SESSION) {
      const todo = this.session.findTodo(row.todoId);
      if (!todo || todo.status !== row.status || todo.closedBy?.operationId !== row.operationId) {
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
    if (!todo || todo.status !== row.status || todo.closedBy?.operationId !== row.operationId) {
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
    case 'session-busy':
      return 'session-busy';
    case 'sessions-unavailable':
      return 'sessions-unavailable';
    case 'room-changed':
      return 'elsewhere';
    case 'write-failed':
    case 'receipt-not-saved': // The port never answers it; a room checkpoint does.
      return 'failed';
    default:
      return assertNever(written.reason);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unmapped to-do refusal: ${String(value)}`);
}
