/**
 * Message handler - Application layer
 * Routes messages from webview to domain handlers
 * Refactored to use domain-specific handlers for better organization
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../domain/services/IProseAnalysisService';
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
      // AND only if not webview-originated (prevent echo-back)
      if (event.affectsConfiguration('proseMinion.ui.showTokenWidget')) {
        if (this.configurationHandler.shouldBroadcastConfigChange('proseMinion.ui.showTokenWidget')) {
          void this.configurationHandler.sendModelData();
        }
      }
    });

    this.disposables.push(configWatcher);

    // Instantiate domain handlers
    this.analysisHandler = new AnalysisHandler(
      proseAnalysisService,
      this.postMessage.bind(this),
      this.applyTokenUsage.bind(this)
    );

    this.dictionaryHandler = new DictionaryHandler(
      proseAnalysisService,
      this.postMessage.bind(this),
      this.applyTokenUsage.bind(this)
    );

    this.contextHandler = new ContextHandler(
      proseAnalysisService,
      this.postMessage.bind(this),
      this.applyTokenUsage.bind(this)
    );

    this.metricsHandler = new MetricsHandler(
      proseAnalysisService,
      this.postMessage.bind(this),
      outputChannel
    );

    this.searchHandler = new SearchHandler(
      proseAnalysisService,
      this.postMessage.bind(this),
      outputChannel
    );

    this.configurationHandler = new ConfigurationHandler(
      proseAnalysisService,
      this.secretsService,
      this.postMessage.bind(this),
      outputChannel,
      sharedResultCache,
      this.tokenTotals
    );

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
