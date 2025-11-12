/**
 * AIResourceManager
 *
 * Single Responsibility: Manage OpenRouterClient and AIResourceOrchestrator lifecycle per model scope
 *
 * This is the most critical service in the refactor. It handles the complex lifecycle
 * of AI resources including:
 * - API key retrieval (SecretStorage with settings fallback)
 * - Model scope resolution (assistant, dictionary, context)
 * - OpenRouterClient creation per scope
 * - AIResourceOrchestrator lifecycle management
 * - StatusCallback propagation
 * - Resource disposal and cleanup
 *
 * CRITICAL: This service must preserve exact behavior from ProseAnalysisService
 */

import * as vscode from 'vscode';
import { OpenRouterClient } from '../../OpenRouterClient';
import { AIResourceOrchestrator, StatusCallback } from '../../../../application/services/AIResourceOrchestrator';
import { ConversationManager } from '../../../../application/services/ConversationManager';
import { GuideRegistry } from '../../../guides/GuideRegistry';
import { GuideLoader } from '../../../../tools/shared/guides';
import { ModelScope } from '../../../../shared/types';
import { SecretStorageService } from '../../../secrets/SecretStorageService';
import { ResourceLoaderService } from './ResourceLoaderService';

/**
 * Bundle of AI resources for a specific model scope
 */
export interface AIResourceBundle {
  model: string;
  orchestrator: AIResourceOrchestrator;
}

/**
 * Configuration for AI resource initialization
 */
export interface ModelConfiguration {
  assistantModel?: string;
  dictionaryModel?: string;
  contextModel?: string;
  fallbackModel?: string;
}

export class AIResourceManager {
  private aiResources: Partial<Record<ModelScope, AIResourceBundle>> = {};
  private resolvedModels: Partial<Record<ModelScope, string>> = {};
  private statusCallback?: StatusCallback;

  constructor(
    private readonly resourceLoader: ResourceLoaderService,
    private readonly secretsService: SecretStorageService,
    private readonly outputChannel?: vscode.OutputChannel
  ) {}

  /**
   * Initialize AI resources for all model scopes
   *
   * This method:
   * 1. Retrieves API key from SecretStorage (fallback to settings)
   * 2. Disposes existing resources
   * 3. Resolves model selections per scope with fallbacks
   * 4. Creates AIResourceBundle for each scope
   * 5. Propagates status callbacks
   *
   * @param apiKey - Optional API key override (if not provided, retrieves from storage)
   * @param modelConfig - Optional model configuration override
   */
  async initializeResources(
    apiKey?: string,
    modelConfig?: ModelConfiguration
  ): Promise<void> {
    // Get API key from SecretStorage (fallback to settings for backward compatibility)
    if (!apiKey) {
      apiKey = await this.secretsService.getApiKey();

      // Fallback to settings if not in SecretStorage (backward compatibility)
      if (!apiKey) {
        const config = vscode.workspace.getConfiguration('proseMinion');
        apiKey = config.get<string>('openRouterApiKey');
      }
    }

    // Dispose existing resources before creating new ones
    this.disposeResources();

    // Check if API key is configured
    if (!OpenRouterClient.isConfigured(apiKey)) {
      this.outputChannel?.appendLine('[AIResourceManager] OpenRouter API key not configured. AI tools disabled.');
      this.resolvedModels = {};
      return;
    }

    // Resolve model selections with fallbacks
    const config = vscode.workspace.getConfiguration('proseMinion');
    const fallbackModel = modelConfig?.fallbackModel ?? config.get<string>('model') ?? 'z-ai/glm-4.6';
    const assistantModel = modelConfig?.assistantModel ?? config.get<string>('assistantModel') ?? fallbackModel;
    const dictionaryModel = modelConfig?.dictionaryModel ?? config.get<string>('dictionaryModel') ?? fallbackModel;
    const contextModel = modelConfig?.contextModel ?? config.get<string>('contextModel') ?? fallbackModel;

    // Create AI resources for each scope
    const assistantResources = this.createResourceBundle(apiKey!, 'assistant', assistantModel);
    const dictionaryResources = this.createResourceBundle(apiKey!, 'dictionary', dictionaryModel);
    const contextResources = this.createResourceBundle(apiKey!, 'context', contextModel);

    this.aiResources = {
      assistant: assistantResources,
      dictionary: dictionaryResources,
      context: contextResources
    };

    // Propagate status callback to all orchestrators
    if (this.statusCallback) {
      Object.values(this.aiResources).forEach(resource => {
        resource?.orchestrator.setStatusCallback(this.statusCallback!);
      });
    }

    // Store resolved models (with fallbacks applied)
    this.resolvedModels = {
      assistant: assistantModel,
      dictionary: dictionaryModel,
      context: contextModel
    };
  }

