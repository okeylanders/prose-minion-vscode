/**
 * Message handler - Application layer
 * Routes messages from webview to domain handlers
 * Refactored to use domain-specific handlers for better organization
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../domain/services/IProseAnalysisService';
import { ContextGenerationResult } from '../../domain/models/ContextGeneration';
import {
  WebviewToExtensionMessage,
  MessageType,
  AnalysisResultMessage,
  MetricsResultMessage,
  DictionaryResultMessage,
  ContextResultMessage,
  SearchResultMessage,
  ErrorMessage,
  ErrorSource,
  StatusMessage,
  ExtensionToWebviewMessage,
  TokenUsageUpdateMessage,
  TokenUsageTotals
} from '../../shared/types/messages';

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

interface ResultCache {
  analysis?: AnalysisResultMessage;
  dictionary?: DictionaryResultMessage;
  context?: ContextResultMessage;
  metrics?: MetricsResultMessage;
  search?: SearchResultMessage;
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

  constructor(
    private readonly proseAnalysisService: IProseAnalysisService,
    private readonly secretsService: any, // SecretStorageService
    private readonly webview: vscode.Webview,
    private readonly extensionUri: vscode.Uri,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    // Set up status callback for guide loading notifications
    if ('setStatusCallback' in proseAnalysisService && typeof (proseAnalysisService as any).setStatusCallback === 'function') {
      (proseAnalysisService as any).setStatusCallback((message: string, guideNames?: string) => {
        this.sendStatus(message, guideNames);
      });
    }

    const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
      // Only refresh service if model configs changed
      if (
        event.affectsConfiguration('proseMinion.assistantModel') ||
        event.affectsConfiguration('proseMinion.dictionaryModel') ||
        event.affectsConfiguration('proseMinion.contextModel') ||
        event.affectsConfiguration('proseMinion.model')
      ) {
        void this.refreshServiceConfiguration();
        // NOTE: Do NOT send MODEL_DATA here for model changes.
        // handleSetModelSelection will send it after saving.
        // This prevents race conditions where we send stale data.
      }

      // Send MODEL_DATA only for UI setting changes (not model changes)
      if (event.affectsConfiguration('proseMinion.ui.showTokenWidget')) {
        void this.configurationHandler.sendModelData();
      }
    });

    this.disposables.push(configWatcher);

    // Instantiate domain handlers with bound helper methods
    this.analysisHandler = new AnalysisHandler(
      proseAnalysisService,
      this.sendStatus.bind(this),
      this.sendAnalysisResult.bind(this),
      this.sendError.bind(this),
      this.applyTokenUsage.bind(this)
    );

    this.dictionaryHandler = new DictionaryHandler(
      proseAnalysisService,
      this.sendStatus.bind(this),
      this.sendDictionaryResult.bind(this),
      this.sendError.bind(this),
      this.applyTokenUsage.bind(this)
    );

    this.contextHandler = new ContextHandler(
      proseAnalysisService,
      this.sendStatus.bind(this),
      this.sendContextResult.bind(this),
      this.sendError.bind(this),
      this.applyTokenUsage.bind(this)
    );

    this.metricsHandler = new MetricsHandler(
      proseAnalysisService,
      outputChannel,
      this.sendMetricsResult.bind(this),
      this.sendError.bind(this)
    );

    this.searchHandler = new SearchHandler(
      proseAnalysisService,
      outputChannel,
      this.sendSearchResult.bind(this),
      this.sendError.bind(this)
    );

    this.configurationHandler = new ConfigurationHandler(
      proseAnalysisService,
      this.secretsService,
      outputChannel,
      this.postMessage.bind(this),
      this.sendError.bind(this),
      sharedResultCache,
      this.tokenTotals
    );

    this.publishingHandler = new PublishingHandler(
      extensionUri,
      outputChannel,
      this.postMessage.bind(this),
      this.sendError.bind(this)
    );

    this.sourcesHandler = new SourcesHandler(
      this.postMessage.bind(this)
    );

    this.uiHandler = new UIHandler(
      extensionUri,
      outputChannel,
      this.postMessage.bind(this),
      this.sendStatus.bind(this),
      this.sendError.bind(this)
    );

    this.fileOperationsHandler = new FileOperationsHandler(
      outputChannel,
      this.postMessage.bind(this),
      this.sendStatus.bind(this),
      this.sendError.bind(this)
    );

    // Initialize message router and register handler routes
    this.router = new MessageRouter();

    // TODO: Domain handlers will register their routes in Sprint 2
    // For now, we register manually to maintain functionality
    // After Sprint 2, handlers will have registerRoutes(router) methods

    // Analysis routes
    this.router.register(MessageType.ANALYZE_DIALOGUE, this.analysisHandler.handleAnalyzeDialogue.bind(this.analysisHandler));
    this.router.register(MessageType.ANALYZE_PROSE, this.analysisHandler.handleAnalyzeProse.bind(this.analysisHandler));

    // Dictionary routes
    this.router.register(MessageType.LOOKUP_DICTIONARY, this.dictionaryHandler.handleLookupDictionary.bind(this.dictionaryHandler));

    // Context routes
    this.router.register(MessageType.GENERATE_CONTEXT, this.contextHandler.handleGenerateContext.bind(this.contextHandler));

    // Metrics routes
    this.router.register(MessageType.MEASURE_PROSE_STATS, this.metricsHandler.handleMeasureProseStats.bind(this.metricsHandler));
    this.router.register(MessageType.MEASURE_STYLE_FLAGS, this.metricsHandler.handleMeasureStyleFlags.bind(this.metricsHandler));
    this.router.register(MessageType.MEASURE_WORD_FREQUENCY, this.metricsHandler.handleMeasureWordFrequency.bind(this.metricsHandler));

    // Search routes
    this.router.register(MessageType.RUN_WORD_SEARCH, this.searchHandler.handleMeasureWordSearch.bind(this.searchHandler));

    // Configuration routes
    this.router.register(MessageType.REQUEST_MODEL_DATA, this.configurationHandler.handleRequestModelData.bind(this.configurationHandler));
    this.router.register(MessageType.SET_MODEL_SELECTION, this.configurationHandler.handleSetModelSelection.bind(this.configurationHandler));
    this.router.register(MessageType.REQUEST_SETTINGS_DATA, this.configurationHandler.handleRequestSettingsData.bind(this.configurationHandler));
    this.router.register(MessageType.UPDATE_SETTING, this.configurationHandler.handleUpdateSetting.bind(this.configurationHandler));
    this.router.register(MessageType.RESET_TOKEN_USAGE, this.configurationHandler.handleResetTokenUsage.bind(this.configurationHandler));
    this.router.register(MessageType.REQUEST_API_KEY, this.configurationHandler.handleRequestApiKey.bind(this.configurationHandler));
    this.router.register(MessageType.UPDATE_API_KEY, this.configurationHandler.handleUpdateApiKey.bind(this.configurationHandler));
    this.router.register(MessageType.DELETE_API_KEY, this.configurationHandler.handleDeleteApiKey.bind(this.configurationHandler));

    // Publishing routes
    this.router.register(MessageType.REQUEST_PUBLISHING_STANDARDS_DATA, this.publishingHandler.handleRequestPublishingStandardsData.bind(this.publishingHandler));
    this.router.register(MessageType.SET_PUBLISHING_PRESET, this.publishingHandler.handleSetPublishingPreset.bind(this.publishingHandler));
    this.router.register(MessageType.SET_PUBLISHING_TRIM_SIZE, this.publishingHandler.handleSetPublishingTrim.bind(this.publishingHandler));

    // Sources routes
    this.router.register(MessageType.REQUEST_ACTIVE_FILE, this.sourcesHandler.handleRequestActiveFile.bind(this.sourcesHandler));
    this.router.register(MessageType.REQUEST_MANUSCRIPT_GLOBS, this.sourcesHandler.handleRequestManuscriptGlobs.bind(this.sourcesHandler));
    this.router.register(MessageType.REQUEST_CHAPTER_GLOBS, this.sourcesHandler.handleRequestChapterGlobs.bind(this.sourcesHandler));

    // UI routes
    this.router.register(MessageType.OPEN_GUIDE_FILE, this.uiHandler.handleOpenGuideFile.bind(this.uiHandler));
    this.router.register(MessageType.REQUEST_SELECTION, this.uiHandler.handleSelectionRequest.bind(this.uiHandler));
    this.router.register(MessageType.TAB_CHANGED, async () => {}); // No-op handler for tab changes

    // File Operations routes
    this.router.register(MessageType.COPY_RESULT, this.fileOperationsHandler.handleCopyResult.bind(this.fileOperationsHandler));
    this.router.register(MessageType.SAVE_RESULT, this.fileOperationsHandler.handleSaveResult.bind(this.fileOperationsHandler));

    // Webview diagnostics
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
      this.sendError(
        'unknown',
        'Error processing request',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Helper methods for sending results and status messages

  private sendAnalysisResult(result: string, toolName: string, usedGuides?: string[]): void {
    const message: AnalysisResultMessage = {
      type: MessageType.ANALYSIS_RESULT,
      result,
      toolName,
      usedGuides,
      timestamp: Date.now()
    };
    sharedResultCache.analysis = {
      ...message,
      usedGuides: message.usedGuides ? [...message.usedGuides] : undefined
    };
    sharedResultCache.error = undefined;
    void this.postMessage(message);
    this.sendStatus('');
  }

  private sendDictionaryResult(result: string, toolName: string): void {
    const message: DictionaryResultMessage = {
      type: MessageType.DICTIONARY_RESULT,
      result,
      toolName,
      timestamp: Date.now()
    };
    sharedResultCache.dictionary = {
      ...message
    };
    sharedResultCache.error = undefined;
    void this.postMessage(message);
    this.sendStatus('');
  }

  private sendContextResult(result: ContextGenerationResult): void {
    const message: ContextResultMessage = {
      type: MessageType.CONTEXT_RESULT,
      result: result.content,
      toolName: result.toolName,
      requestedResources: result.requestedResources,
      timestamp: Date.now()
    };

    sharedResultCache.context = { ...message };
    sharedResultCache.error = undefined;
    void this.postMessage(message);
    this.sendStatus('');
  }

  private sendMetricsResult(result: any, toolName: string): void {
    const message: MetricsResultMessage = {
      type: MessageType.METRICS_RESULT,
      result,
      toolName,
      timestamp: Date.now()
    } as MetricsResultMessage;
    sharedResultCache.metrics = {
      ...message
    };
    void this.postMessage(message);
  }

  private sendSearchResult(result: any, toolName: string): void {
    const message: SearchResultMessage = {
      type: MessageType.SEARCH_RESULT,
      result,
      toolName,
      timestamp: Date.now()
    };
    sharedResultCache.search = { ...message };
    void this.postMessage(message);
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
        totals: { ...this.tokenTotals },
        timestamp: Date.now()
      };
      sharedResultCache.tokenUsage = { ...message };
      void this.postMessage(message);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[MessageHandler] Failed to apply token usage update: ${msg}`);
    }
  }

  private sendStatus(message: string, guideNames?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      message,
      guideNames,
      timestamp: Date.now()
    };
    sharedResultCache.status = { ...statusMessage };
    void this.postMessage(statusMessage);
  }

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source,
      message,
      details,
      timestamp: Date.now()
    };
    sharedResultCache.error = { ...errorMessage };
    sharedResultCache.analysis = undefined;
    sharedResultCache.dictionary = undefined;
    sharedResultCache.context = undefined;
    void this.postMessage(errorMessage);
    this.outputChannel.appendLine(`[MessageHandler] ERROR [${source}]: ${message}${details ? ` - ${details}` : ''}`);
  }

  private async refreshServiceConfiguration(): Promise<void> {
    if (
      'refreshConfiguration' in this.proseAnalysisService &&
      typeof (this.proseAnalysisService as any).refreshConfiguration === 'function'
    ) {
      try {
        await (this.proseAnalysisService as any).refreshConfiguration();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[MessageHandler] Failed to refresh service configuration: ${message}`
        );
      }
    }
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
    try {
      await this.webview.postMessage(message);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[MessageHandler] Failed to post message (${message.type}): ${messageText}`
      );
    }
  }

  dispose(): void {
    // Clear status callback to avoid stale references
    if ('setStatusCallback' in this.proseAnalysisService && typeof (this.proseAnalysisService as any).setStatusCallback === 'function') {
      try {
        (this.proseAnalysisService as any).setStatusCallback(undefined);
      } catch {
        // noop
      }
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
