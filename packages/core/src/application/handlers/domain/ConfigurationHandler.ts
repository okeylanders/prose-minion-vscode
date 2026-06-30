/**
 * Configuration domain handler
 * Handles settings, model selection, and token tracking
 *
 * SPRINT 05 REFACTOR: Now injects AIResourceManager and analysis services directly (facade removed)
 */

import { LogSink, SettingsStore, ShellService } from '@/platform';
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import { DictionaryService } from '@services/dictionary/DictionaryService';
import { ContextAssistantService } from '@services/analysis/ContextAssistantService';
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
} from '@messages';
import {
  MessageTransport,
  ResultCache,
  SecretsPort
} from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '../MessageRouter';
import { CATEGORY_MODELS, CuratedOpenRouterModel, OpenRouterModel, OpenRouterModels } from '@providers/OpenRouterModels';
import { WORD_SEARCH_DEFAULTS } from '@shared/constants/wordSearchDefaults';

export class ConfigurationHandler {
  // Track webview-originated config updates to prevent echo-back
  private webviewOriginatedUpdates = new Set<string>();

  constructor(
    private readonly aiResourceManager: AIResourceManager,
    private readonly assistantToolService: AssistantToolService,
    private readonly dictionaryService: DictionaryService,
    private readonly contextAssistantService: ContextAssistantService,
    private readonly secretsService: SecretsPort,
    private readonly settings: SettingsStore,
    private readonly shell: ShellService,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly resultCache: ResultCache,
    private readonly tokenTotals: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costUsd?: number;
      lastRequestCostUsd?: number;
    }
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

  /**
   * Get word search settings with correct defaults
   */
  public getWordSearchSettings() {
    return {
      contextWords: this.settings.get<number>('proseMinion', 'wordSearch.contextWords', WORD_SEARCH_DEFAULTS.contextWords),
      clusterWindow: this.settings.get<number>('proseMinion', 'wordSearch.clusterWindow', WORD_SEARCH_DEFAULTS.clusterWindow),
      minClusterSize: this.settings.get<number>('proseMinion', 'wordSearch.minClusterSize', WORD_SEARCH_DEFAULTS.minClusterSize),
      caseSensitive: this.settings.get<boolean>('proseMinion', 'wordSearch.caseSensitive', WORD_SEARCH_DEFAULTS.caseSensitive)
    };
  }

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
    this.outputChannel.appendLine(
      `[ConfigurationHandler] Marking ${configKey} as webview-originated (will clear in 100ms)`
    );
    this.webviewOriginatedUpdates.add(configKey);
    setTimeout(() => {
      this.webviewOriginatedUpdates.delete(configKey);
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Cleared webview-originated flag for ${configKey}`
      );
    }, 100);
  }

  /**
   * Check if a config change should be broadcast to the webview
   * Returns false if the change was originated by the webview (to prevent echo-back)
   * For prefixes (e.g., 'proseMinion.wordFrequency'), checks if ANY nested key matches
   */
  public shouldBroadcastConfigChange(configKey: string): boolean {
    // Check exact match first
    if (this.webviewOriginatedUpdates.has(configKey)) {
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Blocking broadcast for ${configKey} (exact match in webview-originated set)`
      );
      return false;
    }

    // For prefix checks (e.g., 'proseMinion.wordFrequency'), check if ANY nested key matches
    // This handles cases where we detect a change at the prefix level but need to check
    // if ANY specific nested key (like 'proseMinion.wordFrequency.minCharacterLength') was webview-originated
    for (const key of this.webviewOriginatedUpdates) {
      if (key.startsWith(configKey + '.')) {
        this.outputChannel.appendLine(
          `[ConfigurationHandler] Blocking broadcast for ${configKey} (prefix match with ${key} in webview-originated set)`
        );
        return false; // Found a webview-originated update for this prefix
      }
    }

