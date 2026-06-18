/**
 * Message handler - Application layer
 * Routes messages from webview to domain handlers
 * Refactored to use domain-specific handlers for better organization
 *
 * SPRINT 05 REFACTOR: ProseAnalysisService facade removed
 * Now injects services directly into domain handlers
 */

import { LogSink, Platform } from '@/platform';
import {
  WebviewToExtensionMessage,
  MessageType,
  AnalysisResultMessage,
  MetricsResultMessage,
  DictionaryResultMessage,
  ContextResultMessage,
  SearchResultMessage,
  CategorySearchResultMessage,
  ErrorMessage,
  ErrorSource,
  StatusMessage,
  ExtensionToWebviewMessage,
  TokenUsageUpdateMessage,
  TokenUsageTotals
} from '@messages';

// Message routing
import { MessageRouter } from './MessageRouter';

// Domain handlers
import { AnalysisHandler } from './domain/AnalysisHandler';
import { DictionaryHandler } from './domain/DictionaryHandler';
import { ContextHandler } from './domain/ContextHandler';
import { MetricsHandler } from './domain/MetricsHandler';
import { SearchHandler } from './domain/SearchHandler';
import { ConfigurationHandler } from './domain/ConfigurationHandler';
import { PublishingHandler } from './domain/PublishingHandler';
import { SourcesHandler } from './domain/SourcesHandler';
import { UIHandler } from './domain/UIHandler';
import { FileOperationsHandler } from './domain/FileOperationsHandler';
import { AccountBalanceHandler } from './domain/AccountBalanceHandler';

