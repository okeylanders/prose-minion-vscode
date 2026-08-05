import { MessageRouter } from '@/application/handlers/MessageRouter';
import { WorkshopExcerptScopeHandler } from '@handlers/domain/workshop/WorkshopExcerptScopeHandler';
import type {
  WorkshopMutationRouteRegistrar
} from '@handlers/domain/workshop/WorkshopHandlerContracts';
import { MessageType } from '@messages';

const message = (type: MessageType, payload: unknown) => ({
  type,
  source: 'webview.workshop',
  payload,
  timestamp: 1
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('WorkshopExcerptScopeHandler', () => {
  let router: MessageRouter;
  let runRefusal: string | undefined;
  let session: {
    replaceExcerpt: jest.Mock;
    collectPendingHostUpdates: jest.Mock;
    getExcerpt: jest.Mock;
    setSessionScope: jest.Mock;
    repinShelvedExcerpt: jest.Mock;
  };
  let shell: { pickFile: jest.Mock };
  let intake: {
    openCatalog: jest.Mock;
    toDisplayPath: jest.Mock;
    loadFile: jest.Mock;
    describeConfiguredResourceFailure: jest.Mock;
    matchConfiguredSource: jest.Mock;
  };
  let log: { appendLine: jest.Mock };
  let effects: {
    postSessionState: jest.Mock;
    postTurn: jest.Mock;
    markDirty: jest.Mock;
    reportError: jest.Mock;
    sendStatus: jest.Mock;
    discardConversations: jest.Mock;
  };

  beforeEach(() => {
    router = new MessageRouter();
    runRefusal = undefined;
    session = {
      replaceExcerpt: jest.fn().mockReturnValue({
        excerpt: {
          text: 'Replacement excerpt.',
          version: 1,
          source: { kind: 'manual' },
          pinnedAt: 1
        },
        disposedConversationIds: [],
        retiredSidecarCount: 0,
        replacementCount: 0
      }),
      collectPendingHostUpdates: jest.fn(),
      getExcerpt: jest.fn(),
      setSessionScope: jest.fn(),
      repinShelvedExcerpt: jest.fn()
    };
    shell = { pickFile: jest.fn() };
    intake = {
      openCatalog: jest.fn(),
      toDisplayPath: jest.fn((value: string) => value),
      loadFile: jest.fn(),
      describeConfiguredResourceFailure: jest.fn(),
      matchConfiguredSource: jest.fn(async (source) => (
        source.kind === 'manual'
          ? { kind: 'manual', source }
          : { kind: 'unmatched', source }
      ))
    };
    log = { appendLine: jest.fn() };
    effects = {
      postSessionState: jest.fn(),
      postTurn: jest.fn(),
      markDirty: jest.fn(),
      reportError: jest.fn(),
      sendStatus: jest.fn(),
      discardConversations: jest.fn()
    };

    const handler = new WorkshopExcerptScopeHandler(
      session as never,
      shell as never,
      intake as never,
      log as never,
      { excerptMutationBlockedReason: () => runRefusal },
      effects
    );
    const registerMutation: WorkshopMutationRouteRegistrar = (type, route) => {
      router.register(type, route as never);
    };
    handler.registerRoutes(registerMutation);
  });

  it('registers exactly the six excerpt and scope mutation routes', () => {
    expect(router.getRegisteredTypes()).toEqual([
      MessageType.WORKSHOP_SET_EXCERPT,
      MessageType.WORKSHOP_SET_EXCERPT_RESOURCE,
      MessageType.WORKSHOP_PICK_EXCERPT_FILE,
      MessageType.WORKSHOP_REREAD_EXCERPT,
      MessageType.WORKSHOP_SET_SESSION_SCOPE,
      MessageType.WORKSHOP_REPIN_EXCERPT
    ]);
  });

  it('re-checks the run gate after configured-resource loading before replacing', async () => {
    const loading = deferred<{
      kind: 'loaded';
      resource: {
        summary: {
          group: 'characters';
          path: string;
          label: string;
          sizeBytes: number;
          absolutePath: string;
        };
        text: string;
        words: number;
        sourceFingerprint: string;
      };
    }>();
    const load = jest.fn(() => loading.promise);
    intake.openCatalog.mockResolvedValue({ load });

    const routed = router.route(message(MessageType.WORKSHOP_SET_EXCERPT_RESOURCE, {
      group: 'characters',
      path: 'Characters/raven.md'
    }) as never);
    await Promise.resolve();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);

    runRefusal = 'A tool started while the catalog was loading.';
    loading.resolve({
      kind: 'loaded',
      resource: {
        summary: {
          group: 'characters',
          path: 'Characters/raven.md',
          label: 'raven',
          sizeBytes: 120,
          absolutePath: '/workspace/Characters/raven.md'
        },
        text: 'Raven keeps the marked token.',
        words: 5,
        sourceFingerprint: 'fingerprint-1'
      }
    });
    await routed;

    expect(effects.reportError).toHaveBeenCalledWith(runRefusal);
    expect(session.replaceExcerpt).not.toHaveBeenCalled();
    expect(effects.markDirty).not.toHaveBeenCalled();
    expect(effects.postSessionState).not.toHaveBeenCalled();
  });

  it('reports the injected wizard refusal without consulting intake or mutating the session', async () => {
    runRefusal =
      'The Context wizard is still running. Wait for it to finish or cancel it before replacing the excerpt.';

    await router.route(message(MessageType.WORKSHOP_SET_EXCERPT, {
      text: 'A valid passage.',
      source: { kind: 'manual' }
    }) as never);

    expect(effects.reportError).toHaveBeenCalledWith(runRefusal);
    expect(intake.matchConfiguredSource).not.toHaveBeenCalled();
    expect(session.replaceExcerpt).not.toHaveBeenCalled();
    expect(effects.postSessionState).not.toHaveBeenCalled();
  });

  it('reconciles an idempotent scope request without marking the session dirty', async () => {
    session.setSessionScope.mockReturnValue({
      scope: 'open',
      changed: false,
      excerpt: undefined,
      shelvedExcerpt: undefined
    });

    await router.route(message(MessageType.WORKSHOP_SET_SESSION_SCOPE, { scope: 'open' }) as never);

    expect(session.setSessionScope).toHaveBeenCalledWith('open');
    expect(effects.postSessionState).toHaveBeenCalledTimes(1);
    expect(effects.markDirty).not.toHaveBeenCalled();
    expect(log.appendLine).not.toHaveBeenCalled();
  });

  it('marks and publishes a changed scope transition', async () => {
    session.setSessionScope.mockReturnValue({
      scope: 'open',
      changed: true,
      excerpt: undefined,
      shelvedExcerpt: {
        text: 'Shelved passage.',
        version: 2,
        source: { kind: 'manual' },
        pinnedAt: 1
      }
    });

    await router.route(message(MessageType.WORKSHOP_SET_SESSION_SCOPE, { scope: 'open' }) as never);

    expect(effects.markDirty).toHaveBeenCalledWith('session scope set to open conversation');
    expect(effects.postSessionState).toHaveBeenCalledTimes(1);
    expect(log.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('scope=open, excerpt=none, shelved=v2')
    );
  });

  it('no-ops a file re-read when the source fingerprint is unchanged', async () => {
    session.getExcerpt.mockReturnValue({
      text: 'The same passage.',
      version: 4,
      source: {
        kind: 'file',
        sourceUri: 'file:///workspace/chapters/04.md',
        relativePath: 'chapters/04.md'
      },
      sourceFingerprint: 'same-fingerprint',
      pinnedAt: 1
    });
    intake.loadFile.mockResolvedValue({
      kind: 'loaded',
      file: {
        text: 'The same passage.',
        words: 3,
        sourceFingerprint: 'same-fingerprint'
      }
    });

    await router.route(message(MessageType.WORKSHOP_REREAD_EXCERPT, {}) as never);

    expect(intake.loadFile).toHaveBeenCalledWith(
      '/workspace/chapters/04.md',
      'chapters/04.md',
      expect.any(Object),
      'pin'
    );
    expect(effects.sendStatus).toHaveBeenCalledWith(
      'Excerpt unchanged on disk · chapters/04.md'
    );
    expect(intake.matchConfiguredSource).not.toHaveBeenCalled();
    expect(session.replaceExcerpt).not.toHaveBeenCalled();
    expect(effects.markDirty).not.toHaveBeenCalled();
  });
});
