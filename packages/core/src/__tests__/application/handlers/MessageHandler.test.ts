import { MessageHandler } from '@/application/handlers/MessageHandler';
import { CoreServices } from '@/application/handlers/MessageHandlerContracts';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { RunWorkshopToolSidePass } from '@/application/services/workshop/RunWorkshopToolSidePass';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  ExtensionToWebviewMessage,
  MessageType,
  TokenUsageTotals,
  WebviewToExtensionMessage
} from '@messages';
import {
  LogSink,
  Platform,
  SecretStore
} from '@/platform';
import {
  createFakeEditorContext,
  createFakeFileSystem,
  createFakeSettings,
  createFakeShellService,
  createFakeWorkspace
} from '../../mocks/platform';

type TokenUsageCallback = (usage: TokenUsageTotals) => void;
const flushQueuedWork = (): Promise<void> =>
  new Promise(resolve => setImmediate(resolve));

interface TestAssembly {
  services: CoreServices;
  platform: Platform;
  log: LogSink;
  scheduleRefresh: jest.Mock;
  getBalances: jest.Mock;
  accountAddRefreshListener: jest.Mock;
  disposeBalanceListener: jest.Mock;
  disposeSecretListener: jest.Mock;
  secretOnDidChange: jest.Mock;
  accountDispose: jest.Mock;
  categoryAddStatusListener: jest.Mock;
  disposeCategoryStatusListener: jest.Mock;
  disposeDictionaryStatusListener: jest.Mock;
  /** Fan a token-usage event out to every LIVE registration (real Set). */
  emitTokenUsage: (usage: TokenUsageTotals) => void;
  tokenUsageListenerCount: () => number;
}

