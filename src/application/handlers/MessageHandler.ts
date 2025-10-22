/**
 * Message handler - Application layer
 * Routes messages from webview to appropriate domain services
 * Following Single Responsibility Principle
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../domain/services/IProseAnalysisService';
import {
  WebviewToExtensionMessage,
  MessageType,
  AnalysisResultMessage,
  MetricsResultMessage,
  DictionaryResultMessage,
  ErrorMessage,
  StatusMessage,
  ModelScope,
  ModelDataMessage,
  ModelOption,
  ExtensionToWebviewMessage
} from '../../shared/types';
import { OpenRouterModels } from '../../infrastructure/api/OpenRouterModels';

interface ResultCache {
  analysis?: AnalysisResultMessage;
  dictionary?: DictionaryResultMessage;
  metrics?: MetricsResultMessage;
  status?: StatusMessage;
  error?: ErrorMessage;
}

const sharedResultCache: ResultCache = {};

export class MessageHandler {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly proseAnalysisService: IProseAnalysisService,
    private readonly webview: vscode.Webview,
    private readonly extensionUri: vscode.Uri,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    // Set up status callback for guide loading notifications
    // Check if service has setStatusCallback method (ProseAnalysisService does)
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
        event.affectsConfiguration('proseMinion.model')
      ) {
        void this.refreshServiceConfiguration();
        void this.sendModelData();
      }
    });

    this.disposables.push(configWatcher);

    this.flushCachedResults();
  }

  async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    try {
      switch (message.type) {
        case MessageType.ANALYZE_DIALOGUE:
          await this.handleAnalyzeDialogue(message.text);
          break;

        case MessageType.ANALYZE_PROSE:
          await this.handleAnalyzeProse(message.text);
          break;

        case MessageType.LOOKUP_DICTIONARY:
          await this.handleLookupDictionary(message.word, message.contextText);
          break;

        case MessageType.MEASURE_PROSE_STATS:
          await this.handleMeasureProseStats(message.text);
          break;

        case MessageType.MEASURE_STYLE_FLAGS:
          await this.handleMeasureStyleFlags(message.text);
          break;

        case MessageType.MEASURE_WORD_FREQUENCY:
          await this.handleMeasureWordFrequency(message.text);
          break;

        case MessageType.TAB_CHANGED:
          // Tab change is handled in UI, no action needed
          break;

        case MessageType.OPEN_GUIDE_FILE:
          await this.handleOpenGuideFile(message.guidePath);
          break;

        case MessageType.REQUEST_MODEL_DATA:
          await this.sendModelData();
          break;

        case MessageType.SET_MODEL_SELECTION:
          await this.handleSetModelSelection(message.scope, message.modelId);
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

  private async handleLookupDictionary(word: string, contextText?: string): Promise<void> {
    if (!word.trim()) {
      this.sendError('Dictionary lookup requires a word to search');
      return;
    }

    this.sendStatus('Preparing dictionary prompt...');
    await new Promise(resolve => setTimeout(resolve, 100));

    this.sendStatus(`Generating dictionary entry for "${word}"...`);
    const result = await this.proseAnalysisService.lookupDictionary(word, contextText);
    this.sendDictionaryResult(result.content, result.toolName);
  }

  private async handleAnalyzeDialogue(text: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

    const loadingMessage = includeCraftGuides
      ? 'Loading prompts and craft guides...'
      : 'Loading prompts...';

    this.sendStatus(loadingMessage);
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

    this.sendStatus('Analyzing dialogue with AI...');
    const result = await this.proseAnalysisService.analyzeDialogue(text);
    this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
  }

  private async handleAnalyzeProse(text: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const includeCraftGuides = config.get<boolean>('includeCraftGuides') ?? true;

    const loadingMessage = includeCraftGuides
      ? 'Loading prompts and craft guides...'
      : 'Loading prompts...';

    this.sendStatus(loadingMessage);
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure UI updates

    this.sendStatus('Analyzing prose with AI...');
    const result = await this.proseAnalysisService.analyzeProse(text);
    this.sendAnalysisResult(result.content, result.toolName, result.usedGuides);
  }

  private async handleMeasureProseStats(text: string): Promise<void> {
    const result = await this.proseAnalysisService.measureProseStats(text);
    this.sendMetricsResult(result.metrics, result.toolName);
  }

  private async handleMeasureStyleFlags(text: string): Promise<void> {
    const result = await this.proseAnalysisService.measureStyleFlags(text);
    this.sendMetricsResult(result.metrics, result.toolName);
  }

  private async handleMeasureWordFrequency(text: string): Promise<void> {
    const result = await this.proseAnalysisService.measureWordFrequency(text);
    this.sendMetricsResult(result.metrics, result.toolName);
  }

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

  private sendMetricsResult(result: any, toolName: string): void {
    const message: MetricsResultMessage = {
      type: MessageType.METRICS_RESULT,
      result,
      toolName,
      timestamp: Date.now()
    };
    sharedResultCache.metrics = {
      ...message
    };
    void this.postMessage(message);
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

  private sendError(message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      message,
      details,
      timestamp: Date.now()
    };
    sharedResultCache.error = { ...errorMessage };
    void this.postMessage(errorMessage);
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

  private async handleSetModelSelection(scope: ModelScope, modelId: string): Promise<void> {
    try {
      const configKey = this.getConfigKeyForScope(scope);
      const config = vscode.workspace.getConfiguration('proseMinion');

      await config.update(configKey, modelId, vscode.ConfigurationTarget.Global);
      this.outputChannel.appendLine(
        `[MessageHandler] Updated ${scope} model selection to ${modelId}`
      );
      await this.refreshServiceConfiguration();
      await this.sendModelData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[MessageHandler] Failed to update model selection for ${scope}: ${message}`
      );
      this.sendError('Failed to update model selection', message);
    }
  }

  private async sendModelData(): Promise<void> {
    try {
      const recommended = OpenRouterModels.getRecommendedModels();
      const options: ModelOption[] = recommended.map(model => ({
        id: model.id,
        label: model.name,
        description: model.description
      }));

      const selections = this.getEffectiveModelSelections();

      const seen = new Set(options.map(option => option.id));
      Object.values(selections).forEach(modelId => {
        if (modelId && !seen.has(modelId)) {
          options.push({
            id: modelId,
            label: modelId,
            description: 'Custom model (from settings)'
          });
          seen.add(modelId);
        }
      });

      const message: ModelDataMessage = {
        type: MessageType.MODEL_DATA,
        options,
        selections,
        timestamp: Date.now()
      };

      void this.postMessage(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[MessageHandler] Failed to load model data: ${message}`);
      this.sendError('Failed to load model list', message);
    }
  }

  private getEffectiveModelSelections(): Partial<Record<ModelScope, string>> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const fallback = config.get<string>('model') || 'z-ai/glm-4.6';

    const selections: Partial<Record<ModelScope, string>> = {
      assistant: config.get<string>('assistantModel') || fallback,
      dictionary: config.get<string>('dictionaryModel') || fallback,
      context: config.get<string>('contextModel') || fallback
    };

    if (
      'getResolvedModelSelections' in this.proseAnalysisService &&
      typeof (this.proseAnalysisService as any).getResolvedModelSelections === 'function'
    ) {
      try {
        const resolved = (this.proseAnalysisService as any).getResolvedModelSelections();
        return { ...selections, ...resolved };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[MessageHandler] Unable to read resolved model selections: ${message}`
        );
      }
    }

    return selections;
  }

  private getConfigKeyForScope(scope: ModelScope): string {
    switch (scope) {
      case 'assistant':
        return 'assistantModel';
      case 'dictionary':
        return 'dictionaryModel';
      case 'context':
        return 'contextModel';
      default:
        const exhaustiveCheck: never = scope;
        throw new Error(`Unknown model scope: ${exhaustiveCheck}`);
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

  private async handleOpenGuideFile(guidePath: string): Promise<void> {
    try {
      this.outputChannel.appendLine(`[MessageHandler] Opening guide file: ${guidePath}`);

      // Construct the full URI to the guide file
      const guideUri = vscode.Uri.joinPath(
        this.extensionUri,
        'resources',
        'craft-guides',
        guidePath
      );

      this.outputChannel.appendLine(`[MessageHandler] Full path: ${guideUri.fsPath}`);

      // Check if file exists first
      try {
        await vscode.workspace.fs.stat(guideUri);
      } catch (statError) {
        const errorMsg = `Guide file not found: ${guideUri.fsPath}`;
        this.outputChannel.appendLine(`[MessageHandler] ERROR: ${errorMsg}`);
        this.sendError('Guide file not found', errorMsg);
        return;
      }

      // Open the file in the editor
      const document = await vscode.workspace.openTextDocument(guideUri);
      await vscode.window.showTextDocument(document, {
        preview: false,  // Open in permanent editor tab
        viewColumn: vscode.ViewColumn.Beside  // Open alongside current editor
      });

      this.outputChannel.appendLine(`[MessageHandler] Successfully opened guide: ${guidePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[MessageHandler] ERROR opening guide: ${guidePath} - ${errorMsg}`);
      this.sendError(
        'Failed to open guide file',
        errorMsg
      );
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

    if (sharedResultCache.dictionary) {
      void this.postMessage(sharedResultCache.dictionary);
    }

    if (sharedResultCache.error) {
      void this.postMessage(sharedResultCache.error);
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
