/**
 * The saved-session write port over the session store and the persistence
 * coordinator (ADR 2026-11-19 D6). Built once, in `extension.ts`, and placed
 * in `CoreServices`; no handler constructs it.
 *
 * - **It is `renameNamed`'s path.** `write` builds the changed session from
 *   the decoded copy `read` returned and calls
 *   `updateNamed(id, changed, read.session)`: a compare-and-swap, under the
 *   file's claim (D6a). A changed file is `session-changed`, a file another
 *   window holds is `session-busy`; nothing is overwritten.
 * - **Stamped** (D8a): each change's `closedBy` carries its write's
 *   `operationId`, so a reload tells a landed write from an interrupted one.
 * - **`updatedAt` moves to now,** so recall's cache, keyed by it, reads the
 *   new status, and the session rises in the recency list.
 * - **It runs on the coordinator's session-operation queue,** so it never
 *   interleaves with this window's Open, rename, duplicate or delete.
 * - **It refuses** the open room's own ids, a session that needs recovery
 *   (as rename does), a store that is not available, and a workspace changed
 *   since load (`recallScope()`'s rule).
 * - **Logs** carry session ids, counts and reasons, never a to-do's text,
 *   a note or a title.
 */

import type { LogSink } from '@/platform';
import type {
  WorkshopPersistedSessionCheckpointDecodeResult,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopSessionRecallScope } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import type { WorkshopStoredSessionSummary } from '@/infrastructure/storage/WorkshopSessionStore';
import type {
  WorkshopSavedSessionTodos,
  WorkshopSavedTodoChange,
  WorkshopSavedTodoRead,
  WorkshopSavedTodoReadOk,
  WorkshopSavedTodoWrite,
  WorkshopTodoStatusOpenRoom
} from '@/application/services/workshop/todos/WorkshopSavedSessionTodos';

/** The store's two calls this port makes. */
export interface WorkshopSavedTodoSessionStore {
  readNamedWithRecovery(sessionId: string): Promise<WorkshopPersistedSessionCheckpointDecodeResult | undefined>;
  updateNamed(sessionId: string, session: WorkshopPersistedSessionV2, expected: WorkshopPersistedSessionV2): Promise<WorkshopStoredSessionSummary>;
}

/** The coordinator's part: which room is open, whether the workspace holds, and its queue. */
export interface WorkshopSavedTodoSessionRoom {
  recallScope(): WorkshopSessionRecallScope;
  openRoomIdentity(): { sessionId: string; title: string; namedSessionId?: string };
  runSavedSessionOperation<T>(operation: () => Promise<T>): Promise<T>;
}

const LOG = '[WorkshopSavedSessionTodos]';

export class WorkshopSavedSessionTodoStore implements WorkshopSavedSessionTodos {
  constructor(
    private readonly store: WorkshopSavedTodoSessionStore,
    private readonly room: WorkshopSavedTodoSessionRoom,
    private readonly outputChannel: LogSink,
    private readonly now: () => Date = () => new Date()
  ) {}

  openRoom(): WorkshopTodoStatusOpenRoom | undefined {
    if (!this.room.recallScope().available) {
      return undefined;
    }
    const identity = this.room.openRoomIdentity();
    const ids = identity.namedSessionId && identity.namedSessionId !== identity.sessionId
      ? [identity.sessionId, identity.namedSessionId]
      : [identity.sessionId];
    return { sessionId: identity.sessionId, title: identity.title, ids };
  }