function createTestAssembly(): TestAssembly {
  // A REAL listener set (not a single captured slot): the fakes must be able
  // to distinguish handler A's registration from handler B's, or the
  // dispose-blinds-the-survivor regression is structurally untestable
  // (PR #67 review #2, Cal).
  const tokenUsageListeners = new Set<TokenUsageCallback>();
  const tokenUsageResetListeners = new Set<() => void>();

  const log: LogSink = {
    appendLine: jest.fn(),
    show: jest.fn(),
    clear: jest.fn()
  };
  const secretStore: SecretStore = {
    get: jest.fn().mockResolvedValue(undefined),
    store: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    onDidChange: jest.fn(() => ({ dispose: jest.fn() }))
  };
  const platform: Platform = {
    log,
    secrets: secretStore,
    settings: createFakeSettings(),
    fileSystem: createFakeFileSystem(),
    workspace: createFakeWorkspace(),
    shell: createFakeShellService(),
    editor: createFakeEditorContext()
  };

  const scheduleRefresh = jest.fn();
  const getBalances = jest.fn().mockResolvedValue({
    openrouter: { status: 'no_key', creditsStatus: 'no_key' },
    fetchedAt: 123
  });
  const disposeBalanceListener = jest.fn();
  const accountAddRefreshListener = jest.fn(() => disposeBalanceListener);
  const disposeSecretListener = jest.fn();
  const secretOnDidChange = jest.fn(() => ({ dispose: disposeSecretListener }));
  const accountDispose = jest.fn();
  const categoryAddStatusListener = jest.fn(() => disposeCategoryStatusListener);
  const disposeCategoryStatusListener = jest.fn();
  const disposeDictionaryStatusListener = jest.fn();
  const assistantToolService = {
    // Registered twice per handler: AnalysisHandler + WorkshopHandler.
    addStatusListener: jest.fn(() => jest.fn()),
    getConversationContextBudget: jest.fn(),
    getConversationContextSources: jest.fn().mockReturnValue([]),
    refreshConfiguration: jest.fn().mockResolvedValue(undefined)
  } as unknown as AssistantToolService;
  const workshopSessionService = new WorkshopSessionService();

  const services = {
    assistantToolService,
    dictionaryService: {
      addStatusListener: jest.fn(() => disposeDictionaryStatusListener),
      refreshConfiguration: jest.fn().mockResolvedValue(undefined)
    },
    contextAssistantService: {
      refreshConfiguration: jest.fn().mockResolvedValue(undefined)
    },
    proseStatsService: {},
    styleFlagsService: {},
    wordFrequencyService: {},
    wordSearchService: {},
    standardsService: {
      getGenres: jest.fn().mockResolvedValue([])
    },
    aiResourceManager: {
      addTokenUsageListener: jest.fn((callback: TokenUsageCallback) => {
        tokenUsageListeners.add(callback);
        return () => {
          tokenUsageListeners.delete(callback);
        };
      }),
      addTokenUsageResetListener: jest.fn((callback: () => void) => {
        tokenUsageResetListeners.add(callback);
        return () => tokenUsageResetListeners.delete(callback);
      }),
      resetTokenUsage: jest.fn(() => {
        for (const callback of [...tokenUsageResetListeners]) {
          callback();
        }
      }),
      refreshModelSelections: jest.fn().mockResolvedValue(undefined),
      refreshConfiguration: jest.fn().mockResolvedValue(undefined)
    },
    secretsService: {
      getApiKey: jest.fn().mockResolvedValue(undefined),
      setApiKey: jest.fn().mockResolvedValue(undefined),
      deleteApiKey: jest.fn().mockResolvedValue(undefined),
      onDidChange: secretOnDidChange
    },
    textSourceResolver: {},
    categorySearchService: {
      addStatusListener: categoryAddStatusListener
    },
    accountBalanceService: {
      getBalances,
      scheduleRefresh,
      addRefreshListener: accountAddRefreshListener,
      dispose: accountDispose
    },
    // Real aggregate on purpose: it is pure/dependency-free, and using it makes
    // the reload-safety test below exercise true session behavior.
    workshopSessionService,
    workshopPersonaCapabilityFactory: {
      create: jest.fn(() => ({ catalog: 'workshopPersona' }))
    } as unknown as WorkshopPersonaCapabilityFactory,
    workshopToolSidePass: { run: jest.fn() } as unknown as RunWorkshopToolSidePass,
    workshopConversationSettingsService: {
      applyFromWebview: jest.fn().mockResolvedValue({ changed: false, deferred: false }),
      syncFromSettings: jest.fn().mockResolvedValue({ changed: false, deferred: false }),
      flushDeferredSettingsSync: jest.fn().mockResolvedValue({ changed: false, deferred: false }),
      getWriterProfile: jest.fn().mockReturnValue(DEFAULT_WORKSHOP_WRITER_PROFILE)
    },
    workshopSessionTimeService: new WorkshopSessionTimeService({
      now: () => new Date('2026-07-23T14:00:00.000Z'),
      timezone: 'America/Chicago'
    }),
    workshopSessionPersistenceCoordinator: {
      availability: jest.fn().mockReturnValue({
        available: true,
        rootPath: '/workspace',
        sessionsDirectory: '/workspace/prose-minion/sessions',
        currentPath: '/workspace/prose-minion/sessions/current.json'
      }),
      getDegradedConversationKeys: jest.fn().mockReturnValue([]),
      isCurrentCheckpointProtected: jest.fn().mockReturnValue(false),
      isSessionOperationPending: jest.fn().mockReturnValue(false),
      waitForSessionOperations: jest.fn().mockResolvedValue(undefined),
      markDirty: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn().mockResolvedValue({
        restored: false,
        degradedConversationKeys: []
      }),
      resetSession: jest.fn().mockResolvedValue(undefined)
    }
  } as unknown as CoreServices;

  return {
    services,
    platform,
    log,
    scheduleRefresh,
    getBalances,
    accountAddRefreshListener,
    disposeBalanceListener,
    accountDispose,
    disposeSecretListener,
    secretOnDidChange,
    categoryAddStatusListener,
    disposeCategoryStatusListener,
    disposeDictionaryStatusListener,
    emitTokenUsage: (usage) => {
      for (const listener of [...tokenUsageListeners]) {
        listener(usage);
      }
    },
    tokenUsageListenerCount: () => tokenUsageListeners.size
  };
}

function createHandler(
  assembly: TestAssembly,
  postMessage: jest.Mock
): MessageHandler {
  return new MessageHandler(
    assembly.services,
    postMessage as (message: ExtensionToWebviewMessage) => PromiseLike<unknown>,
    assembly.platform,
    assembly.log
  );
}

