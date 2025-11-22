/**
 * Message handler - Application layer
 * Routes messages from webview to domain handlers
 * Refactored to use domain-specific handlers for better organization
 *
 * SPRINT 05 REFACTOR: ProseAnalysisService facade removed
 * Now injects services directly into domain handlers
 */

import * as vscode from 'vscode';
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
import { AIResourceManager } from '@services/resources/AIResourceManager';

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
  private readonly disposables: vscode.Disposable[] = [];
  private tokenTotals: TokenUsageTotals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

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
    private readonly webview: vscode.Webview,
    private readonly extensionUri: vscode.Uri,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    // SPRINT 05: Set up status callback on AIResourceManager (not facade)
    this.aiResourceManager.setStatusCallback((message: string, guideNames?: string) => {
      this.sendStatus(message, guideNames);
    });

    const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
      // Log all proseMinion config changes for debugging
      if (event.affectsConfiguration('proseMinion')) {
        this.outputChannel.appendLine('[ConfigWatcher] Config change detected');
      }

      // Only refresh service if model configs changed
      if (this.MODEL_KEYS.some(key => event.affectsConfiguration(key))) {
        this.outputChannel.appendLine('[ConfigWatcher] Model config changed, refreshing service');
        void this.refreshServiceConfiguration();

        // Send MODEL_DATA if this change came from external source (VS Code Settings UI)
        // handleSetModelSelection will send it for webview changes (with echo prevention)
        const shouldBroadcast = this.shouldBroadcastModelSettings(event);
        if (shouldBroadcast) {
          this.outputChannel.appendLine('[ConfigWatcher] Model settings changed externally, sending MODEL_DATA after delay');
          // Wait for VSCode's async config system to finish writing (same delay as handleSetModelSelection)
          void (async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            await this.configurationHandler.sendModelData();
          })();
        } else {
          this.outputChannel.appendLine('[ConfigWatcher] Model settings changed from webview, skipping MODEL_DATA (echo prevention)');
        }
      }

      // Send MODEL_DATA for UI setting changes (not model changes)
      // AND only if not webview-originated (prevent echo-back)
      if (this.shouldBroadcastUISettings(event)) {
        this.outputChannel.appendLine('[ConfigWatcher] UI settings changed, sending MODEL_DATA');
        void this.configurationHandler.sendModelData();
      }

      // Send SETTINGS_DATA when any settings change (from VS Code settings panel)
      // This ensures Settings Overlay reflects changes made outside the webview
      const shouldBroadcastGeneral = this.shouldBroadcastGeneralSettings(event);
      const shouldBroadcastWordSearch = this.shouldBroadcastWordSearchSettings(event);
      const shouldBroadcastWordFreq = this.shouldBroadcastWordFrequencySettings(event);
      const shouldBroadcastContextPath = this.shouldBroadcastContextPathSettings(event);
      const shouldBroadcastPublishing = this.shouldBroadcastPublishingSettings(event);

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
        });
      } else if (event.affectsConfiguration('proseMinion')) {
        // Config change detected but not broadcast - log for debugging
        this.outputChannel.appendLine('[ConfigWatcher] Config change detected but not broadcasting (likely echo prevention)');
      }
    });

    this.disposables.push(configWatcher);

    // SPRINT 05: Instantiate domain handlers with direct service injection
    this.analysisHandler = new AnalysisHandler(
      assistantToolService,
      this.postMessage.bind(this),
      this.applyTokenUsage.bind(this)
    );

    this.dictionaryHandler = new DictionaryHandler(
      dictionaryService,
      this.postMessage.bind(this),
      this.applyTokenUsage.bind(this)
    );

    this.contextHandler = new ContextHandler(
      contextAssistantService,
      this.postMessage.bind(this),
      this.applyTokenUsage.bind(this)
    );

    this.metricsHandler = new MetricsHandler(
      proseStatsService,
      styleFlagsService,
      wordFrequencyService,
      standardsService,
      this.postMessage.bind(this),
      outputChannel
    );

    const categorySearchService = new CategorySearchService(
      aiResourceManager,
      wordSearchService,
      extensionUri,
      outputChannel,
      this.sendSearchStatus.bind(this)
    );

    this.searchHandler = new SearchHandler(
      wordSearchService,
      this.postMessage.bind(this),
      outputChannel,
      categorySearchService,
      this.applyTokenUsage.bind(this)
    );

    this.configurationHandler = new ConfigurationHandler(
      aiResourceManager,
      assistantToolService,
      dictionaryService,
      contextAssistantService,
      this.secretsService,
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
      extensionUri,
      this.postMessage.bind(this)
    );

    this.sourcesHandler = new SourcesHandler(
      this.postMessage.bind(this)
    );

    this.uiHandler = new UIHandler(
      extensionUri,
      this.postMessage.bind(this),
      outputChannel
    );

    this.fileOperationsHandler = new FileOperationsHandler(
      this.postMessage.bind(this)
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

    // Webview diagnostics (no dedicated handler)
    this.router.register(MessageType.WEBVIEW_ERROR, async (message: any) => {
      this.outputChannel.appendLine(`[Webview Error] ${message.message}${message.details ? ` - ${message.details}` : ''}`);
    });

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

  private sendStatus(message: string, guideNames?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.handler',
      payload: {
        message,
        guideNames
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

      const message: TokenUsageUpdateMessage = {
        type: MessageType.TOKEN_USAGE_UPDATE,
        source: 'extension.handler',
        payload: {
          totals: { ...this.tokenTotals }
        },
        timestamp: Date.now()
      };
      sharedResultCache.tokenUsage = { ...message };
      void this.postMessage(message);
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

  // Semantic helper methods for config change broadcasting
  private shouldBroadcastGeneralSettings(event: vscode.ConfigurationChangeEvent): boolean {
    return this.GENERAL_SETTINGS_KEYS.some(key =>
      event.affectsConfiguration(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastWordSearchSettings(event: vscode.ConfigurationChangeEvent): boolean {
    return this.WORD_SEARCH_KEYS.some(key =>
      event.affectsConfiguration(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastWordFrequencySettings(event: vscode.ConfigurationChangeEvent): boolean {
    return this.WORD_FREQUENCY_KEYS.some(key =>
      event.affectsConfiguration(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastContextPathSettings(event: vscode.ConfigurationChangeEvent): boolean {
    return this.CONTEXT_PATH_KEYS.some(key =>
      event.affectsConfiguration(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastModelSettings(event: vscode.ConfigurationChangeEvent): boolean {
    return this.MODEL_KEYS.some(key =>
      event.affectsConfiguration(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastUISettings(event: vscode.ConfigurationChangeEvent): boolean {
    return this.UI_KEYS.some(key =>
      event.affectsConfiguration(key) &&
      this.configurationHandler.shouldBroadcastConfigChange(key)
    );
  }

  private shouldBroadcastPublishingSettings(event: vscode.ConfigurationChangeEvent): boolean {
    return this.PUBLISHING_STANDARDS_KEYS.some(key =>
      event.affectsConfiguration(key) &&
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
      await this.webview.postMessage(message);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[MessageHandler] ✗ Failed to post ${message.type}: ${messageText}`
      );
    }
  }

  dispose(): void {
    // SPRINT 05: Clear status callback on AIResourceManager to avoid stale references
    try {
      this.aiResourceManager.setStatusCallback(undefined as any);
    } catch {
      // noop
    }
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      try {
        disposable?.dispose();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[MessageHandler] Error disposing resource: ${message}`
        );
      }
    }
  }
}