// Infrastructure shared across metrics + search handlers (built once, injected)
import { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import { OpenRouterAccountClient, AccountBalanceService } from '@/infrastructure/account';

// SPRINT 05: Import services for direct injection
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import { DictionaryService } from '@services/dictionary/DictionaryService';
import { ContextAssistantService } from '@services/analysis/ContextAssistantService';
import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { StyleFlagsService } from '@services/measurement/StyleFlagsService';
import { WordFrequencyService } from '@services/measurement/WordFrequencyService';
import { WordSearchService } from '@services/search/WordSearchService';
import { CategorySearchService } from '@services/search/CategorySearchService';
import { StandardsService } from '@services/resources/StandardsService';
import { AIResourceManager } from '@orchestration/AIResourceManager';

interface ResultCache {
  analysis?: AnalysisResultMessage;
  dictionary?: DictionaryResultMessage;
  context?: ContextResultMessage;
  metrics?: MetricsResultMessage;
  search?: SearchResultMessage;
  categorySearch?: CategorySearchResultMessage;
  status?: StatusMessage;
  error?: ErrorMessage;
  tokenUsage?: TokenUsageUpdateMessage;
}

const sharedResultCache: ResultCache = {};

export class MessageHandler {
  // Shared token-tracking bag. Mutated in place + passed by reference to
  // ConfigurationHandler (which zeroes it on RESET_TOKEN_USAGE). `costUsd` is
  // cumulative; `lastRequestCostUsd` is the single most-recent request's cost.
  private tokenTotals: TokenUsageTotals & { lastRequestCostUsd?: number } = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  };

  // Message router (Strategy pattern)
  private readonly router: MessageRouter;

  // Domain handlers
  private readonly analysisHandler: AnalysisHandler;
  private readonly dictionaryHandler: DictionaryHandler;
  private readonly contextHandler: ContextHandler;
  private readonly metricsHandler: MetricsHandler;
  private readonly searchHandler: SearchHandler;
  private readonly configurationHandler: ConfigurationHandler;
  private readonly publishingHandler: PublishingHandler;
  private readonly sourcesHandler: SourcesHandler;
  private readonly uiHandler: UIHandler;
  private readonly fileOperationsHandler: FileOperationsHandler;
  private readonly accountBalanceHandler: AccountBalanceHandler;

  // OpenRouter account-balance service: TTL cache + debounced post-request
  // refresh. Owned here (PM has one webview, unlike FM's shared-in-extension.ts
  // setup) and disposed with the handler.
  private readonly accountBalanceService: AccountBalanceService;
  private readonly disposeBalanceListener: () => void;

  // Settings key constants for config watcher
  private readonly GENERAL_SETTINGS_KEYS = [
    'proseMinion.includeCraftGuides',
    'proseMinion.temperature',
    'proseMinion.maxTokens',
    'proseMinion.applyContextWindowTrimming'
  ] as const;

  private readonly WORD_SEARCH_KEYS = [
    'proseMinion.wordSearch.contextWords',
    'proseMinion.wordSearch.clusterWindow',
    'proseMinion.wordSearch.minClusterSize',
    'proseMinion.wordSearch.caseSensitive',
    'proseMinion.wordSearch.enableAssistantExpansion'
  ] as const;

  private readonly WORD_FREQUENCY_KEYS = [
    'proseMinion.wordFrequency.topN',
    'proseMinion.wordFrequency.includeHapaxList',
    'proseMinion.wordFrequency.hapaxDisplayMax',
    'proseMinion.wordFrequency.includeStopwordsTable',
    'proseMinion.wordFrequency.contentWordsOnly',
    'proseMinion.wordFrequency.posEnabled',
    'proseMinion.wordFrequency.includeBigrams',
    'proseMinion.wordFrequency.includeTrigrams',
    'proseMinion.wordFrequency.enableLemmas',
    'proseMinion.wordFrequency.lengthHistogramMaxChars',
    'proseMinion.wordFrequency.minCharacterLength'
  ] as const;

  private readonly CONTEXT_PATH_KEYS = [
    'proseMinion.contextPaths.characters',
    'proseMinion.contextPaths.locations',
    'proseMinion.contextPaths.themes',
    'proseMinion.contextPaths.things',
    'proseMinion.contextPaths.chapters',
    'proseMinion.contextPaths.manuscript',
    'proseMinion.contextPaths.projectBrief',
    'proseMinion.contextPaths.general'
  ] as const;

  private readonly MODEL_KEYS = [
    'proseMinion.assistantModel',
    'proseMinion.dictionaryModel',
    'proseMinion.contextModel',
    'proseMinion.categoryModel'
  ] as const;

  private readonly UI_KEYS = [
    'proseMinion.ui.showTokenWidget'
  ] as const;

  private readonly PUBLISHING_STANDARDS_KEYS = [
    'proseMinion.publishingStandards.preset',
    'proseMinion.publishingStandards.pageSizeKey'
  ] as const;

  constructor(
    // SPRINT 05: Inject services directly (facade removed)
    private readonly assistantToolService: AssistantToolService,
    private readonly dictionaryService: DictionaryService,
    private readonly contextAssistantService: ContextAssistantService,
    private readonly proseStatsService: ProseStatsService,
    private readonly styleFlagsService: StyleFlagsService,
    private readonly wordFrequencyService: WordFrequencyService,
    private readonly wordSearchService: WordSearchService,
    private readonly standardsService: StandardsService,
    private readonly aiResourceManager: AIResourceManager,
    private readonly secretsService: any, // SecretStorageService
    // Raw webview transport (the shell binds it to `webview.postMessage`); keeps
    // MessageHandler vscode-free. NOTE: domain handlers must receive the wrapped
    // `this.postMessage` (logging + result cache), NOT this raw `transport` — the
    // distinct name is deliberate so the unwrapped one isn't grabbed by accident.
    private readonly transport: (message: ExtensionToWebviewMessage) => PromiseLike<unknown>,
    private readonly outputChannel: LogSink,
    private readonly platform: Platform
  ) {
    // SPRINT 05: Set up status callback on AIResourceManager (not facade)
    this.aiResourceManager.setStatusCallback((message: string, tickerMessage?: string) => {
      this.sendStatus(message, tickerMessage);
    });

    // Token tracking: centralized in AIResourceOrchestrator
    // This callback is called after each API call with usage data
    this.aiResourceManager.setTokenUsageCallback((usage) => {
      this.applyTokenUsage(usage);
    });

    // SPRINT 05: Instantiate domain handlers with direct service injection
    // Token tracking is now centralized in AIResourceOrchestrator via setTokenUsageCallback
    this.analysisHandler = new AnalysisHandler(
      assistantToolService,
      this.postMessage.bind(this),
      this.platform.settings
    );

    this.dictionaryHandler = new DictionaryHandler(
      dictionaryService,
      this.postMessage.bind(this)
    );

    // Set status emitter for dictionary service (for fast generation progress)
    dictionaryService.setStatusEmitter(this.sendDictionaryStatus.bind(this));

    this.contextHandler = new ContextHandler(
      contextAssistantService,
      this.postMessage.bind(this)
    );

    // Build ONE stateless TextSourceResolver from the platform ports and share it
    // across the metrics + search handlers (it was previously `new`-ed per call
    // via dynamic import inside each handler).
    const textSourceResolver = new TextSourceResolver(
      this.platform.fileSystem,
      this.platform.workspace,
      this.platform.settings,
      this.platform.editor,
      outputChannel
    );

    this.metricsHandler = new MetricsHandler(
      proseStatsService,
      styleFlagsService,
      wordFrequencyService,
      standardsService,
      this.postMessage.bind(this),
      outputChannel,
      textSourceResolver
    );

    const categorySearchService = new CategorySearchService(
      aiResourceManager,
      wordSearchService,
      this.platform.fileSystem,
      this.platform.workspace.extensionPath,
      outputChannel,
      this.sendSearchStatus.bind(this)
    );

    this.searchHandler = new SearchHandler(
      wordSearchService,
      this.postMessage.bind(this),
      outputChannel,
      textSourceResolver,
      categorySearchService
    );

    this.configurationHandler = new ConfigurationHandler(
      aiResourceManager,
      assistantToolService,
      dictionaryService,
      contextAssistantService,
      this.secretsService,
      this.platform.settings,
      this.platform.shell,
      this.postMessage.bind(this),
      outputChannel,
      sharedResultCache,
      this.tokenTotals
    );

    // Ensure token totals are reset on activation/startup so the webview does not
    // display stale persisted values from prior sessions.
    this.applyTokenUsage({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0
    });

    this.publishingHandler = new PublishingHandler(
      this.platform.fileSystem,
      this.platform.workspace.extensionPath,
      this.postMessage.bind(this),
      this.platform.settings
    );

    this.sourcesHandler = new SourcesHandler(
      this.postMessage.bind(this),
      this.platform.settings,
      this.platform.editor
    );

    this.uiHandler = new UIHandler(
      this.postMessage.bind(this),
      outputChannel,
      this.platform.fileSystem,
      this.platform.workspace,
      this.platform.shell,
      this.platform.editor
    );

    this.fileOperationsHandler = new FileOperationsHandler(
      this.postMessage.bind(this),
      this.platform.fileSystem,
      this.platform.workspace,
      this.platform.shell,
      outputChannel
    );

    // OpenRouter account-balance slice. The client reads the key host-side from
    // SecretStorage; only sanitized numbers/enums cross to the webview.
    this.accountBalanceService = new AccountBalanceService(
      new OpenRouterAccountClient(this.secretsService, outputChannel),
      outputChannel
    );
    this.accountBalanceHandler = new AccountBalanceHandler(
      this.postMessage.bind(this),
      this.accountBalanceService,
      outputChannel
    );
    // Post-AI-request refresh: the debounced fetch (armed in applyTokenUsage)
    // broadcasts fresh balances to the webview through the same handler.
    this.disposeBalanceListener = this.accountBalanceService.addRefreshListener(
      (payload) => this.accountBalanceHandler.post(payload)
    );

    // Initialize message router and register handler routes
    this.router = new MessageRouter(outputChannel);

    // Domain handlers self-register their routes (Strategy pattern)
    this.analysisHandler.registerRoutes(this.router);
    this.dictionaryHandler.registerRoutes(this.router);
    this.contextHandler.registerRoutes(this.router);
    this.metricsHandler.registerRoutes(this.router);
    this.searchHandler.registerRoutes(this.router);
    this.configurationHandler.registerRoutes(this.router);
    this.publishingHandler.registerRoutes(this.router);
    this.sourcesHandler.registerRoutes(this.router);
    this.uiHandler.registerRoutes(this.router);
    this.fileOperationsHandler.registerRoutes(this.router);
    this.accountBalanceHandler.registerRoutes(this.router);

    this.flushCachedResults();
  }

  async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    try {
      // Route message to registered handler
      await this.router.route(message);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[MessageHandler] ✗ Error routing ${message.type} from ${message.source}: ${details}`
      );
      this.sendError(
        'unknown',
        'Error processing request',
        details
      );
    }
  }

  // Helper methods for centralized token tracking and status messages

  private sendStatus(message: string, tickerMessage?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.handler',
      payload: {
        message,
        tickerMessage
      },
      timestamp: Date.now()
    };
    sharedResultCache.status = { ...statusMessage };
    void this.postMessage(statusMessage);
  }

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.handler',
      payload: {
        source,
        message,
        details
      },
      timestamp: Date.now()
    };
    sharedResultCache.error = { ...errorMessage };
    sharedResultCache.analysis = undefined;
    sharedResultCache.dictionary = undefined;
    sharedResultCache.context = undefined;
    void this.postMessage(errorMessage);
    this.outputChannel.appendLine(`[MessageHandler] ERROR [${source}]: ${message}${details ? ` - ${details}` : ''}`);
  }

  private applyTokenUsage(usage: TokenUsageTotals): void {
    try {
      this.tokenTotals.promptTokens += usage.promptTokens || 0;
      this.tokenTotals.completionTokens += usage.completionTokens || 0;
      this.tokenTotals.totalTokens += usage.totalTokens || 0;
      if (typeof usage.costUsd === 'number') {
        this.tokenTotals.costUsd = (this.tokenTotals.costUsd || 0) + usage.costUsd;
      }

      // A real completed request reports tokens; the activation/reset calls pass
      // all-zeros and must not overwrite the last-request cost or trigger a
      // billing refresh. `lastRequestCostUsd` may be undefined when the provider
      // returned no cost — surfaced honestly as "—" rather than $0.000.
      const isRealRequest = (usage.totalTokens || 0) > 0;
      if (isRealRequest) {
        this.tokenTotals.lastRequestCostUsd = usage.costUsd;
      }

      const { lastRequestCostUsd, ...totals } = this.tokenTotals;
      const message: TokenUsageUpdateMessage = {
        type: MessageType.TOKEN_USAGE_UPDATE,
        source: 'extension.handler',
        payload: {
          totals: { ...totals },
          lastRequestCostUsd
        },
        timestamp: Date.now()
      };
      sharedResultCache.tokenUsage = { ...message };
      void this.postMessage(message);

      // Spend just happened → re-fetch the balance (debounced, since OpenRouter
      // billing is eventually consistent). The service coalesces bursts.
      if (isRealRequest) {
        this.accountBalanceService.scheduleRefresh();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[MessageHandler] Failed to apply token usage update: ${msg}`);
    }
  }

  private sendSearchStatus(message: string, progress?: { current: number; total: number }): void {
    try {
      const status: StatusMessage = {
        type: MessageType.STATUS,
        source: 'extension.search',
        payload: { message, progress },
        timestamp: Date.now()
      };
      void this.postMessage(status);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[MessageHandler] Failed to post search status: ${msg}`);
    }
  }

  private sendDictionaryStatus(message: string, progress?: { current: number; total: number }, tickerMessage?: string): void {
    try {
      const status: StatusMessage = {
        type: MessageType.STATUS,
        source: 'extension.dictionary',
        payload: { message, progress, tickerMessage },
        timestamp: Date.now()
      };
      void this.postMessage(status);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[MessageHandler] Failed to post dictionary status: ${msg}`);
    }
  }

  private async refreshServiceConfiguration(): Promise<void> {
    // SPRINT 05: Refresh configuration on all services that need it
    try {
      await this.aiResourceManager.refreshConfiguration();
      await this.assistantToolService.refreshConfiguration();
      await this.dictionaryService.refreshConfiguration();
      await this.contextAssistantService.refreshConfiguration();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[MessageHandler] Failed to refresh service configuration: ${message}`
      );
    }
  }

  /**
   * React to a host configuration change. The shell owns the `vscode`
   * `onDidChangeConfiguration` registration and calls this with a vscode-free
   * `affects(section)` predicate (bound to `event.affectsConfiguration`), so all
   * the broadcast logic stays here without importing `vscode`.
   */
  handleConfigurationChange(affects: (section: string) => boolean): void {
    // Log all proseMinion config changes for debugging
    if (affects('proseMinion')) {
      this.outputChannel.appendLine('[ConfigWatcher] Config change detected');
    }

    // Only refresh service if model configs changed
    if (this.MODEL_KEYS.some(key => affects(key))) {
      this.outputChannel.appendLine('[ConfigWatcher] Model config changed, refreshing service');
      void this.refreshServiceConfiguration();

      // Send MODEL_DATA if this change came from external source (VS Code Settings UI)
      // handleSetModelSelection will send it for webview changes (with echo prevention)
      const shouldBroadcast = this.shouldBroadcastModelSettings(affects);
      if (shouldBroadcast) {
        this.outputChannel.appendLine('[ConfigWatcher] Model settings changed externally, sending MODEL_DATA after delay');
        // Wait for VSCode's async config system to finish writing (same delay as handleSetModelSelection)
        void (async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          await this.configurationHandler.sendModelData();
        })().catch(this.logBroadcastError('delayed sendModelData'));
      } else {
        this.outputChannel.appendLine('[ConfigWatcher] Model settings changed from webview, skipping MODEL_DATA (echo prevention)');
      }
    }

    // Send MODEL_DATA for UI setting changes (not model changes)
    // AND only if not webview-originated (prevent echo-back)
    if (this.shouldBroadcastUISettings(affects)) {
      this.outputChannel.appendLine('[ConfigWatcher] UI settings changed, sending MODEL_DATA');
      void this.configurationHandler.sendModelData().catch(this.logBroadcastError('sendModelData'));
    }

    // Send SETTINGS_DATA when any settings change (from VS Code settings panel)
    // This ensures Settings Overlay reflects changes made outside the webview
    const shouldBroadcastGeneral = this.shouldBroadcastGeneralSettings(affects);
    const shouldBroadcastWordSearch = this.shouldBroadcastWordSearchSettings(affects);
    const shouldBroadcastWordFreq = this.shouldBroadcastWordFrequencySettings(affects);
    const shouldBroadcastContextPath = this.shouldBroadcastContextPathSettings(affects);
    const shouldBroadcastPublishing = this.shouldBroadcastPublishingSettings(affects);

    if (shouldBroadcastGeneral || shouldBroadcastWordSearch || shouldBroadcastWordFreq ||
        shouldBroadcastContextPath || shouldBroadcastPublishing) {
      this.outputChannel.appendLine(
        `[ConfigWatcher] Broadcasting SETTINGS_DATA (general:${shouldBroadcastGeneral}, ` +
        `wordSearch:${shouldBroadcastWordSearch}, wordFreq:${shouldBroadcastWordFreq}, ` +
        `contextPath:${shouldBroadcastContextPath}, publishing:${shouldBroadcastPublishing})`
      );
      void this.configurationHandler.handleRequestSettingsData({
        type: MessageType.REQUEST_SETTINGS_DATA,
        source: 'extension.config_watcher',
        payload: {},
        timestamp: Date.now()
      }).catch(this.logBroadcastError('handleRequestSettingsData'));
    } else if (affects('proseMinion')) {
      // Config change detected but not broadcast - log for debugging
      this.outputChannel.appendLine('[ConfigWatcher] Config change detected but not broadcasting (likely echo prevention)');
    }
  }

  /**
   * Returns a `.catch` handler that records a fire-and-forget config-broadcast
   * rejection to the Output channel — so a "settings changed but the webview
   * didn't update" is diagnosable instead of vanishing into a `void`.
   */
  private logBroadcastError(what: string): (err: unknown) => void {
    return (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[ConfigWatcher] ${what} failed: ${msg}`);
    };
  }

  // Semantic helper methods for config change broadcasting
  private shouldBroadcastGeneralSettings(affects: (section: string) => boolean): boolean {
    return this.GENERAL_SETTINGS_KEYS.some(key =>
      affects(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastWordSearchSettings(affects: (section: string) => boolean): boolean {
    return this.WORD_SEARCH_KEYS.some(key =>
      affects(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastWordFrequencySettings(affects: (section: string) => boolean): boolean {
    return this.WORD_FREQUENCY_KEYS.some(key =>
      affects(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastContextPathSettings(affects: (section: string) => boolean): boolean {
    return this.CONTEXT_PATH_KEYS.some(key =>
      affects(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastModelSettings(affects: (section: string) => boolean): boolean {
    return this.MODEL_KEYS.some(key =>
      affects(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastUISettings(affects: (section: string) => boolean): boolean {
    return this.UI_KEYS.some(key =>
      affects(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastPublishingSettings(affects: (section: string) => boolean): boolean {
    return this.PUBLISHING_STANDARDS_KEYS.some(key =>
      affects(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  // Expose flushing so the provider can replay cached results when the view becomes visible again
  flushCachedResults(): void {
    if (sharedResultCache.status) {
      void this.postMessage(sharedResultCache.status);
    }

    if (sharedResultCache.analysis) {
      void this.postMessage(sharedResultCache.analysis);
    }

    if (sharedResultCache.metrics) {
      void this.postMessage(sharedResultCache.metrics);
    }

    if (sharedResultCache.search) {
      void this.postMessage(sharedResultCache.search);
    }

    if (sharedResultCache.categorySearch) {
      void this.postMessage(sharedResultCache.categorySearch);
    }

    if (sharedResultCache.context) {
      void this.postMessage(sharedResultCache.context);
    }

    if (sharedResultCache.dictionary) {
      void this.postMessage(sharedResultCache.dictionary);
    }

    if (sharedResultCache.error) {
      void this.postMessage(sharedResultCache.error);
    }

    if (sharedResultCache.tokenUsage) {
      void this.postMessage(sharedResultCache.tokenUsage);
    }
  }

  private async postMessage(message: ExtensionToWebviewMessage): Promise<void> {
    // Spy on messages and update cache (orchestration concern, not domain concern)
    switch (message.type) {
      case MessageType.ANALYSIS_RESULT:
        sharedResultCache.analysis = { ...message as AnalysisResultMessage };
        sharedResultCache.error = undefined;
        break;
      case MessageType.DICTIONARY_RESULT:
        sharedResultCache.dictionary = { ...message as DictionaryResultMessage };
        sharedResultCache.error = undefined;
        break;
      case MessageType.CONTEXT_RESULT:
        sharedResultCache.context = { ...message as ContextResultMessage };
        sharedResultCache.error = undefined;
        break;
      case MessageType.METRICS_RESULT:
        sharedResultCache.metrics = { ...message as MetricsResultMessage };
        break;
      case MessageType.SEARCH_RESULT:
        sharedResultCache.search = { ...message as SearchResultMessage };
        break;
      case MessageType.CATEGORY_SEARCH_RESULT:
        sharedResultCache.categorySearch = { ...message as CategorySearchResultMessage };
        break;
      case MessageType.STATUS:
        sharedResultCache.status = { ...message as StatusMessage };
        break;
      case MessageType.TOKEN_USAGE_UPDATE:
        sharedResultCache.tokenUsage = { ...message as TokenUsageUpdateMessage };
        break;
      case MessageType.ERROR:
        const error = message as ErrorMessage;
        sharedResultCache.error = { ...error };

        // Clear only the relevant domain cache based on envelope source
        // This ensures domain independence - dictionary error shouldn't clear analysis results
        if (error.source === 'extension.analysis') {
          sharedResultCache.analysis = undefined;
        } else if (error.source === 'extension.dictionary') {
          sharedResultCache.dictionary = undefined;
        } else if (error.source === 'extension.context') {
          sharedResultCache.context = undefined;
        }
        // Metrics/Search don't cache results, so no clearing needed
        break;
    }

    // Log outgoing message
    this.outputChannel.appendLine(
      `[MessageHandler] → ${message.type} to webview (source: ${message.source})`
    );

    try {
      await this.transport(message);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[MessageHandler] ✗ Failed to post ${message.type}: ${messageText}`
      );
    }
  }

  dispose(): void {
    // SPRINT 05: Clear status callback on AIResourceManager to avoid stale references.
    // The config-change watcher is now owned + disposed by the shell (the provider),
    // so MessageHandler holds no host disposables of its own.
    try {
      this.aiResourceManager.setStatusCallback(undefined as any);
    } catch {
      // noop
    }
    // Cancel any armed balance refresh timer + drop the listener so a disposed
    // handler can't fire a fetch/post after teardown.
    try {
      this.disposeBalanceListener();
      this.accountBalanceService.dispose();
    } catch {
      // noop
    }
  }
}
