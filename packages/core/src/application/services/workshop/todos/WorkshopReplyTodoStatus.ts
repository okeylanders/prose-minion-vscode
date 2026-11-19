/**
 * A reply's to-do status changes, settled (ADR 2026-11-19 D3, D5, D7).
 *
 * - **Before the commit** (`resolveWorkshopReplyTodoStatus`, awaits
 *   allowed): only a reply holding the tag costs anything. Its frames are
 *   judged, and each saved session named is read once through the write
 *   port. A reply with no tag gets no context, and no read.
 * - **At the commit** (`settleWorkshopReplyTodoStatus`, synchronous, in the
 *   same step as `completeRun`): each change is checked against the session
 *   it names, read whole: the open room's live to-dos, or the saved copy
 *   read before. An unknown session, an unknown to-do or one not `open` is
 *   dropped with its typed reason, and the reply's other changes still land.
 *   The open room's rows commit `applied`; a saved session's commit `saving`,
 *   handed to the post-commit write grouped by session.
 * - **Verdicts are typed** (`WorkshopTodoStatusDropCode`), and
 *   `workshopTrailerDropReason` maps each to the record's reason.
 * - **Logs** carry ids, counts and reasons, never a to-do's text or a note.
 */

import type { WorkshopTodoItem, WorkshopTodoStatusChange } from '@messages';
import { WORKSHOP_TODO_STATUS_CURRENT_SESSION } from '@shared/types/messages/workshop/todoStatus';
import { WORKSHOP_TODO_BOUNDS } from '@/application/services/workshop/WorkshopSessionLimits';
import { extractWorkshopReplyControls, hasWorkshopTodoStatusText } from '@/utils/workshopReplyControls';
import type {
  WorkshopReplyTodoStatusControl,
  WorkshopReplyTodoStatusRejection,
  WorkshopTodoStatusDraft
} from '@/utils/workshopReplyTodoStatus';
import type {
  WorkshopSavedSessionTodos,
  WorkshopSavedTodoRead,
  WorkshopSavedTodoReadFault,
  WorkshopSavedTodoReadOk,
  WorkshopTodoStatusOpenRoom
} from '@/application/services/workshop/todos/WorkshopSavedSessionTodos';
import type { WorkshopReplyTodoStatusCommit } from '@/application/services/workshop/todos/WorkshopTodoStatusRows';

/** Every code a to-do status frame can end with no row for. */
export type WorkshopTodoStatusDropCode =
  | WorkshopReplyTodoStatusRejection
  | WorkshopSavedTodoReadFault
  | 'unknown-todo'
  | 'not-open';

/** One frame's verdict: a row, or why it has none. */
export type WorkshopTodoStatusVerdict =
  | { readonly kind: 'row'; readonly row: WorkshopTodoStatusChange }
  | { readonly kind: 'dropped'; readonly code: WorkshopTodoStatusDropCode };

/** The saved writes a commit owes: one per session, with the indexes of its rows. */
export interface WorkshopTodoStatusSavedWrite {
  readonly read: WorkshopSavedTodoReadOk;
  readonly indexes: readonly number[];
}

/** What completion is handed for a reply, resolved before it. */
export interface WorkshopReplyTodoStatusContext {
  /** The reply it was resolved from: used for that reply only. */
  readonly reply: string;
  readonly openRoom?: WorkshopTodoStatusOpenRoom;
  /** Each saved session the frames named, read once. */
  readonly reads: ReadonlyMap<string, WorkshopSavedTodoRead>;
  /** Hand the commit's saved writes over, once the reply is in the ledger. */
  readonly afterCommit?: (turnId: string, writes: readonly WorkshopTodoStatusSavedWrite[]) => void;
  /** What the run awaits as its tail: the writes handed over, settled. */
  readonly settled?: () => Promise<void> | undefined;
}

export interface WorkshopReplyTodoStatusSettlement {
  /** For `completeRun`; absent when no frame made a row. */
  readonly commit?: WorkshopReplyTodoStatusCommit;
  readonly drops: readonly WorkshopTodoStatusDropCode[];
  readonly writes: readonly WorkshopTodoStatusSavedWrite[];
  readonly logs: readonly string[];
}

/** The open room's title, when the store could not name it. */
export const WORKSHOP_TODO_STATUS_OPEN_ROOM_FALLBACK = { sessionId: WORKSHOP_TODO_STATUS_CURRENT_SESSION, title: 'This session' } as const;

/** Read what a reply's frames name, before completion. A reply holding no tag costs no await. */
export async function resolveWorkshopReplyTodoStatus(
  reply: string,
  port: WorkshopSavedSessionTodos
): Promise<Omit<WorkshopReplyTodoStatusContext, 'afterCommit' | 'settled'> | undefined> {
  if (!hasWorkshopTodoStatusText(reply)) {
    return undefined;
  }
  const openRoom = port.openRoom();
  const control = extractWorkshopReplyControls(reply, { memoryOpen: false, todoStatus: { openRoomIds: openRoom?.ids ?? [] } }).todoStatus;
  const sessions = [...new Set((control?.changes ?? []).map((change) => change.session))]
    .filter((session) => session !== WORKSHOP_TODO_STATUS_CURRENT_SESSION);
  const reads = await Promise.all(sessions.map(async (session) => [session, await port.read(session)] as const));
  return { reply, ...(openRoom ? { openRoom } : {}), reads: new Map(reads) };
}