  async read(sessionId: string): Promise<WorkshopSavedTodoRead> {
    const scope = this.room.recallScope();
    if (!scope.available) {
      return this.readRefused(sessionId, scope.reason === 'workspace-changed' ? 'workspace-changed' : 'store-unavailable');
    }
    if (this.openRoom()?.ids.includes(sessionId)) {
      // The open room is never a saved session: settlement routes its ids to `current`.
      return this.readRefused(sessionId, 'unknown-session');
    }
    let found: WorkshopPersistedSessionCheckpointDecodeResult | undefined;
    try {
      found = await this.store.readNamedWithRecovery(sessionId);
    } catch (error) {
      // A file another window holds under its claim (D6a) cannot be read just now: not available, never missing.
      const name = error instanceof Error ? error.name : '';
      return this.readRefused(sessionId, name === 'WorkshopSessionStoreUnavailableError' || name === 'WorkshopNamedSessionBusyError' ? 'store-unavailable' : 'unreadable-session');
    }
    if (!found) {
      return this.readRefused(sessionId, 'unknown-session');
    }
    if (found.recoveryNotices.length > 0) {
      return this.readRefused(sessionId, 'session-needs-recovery');
    }
    return {
      kind: 'read',
      sessionId,
      title: found.session.title,
      todos: found.session.workshop.todos,
      session: found.session
    };
  }

  write(read: WorkshopSavedTodoReadOk, changes: readonly WorkshopSavedTodoChange[]): Promise<WorkshopSavedTodoWrite> {
    const target = `sessionId=${read.sessionId} changes=${changes.length}`;
    return this.room.runSavedSessionOperation(async (): Promise<WorkshopSavedTodoWrite> => {
      if (this.openRoom()?.ids.includes(read.sessionId)) {
        return this.writeRefused(target, 'room-changed');
      }
      const changed = withTodoChanges(read.session, changes, this.now().toISOString());
      if (!changed) {
        return this.writeRefused(target, 'session-changed');
      }
      await this.store.updateNamed(read.sessionId, changed, read.session);
      this.outputChannel.appendLine(`${LOG} written ${target}`);
      return { kind: 'written' };
    }).catch((error: unknown) => this.writeRefused(target, writeRefusalOf(error)));
  }

  private readRefused(sessionId: string, reason: Extract<WorkshopSavedTodoRead, { kind: 'refused' }>['reason']): WorkshopSavedTodoRead {
    this.outputChannel.appendLine(`${LOG} read refused sessionId=${sessionId} reason=${reason}`);
    return { kind: 'refused', reason };
  }

  private writeRefused(target: string, reason: Extract<WorkshopSavedTodoWrite, { kind: 'refused' }>['reason']): WorkshopSavedTodoWrite {
    this.outputChannel.appendLine(`${LOG} write refused ${target} reason=${reason}`);
    return { kind: 'refused', reason };
  }
}

/** The session with each change applied, `updatedAt` moved; undefined when a named to-do is not in it. */
function withTodoChanges(
  session: WorkshopPersistedSessionV2,
  changes: readonly WorkshopSavedTodoChange[],
  updatedAt: string
): WorkshopPersistedSessionV2 | undefined {
  const byId = new Map(changes.map((change) => [change.todoId, change]));
  if (changes.some((change) => !session.workshop.todos.some((todo) => todo.id === change.todoId))) {
    return undefined;
  }
  return {
    ...session,
    updatedAt,
    workshop: {
      ...session.workshop,
      todos: session.workshop.todos.map((todo) => {
        const change = byId.get(todo.id);
        if (!change) {
          return todo;
        }
        const { closedBy: _previous, ...rest } = todo;
        return change.closedBy ? { ...rest, status: change.status, closedBy: { ...change.closedBy } } : { ...rest, status: change.status };
      })
    }
  };
}

function writeRefusalOf(error: unknown): Extract<WorkshopSavedTodoWrite, { kind: 'refused' }>['reason'] {
  const name = error instanceof Error ? error.name : '';
  switch (name) {
    case 'WorkshopNamedSessionChangedError':
      return 'session-changed';
    case 'WorkshopNamedSessionNotFoundError':
      return 'session-not-found';
    case 'WorkshopNamedSessionBusyError':
      return 'session-busy';
    case 'WorkshopSessionStoreUnavailableError':
      return 'sessions-unavailable';
    default:
      // The coordinator's queue refuses a changed workspace by throwing before the write.
      return error instanceof Error && /workspace changed/i.test(error.message) ? 'sessions-unavailable' : 'write-failed';
  }
}