describe('MessageHandler assembly', () => {
  it('constructs entirely from injected services and routes account requests', async () => {
    const assembly = createTestAssembly();
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const handler = createHandler(assembly, postMessage);
    postMessage.mockClear();

    await handler.handleMessage({
      type: MessageType.REQUEST_ACCOUNT_BALANCE,
      source: 'webview.test',
      payload: { forceRefresh: true },
      timestamp: Date.now()
    });

    expect(assembly.getBalances).toHaveBeenCalledWith(true);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.ACCOUNT_BALANCE_DATA,
        source: 'extension.account'
      })
    );
    expect(assembly.categoryAddStatusListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('routes workshop messages (12th domain) and rehydrates a new handler from the shared session aggregate', async () => {
    const assembly = createTestAssembly();
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const handler = createHandler(assembly, postMessage);
    postMessage.mockClear();

    await handler.handleMessage({
      type: MessageType.WORKSHOP_SET_EXCERPT,
      source: 'webview.workshop',
      payload: { text: 'A line of prose worth keeping.' },
      timestamp: Date.now()
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.WORKSHOP_SESSION_STATE,
        source: 'extension.workshop',
        payload: expect.objectContaining({
          session: expect.objectContaining({
            excerpt: expect.objectContaining({ text: 'A line of prose worth keeping.' })
          })
        })
      })
    );

    // Panel closed and reopened: a SECOND handler over the SAME bundle serves
    // the same session back — the ADR's reload-safety criterion.
    const secondPost = jest.fn().mockResolvedValue(undefined);
    const second = createHandler(assembly, secondPost);
    secondPost.mockClear();

    await second.handleMessage({
      type: MessageType.WORKSHOP_REQUEST_SESSION,
      source: 'webview.workshop',
      payload: {},
      timestamp: Date.now()
    });

    expect(secondPost).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.WORKSHOP_SESSION_STATE,
        payload: expect.objectContaining({
          session: expect.objectContaining({
            excerpt: expect.objectContaining({ text: 'A line of prose worth keeping.' })
          })
        })
      })
    );
  });

  it('does not arm a balance refresh for activation/reset token updates', () => {
    const assembly = createTestAssembly();
    const postMessage = jest.fn().mockResolvedValue(undefined);
    createHandler(assembly, postMessage);

    expect(assembly.scheduleRefresh).not.toHaveBeenCalled();

    assembly.emitTokenUsage({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0
    });
    expect(assembly.scheduleRefresh).not.toHaveBeenCalled();

    assembly.emitTokenUsage({
      promptTokens: 3,
      completionTokens: 2,
      totalTokens: 5,
      costUsd: 0.001
    });
    expect(assembly.scheduleRefresh).toHaveBeenCalledTimes(1);
  });

  it('token usage fans out to BOTH live surfaces, and disposing one never blinds the survivor', () => {
    const assembly = createTestAssembly();
    const sidebarPost = jest.fn().mockResolvedValue(undefined);
    const workshopPost = jest.fn().mockResolvedValue(undefined);
    createHandler(assembly, sidebarPost); // the sidebar's handler
    const workshop = createHandler(assembly, workshopPost); // the panel's handler
    sidebarPost.mockClear();
    workshopPost.mockClear();

    const tokenUpdates = (post: jest.Mock) =>
      post.mock.calls.map((c) => c[0]).filter((m) => m.type === MessageType.TOKEN_USAGE_UPDATE);

    // One real request's usage reaches BOTH webviews — the load-bearing
    // multicast behavior itself (PR #67 review #2).
    assembly.emitTokenUsage({ promptTokens: 3, completionTokens: 2, totalTokens: 5, costUsd: 0.001 });
    expect(tokenUpdates(sidebarPost)).toHaveLength(1);
    expect(tokenUpdates(workshopPost)).toHaveLength(1);
    expect(assembly.tokenUsageListenerCount()).toBe(2);

    // Closing the Workshop panel releases ONLY its registration…
    workshop.dispose();
    expect(assembly.tokenUsageListenerCount()).toBe(1);
    sidebarPost.mockClear();
    workshopPost.mockClear();

    // …so the sidebar keeps receiving after the panel is gone.
    assembly.emitTokenUsage({ promptTokens: 1, completionTokens: 1, totalTokens: 2, costUsd: 0.0002 });
    expect(tokenUpdates(workshopPost)).toHaveLength(0);
    expect(tokenUpdates(sidebarPost)).toHaveLength(1);
  });

  it('keeps replay caches isolated between handler instances', async () => {
    const assembly = createTestAssembly();
    const firstPost = jest.fn().mockResolvedValue(undefined);
    const first = createHandler(assembly, firstPost);
    firstPost.mockClear();

    await first.handleMessage({
      type: 'not_registered'
    } as unknown as WebviewToExtensionMessage);
    expect(firstPost).toHaveBeenCalledWith(
      expect.objectContaining({ type: MessageType.ERROR })
    );

    const secondPost = jest.fn().mockResolvedValue(undefined);
    const second = createHandler(assembly, secondPost);
    secondPost.mockClear();
    second.flushCachedResults();

    expect(secondPost).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: MessageType.ERROR })
    );
  });

  it('detaches lifecycle callbacks and re-subscribes shared services for the next handler', () => {
    const assembly = createTestAssembly();
    const first = createHandler(
      assembly,
      jest.fn().mockResolvedValue(undefined)
    );

    first.dispose();

    // Dispose releases ONLY this instance's registrations…
    expect(assembly.disposeBalanceListener).toHaveBeenCalledTimes(1);
    expect(assembly.disposeSecretListener).toHaveBeenCalledTimes(1);
    expect(assembly.disposeDictionaryStatusListener).toHaveBeenCalledTimes(1);
    expect(assembly.disposeCategoryStatusListener).toHaveBeenCalledTimes(1);
    expect(assembly.tokenUsageListenerCount()).toBe(0);
    // …and NEVER tears down the shared service: the other webview surface
    // (sidebar ↔ Workshop panel) still depends on it (PR #66 review, Tim).
    expect(assembly.accountDispose).not.toHaveBeenCalled();

    createHandler(
      assembly,
      jest.fn().mockResolvedValue(undefined)
    );

    expect(assembly.accountAddRefreshListener).toHaveBeenCalledTimes(2);
    expect(assembly.secretOnDidChange).toHaveBeenCalledTimes(2);
    expect(assembly.categoryAddStatusListener).toHaveBeenCalledTimes(2);
    expect(assembly.tokenUsageListenerCount()).toBe(1);
  });

  it('refreshes AI services when the stored API key changes (self-heal)', async () => {
    const assembly = createTestAssembly();
    createHandler(assembly, jest.fn().mockResolvedValue(undefined));

    // Fire the secret-change listener the handler registered.
    const onSecretChange = assembly.secretOnDidChange.mock.calls[0][0] as () => void;
    onSecretChange();
    // The handler intentionally fire-and-forgets the refresh; let that queued
    // work settle before asserting the services were refreshed.
    await flushQueuedWork();

    expect(assembly.services.aiResourceManager.refreshConfiguration).toHaveBeenCalledTimes(1);
    expect(assembly.services.assistantToolService.refreshConfiguration).toHaveBeenCalledTimes(1);
    expect(assembly.services.dictionaryService.refreshConfiguration).toHaveBeenCalledTimes(1);
    expect(assembly.services.contextAssistantService.refreshConfiguration).toHaveBeenCalledTimes(1);
    expect(assembly.log.appendLine).toHaveBeenCalledWith(
      '[MessageHandler] Service configuration refresh completed: AI resource manager, assistant tool service, dictionary service, context assistant service'
    );
  });

  it('hot-swaps model settings without rebuilding services or retained conversations', async () => {
    const assembly = createTestAssembly();
    const handler = createHandler(assembly, jest.fn().mockResolvedValue(undefined));
    let contextModelChecks = 0;

    handler.handleConfigurationChange(section =>
      section === 'proseMinion.contextModel' && ++contextModelChecks === 1
    );
    await flushQueuedWork();

    expect(assembly.services.aiResourceManager.refreshModelSelections).toHaveBeenCalledTimes(1);
    expect(assembly.services.aiResourceManager.refreshConfiguration).not.toHaveBeenCalled();
    expect(assembly.services.assistantToolService.refreshConfiguration).not.toHaveBeenCalled();
    expect(assembly.services.dictionaryService.refreshConfiguration).not.toHaveBeenCalled();
    expect(assembly.services.contextAssistantService.refreshConfiguration).not.toHaveBeenCalled();
    expect(assembly.log.appendLine).toHaveBeenCalledWith(
      '[MessageHandler] Model selections hot-swapped; retained conversations preserved'
    );
  });

  it.each([
    'proseMinion.workshop.conversationBehavior',
    'proseMinion.workshop.writerProfile'
  ])('pulls external Workshop setting %s into the live room', async (changedKey) => {
    const assembly = createTestAssembly();
    const handler = createHandler(assembly, jest.fn().mockResolvedValue(undefined));

    handler.handleConfigurationChange(
      section => section === changedKey
    );
    await flushQueuedWork();

    expect(
      assembly.services.workshopConversationSettingsService.syncFromSettings
    ).toHaveBeenCalledTimes(1);
  });

  it('posts a transient API-key warning clear after successful key-backed self-heal', async () => {
    const assembly = createTestAssembly();
    (assembly.services.secretsService.getApiKey as jest.Mock).mockResolvedValue('configured-key');
    const postMessage = jest.fn().mockResolvedValue(undefined);
    createHandler(assembly, postMessage);
    postMessage.mockClear();

    const onSecretChange = assembly.secretOnDidChange.mock.calls[0][0] as () => void;
    onSecretChange();
    await flushQueuedWork();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.CLEAR_TRANSIENT_API_KEY_WARNING,
        source: 'extension.handler',
        payload: {}
      })
    );
    expect(assembly.services.secretsService.getApiKey).toHaveBeenCalledTimes(1);
  });

  it('logs the named refresh step and skipped services when API key self-heal fails', async () => {
    const assembly = createTestAssembly();
    (assembly.services.assistantToolService.refreshConfiguration as jest.Mock).mockRejectedValueOnce(
      new Error('assistant refresh failed')
    );
    createHandler(assembly, jest.fn().mockResolvedValue(undefined));

    const onSecretChange = assembly.secretOnDidChange.mock.calls[0][0] as () => void;
    onSecretChange();
    await flushQueuedWork();

    expect(assembly.services.aiResourceManager.refreshConfiguration).toHaveBeenCalledTimes(1);
    expect(assembly.services.assistantToolService.refreshConfiguration).toHaveBeenCalledTimes(1);
    expect(assembly.services.dictionaryService.refreshConfiguration).not.toHaveBeenCalled();
    expect(assembly.services.contextAssistantService.refreshConfiguration).not.toHaveBeenCalled();
    expect(assembly.log.appendLine).toHaveBeenCalledWith(
      '[MessageHandler] Service configuration refresh failed at assistant tool service: assistant refresh failed'
    );
    expect(assembly.log.appendLine).toHaveBeenCalledWith(
      '[MessageHandler] Service configuration refresh skipped: dictionary service, context assistant service'
    );
  });

  it('posts a partial-refresh status and clears stale API-key warnings when a key-backed self-heal partially fails', async () => {
    const assembly = createTestAssembly();
    (assembly.services.secretsService.getApiKey as jest.Mock).mockResolvedValue('configured-key');
    (assembly.services.assistantToolService.refreshConfiguration as jest.Mock).mockRejectedValueOnce(
      new Error('assistant refresh failed')
    );
    const postMessage = jest.fn().mockResolvedValue(undefined);
    createHandler(assembly, postMessage);
    postMessage.mockClear();

    const onSecretChange = assembly.secretOnDidChange.mock.calls[0][0] as () => void;
    onSecretChange();
    await flushQueuedWork();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.STATUS,
        source: 'extension.handler',
        payload: {
          message: 'AI service refresh partially failed. Some tools may need a reload.',
          tickerMessage: 'assistant tool service: assistant refresh failed'
        }
      })
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.CLEAR_TRANSIENT_API_KEY_WARNING,
        source: 'extension.handler',
        payload: {}
      })
    );
    expect(assembly.services.secretsService.getApiKey).toHaveBeenCalledTimes(1);
  });
});