/**
 * Settle a reply's frames, synchronously, at its commit. `liveTodo` reads
 * the open room's to-do as it stands now.
 */
export function settleWorkshopReplyTodoStatus(
  control: WorkshopReplyTodoStatusControl | undefined,
  context: Pick<WorkshopReplyTodoStatusContext, 'openRoom' | 'reads'> | undefined,
  liveTodo: (todoId: string) => WorkshopTodoItem | undefined,
  mintOperationId: () => string = workshopTodoOperationId
): WorkshopReplyTodoStatusSettlement {
  if (!control) {
    return { drops: [], writes: [], logs: [] };
  }
  const room = context?.openRoom ?? WORKSHOP_TODO_STATUS_OPEN_ROOM_FALLBACK;
  const rows: WorkshopTodoStatusChange[] = [];
  const drops: WorkshopTodoStatusDropCode[] = [...control.rejections];
  const logs = control.rejections.map((code) => `To-do status dropped (reason=${code})`);
  const writes = new Map<string, { read: WorkshopSavedTodoReadOk; indexes: number[] }>();
  // One operation per write (D8a): the open room's changes, and each saved session's.
  const operations = new Map<string, string>();
  const operationOf = (session: string): string => operations.get(session) ?? operations.set(session, mintOperationId()).get(session)!;
  for (const change of control.changes) {
    const verdict = judgeChange(change, context, room, liveTodo, operationOf);
    if (verdict.kind === 'dropped') {
      drops.push(verdict.code);
      logs.push(`To-do status dropped (reason=${verdict.code}; session=${change.session}; todoId=${change.todoId})`);
      continue;
    }
    const index = rows.push(verdict.row) - 1;
    logs.push(`To-do status ${verdict.row.state} (session=${change.session}; todoId=${change.todoId}; status=${change.status})`);
    if (change.session !== WORKSHOP_TODO_STATUS_CURRENT_SESSION) {
      const read = context?.reads.get(change.session);
      if (read?.kind === 'read') {
        const entry = writes.get(change.session) ?? { read, indexes: [] };
        entry.indexes.push(index);
        writes.set(change.session, entry);
      }
    }
  }
  return {
    ...(rows.length > 0 ? { commit: { rows, room: { sessionId: room.sessionId, title: room.title } } } : {}),
    drops,
    writes: [...writes.values()],
    logs
  };
}

function judgeChange(
  change: WorkshopTodoStatusDraft,
  context: Pick<WorkshopReplyTodoStatusContext, 'openRoom' | 'reads'> | undefined,
  room: { readonly sessionId: string; readonly title: string },
  liveTodo: (todoId: string) => WorkshopTodoItem | undefined,
  operationOf: (session: string) => string
): WorkshopTodoStatusVerdict {
  if (change.session === WORKSHOP_TODO_STATUS_CURRENT_SESSION) {
    const todo = liveTodo(change.todoId);
    if (!todo) {
      return { kind: 'dropped', code: 'unknown-todo' };
    }
    return todo.status !== 'open'
      ? { kind: 'dropped', code: 'not-open' }
      : { kind: 'row', row: rowOf(change, room.title, todo.text, 'applied', operationOf(change.session)) };
  }
  // A saved session no context read for (a context resolved for another reply) is not available now.
  const read = context?.reads.get(change.session) ?? { kind: 'refused', reason: 'store-unavailable' };
  if (read.kind === 'refused') {
    return { kind: 'dropped', code: read.reason };
  }
  const todo = read.todos.find((candidate) => candidate.id === change.todoId);
  if (!todo) {
    return { kind: 'dropped', code: 'unknown-todo' };
  }
  return todo.status !== 'open'
    ? { kind: 'dropped', code: 'not-open' }
    : { kind: 'row', row: { ...rowOf(change, read.title, todo.text, 'saving', operationOf(change.session)), roomSessionId: room.sessionId } };
}

function rowOf(change: WorkshopTodoStatusDraft, sessionTitle: string, text: string, state: 'applied' | 'saving', operationId: string): WorkshopTodoStatusChange {
  return {
    session: change.session,
    sessionTitle,
    todoId: change.todoId,
    todoText: text.slice(0, WORKSHOP_TODO_BOUNDS.textCharacters),
    status: change.status,
    previous: 'open',
    ...(change.note ? { note: change.note } : {}),
    state,
    operationId
  };
}

/** A host-minted operation id (D8a): unique enough to tell one write from every other. */
export function workshopTodoOperationId(): string {
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
