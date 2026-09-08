import { MessageRouter } from '@/application/handlers/MessageRouter';
import { WorkshopContextHandler } from '@handlers/domain/workshop/WorkshopContextHandler';
import type {
  WorkshopMutationRouteRegistrar,
  WorkshopRoomEffects
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { MessageType } from '@messages';
import type { LogSink, ShellService } from '@/platform';
import {
  createFakeFileSystem,
  createFakeShellService,
  createFakeWorkspace
} from '../../../../mocks/platform';

const MUTATION_ROUTES = [
  MessageType.WORKSHOP_ADD_CONTEXT_TEXT,
  MessageType.WORKSHOP_ADD_CONTEXT_FILE,
  MessageType.WORKSHOP_REFRESH_CONTEXT_FILES,
  MessageType.WORKSHOP_REMOVE_CONTEXT_ATTACHMENT,
  MessageType.WORKSHOP_UPDATE_CONTEXT_TEXT,
  MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES,
  MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES,
  MessageType.WORKSHOP_ATTACH_MESSAGE_FILE,
  MessageType.WORKSHOP_REMOVE_MESSAGE_ATTACHMENT,
  MessageType.WORKSHOP_RUN_CONTEXT_WIZARD
] as const;

const READ_ROUTES = [
  MessageType.WORKSHOP_REQUEST_CONTEXT_ATTACHMENT,
  MessageType.WORKSHOP_OPEN_CONTEXT_ATTACHMENT_FILE,
  MessageType.WORKSHOP_REQUEST_CONTEXT_CATALOG,
  MessageType.WORKSHOP_SEARCH_CONTEXT_RESOURCES
] as const;

const ALL_ROUTES = [...MUTATION_ROUTES, ...READ_ROUTES];

const message = (type: MessageType, payload: unknown = {}) => ({
  type,
  source: 'webview.workshop' as const,
  payload,
  timestamp: 1
});

const wizardResult = () => ({
  toolName: 'context_assistant',
  content: '',
  timestamp: new Date(0),
  requestedResources: []
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('WorkshopContextHandler', () => {
  let router: MessageRouter;
  let handler: WorkshopContextHandler;
  let session: WorkshopSessionService;
  let contextAssistant: { generateContext: jest.Mock };
  let postMessage: jest.Mock;
  let shell: ShellService;
  let log: LogSink;
  let effects: jest.Mocked<WorkshopRoomEffects>;
  let registerMutation: jest.MockedFunction<WorkshopMutationRouteRegistrar>;
  let contextFiles: Record<string, string>;

  const posted = (type: MessageType) => postMessage.mock.calls
    .map(([entry]) => entry)
    .filter((entry) => entry.type === type);

  const pinExcerpt = () => {
    session.setExcerpt({
      text: 'A pinned excerpt.',
      source: { kind: 'manual' }
    });
  };

  const runWizard = () => router.route(
    message(MessageType.WORKSHOP_RUN_CONTEXT_WIZARD) as never
  );

  beforeEach(() => {
    router = new MessageRouter();
    session = new WorkshopSessionService(() => 1);
    contextAssistant = {
      generateContext: jest.fn().mockResolvedValue(wizardResult())
    };
    postMessage = jest.fn().mockResolvedValue(undefined);
    shell = createFakeShellService();
    log = { appendLine: jest.fn() } as unknown as LogSink;
    contextFiles = {};
    effects = {
      postSessionState: jest.fn(),
      postTurn: jest.fn(),
      markDirty: jest.fn(),
      reportError: jest.fn(),
      sendStatus: jest.fn(),
      discardConversations: jest.fn()
    };
    const intake = new WorkshopContextIntakeService(
      {
        createProvider: jest.fn().mockResolvedValue({
          listResources: () => [],
          loadResources: async () => []
        })
      } as never,
      createFakeFileSystem({}, contextFiles),
      createFakeWorkspace({
        workspaceFolders: () => [{ path: '/workspace', name: 'workspace' }],
        asRelativePath: (filePath) => filePath.replace('/workspace/', '')
      })
    );
    handler = new WorkshopContextHandler(
      contextAssistant as never,
      session,
      shell,
      intake,
      postMessage,
      log,
      effects
    );
    registerMutation = jest.fn((type, route) => {
      router.register(type, route as never);
    });
    handler.registerRoutes(router, registerMutation);
  });

  it('owns exactly fourteen routes and keeps reads outside the mutation registrar', () => {
    expect(router.handlerCount).toBe(14);
    expect(new Set(router.getRegisteredTypes())).toEqual(new Set(ALL_ROUTES));

    const mutationRegistrations = registerMutation.mock.calls.map(([type]) => type);
    expect(registerMutation).toHaveBeenCalledTimes(10);
    expect(new Set(mutationRegistrations)).toEqual(new Set(MUTATION_ROUTES));
    expect(mutationRegistrations).toEqual(expect.not.arrayContaining(READ_ROUTES));

    for (const readRoute of READ_ROUTES) {
      expect(router.hasHandler(readRoute)).toBe(true);
    }
  });

  it('refreshes a wizard-picked file from its on-disk source without making it editable', async () => {
    contextFiles['/workspace/voice-guide.md'] = 'Fresh source text.';
    session.addContextAttachment({
      kind: 'file',
      origin: 'wizard',
      label: 'voice-guide.md',
      words: 2,
      content: 'Old copy.',
      sourceUri: 'file:///workspace/voice-guide.md',
      relativePath: 'voice-guide.md'
    });

    await router.route(message(MessageType.WORKSHOP_REFRESH_CONTEXT_FILES) as never);

    expect(session.getContextAttachment('ctx-1')).toMatchObject({
      origin: 'wizard',
      content: 'Fresh source text.',
      words: 3
    });
    expect(effects.markDirty).toHaveBeenCalledWith('context files refreshed');
    expect(effects.postSessionState).toHaveBeenCalled();
  });

  it('keeps the wizard slot occupied after cancellation until the original run settles', async () => {
    pinExcerpt();
    const firstResult = deferred<ReturnType<typeof wizardResult>>();
    contextAssistant.generateContext.mockReturnValueOnce(firstResult.promise);

    const firstRun = runWizard();
    const started = posted(MessageType.STREAM_STARTED).at(-1);
    const requestId = started.payload.requestId as string;
    const firstSignal = contextAssistant.generateContext.mock.calls[0][1].signal as AbortSignal;

    expect(handler.cancelRun(requestId)).toBe(true);
    expect(firstSignal.aborted).toBe(true);
    expect(handler.isRunning()).toBe(true);

    await runWizard();

    expect(contextAssistant.generateContext).toHaveBeenCalledTimes(1);
    expect(effects.reportError).toHaveBeenLastCalledWith(
      'The Context wizard is already running — one run at a time.'
    );
    expect(handler.isRunning()).toBe(true);

    firstResult.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
    await firstRun;

    expect(handler.isRunning()).toBe(false);
    await runWizard();
    expect(contextAssistant.generateContext).toHaveBeenCalledTimes(2);
  });

  it('ignores a mismatched cancellation request without aborting the active run', async () => {
    pinExcerpt();
    const result = deferred<ReturnType<typeof wizardResult>>();
    let signal!: AbortSignal;
    contextAssistant.generateContext.mockImplementationOnce(
      (_input: unknown, options: { signal: AbortSignal }) => {
        signal = options.signal;
        return result.promise;
      }
    );

    const run = runWizard();

    expect(handler.cancelRun('some-other-request')).toBe(false);
    expect(signal.aborted).toBe(false);
    expect(handler.isRunning()).toBe(true);

    result.resolve(wizardResult());
    await run;
    expect(handler.isRunning()).toBe(false);
  });

  it('dispose aborts and clears immediately without letting the old finally clear a newer run', async () => {
    pinExcerpt();
    const firstResult = deferred<ReturnType<typeof wizardResult>>();
    const secondResult = deferred<ReturnType<typeof wizardResult>>();
    const signals: AbortSignal[] = [];
    contextAssistant.generateContext
      .mockImplementationOnce((_input: unknown, options: { signal: AbortSignal }) => {
        signals.push(options.signal);
        return firstResult.promise;
      })
      .mockImplementationOnce((_input: unknown, options: { signal: AbortSignal }) => {
        signals.push(options.signal);
        return secondResult.promise;
      });

    const firstRun = runWizard();
    handler.dispose();

    expect(signals[0].aborted).toBe(true);
    expect(handler.isRunning()).toBe(false);

    const secondRun = runWizard();
    expect(contextAssistant.generateContext).toHaveBeenCalledTimes(2);
    expect(handler.isRunning()).toBe(true);

    firstResult.reject(Object.assign(new Error('disposed'), { name: 'AbortError' }));
    await firstRun;
    expect(handler.isRunning()).toBe(true);

    secondResult.resolve(wizardResult());
    await secondRun;
    expect(handler.isRunning()).toBe(false);
  });
});
