/**
 * To-do status fixtures (ADR 2026-11-19): a real room whose host promoted
 * findings to to-dos, a frame builder, a fake saved-session port over an
 * in-memory session, and the production completion. *Alice*, made-up ids.
 */

import {
  completeWorkshopRun,
  workshopMessageCompletionCopy
} from '@/application/services/workshop/WorkshopRunCompletion';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { AnalysisResult } from '@/domain/models/AnalysisResult';
import type { WorkshopTodoItem, WorkshopTurn } from '@messages';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopStoredTodoItemV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import type {
  WorkshopSavedSessionTodos,
  WorkshopSavedTodoChange,
  WorkshopSavedTodoRead,
  WorkshopSavedTodoReadOk,
  WorkshopSavedTodoWrite
} from '@/application/services/workshop/todos/WorkshopSavedSessionTodos';
import type { WorkshopReplyTodoStatusContext } from '@/application/services/workshop/todos/WorkshopReplyTodoStatus';

/** Text no record, log or line may hold. */
export const TODO_TEXT_SENTINEL = 'ZZQ-WHITE-RABBIT-TODO';
export const NOTE_SENTINEL = 'ZZQ-NOTE';
export const TITLE_SENTINEL = 'ZZQ-POLISH-TITLE';

export function todoFrame(fields: { session?: string; todo: string; status?: string; note?: string }): string {
  return [
    '<prose-minion-todo-status>',
    `  <session>${fields.session ?? 'current'}</session>`,
    `  <todo>${fields.todo}</todo>`,
    `  <status>${fields.status ?? 'completed'}</status>`,
    ...(fields.note !== undefined ? [`  <note>${fields.note}</note>`] : []),
    '</prose-minion-todo-status>'
  ].join('\n');
}

/** A room with `count` open to-dos promoted from Jill's findings. */
export function roomWithTodos(count = 3): { session: WorkshopSessionService; todos: WorkshopTodoItem[] } {
  let clock = 1_000;
  const session = new WorkshopSessionService(() => clock++);
  session.setExcerpt({ text: 'Alice was beginning to get very tired of sitting by her sister.', source: { kind: 'manual' } });
  session.beginPersonaMessage('seed', 'What should I fix?');
  const findings = Array.from({ length: count }, (_, index) => ({
    key: `finding-${index + 1}`,
    text: `${TODO_TEXT_SENTINEL} ${index + 1}: let the White Rabbit enter sooner.`,
    ordinal: index + 1
  }));
  const reply = session.completeRun('seed', 'Here is my read.', undefined, false, 'host-conv', findings)!;
  return { session, todos: findings.map((finding) => session.addTodoFromFinding(reply.id, finding.key)) };
}

let sent = 0;

/** One host reply, or a guest's joining reply, completed as the room completes it. */
export function replyWith(
  session: WorkshopSessionService,
  content: string,
  options: { todoStatus?: WorkshopReplyTodoStatusContext; log?: jest.Mock; guest?: 'cliff' } = {}
): WorkshopTurn {
  sent += 1;
  const requestId = `todo-req-${sent}`;
  if (options.guest) {
    session.beginPersonaGuestJoin(options.guest, requestId, `Message ${sent}.`);
  } else {
    session.beginPersonaMessage(requestId, `Message ${sent}.`);
  }
  const turn = completeWorkshopRun({
    session,
    requestId,
    label: 'Jill',
    result: {
      toolName: 'workshop-test',
      content,
      conversationId: 'host-conv',
      timestamp: new Date(0),
      replySource: 'provider'
    } as AnalysisResult,
    aborted: false,
    createsRetainedConversation: false,
    copy: workshopMessageCompletionCopy('Jill'),
    discardConversation: jest.fn(),
    readRetainedHistory: jest.fn(() => ({ messageCount: 2, contextSourceCount: 0 })),
    ...(options.todoStatus ? { todoStatus: options.todoStatus } : {}),
    log: options.log ?? jest.fn(),
    events: { streamCompleted: jest.fn(), turnCompleted: jest.fn(), status: jest.fn(), error: jest.fn(), widgetRecommendationRejected: jest.fn() }
  });
  if (!turn) {
    throw new Error('the reply was refused');
  }
  return turn;
}

function storedTodo(id: string, status: WorkshopStoredTodoItemV1['status']): WorkshopStoredTodoItemV1 {
  return {
    id,
    text: `${TODO_TEXT_SENTINEL} saved ${id}`,
    status,
    source: {
      kind: 'host_turn', turnId: 'turn-1-assistant-1', participantLabel: 'Jill', personaId: 'jill',
      findingKey: 'finding-1', findingText: 'Cut the second "very".', excerptVersion: 1
    },
    createdAt: 1
  };
}

/**
 * A fake saved-session port over in-memory sessions: `read` answers what
 * each holds, and `write` compares against the version read, as the
 * store's compare-and-swap does.
 */
export class FakeSavedSessionTodos implements WorkshopSavedSessionTodos {
  readonly sessions = new Map<string, { title: string; todos: WorkshopStoredTodoItemV1[]; version: number }>();
  readonly refusals = new Map<string, Extract<WorkshopSavedTodoRead, { kind: 'refused' }>['reason']>();
  readonly writes: Array<{ sessionId: string; changes: readonly WorkshopSavedTodoChange[] }> = [];
  openRoomId = 'room-alice';

  addSession(sessionId: string, todos: ReadonlyArray<[string, WorkshopStoredTodoItemV1['status']]>): void {
    this.sessions.set(sessionId, { title: `${TITLE_SENTINEL} ${sessionId}`, todos: todos.map(([id, status]) => storedTodo(id, status)), version: 1 });
  }

  /** Another writer changed the file. */
  touch(sessionId: string): void {
    this.sessions.get(sessionId)!.version += 1;
  }

  openRoom() {
    return { sessionId: this.openRoomId, title: 'Polish 6.11', ids: [this.openRoomId] };
  }

  async read(sessionId: string): Promise<WorkshopSavedTodoRead> {
    const refused = this.refusals.get(sessionId);
    if (refused) {
      return { kind: 'refused', reason: refused };
    }
    const found = this.sessions.get(sessionId);
    if (!found) {
      return { kind: 'refused', reason: 'unknown-session' };
    }
    return {
      kind: 'read',
      sessionId,
      title: found.title,
      todos: found.todos.map((todo) => ({ ...todo, ...(todo.closedBy ? { closedBy: { ...todo.closedBy } } : {}) })),
      session: { sessionId, updatedAt: String(found.version) } as unknown as WorkshopPersistedSessionV2
    };
  }

  async write(read: WorkshopSavedTodoReadOk, changes: readonly WorkshopSavedTodoChange[]): Promise<WorkshopSavedTodoWrite> {
    const found = this.sessions.get(read.sessionId);
    if (!found) {
      return { kind: 'refused', reason: 'session-not-found' };
    }
    if (String(found.version) !== read.session.updatedAt) {
      return { kind: 'refused', reason: 'session-changed' };
    }
    this.writes.push({ sessionId: read.sessionId, changes });
    found.version += 1;
    found.todos = found.todos.map((todo) => {
      const change = changes.find((candidate) => candidate.todoId === todo.id);
      if (!change) {
        return todo;
      }
      const { closedBy: _previous, ...rest } = todo;
      return change.closedBy ? { ...rest, status: change.status, closedBy: change.closedBy } : { ...rest, status: change.status };
    });
    return { kind: 'written' };
  }
}
