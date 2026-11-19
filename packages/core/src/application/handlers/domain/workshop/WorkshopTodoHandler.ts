import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { MessageRouter } from '@handlers/MessageRouter';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopTodoActionMessage,
  type WorkshopTodoStatusUndoRefusal,
  type WorkshopTodoStatusUndoResultMessage,
  type WorkshopUndoTodoStatusMessage,
  type WorkshopUndoTodoStatusPayload
} from '@messages';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopTodoStatusWrites } from '@/application/services/workshop/todos/WorkshopTodoStatusWrites';
import {
  WORKSHOP_TODO_STATUS_UNDO_REFUSAL_WORDS,
  WORKSHOP_TODO_STATUS_UNDONE_WORDS
} from '@shared/constants/workshopTodoStatusWords';
import type {
  WorkshopMutationRouteRegistrar,
  WorkshopRoomEffects
} from '@handlers/domain/workshop/WorkshopRouteContracts';

type WorkshopTodoEffects = Pick<
  WorkshopRoomEffects,
  'postSessionState' | 'markDirty' | 'reportError'
>;

/**
 * Owns the Workshop task-list mutation route and its action grammar, and
 * the writer's Undo of a persona's change (ADR 2026-11-19 D8): ids only in,
 * an answer by `requestId` out. A persona's saved-session writes are its
 * `writes`' (`WorkshopTodoStatusWrites`).
 */
export class WorkshopTodoHandler {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly outputChannel: LogSink,
    private readonly effects: WorkshopTodoEffects,
    private readonly writes?: WorkshopTodoStatusWrites,
    private readonly postMessage?: MessageTransport
  ) {}

  registerRoutes(
    router: MessageRouter,
    registerMutation: WorkshopMutationRouteRegistrar
  ): void {
    registerMutation(MessageType.WORKSHOP_TODO_ACTION, this.handleTodoAction.bind(this));
    registerMutation(MessageType.WORKSHOP_UNDO_TODO_STATUS, this.handleUndoTodoStatus.bind(this), undefined,
      (_reason, message: WorkshopUndoTodoStatusMessage) => {
        const payload = undoPayloadOf(message.payload);
        if (payload) {
          this.answerUndo(payload, { ok: false, reason: 'session-operation' });
        }
      });
  }

  async handleUndoTodoStatus(message: WorkshopUndoTodoStatusMessage): Promise<void> {
    const payload = undoPayloadOf(message.payload);
    if (!payload) {
      this.effects.reportError(WORKSHOP_TODO_STATUS_UNDO_REFUSAL_WORDS['invalid-request']);
      return;
    }
    let outcome: { ok: true } | { ok: false; reason: WorkshopTodoStatusUndoRefusal };
    try {
      outcome = this.writes ? await this.writes.undo(payload.turnId, payload.index, payload.roomRevision) : { ok: false, reason: 'failed' };
    } catch (error) {
      this.outputChannel.appendLine(`[WorkshopTodoHandler] To-do undo failed (turnId=${payload.turnId}, index=${payload.index}, reason=${error instanceof Error ? error.name : 'unknown'})`);
      outcome = { ok: false, reason: 'failed' };
    }
    this.outputChannel.appendLine(
      `[WorkshopTodoHandler] To-do undo ${outcome.ok ? 'applied' : `refused reason=${outcome.reason}`} (turnId=${payload.turnId}, index=${payload.index})`
    );
    if (outcome.ok) {
      this.effects.markDirty('persona to-do change undone');
      this.effects.postSessionState();
    }
    this.answerUndo(payload, outcome);
  }

  private answerUndo(payload: WorkshopUndoTodoStatusPayload, outcome: { ok: true } | { ok: false; reason: WorkshopTodoStatusUndoRefusal }): void {
    const answer: WorkshopTodoStatusUndoResultMessage = {
      type: MessageType.WORKSHOP_TODO_STATUS_UNDO_RESULT,
      source: 'extension.workshop',
      payload: {
        requestId: payload.requestId,
        turnId: payload.turnId,
        index: payload.index,
        ok: outcome.ok,
        ...(outcome.ok ? {} : { reason: outcome.reason }),
        message: outcome.ok ? WORKSHOP_TODO_STATUS_UNDONE_WORDS : WORKSHOP_TODO_STATUS_UNDO_REFUSAL_WORDS[outcome.reason]
      },
      timestamp: Date.now()
    };
    void this.postMessage?.(answer);
  }

  async handleTodoAction(message: WorkshopTodoActionMessage): Promise<void> {
    const action = message.payload;
    let apply: () => void;
    let target: string;
    switch (action?.action) {
      case 'add':
        if (typeof action.sourceTurnId !== 'string' || typeof action.findingKey !== 'string') {
          this.effects.reportError('Task source must identify a turn and finding');
          return;
        }
        apply = () => this.session.addTodoFromFinding(action.sourceTurnId, action.findingKey);
        target = `sourceTurnId=${action.sourceTurnId}, findingKey=${action.findingKey}`;
        break;
      case 'edit':
        if (typeof action.todoId !== 'string' || typeof action.text !== 'string') {
          this.effects.reportError('Task edit must include an id and text');
          return;
        }
        apply = () => this.session.editTodo(action.todoId, action.text);
        target = `todoId=${action.todoId}`;
        break;
      case 'complete':
        if (typeof action.todoId !== 'string') {
          this.effects.reportError('Task action must include an id');
          return;
        }
        apply = () => this.session.setTodoStatus(action.todoId, 'completed');
        target = `todoId=${action.todoId}`;
        break;
      case 'reopen':
        if (typeof action.todoId !== 'string') {
          this.effects.reportError('Task action must include an id');
          return;
        }
        apply = () => this.session.setTodoStatus(action.todoId, 'open');
        target = `todoId=${action.todoId}`;
        break;
      case 'dismiss':
        if (typeof action.todoId !== 'string') {
          this.effects.reportError('Task action must include an id');
          return;
        }
        apply = () => this.session.setTodoStatus(action.todoId, 'dismissed');
        target = `todoId=${action.todoId}`;
        break;
      case 'reorder':
        if (
          typeof action.todoId !== 'string' ||
          (action.direction !== 'up' && action.direction !== 'down')
        ) {
          this.effects.reportError('Task reorder must include an id and direction');
          return;
        }
        apply = () => this.session.reorderTodo(action.todoId, action.direction);
        target = `todoId=${action.todoId}, direction=${action.direction}`;
        break;
      default:
        this.effects.reportError('Unknown Workshop task action');
        return;
    }
    try {
      apply();
      this.outputChannel.appendLine(
        `[WorkshopTodoHandler] Task action applied (${action.action}, ${target}, source=${message.source})`
      );
      this.effects.markDirty('task action committed');
      this.effects.postSessionState();
    } catch (error) {
      this.effects.reportError(
        error instanceof Error ? error.message : 'Could not update Workshop task'
      );
    }
  }
}

function undoPayloadOf(value: unknown): WorkshopUndoTodoStatusPayload | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const payload = value as Record<string, unknown>;
  return typeof payload.requestId === 'string' && payload.requestId.length > 0 && payload.requestId.length <= 200
    && typeof payload.roomRevision === 'number' && Number.isSafeInteger(payload.roomRevision)
    && typeof payload.turnId === 'string' && payload.turnId.length > 0 && payload.turnId.length <= 200
    && typeof payload.index === 'number' && Number.isSafeInteger(payload.index) && payload.index >= 0
    ? { requestId: payload.requestId, roomRevision: payload.roomRevision, turnId: payload.turnId, index: payload.index }
    : undefined;
}
