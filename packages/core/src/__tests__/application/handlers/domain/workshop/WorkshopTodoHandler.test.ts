import { MessageRouter } from '@/application/handlers/MessageRouter';
import { WorkshopTodoHandler } from '@handlers/domain/workshop/WorkshopTodoHandler';
import type {
  WorkshopMutationRouteRegistrar
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import { MessageType, WorkshopTodoActionMessage } from '@messages';

const message = (
  payload: WorkshopTodoActionMessage['payload']
): WorkshopTodoActionMessage => ({
  type: MessageType.WORKSHOP_TODO_ACTION,
  source: 'webview.workshop',
  payload,
  timestamp: 1
});

describe('WorkshopTodoHandler', () => {
  let router: MessageRouter;
  let session: {
    addTodoFromFinding: jest.Mock;
    editTodo: jest.Mock;
    setTodoStatus: jest.Mock;
    reorderTodo: jest.Mock;
  };
  let effects: {
    postSessionState: jest.Mock;
    markDirty: jest.Mock;
    reportError: jest.Mock;
  };

  beforeEach(() => {
    router = new MessageRouter();
    session = {
      addTodoFromFinding: jest.fn(),
      editTodo: jest.fn(),
      setTodoStatus: jest.fn(),
      reorderTodo: jest.fn()
    };
    effects = {
      postSessionState: jest.fn(),
      markDirty: jest.fn(),
      reportError: jest.fn()
    };
    const handler = new WorkshopTodoHandler(
      session as never,
      { appendLine: jest.fn() } as never,
      effects
    );
    const registerMutation: WorkshopMutationRouteRegistrar = (type, route) => {
      router.register(type, route as never);
    };
    handler.registerRoutes(router, registerMutation);
  });

  it('routes a valid task edit through the owner and publishes the committed state', async () => {
    await router.route(message({ action: 'edit', todoId: 'todo-1', text: 'Sharpen the turn.' }));

    expect(session.editTodo).toHaveBeenCalledWith('todo-1', 'Sharpen the turn.');
    expect(effects.markDirty).toHaveBeenCalledWith('task action committed');
    expect(effects.postSessionState).toHaveBeenCalledTimes(1);
    expect(effects.reportError).not.toHaveBeenCalled();
  });

  it('keeps invalid task grammar out of the aggregate', async () => {
    await router.route(message({ action: 'complete', todoId: undefined as never }));

    expect(session.setTodoStatus).not.toHaveBeenCalled();
    expect(effects.reportError).toHaveBeenCalledWith('Task action must include an id');
    expect(effects.markDirty).not.toHaveBeenCalled();
  });

  it('reports aggregate failures without publishing a dirty snapshot', async () => {
    session.reorderTodo.mockImplementation(() => {
      throw new Error('Task is already first');
    });

    await router.route(message({ action: 'reorder', todoId: 'todo-1', direction: 'up' }));

    expect(effects.reportError).toHaveBeenCalledWith('Task is already first');
    expect(effects.markDirty).not.toHaveBeenCalled();
    expect(effects.postSessionState).not.toHaveBeenCalled();
  });
});
