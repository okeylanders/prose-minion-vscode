/**
 * Configuration domain handler
 * Handles settings, model selection, and token tracking
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import {
  RequestSettingsDataMessage,
  SettingsDataMessage,
  UpdateSettingMessage,
  SetModelSelectionMessage,
  RequestModelDataMessage,
  ModelDataMessage,
  ModelScope,
  ModelOption,
  TokenUsageUpdateMessage,
  RequestApiKeyMessage,
  ApiKeyStatusMessage,
  UpdateApiKeyMessage,
  DeleteApiKeyMessage,
  MessageType,
  ErrorSource,
  ErrorMessage
} from '../../../shared/types/messages';
import { MessageRouter } from '../MessageRouter';
import { OpenRouterModels } from '../../../infrastructure/api/OpenRouterModels';
import { SecretStorageService } from '../../../infrastructure/secrets/SecretStorageService';

export class ConfigurationHandler {
  // Track webview-originated config updates to prevent echo-back
  private webviewOriginatedUpdates = new Set<string>();

  constructor(
    private readonly service: IProseAnalysisService,
    private readonly secretsService: SecretStorageService,
    private readonly postMessage: (message: any) => Promise<void>,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly sharedResultCache: any,
    private readonly tokenTotals: { promptTokens: number; completionTokens: number; totalTokens: number }
  ) {}

  /**
   * Register message routes for configuration domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.REQUEST_MODEL_DATA, this.handleRequestModelData.bind(this));
    router.register(MessageType.SET_MODEL_SELECTION, this.handleSetModelSelection.bind(this));
    router.register(MessageType.REQUEST_SETTINGS_DATA, this.handleRequestSettingsData.bind(this));
    router.register(MessageType.UPDATE_SETTING, this.handleUpdateSetting.bind(this));
    router.register(MessageType.RESET_TOKEN_USAGE, this.handleResetTokenUsage.bind(this));
    router.register(MessageType.REQUEST_API_KEY, this.handleRequestApiKey.bind(this));
    router.register(MessageType.UPDATE_API_KEY, this.handleUpdateApiKey.bind(this));
    router.register(MessageType.DELETE_API_KEY, this.handleDeleteApiKey.bind(this));
  }

  // Helper methods (domain owns its message lifecycle)

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.configuration',
      payload: {
        source,
        message,
        details
      },
      timestamp: Date.now()
    };
    void this.postMessage(errorMessage);
  }

  /**
   * Mark a config key as webview-originated (to prevent echo-back)
   * The key will be cleared after 100ms
   */
  private markWebviewOriginatedUpdate(configKey: string): void {
    this.webviewOriginatedUpdates.add(configKey);
    setTimeout(() => {
      this.webviewOriginatedUpdates.delete(configKey);
    }, 100);
  }

  /**
   * Check if a config change should be broadcast to the webview
   * Returns false if the change was originated by the webview (to prevent echo-back)
   */
  public shouldBroadcastConfigChange(configKey: string): boolean {
    return !this.webviewOriginatedUpdates.has(configKey);
  }

  async handleRequestSettingsData(message: RequestSettingsDataMessage): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('proseMinion');
      const settings: Record<string, string | number | boolean> = {
        // Core (API key now in SecretStorage, not exposed here)
        'includeCraftGuides': config.get<boolean>('includeCraftGuides') ?? true,
        'temperature': config.get<number>('temperature') ?? 0.7,
        'maxTokens': config.get<number>('maxTokens') ?? 10000,
        'applyContextWindowTrimming': config.get<boolean>('applyContextWindowTrimming') ?? true,
        'ui.showTokenWidget': config.get<boolean>('ui.showTokenWidget') ?? true,
        // Publishing standards
        'publishingStandards.preset': config.get<string>('publishingStandards.preset') ?? 'none',
        'publishingStandards.pageSizeKey': config.get<string>('publishingStandards.pageSizeKey') ?? '',
        // Word Frequency
        'wordFrequency.topN': config.get<number>('wordFrequency.topN') ?? 100,
        'wordFrequency.includeHapaxList': config.get<boolean>('wordFrequency.includeHapaxList') ?? true,
        'wordFrequency.hapaxDisplayMax': config.get<number>('wordFrequency.hapaxDisplayMax') ?? 300,
        'wordFrequency.includeStopwordsTable': config.get<boolean>('wordFrequency.includeStopwordsTable') ?? true,
        'wordFrequency.contentWordsOnly': config.get<boolean>('wordFrequency.contentWordsOnly') ?? true,
        'wordFrequency.posEnabled': config.get<boolean>('wordFrequency.posEnabled') ?? true,
        'wordFrequency.includeBigrams': config.get<boolean>('wordFrequency.includeBigrams') ?? true,
        'wordFrequency.includeTrigrams': config.get<boolean>('wordFrequency.includeTrigrams') ?? true,
        'wordFrequency.enableLemmas': config.get<boolean>('wordFrequency.enableLemmas') ?? false,
        'wordFrequency.lengthHistogramMaxChars': config.get<number>('wordFrequency.lengthHistogramMaxChars') ?? 10,
        'wordFrequency.minCharacterLength': config.get<number>('wordFrequency.minCharacterLength') ?? 1,
        // Word Search
        'wordSearch.defaultTargets': config.get<string>('wordSearch.defaultTargets') ?? 'just',
        'wordSearch.contextWords': config.get<number>('wordSearch.contextWords') ?? 7,
        'wordSearch.clusterWindow': config.get<number>('wordSearch.clusterWindow') ?? 150,
        'wordSearch.minClusterSize': config.get<number>('wordSearch.minClusterSize') ?? 2,
        'wordSearch.caseSensitive': config.get<boolean>('wordSearch.caseSensitive') ?? false,
        'wordSearch.enableAssistantExpansion': config.get<boolean>('wordSearch.enableAssistantExpansion') ?? false,
        // Context resource paths
        'contextPaths.characters': config.get<string>('contextPaths.characters') ?? '',
        'contextPaths.locations': config.get<string>('contextPaths.locations') ?? '',
        'contextPaths.themes': config.get<string>('contextPaths.themes') ?? '',
        'contextPaths.things': config.get<string>('contextPaths.things') ?? '',
        'contextPaths.chapters': config.get<string>('contextPaths.chapters') ?? '',
        'contextPaths.manuscript': config.get<string>('contextPaths.manuscript') ?? '',
        'contextPaths.projectBrief': config.get<string>('contextPaths.projectBrief') ?? '',
        'contextPaths.general': config.get<string>('contextPaths.general') ?? ''
      };

      const message_out: SettingsDataMessage = {
        type: MessageType.SETTINGS_DATA,
        source: 'extension.handler',
        payload: {
          settings
        },
        timestamp: Date.now()
      };
      this.postMessage(message_out);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('settings.general', 'Failed to load settings data', msg);
    }
  }

  async handleUpdateSetting(message: UpdateSettingMessage): Promise<void> {
    try {
      const { key, value } = message.payload;
      const allowedPrefixes = [
        'ui.',
        'publishingStandards.',
        'wordFrequency.',
        'wordSearch.',
        'contextPaths.'
      ];
      const allowedTop = new Set(['includeCraftGuides', 'temperature', 'maxTokens', 'applyContextWindowTrimming']);

      const isAllowed = allowedTop.has(key) || allowedPrefixes.some(prefix => key.startsWith(prefix));
      if (!isAllowed) {
        throw new Error(`Unsupported setting key: ${key}`);
      }

      // Mark this update as webview-originated to prevent echo-back
      this.markWebviewOriginatedUpdate(`proseMinion.${key}`);

      const config = vscode.workspace.getConfiguration('proseMinion');
      await config.update(key, value, true);

      // Only send model data for UI-affecting settings (prevents overwriting settings overlay state during typing)
      if (key === 'ui.showTokenWidget') {
        await this.sendModelData();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('settings.general', 'Failed to update setting', msg);
    }
  }

  async handleResetTokenUsage(): Promise<void> {
    try {
      this.tokenTotals.promptTokens = 0;
      this.tokenTotals.completionTokens = 0;
      this.tokenTotals.totalTokens = 0;

      const message: TokenUsageUpdateMessage = {
        type: MessageType.TOKEN_USAGE_UPDATE,
        source: 'extension.handler',
        payload: {
          totals: { ...this.tokenTotals }
        },
        timestamp: Date.now()
      };
      this.sharedResultCache.tokenUsage = { ...message };
      this.postMessage(message);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('settings.tokens', 'Failed to reset token usage', msg);
    }
  }

  async handleSetModelSelection(message: SetModelSelectionMessage): Promise<void> {
    try {
      const { scope, modelId } = message.payload;
      this.outputChannel.appendLine(
        `[ConfigurationHandler] handleSetModelSelection received: scope=${scope}, modelId=${modelId}`
      );
      const configKey = this.getConfigKeyForScope(scope);
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Config key for scope: ${configKey}`
      );

      // Mark this update as webview-originated to prevent echo-back
      this.markWebviewOriginatedUpdate(`proseMinion.${configKey}`);

      const config = vscode.workspace.getConfiguration('proseMinion');

      await config.update(configKey, modelId, vscode.ConfigurationTarget.Global);
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Config saved: ${configKey} = ${modelId}`
      );

      // Wait a moment for config to be readable (VSCode's config system is async)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Send MODEL_DATA with the updated selection
      // (Config watcher will NOT send it to avoid race conditions)
      await this.sendModelData();
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Sent MODEL_DATA after model selection change`
      );
    } catch (error) {
      const { scope } = message.payload;
      const message_err = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Failed to update model selection for ${scope}: ${message_err}`
      );
      this.sendError('settings.model', 'Failed to update model selection', message_err);
    }
  }

  async handleRequestModelData(message: RequestModelDataMessage): Promise<void> {
    try {
      await this.sendModelData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('settings.model', 'Failed to load model data', msg);
    }
  }

  async sendModelData(): Promise<void> {
    try {
      const recommended = OpenRouterModels.getRecommendedModels();
      const options: ModelOption[] = recommended.map(model => ({
        id: model.id,
        label: model.name,
        description: model.description
      }));

      const selections = this.getEffectiveModelSelections();
      this.outputChannel.appendLine(
        `[ConfigurationHandler] sendModelData: selections = ${JSON.stringify(selections)}`
      );

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

      const config = vscode.workspace.getConfiguration('proseMinion');
      const message: ModelDataMessage = {
        type: MessageType.MODEL_DATA,
        source: 'extension.handler',
        payload: {
          options,
          selections,
          ui: {
            showTokenWidget: config.get<boolean>('ui.showTokenWidget') ?? true
          }
        },
        timestamp: Date.now()
      };

      this.outputChannel.appendLine(
        `[ConfigurationHandler] Sending MODEL_DATA with ${options.length} options and selections: ${JSON.stringify(selections)}`
      );
      this.postMessage(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ConfigurationHandler] Failed to load model data: ${message}`);
      this.sendError('settings.model', 'Failed to load model list', message);
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
      'getResolvedModelSelections' in this.service &&
      typeof (this.service as any).getResolvedModelSelections === 'function'
    ) {
      try {
        const resolved = (this.service as any).getResolvedModelSelections();
        return { ...selections, ...resolved };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[ConfigurationHandler] Unable to read resolved model selections: ${message}`
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
    this.outputChannel.appendLine(`[ConfigurationHandler] refreshServiceConfiguration called`);
    if (
      'refreshConfiguration' in this.service &&
      typeof (this.service as any).refreshConfiguration === 'function'
    ) {
      try {
        await (this.service as any).refreshConfiguration();
        this.outputChannel.appendLine(`[ConfigurationHandler] Service configuration refreshed`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[ConfigurationHandler] Failed to refresh service configuration: ${message}`
        );
      }
    }
  }

  // API Key Management (SecretStorage)

  async handleRequestApiKey(message: RequestApiKeyMessage): Promise<void> {
    try {
      const apiKey = await this.secretsService.getApiKey();
      const response: ApiKeyStatusMessage = {
        type: MessageType.API_KEY_STATUS,
        source: 'extension.handler',
        payload: {
          hasSavedKey: !!apiKey
        },
        timestamp: Date.now()
      };
      this.postMessage(response);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ConfigurationHandler] Error retrieving API key status: ${msg}`);
      this.sendError('settings.api_key', 'Failed to retrieve API key status', msg);
    }
  }

  async handleUpdateApiKey(message: UpdateApiKeyMessage): Promise<void> {
    try {
      const { apiKey } = message.payload;
      if (!apiKey || apiKey.trim().length === 0) {
        throw new Error('API key cannot be empty');
      }

      await this.secretsService.setApiKey(apiKey.trim());
      this.outputChannel.appendLine('[ConfigurationHandler] API key saved to secure storage');

      // Refresh service configuration to pick up new API key
      await this.refreshServiceConfiguration();

      // Send success status
      const response: ApiKeyStatusMessage = {
        type: MessageType.API_KEY_STATUS,
        source: 'extension.handler',
        payload: {
          hasSavedKey: true
        },
        timestamp: Date.now()
      };
      this.postMessage(response);

      // Show user notification
      vscode.window.showInformationMessage('API key saved securely');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ConfigurationHandler] Error saving API key: ${msg}`);
      this.sendError('settings.api_key', 'Failed to save API key', msg);
    }
  }

  async handleDeleteApiKey(message: DeleteApiKeyMessage): Promise<void> {
    try {
      await this.secretsService.deleteApiKey();
      this.outputChannel.appendLine('[ConfigurationHandler] API key removed from secure storage');

      // Refresh service configuration
      await this.refreshServiceConfiguration();

      // Send success status
      const response: ApiKeyStatusMessage = {
        type: MessageType.API_KEY_STATUS,
        source: 'extension.configuration',
        payload: {
          hasSavedKey: false
        },
        timestamp: Date.now()
      };
      this.postMessage(response);

      // Show user notification
      vscode.window.showInformationMessage('API key cleared');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ConfigurationHandler] Error deleting API key: ${msg}`);
      this.sendError('settings.api_key', 'Failed to delete API key', msg);
    }
  }
}
