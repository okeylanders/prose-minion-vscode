/**
 * Session-owned ledger for writer-promoted Workshop tasks.
 *
 * The ledger owns task identity, ordering, editing, status, bounds, and
 * immutable finding provenance. Excerpt version is owned by
 * `WorkshopPassageScope`; the aggregate supplies it to every operation that
 * derives staleness. It is never cached here.
 */

import {
  WorkshopActionableFinding,
  WorkshopTodoItem,
  WorkshopTodoSource,
  WorkshopTurn
} from '@messages';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { workshopToolLabel } from '@shared/constants/workshopTools';
import { WORKSHOP_TODO_BOUNDS } from '@/application/services/workshop/WorkshopSessionLimits';
import type {
  WorkshopStoredTodoItemV1
} from '@/application/services/workshop/WorkshopSessionStateV1';

export interface WorkshopTodoLedgerState {
  counter: number;
  todos: WorkshopStoredTodoItemV1[];
}

const cloneStoredTodo = (
  todo: WorkshopStoredTodoItemV1
): WorkshopStoredTodoItemV1 => ({
  ...todo,
  source: { ...todo.source },
  writerEdit: todo.writerEdit ? { ...todo.writerEdit } : undefined
});

const cloneTodo = (
  todo: WorkshopStoredTodoItemV1,
  excerptVersion: number
): WorkshopTodoItem => ({
  ...cloneStoredTodo(todo),
  stale: todo.source.excerptVersion !== excerptVersion
});

/**
 * Provenance for a task promoted from one turn's finding, or undefined when
 * the turn cannot source a task. Each kind is its own literal so the compiler
 * checks it against its own union member: one literal shared by host and
 * guest once wrote the host-only `upstreamReportTurnId` onto guest sources,
 * and the strict session codec refused to save the room.
 */
function findingSource(
  turn: WorkshopTurn,
  finding: WorkshopActionableFinding
): WorkshopTodoSource | undefined {
  if (turn.artifact === 'tool_report' && turn.toolId) {
    return {
      kind: 'tool_report',
      turnId: turn.id,
      participantLabel: turn.toolLabel ?? workshopToolLabel(turn.toolId),
      toolId: turn.toolId,
      findingKey: finding.key,
      findingText: finding.text,
      excerptVersion: turn.excerptVersion
    };
  }
  if (!turn.personaId) {
    return undefined;
  }
  const participantLabel = turn.personaLabel ?? workshopPersonaLabel(turn.personaId);
  if (turn.participant === 'host') {
    return {
      kind: 'host_turn',
      turnId: turn.id,
      participantLabel,
      personaId: turn.personaId,
      // Absent rather than undefined, so the live source matches its saved form.
      ...(turn.reportTurnId === undefined ? {} : { upstreamReportTurnId: turn.reportTurnId }),
      findingKey: finding.key,
      findingText: finding.text,
      excerptVersion: turn.excerptVersion
    };
  }
  if (turn.participant === 'guest') {
    return {
      kind: 'guest_turn',
      turnId: turn.id,
      participantLabel,
      personaId: turn.personaId,
      findingKey: finding.key,
      findingText: finding.text,
      excerptVersion: turn.excerptVersion
    };
  }
  return undefined;
}

export class WorkshopTodoLedger {
  private counter = 0;
  private todos: WorkshopStoredTodoItemV1[] = [];

  constructor(private readonly now: () => number) {}

  addFromFinding(
    sourceTurn: WorkshopTurn | undefined,
    findingKey: string,
    excerptVersion: number
  ): WorkshopTodoItem {
    const finding = sourceTurn?.actionableFindings?.find(
      (candidate) => candidate.key === findingKey
    );
    const source = sourceTurn && finding ? findingSource(sourceTurn, finding) : undefined;
    if (!sourceTurn || !finding || !source) {
      throw new Error('Cannot add a task from an unknown actionable finding');
    }
    if (sourceTurn.excerptVersion !== excerptVersion) {
      throw new Error('Cannot add a task from a stale excerpt turn');
    }
    const existing = this.todos.find(
      (todo) => todo.source.turnId === sourceTurn.id && todo.source.findingKey === findingKey
    );
    if (existing) {
      return cloneTodo(existing, excerptVersion);
    }
    if (this.todos.length >= WORKSHOP_TODO_BOUNDS.items) {
      throw new Error(`Workshop task list is limited to ${WORKSHOP_TODO_BOUNDS.items} items`);
    }

    const todo: WorkshopStoredTodoItemV1 = {
      id: `todo-${++this.counter}-${this.now()}`,
      text: finding.text,
      status: 'open',
      priority: finding.priority,
      source,
      createdAt: this.now()
    };
    this.todos.push(todo);
    return cloneTodo(todo, excerptVersion);
  }

  edit(todoId: string, text: string, excerptVersion: number): WorkshopTodoItem {
    const todo = this.requireTodo(todoId);
    const normalized = text.trim();
    if (
      normalized.length === 0
      || normalized.length > WORKSHOP_TODO_BOUNDS.textCharacters
    ) {
      throw new Error(
        `Task text must contain 1–${WORKSHOP_TODO_BOUNDS.textCharacters} characters`
      );
    }
    if (normalized !== todo.text) {
      todo.text = normalized;
      todo.writerEdit = {
        originalText: todo.writerEdit?.originalText ?? todo.source.findingText,
        editedAt: this.now()
      };
    }
    return cloneTodo(todo, excerptVersion);
  }

  setStatus(
    todoId: string,
    status: WorkshopTodoItem['status'],
    excerptVersion: number
  ): WorkshopTodoItem {
    const todo = this.requireTodo(todoId);
    todo.status = status;
    return cloneTodo(todo, excerptVersion);
  }

  reorder(todoId: string, direction: 'up' | 'down'): void {
    const index = this.todos.findIndex((todo) => todo.id === todoId);
    if (index < 0) {
      throw new Error('Unknown Workshop task');
    }
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= this.todos.length) {
      return;
    }
    [this.todos[index], this.todos[target]] = [this.todos[target], this.todos[index]];
  }

  list(excerptVersion: number): WorkshopTodoItem[] {
    return this.todos.map((todo) => cloneTodo(todo, excerptVersion));
  }

  collectOpen(excerptVersion: number): WorkshopTodoItem[] {
    return this.todos
      .filter(
        (todo) => todo.status === 'open' && todo.source.excerptVersion === excerptVersion
      )
      .map((todo) => cloneTodo(todo, excerptVersion));
  }

  exportState(): WorkshopTodoLedgerState {
    return {
      counter: this.counter,
      todos: this.todos.map(cloneStoredTodo)
    };
  }

  /** Complete every potentially throwing clone before aggregate installation. */
  prepareState(state: WorkshopTodoLedgerState): WorkshopTodoLedgerState {
    return {
      counter: state.counter,
      todos: state.todos.map(cloneStoredTodo)
    };
  }

  /** Install state produced by this ledger's prepare phase; this must not throw. */
  installPreparedState(state: WorkshopTodoLedgerState): void {
    this.counter = state.counter;
    this.todos = state.todos;
  }

  /**
   * A room reset clears its task rows but does not rewind task identity. This
   * preserves the aggregate's existing no-id-reuse behavior for its lifetime.
   */
  reset(): void {
    this.todos = [];
  }

  private requireTodo(todoId: string): WorkshopStoredTodoItemV1 {
    const todo = this.todos.find((candidate) => candidate.id === todoId);
    if (!todo) {
      throw new Error('Unknown Workshop task');
    }
    return todo;
  }
}
