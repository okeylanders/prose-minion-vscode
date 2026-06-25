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

interface TestAssembly {
  services: CoreServices;
  platform: Platform;
  log: LogSink;
  scheduleRefresh: jest.Mock;
  getBalances: jest.Mock;
  accountAddRefreshListener: jest.Mock;
  disposeBalanceListener: jest.Mock;
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
      deleteApiKey: jest.fn().mockResolvedValue(undefined)
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
    expect(assembly.accountDispose).toHaveBeenCalledTimes(1);
    expect(assembly.categorySetStatusEmitter).toHaveBeenLastCalledWith(undefined);
    expect(assembly.tokenUsageCallback()).toBeUndefined();

    createHandler(
      assembly,
      jest.fn().mockResolvedValue(undefined)
    );

    expect(assembly.accountAddRefreshListener).toHaveBeenCalledTimes(2);
    expect(assembly.categorySetStatusEmitter).toHaveBeenLastCalledWith(expect.any(Function));
    expect(assembly.tokenUsageCallback()).toEqual(expect.any(Function));
  });
});