  /**
   * Get the AIResourceOrchestrator for a specific model scope
   *
   * @param scope - The model scope ('assistant', 'dictionary', 'context')
   * @returns AIResourceOrchestrator if available, undefined otherwise
   */
  getOrchestrator(scope: ModelScope): AIResourceOrchestrator | undefined {
    return this.aiResources[scope]?.orchestrator;
  }

  /**
   * Get the resolved model for a specific scope
   *
   * @param scope - The model scope ('assistant', 'dictionary', 'context')
   * @returns Resolved model string if available, undefined otherwise
   */
  getResolvedModel(scope: ModelScope): string | undefined {
    return this.resolvedModels[scope];
  }

  /**
   * Get all resolved model selections (with fallbacks applied)
   *
   * @returns Partial record of model scope to resolved model string
   */
  getResolvedModelSelections(): Partial<Record<ModelScope, string>> {
    return { ...this.resolvedModels };
  }

  /**
   * Set the status callback for guide loading notifications
   *
   * This callback is propagated to all AIResourceOrchestrators
   *
   * @param callback - Status callback function
   */
  setStatusCallback(callback: StatusCallback): void {
    this.statusCallback = callback;
    Object.values(this.aiResources).forEach(resource => {
      resource?.orchestrator.setStatusCallback(callback);
    });
  }

  /**
   * Refresh configuration by reinitializing all resources
   *
   * This is called when configuration changes (API key, model selections, etc.)
   */
  async refreshConfiguration(): Promise<void> {
    await this.initializeResources();
  }

  /**
   * Dispose of all AI resources (cleanup)
   *
   * This disposes all AIResourceOrchestrators and clears the resource map
   */
  disposeResources(): void {
    Object.values(this.aiResources).forEach(resource => {
      resource?.orchestrator.dispose();
    });
    this.aiResources = {};
  }

  /**
   * Dispose of the service (cleanup)
   *
   * Public disposal method for external cleanup
   */
  dispose(): void {
    this.disposeResources();
    this.resolvedModels = {};
    this.statusCallback = undefined;
  }

  /**
   * Create an AIResourceBundle for a specific model scope
   *
   * @param apiKey - OpenRouter API key
   * @param scope - Model scope ('assistant', 'dictionary', 'context')
   * @param model - Model identifier string
   * @returns AIResourceBundle if successful, undefined otherwise
   */
  private createResourceBundle(
    apiKey: string,
    scope: ModelScope,
    model: string
  ): AIResourceBundle | undefined {
    try {
      const guideRegistry = this.resourceLoader.getGuideRegistry();
      const guideLoader = this.resourceLoader.getGuideLoader();

      const client = new OpenRouterClient(apiKey, model);
      const conversationManager = new ConversationManager();
      const orchestrator = new AIResourceOrchestrator(
        client,
        conversationManager,
        guideRegistry,
        guideLoader,
        this.statusCallback,
        this.outputChannel
      );

      this.outputChannel?.appendLine(
        `[AIResourceManager] Initialized ${scope} model: ${model}`
      );

      return {
        model,
        orchestrator
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(
        `[AIResourceManager] Failed to initialize ${scope} model ${model}: ${message}`
      );
      return undefined;
    }
  }
}
