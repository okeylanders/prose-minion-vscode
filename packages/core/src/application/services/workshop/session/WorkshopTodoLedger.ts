/**
 * Session-owned ledger for writer-promoted Workshop tasks.
 *
 * The ledger owns task identity, ordering, editing, status, bounds, and
 * immutable finding provenance. Excerpt version is owned by
 * `WorkshopPassageScope`; the aggregate supplies it to every operation that
 * derives staleness. It is never cached here.
 */

import {
  WorkshopTodoItem,
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
    const isToolReport = sourceTurn?.artifact === 'tool_report' && !!sourceTurn.toolId;
    const isPersonaTurn =
      (sourceTurn?.participant === 'host' || sourceTurn?.participant === 'guest')
      && !!sourceTurn.personaId;
    if (!sourceTurn || (!isToolReport && !isPersonaTurn) || !finding) {
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

    const source: WorkshopTodoItem['source'] = isToolReport
      ? {
          kind: 'tool_report',
          turnId: sourceTurn.id,
          participantLabel: sourceTurn.toolLabel ?? workshopToolLabel(sourceTurn.toolId!),
          toolId: sourceTurn.toolId!,
          findingKey,
          findingText: finding.text,
          excerptVersion: sourceTurn.excerptVersion
        }
      : {
          kind: sourceTurn.participant === 'host' ? 'host_turn' : 'guest_turn',
          turnId: sourceTurn.id,
          participantLabel:
            sourceTurn.personaLabel ?? workshopPersonaLabel(sourceTurn.personaId!),
          personaId: sourceTurn.personaId!,
          upstreamReportTurnId: sourceTurn.reportTurnId,
          findingKey,
          findingText: finding.text,
          excerptVersion: sourceTurn.excerptVersion
        };
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