    return true;
  }

  async handleRequestSettingsData(message: RequestSettingsDataMessage): Promise<void> {
    try {
      const wordSearchSettings = this.getWordSearchSettings();
      const settings: Record<string, string | number | boolean> = {
        // Core (API key now in SecretStorage, not exposed here)
        'includeCraftGuides': this.settings.get<boolean>('proseMinion', 'includeCraftGuides') ?? true,
        'temperature': this.settings.get<number>('proseMinion', 'temperature') ?? 0.7,
        'maxTokens': this.settings.get<number>('proseMinion', 'maxTokens') ?? 10000,
        'applyContextWindowTrimming': this.settings.get<boolean>('proseMinion', 'applyContextWindowTrimming') ?? true,
        'ui.showTokenWidget': this.settings.get<boolean>('proseMinion', 'ui.showTokenWidget') ?? true,
        'ui.sidebarTheme': this.settings.get<string>('proseMinion', 'ui.sidebarTheme') ?? 'follow-vscode',
        // Publishing standards
        'publishingStandards.preset': this.settings.get<string>('proseMinion', 'publishingStandards.preset') ?? 'none',
        'publishingStandards.pageSizeKey': this.settings.get<string>('proseMinion', 'publishingStandards.pageSizeKey') ?? '',
        // Word Frequency
        'wordFrequency.topN': this.settings.get<number>('proseMinion', 'wordFrequency.topN') ?? 100,
        'wordFrequency.includeHapaxList': this.settings.get<boolean>('proseMinion', 'wordFrequency.includeHapaxList') ?? true,
        'wordFrequency.hapaxDisplayMax': this.settings.get<number>('proseMinion', 'wordFrequency.hapaxDisplayMax') ?? 300,
        'wordFrequency.includeStopwordsTable': this.settings.get<boolean>('proseMinion', 'wordFrequency.includeStopwordsTable') ?? true,
        'wordFrequency.contentWordsOnly': this.settings.get<boolean>('proseMinion', 'wordFrequency.contentWordsOnly') ?? true,
        'wordFrequency.posEnabled': this.settings.get<boolean>('proseMinion', 'wordFrequency.posEnabled') ?? true,
        'wordFrequency.includeBigrams': this.settings.get<boolean>('proseMinion', 'wordFrequency.includeBigrams') ?? true,
        'wordFrequency.includeTrigrams': this.settings.get<boolean>('proseMinion', 'wordFrequency.includeTrigrams') ?? true,
        'wordFrequency.enableLemmas': this.settings.get<boolean>('proseMinion', 'wordFrequency.enableLemmas') ?? false,
        'wordFrequency.lengthHistogramMaxChars': this.settings.get<number>('proseMinion', 'wordFrequency.lengthHistogramMaxChars') ?? 10,
        'wordFrequency.minCharacterLength': this.settings.get<number>('proseMinion', 'wordFrequency.minCharacterLength') ?? 1,
        // Word Search (using getWordSearchSettings method for consistency)
        'wordSearch.contextWords': wordSearchSettings.contextWords,
        'wordSearch.clusterWindow': wordSearchSettings.clusterWindow,
        'wordSearch.minClusterSize': wordSearchSettings.minClusterSize,
        'wordSearch.caseSensitive': wordSearchSettings.caseSensitive,
        'wordSearch.enableAssistantExpansion': this.settings.get<boolean>('proseMinion', 'wordSearch.enableAssistantExpansion') ?? false,
        // Context resource paths
        'contextPaths.characters': this.settings.get<string>('proseMinion', 'contextPaths.characters') ?? '',
        'contextPaths.locations': this.settings.get<string>('proseMinion', 'contextPaths.locations') ?? '',
        'contextPaths.themes': this.settings.get<string>('proseMinion', 'contextPaths.themes') ?? '',
        'contextPaths.things': this.settings.get<string>('proseMinion', 'contextPaths.things') ?? '',
        'contextPaths.chapters': this.settings.get<string>('proseMinion', 'contextPaths.chapters') ?? '',
        'contextPaths.manuscript': this.settings.get<string>('proseMinion', 'contextPaths.manuscript') ?? '',
        'contextPaths.projectBrief': this.settings.get<string>('proseMinion', 'contextPaths.projectBrief') ?? '',
        'contextPaths.general': this.settings.get<string>('proseMinion', 'contextPaths.general') ?? ''
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

      await this.settings.update('proseMinion', key, value);

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
      // Reset clears cumulative cost AND the last-request cost so the widget
      // returns to a clean slate, not a lingering "Last request $X".
      this.tokenTotals.costUsd = 0;
      this.tokenTotals.lastRequestCostUsd = undefined;

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
      this.resultCache.tokenUsage = { ...message };
      void this.postMessage(message);
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


      await this.settings.update('proseMinion', configKey, modelId);
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Config saved: ${configKey} = ${modelId}`
      );

      // Wait a moment for config to be readable (VSCode's config system is async)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Send MODEL_DATA with the updated selection
      // (Config watcher will NOT send it to avoid race conditions).
      // Reuse the cached catalog — the refresh point is browser-open, not selection,
      // so a pick doesn't trigger a second full ~500KB catalog re-fetch.
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
      await this.sendModelData({ refreshCatalog: message.payload?.refresh === true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('settings.model', 'Failed to load model data', msg);
    }
  }

  async sendModelData(options: { refreshCatalog?: boolean } = {}): Promise<void> {
    try {
      if (options.refreshCatalog) {
        OpenRouterModels.clearCache();
      }

      const recommended = OpenRouterModels.getRecommendedModels();
      const liveModels = await OpenRouterModels.fetchModels(this.outputChannel);
      const liveModelsById = new Map(liveModels.map(model => [model.id, model]));

      // A catalog made entirely of fallback entries means the live fetch failed.
      // Log the degraded state so the on-call sees WHY every card reads
      // "pricing unavailable" instead of a success line that hides it.
      const liveFetchDegraded = liveModels.length > 0 && liveModels.every(model => model.isFallback);
      if (liveFetchDegraded) {
        this.outputChannel.appendLine(
          `[ConfigurationHandler] WARN: live OpenRouter catalog unavailable — all ${liveModels.length} models using offline fallback (pricing/context hidden). Reopen the model browser to retry.`
        );
      }

      const modelOptions = this.buildModelOptions(recommended, liveModelsById);
      const categoryOptions = this.buildModelOptions(CATEGORY_MODELS, liveModelsById);

      const selections = this.getEffectiveModelSelections();
      this.outputChannel.appendLine(
        `[ConfigurationHandler] sendModelData: selections = ${JSON.stringify(selections)}`
      );

      const seen = new Set(modelOptions.map(option => option.id));
      Object.values(selections).forEach(modelId => {
        if (modelId && !seen.has(modelId)) {
          modelOptions.push(this.buildCustomModelOption(modelId, liveModelsById.get(modelId)));
          seen.add(modelId);
        }
      });

      const message: ModelDataMessage = {
        type: MessageType.MODEL_DATA,
        source: 'extension.handler',
        payload: {
          options: modelOptions,
          categoryOptions,
          selections,
          ui: {
            showTokenWidget: this.settings.get<boolean>('proseMinion', 'ui.showTokenWidget') ?? true
          }
        },
        timestamp: Date.now()
      };

      this.outputChannel.appendLine(
        `[ConfigurationHandler] Sending MODEL_DATA with ${modelOptions.length} options and selections: ${JSON.stringify(selections)}`
      );
      void this.postMessage(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ConfigurationHandler] Failed to load model data: ${message}`);
      this.sendError('settings.model', 'Failed to load model list', message);
    }
  }

  private buildModelOptions(
    curatedModels: CuratedOpenRouterModel[],
    liveModelsById: Map<string, OpenRouterModel>
  ): ModelOption[] {
    return curatedModels.map(model => this.buildModelOption(model, liveModelsById.get(model.id)));
  }

  private buildModelOption(curated: CuratedOpenRouterModel, live?: OpenRouterModel): ModelOption {
    const pricingAvailable = this.hasLivePricing(live);

    return {
      id: curated.id,
      label: curated.name,
      description: curated.description,
      family: curated.family,
      provider: this.getProviderName(curated.id),
      releaseDate: this.getReleaseDate(live),
      knowledgeCutoff: live?.knowledge_cutoff,
      expirationDate: live?.expiration_date,
      contextLength: live && !live.isFallback ? live.context_length : undefined,
      pricing: pricingAvailable ? live?.pricing : undefined,
      pricingAvailable,
      liveDataAvailable: Boolean(live && !live.isFallback)
    };
  }

  private buildCustomModelOption(modelId: string, live?: OpenRouterModel): ModelOption {
    const pricingAvailable = this.hasLivePricing(live);

    return {
      id: modelId,
      label: live?.name ?? modelId,
      description: live?.description ?? 'Custom model (from settings)',
      family: live?.family,
      provider: this.getProviderName(modelId),
      releaseDate: this.getReleaseDate(live),
      knowledgeCutoff: live?.knowledge_cutoff,
      expirationDate: live?.expiration_date,
      contextLength: live && !live.isFallback ? live.context_length : undefined,
      pricing: pricingAvailable ? live?.pricing : undefined,
      pricingAvailable,
      liveDataAvailable: Boolean(live && !live.isFallback)
    };
  }

  private hasLivePricing(live?: OpenRouterModel): boolean {
    if (!live || live.isFallback) {
      return false;
    }

    const prompt = Number(live.pricing?.prompt);
    const completion = Number(live.pricing?.completion);
    return Number.isFinite(prompt) && Number.isFinite(completion);
  }

  private getReleaseDate(live?: OpenRouterModel): string | undefined {
    if (!live?.created || live.isFallback) {
      return undefined;
    }

    return new Date(live.created * 1000).toISOString().slice(0, 10);
  }

  private getProviderName(modelId: string): string {
    return modelId.split('/')[0] ?? 'custom';
  }

  private getEffectiveModelSelections(): Partial<Record<ModelScope, string>> {
    const fallback = 'anthropic/claude-sonnet-5';

    const selections: Partial<Record<ModelScope, string>> = {
      assistant: this.settings.get<string>('proseMinion', 'assistantModel') || fallback,
      dictionary: this.settings.get<string>('proseMinion', 'dictionaryModel') || fallback,
      context: this.settings.get<string>('proseMinion', 'contextModel') || fallback,
      category: this.settings.get<string>('proseMinion', 'categoryModel') || fallback
    };

    // SPRINT 05: Get resolved model selections from AIResourceManager
    try {
      const resolved = this.aiResourceManager.getResolvedModelSelections();
      return { ...selections, ...resolved };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Unable to read resolved model selections: ${message}`
      );
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
      case 'category':
        return 'categoryModel';
      default:
        const exhaustiveCheck: never = scope;
        throw new Error(`Unknown model scope: ${exhaustiveCheck}`);
    }
  }

  private async refreshServiceConfiguration(): Promise<void> {
    this.outputChannel.appendLine(`[ConfigurationHandler] refreshServiceConfiguration called`);
    // SPRINT 05: Refresh configuration on all services that need it
    try {
      await this.aiResourceManager.refreshConfiguration();
      await this.assistantToolService.refreshConfiguration();
      await this.dictionaryService.refreshConfiguration();
      await this.contextAssistantService.refreshConfiguration();
      this.outputChannel.appendLine(`[ConfigurationHandler] Service configuration refreshed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Failed to refresh service configuration: ${message}`
      );
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
      void this.shell.showInformationMessage('API key saved securely');
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
      void this.shell.showInformationMessage('API key cleared');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ConfigurationHandler] Error deleting API key: ${msg}`);
      this.sendError('settings.api_key', 'Failed to delete API key', msg);
    }
  }
}
