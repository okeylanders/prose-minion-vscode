import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { LogSink } from '@/platform';
import { MessageType, WorkshopTodoActionMessage } from '@messages';
import type {
  WorkshopMutationRouteRegistrar,
  WorkshopRoomEffects
} from '@handlers/domain/workshop/WorkshopHandlerContracts';

type WorkshopTodoEffects = Pick<
  WorkshopRoomEffects,
  'postSessionState' | 'markDirty' | 'reportError'
>;

/** Owns the Workshop task-list mutation route and its action grammar. */
export class WorkshopTodoHandler {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly outputChannel: LogSink,
    private readonly effects: WorkshopTodoEffects
  ) {}

  registerRoutes(registerMutation: WorkshopMutationRouteRegistrar): void {
    registerMutation(MessageType.WORKSHOP_TODO_ACTION, this.handleTodoAction.bind(this));
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
