/**
 * Configuration domain handler
 * Handles settings, model selection, and token tracking
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../../domain/services/IProseAnalysisService';
import {
  RequestSettingsDataMessage,
  UpdateSettingMessage,
  SetModelSelectionMessage,
  RequestModelDataMessage,
  ModelDataMessage,
  ModelScope,
  ModelOption,
  TokenUsageUpdateMessage,
  MessageType
} from '../../../shared/types/messages';
import { OpenRouterModels } from '../../../infrastructure/api/OpenRouterModels';

export class ConfigurationHandler {
  constructor(
    private readonly service: IProseAnalysisService,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly postMessage: (message: any) => void,
    private readonly sendError: (message: string, details?: string) => void,
    private readonly sharedResultCache: any,
    private readonly tokenTotals: { promptTokens: number; completionTokens: number; totalTokens: number }
  ) {}

  async handleRequestSettingsData(message: RequestSettingsDataMessage): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const settings: Record<string, string | number | boolean> = {
      // Core
      'openRouterApiKey': config.get<string>('openRouterApiKey') ?? '',
      'includeCraftGuides': config.get<boolean>('includeCraftGuides') ?? true,
      'temperature': config.get<number>('temperature') ?? 0.7,
      'maxTokens': config.get<number>('maxTokens') ?? 10000,
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
      // Word Search
      'wordSearch.defaultTargets': config.get<string>('wordSearch.defaultTargets') ?? 'just',
      'wordSearch.contextWords': config.get<number>('wordSearch.contextWords') ?? 7,
      'wordSearch.clusterWindow': config.get<number>('wordSearch.clusterWindow') ?? 150,
      'wordSearch.minClusterSize': config.get<number>('wordSearch.minClusterSize') ?? 2,
      'wordSearch.caseSensitive': config.get<boolean>('wordSearch.caseSensitive') ?? false,
      'wordSearch.enableAssistantExpansion': config.get<boolean>('wordSearch.enableAssistantExpansion') ?? false
    };

    const message_out = {
      type: MessageType.SETTINGS_DATA,
      settings,
      timestamp: Date.now()
    };
    this.postMessage(message_out);
  }

  async handleUpdateSetting(message: UpdateSettingMessage): Promise<void> {
    try {
      const allowedPrefixes = [
        'ui.',
        'publishingStandards.',
        'wordFrequency.',
        'wordSearch.'
      ];
      const allowedTop = new Set(['openRouterApiKey', 'includeCraftGuides', 'temperature', 'maxTokens']);

      const isAllowed = allowedTop.has(message.key) || allowedPrefixes.some(prefix => message.key.startsWith(prefix));
      if (!isAllowed) {
        throw new Error(`Unsupported setting key: ${message.key}`);
      }

      const config = vscode.workspace.getConfiguration('proseMinion');
      await config.update(message.key, message.value, true);

      // Push updated model data for UI-affecting settings (e.g., ui.showTokenWidget)
      await this.sendModelData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('Failed to update setting', msg);
    }
  }

  async handleResetTokenUsage(): Promise<void> {
    this.tokenTotals.promptTokens = 0;
    this.tokenTotals.completionTokens = 0;
    this.tokenTotals.totalTokens = 0;

    const message: TokenUsageUpdateMessage = {
      type: MessageType.TOKEN_USAGE_UPDATE,
      totals: { ...this.tokenTotals },
      timestamp: Date.now()
    };
    this.sharedResultCache.tokenUsage = { ...message };
    this.postMessage(message);
  }

  async handleSetModelSelection(message: SetModelSelectionMessage): Promise<void> {
    try {
      const configKey = this.getConfigKeyForScope(message.scope);
      const config = vscode.workspace.getConfiguration('proseMinion');

      await config.update(configKey, message.modelId, vscode.ConfigurationTarget.Global);
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Updated ${message.scope} model selection to ${message.modelId}`
      );
      await this.refreshServiceConfiguration();
      await this.sendModelData();
    } catch (error) {
      const message_err = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[ConfigurationHandler] Failed to update model selection for ${message.scope}: ${message_err}`
      );
      this.sendError('Failed to update model selection', message_err);
    }
  }

  async handleRequestModelData(message: RequestModelDataMessage): Promise<void> {
    await this.sendModelData();
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
        options,
        selections,
        ui: {
          showTokenWidget: config.get<boolean>('ui.showTokenWidget') ?? true
        },
        timestamp: Date.now()
      };

      this.postMessage(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ConfigurationHandler] Failed to load model data: ${message}`);
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
    if (
      'refreshConfiguration' in this.service &&
      typeof (this.service as any).refreshConfiguration === 'function'
    ) {
      try {
        await (this.service as any).refreshConfiguration();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[ConfigurationHandler] Failed to refresh service configuration: ${message}`
        );
      }
    }
  }
}
