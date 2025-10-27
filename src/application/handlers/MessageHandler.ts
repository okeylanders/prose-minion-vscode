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
  StatusMessage,
  ExtensionToWebviewMessage,
  TokenUsageUpdateMessage,
  TokenUsageTotals
} from '../../shared/types/messages';

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
      if (
        event.affectsConfiguration('proseMinion.assistantModel') ||
        event.affectsConfiguration('proseMinion.dictionaryModel') ||
        event.affectsConfiguration('proseMinion.contextModel') ||
        event.affectsConfiguration('proseMinion.model') ||
        event.affectsConfiguration('proseMinion.ui.showTokenWidget')
      ) {
        void this.refreshServiceConfiguration();
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

    this.flushCachedResults();
  }

  async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    try {
      switch (message.type) {
        // Analysis
        case MessageType.ANALYZE_DIALOGUE:
          await this.analysisHandler.handleAnalyzeDialogue(message);
          break;

        case MessageType.ANALYZE_PROSE:
          await this.analysisHandler.handleAnalyzeProse(message);
          break;

        // Dictionary
        case MessageType.LOOKUP_DICTIONARY:
          await this.dictionaryHandler.handleLookupDictionary(message);
          break;

        // Context
        case MessageType.GENERATE_CONTEXT:
          await this.contextHandler.handleGenerateContext(message);
          break;

        // Metrics
        case MessageType.MEASURE_PROSE_STATS:
          await this.metricsHandler.handleMeasureProseStats(message);
          break;

        case MessageType.MEASURE_STYLE_FLAGS:
          await this.metricsHandler.handleMeasureStyleFlags(message);
          break;

        case MessageType.MEASURE_WORD_FREQUENCY:
          await this.metricsHandler.handleMeasureWordFrequency(message);
          break;

        // Search
        case MessageType.RUN_WORD_SEARCH:
          await this.searchHandler.handleMeasureWordSearch(message);
          break;

        // Configuration
        case MessageType.REQUEST_MODEL_DATA:
          await this.configurationHandler.handleRequestModelData(message);
          break;

        case MessageType.SET_MODEL_SELECTION:
          await this.configurationHandler.handleSetModelSelection(message);
          break;

        case MessageType.REQUEST_SETTINGS_DATA:
          await this.configurationHandler.handleRequestSettingsData(message);
          break;

        case MessageType.UPDATE_SETTING:
          await this.configurationHandler.handleUpdateSetting(message);
          break;

        case MessageType.RESET_TOKEN_USAGE:
          await this.configurationHandler.handleResetTokenUsage();
          break;

        case MessageType.REQUEST_API_KEY:
          await this.configurationHandler.handleRequestApiKey(message);
          break;

        case MessageType.UPDATE_API_KEY:
          await this.configurationHandler.handleUpdateApiKey(message);
          break;

        case MessageType.DELETE_API_KEY:
          await this.configurationHandler.handleDeleteApiKey(message);
          break;

        // Publishing
        case MessageType.REQUEST_PUBLISHING_STANDARDS_DATA:
          await this.publishingHandler.handleRequestPublishingStandardsData(message);
          break;

        case MessageType.SET_PUBLISHING_PRESET:
          await this.publishingHandler.handleSetPublishingPreset(message);
          break;

        case MessageType.SET_PUBLISHING_TRIM_SIZE:
          await this.publishingHandler.handleSetPublishingTrim(message);
          break;

        // Sources
        case MessageType.REQUEST_ACTIVE_FILE:
          await this.sourcesHandler.handleRequestActiveFile(message);
          break;

        case MessageType.REQUEST_MANUSCRIPT_GLOBS:
          await this.sourcesHandler.handleRequestManuscriptGlobs(message);
          break;

        case MessageType.REQUEST_CHAPTER_GLOBS:
          await this.sourcesHandler.handleRequestChapterGlobs(message);
          break;

        // UI
        case MessageType.OPEN_GUIDE_FILE:
          await this.uiHandler.handleOpenGuideFile(message);
          break;

        case MessageType.REQUEST_SELECTION:
          await this.uiHandler.handleSelectionRequest(message);
          break;

        case MessageType.TAB_CHANGED:
          // Tab change is handled in UI, no action needed
          break;

        // File Operations
        case MessageType.COPY_RESULT:
          await this.fileOperationsHandler.handleCopyResult(message);
          break;

        case MessageType.SAVE_RESULT:
          await this.fileOperationsHandler.handleSaveResult(message);
          break;

        default:
          this.sendError('Unknown message type', 'Received unrecognized message');
      }
    } catch (error) {
      this.sendError(
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

  private sendError(message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      message,
      details,
      timestamp: Date.now()
    };
    sharedResultCache.error = { ...errorMessage };
    sharedResultCache.analysis = undefined;
    sharedResultCache.dictionary = undefined;
    sharedResultCache.context = undefined;
    void this.postMessage(errorMessage);
    this.outputChannel.appendLine(`[MessageHandler] ERROR: ${message}${details ? ` - ${details}` : ''}`);
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
