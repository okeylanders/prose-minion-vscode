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

import { LogSink, SettingsStore } from '@/platform';
import { OpenRouterClient } from '@providers/OpenRouterClient';
import { AIResourceOrchestrator, StatusCallback, TokenUsageCallback } from './AIResourceOrchestrator';
import { ConversationManager } from './ConversationManager';
import { GuideRegistry } from '@/infrastructure/guides/GuideRegistry';
import { GuideLoader } from '@/tools/shared/guides';
import { ModelScope } from '@shared/types';
import { SecretStorageService } from '@/infrastructure/secrets/SecretStorageService';
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
  categoryModel?: string;
  fallbackModel?: string;
}

export class AIResourceManager {
  private aiResources: Partial<Record<ModelScope, AIResourceBundle>> = {};
  private resolvedModels: Partial<Record<ModelScope, string>> = {};
  private statusCallback?: StatusCallback;
  private readonly tokenUsageListeners = new Set<TokenUsageCallback>();

  /**
   * Single stable closure handed to every orchestrator: fans token usage out
   * to all registered listeners — one per live webview MessageHandler, now
   * that the sidebar and the Workshop panel share this manager (ADR
   * 2026-07-03). Stable identity means re-initialized orchestrators can never
   * hold a stale generation of listeners.
   */
  private readonly tokenUsageFanout: TokenUsageCallback = (usage) => {
    for (const listener of [...this.tokenUsageListeners]) {
      try {
        listener(usage);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.outputChannel?.appendLine(`[AIResourceManager] Token usage listener threw: ${message}`);
      }
    }
  };

  constructor(
    private readonly resourceLoader: ResourceLoaderService,
    private readonly secretsService: SecretStorageService,
    private readonly settings: SettingsStore,
    private readonly outputChannel?: LogSink
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
        apiKey = this.settings.get<string>('proseMinion', 'openRouterApiKey');
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
    const fallbackModel = modelConfig?.fallbackModel ?? 'anthropic/claude-sonnet-5';
    const assistantModel = modelConfig?.assistantModel ?? this.settings.get<string>('proseMinion', 'assistantModel') ?? fallbackModel;
    const dictionaryModel = modelConfig?.dictionaryModel ?? this.settings.get<string>('proseMinion', 'dictionaryModel') ?? fallbackModel;
    const contextModel = modelConfig?.contextModel ?? this.settings.get<string>('proseMinion', 'contextModel') ?? fallbackModel;
    const categoryModel = modelConfig?.categoryModel ?? this.settings.get<string>('proseMinion', 'categoryModel') ?? fallbackModel;

    // Create AI resources for each scope
    const assistantResources = this.createResourceBundle(apiKey!, 'assistant', assistantModel);
    const dictionaryResources = this.createResourceBundle(apiKey!, 'dictionary', dictionaryModel);
    const contextResources = this.createResourceBundle(apiKey!, 'context', contextModel);
    const categoryResources = this.createResourceBundle(apiKey!, 'category', categoryModel);

    this.aiResources = {
      assistant: assistantResources,
      dictionary: dictionaryResources,
      context: contextResources,
      category: categoryResources
    };

    // Note: Both statusCallback and tokenUsageCallback are passed in constructor
    // via createResourceBundle(), so no post-construction propagation needed

    // Store resolved models (with fallbacks applied)
    this.resolvedModels = {
      assistant: assistantModel,
      dictionary: dictionaryModel,
      context: contextModel,
      category: categoryModel
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
  setStatusCallback(callback?: StatusCallback): void {
    this.statusCallback = callback;
    Object.values(this.aiResources).forEach(resource => {
      resource?.orchestrator.setStatusCallback(callback);
    });
  }

  /**
   * Subscribe to per-request token usage (centralized token tracking).
   *
   * Every orchestrator reports through one stable fan-out, so multiple
   * webview MessageHandlers can track usage concurrently without stealing
   * each other's callback slot. Returns an unsubscribe function — callers own
   * their registration and MUST release it on dispose.
   */
  addTokenUsageListener(listener: TokenUsageCallback): () => void {
    this.tokenUsageListeners.add(listener);
    return () => {
      this.tokenUsageListeners.delete(listener);
    };
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
    this.tokenUsageListeners.clear();
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

      const client = new OpenRouterClient(apiKey, model, this.outputChannel);
      const conversationManager = new ConversationManager(this.outputChannel);
      const orchestrator = new AIResourceOrchestrator(
        client,
        conversationManager,
        guideRegistry,
        guideLoader,
        this.settings,
        this.statusCallback,
        this.outputChannel,
        this.tokenUsageFanout
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
