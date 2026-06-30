import { MessageHandler } from '@/application/handlers/MessageHandler';
import { CoreServices } from '@/application/handlers/MessageHandlerContracts';
import {
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
  categorySetStatusEmitter: jest.Mock;
  tokenUsageCallback: () => TokenUsageCallback | undefined;
}

function createTestAssembly(): TestAssembly {
  let capturedTokenUsageCallback: TokenUsageCallback | undefined;

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
  const categorySetStatusEmitter = jest.fn();

  const services = {
    assistantToolService: {
      setStatusEmitter: jest.fn(),
      refreshConfiguration: jest.fn().mockResolvedValue(undefined)
    },
    dictionaryService: {
      setStatusEmitter: jest.fn(),
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
      setStatusCallback: jest.fn(),
      setTokenUsageCallback: jest.fn((callback?: TokenUsageCallback) => {
        capturedTokenUsageCallback = callback;
      }),
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
      setStatusEmitter: categorySetStatusEmitter
    },
    accountBalanceService: {
      getBalances,
      scheduleRefresh,
      addRefreshListener: accountAddRefreshListener,
      dispose: accountDispose
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
    categorySetStatusEmitter,
    tokenUsageCallback: () => capturedTokenUsageCallback
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
    expect(assembly.categorySetStatusEmitter).toHaveBeenCalledWith(expect.any(Function));
  });

  it('does not arm a balance refresh for activation/reset token updates', () => {
    const assembly = createTestAssembly();
    const postMessage = jest.fn().mockResolvedValue(undefined);
    createHandler(assembly, postMessage);

    expect(assembly.scheduleRefresh).not.toHaveBeenCalled();

    assembly.tokenUsageCallback()?.({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0
    });
    expect(assembly.scheduleRefresh).not.toHaveBeenCalled();

    assembly.tokenUsageCallback()?.({
      promptTokens: 3,
      completionTokens: 2,
      totalTokens: 5,
      costUsd: 0.001
    });
    expect(assembly.scheduleRefresh).toHaveBeenCalledTimes(1);
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

    expect(assembly.disposeBalanceListener).toHaveBeenCalledTimes(1);
    expect(assembly.disposeSecretListener).toHaveBeenCalledTimes(1);
    expect(assembly.accountDispose).toHaveBeenCalledTimes(1);
    expect(assembly.categorySetStatusEmitter).toHaveBeenLastCalledWith(undefined);
    expect(assembly.tokenUsageCallback()).toBeUndefined();

    createHandler(
      assembly,
      jest.fn().mockResolvedValue(undefined)
    );

    expect(assembly.accountAddRefreshListener).toHaveBeenCalledTimes(2);
    expect(assembly.secretOnDidChange).toHaveBeenCalledTimes(2);
    expect(assembly.categorySetStatusEmitter).toHaveBeenLastCalledWith(expect.any(Function));
    expect(assembly.tokenUsageCallback()).toEqual(expect.any(Function));
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
