/**
 * AIResourceManager
 *
 * Single Responsibility: Manage OpenRouterClient and AgentRunEngine lifecycle per model scope
 *
 * This is the most critical service in the refactor. It handles the complex lifecycle
 * of AI resources including:
 * - API key retrieval (SecretStorage with settings fallback)
 * - Model scope resolution (assistant, dictionary, context)
 * - OpenRouterClient creation per scope
 * - AgentRunEngine lifecycle management
 * - StatusCallback propagation
 * - Resource disposal and cleanup
 *
 * CRITICAL: This service must preserve exact behavior from ProseAnalysisService
 */

import { LogSink, SettingsStore } from '@/platform';
import { ListenerSet } from '@/utils/ListenerSet';
import { TokenUsage } from '@shared/types';
import { OpenRouterClient } from '@providers/OpenRouterClient';
import { AgentRunEngine, StatusCallback, TokenUsageCallback } from './AgentRunEngine';
import { ConversationManager } from './ConversationManager';
import { ModelScope } from '@shared/types';
import { SecretStorageService } from '@/infrastructure/secrets/SecretStorageService';
import { ResourceLoaderService } from './ResourceLoaderService';
import { GuideCapability } from './capabilities/GuideCapability';
import { ContextFileCapability } from './capabilities/ContextFileCapability';
import { ContextResourceProvider } from '@/domain/models/ContextGeneration';

/**
 * Bundle of AI resources for a specific model scope
 */
export interface AIResourceBundle {
  model: string;
  generation: number;
  engine: AgentRunEngine;
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
  private generation = 0;
  private initialized = false;
  private initialization?: Promise<void>;
  private statusCallback?: StatusCallback;
  private readonly tokenUsageListeners: ListenerSet<[TokenUsage]>;

  /**
   * Single stable closure handed to every orchestrator: fans token usage out
   * to all registered listeners — one per live webview MessageHandler, now
   * that the sidebar and the Workshop panel share this manager (ADR
   * 2026-07-03). Stable identity means re-initialized orchestrators can never
   * hold a stale generation of listeners.
   */
  private readonly tokenUsageFanout: TokenUsageCallback = (usage) => {
    this.tokenUsageListeners.emit(usage);
  };

  constructor(
    private readonly resourceLoader: ResourceLoaderService,
    private readonly secretsService: SecretStorageService,
    private readonly settings: SettingsStore,
    private readonly outputChannel?: LogSink
  ) {
    this.tokenUsageListeners = new ListenerSet(
      '[AIResourceManager] Token usage listener',
      outputChannel
    );
  }

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
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (!this.initialization) {
      this.initialization = this.startRebuild();
    }
    await this.initialization;
  }

  /** Rebuild only for an explicit configuration change. */
  async refreshConfiguration(): Promise<void> {
    this.initialization = this.startRebuild();
    await this.initialization;
  }

  /**
   * Apply model-selection changes in place. Engines and their conversation
   * managers survive; only future provider requests use the new model.
   * Duplicate calls from multiple live webview surfaces are idempotent.
   */
  async refreshModelSelections(): Promise<void> {
    await this.ensureInitialized();
    const selections = this.resolveModelSelections();

    for (const scope of Object.keys(selections) as ModelScope[]) {
      const model = selections[scope];
      const resource = this.aiResources[scope];
      if (!resource || resource.model === model) {
        continue;
      }
      const previousModel = resource.model;
      resource.engine.setModel(model);
      resource.model = model;
      this.outputChannel?.appendLine(
        `[AIResourceManager] Hot-swapped ${scope} model: ${previousModel} → ${model} (generation ${resource.generation}; conversations preserved)`
      );
    }
    this.resolvedModels = { ...selections };
  }

  /**
   * A failed build must not poison the singleton: clear the cached promise
   * on rejection so the next call retries instead of re-awaiting the corpse.
   */
  private startRebuild(): Promise<void> {
    return this.rebuildResources().catch(error => {
      this.initialization = undefined;
      this.outputChannel?.appendLine(
        `[AIResourceManager] Resource build failed; will retry on next use: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    });
  }

  private async rebuildResources(
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
    this.generation += 1;

    // Check if API key is configured
    if (!OpenRouterClient.isConfigured(apiKey)) {
      this.outputChannel?.appendLine('[AIResourceManager] OpenRouter API key not configured. AI tools disabled.');
      this.resolvedModels = {};
      this.initialized = true;
      return;
    }

    // Resolve model selections with fallbacks
    const selections = this.resolveModelSelections(modelConfig);
    const assistantModel = selections.assistant;
    const dictionaryModel = selections.dictionary;
    const contextModel = selections.context;
    const categoryModel = selections.category;

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
    this.initialized = true;
  }

  private resolveModelSelections(modelConfig?: ModelConfiguration): Record<ModelScope, string> {
    const fallbackModel = modelConfig?.fallbackModel ?? 'anthropic/claude-sonnet-5';
    return {
      assistant: modelConfig?.assistantModel
        ?? this.settings.get<string>('proseMinion', 'assistantModel')
        ?? fallbackModel,
      dictionary: modelConfig?.dictionaryModel
        ?? this.settings.get<string>('proseMinion', 'dictionaryModel')
        ?? fallbackModel,
      context: modelConfig?.contextModel
        ?? this.settings.get<string>('proseMinion', 'contextModel')
        ?? fallbackModel,
      category: modelConfig?.categoryModel
        ?? this.settings.get<string>('proseMinion', 'categoryModel')
        ?? fallbackModel
    };
  }

  /**
   * Get the manager-owned agent-run engine for a specific model scope.
   *
   * @param scope - The model scope ('assistant', 'dictionary', 'context')
   * @returns AgentRunEngine if available, undefined otherwise
   */
  getEngine(scope: ModelScope): AgentRunEngine | undefined {
    return this.aiResources[scope]?.engine;
  }

  getGeneration(scope: ModelScope): number | undefined {
    return this.aiResources[scope]?.generation;
  }

  /** Build the bounded guides adapter used by explicitly guides-scoped routes. */
  createGuideCapability(): GuideCapability {
    return new GuideCapability(
      this.resourceLoader.getGuideRegistry(),
      this.resourceLoader.getGuideLoader(),
      this.settings,
      this.outputChannel
    );
  }

  /** Build the bounded project-context adapter used by context-scoped routes. */
  createContextFileCapability(provider: ContextResourceProvider): ContextFileCapability {
    return new ContextFileCapability(provider, this.settings, this.outputChannel);
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
   * This callback is propagated to all AgentRunEngines.
   *
   * @param callback - Status callback function
   */
  setStatusCallback(callback?: StatusCallback): void {
    this.statusCallback = callback;
    Object.values(this.aiResources).forEach(resource => {
      resource?.engine.setStatusCallback(callback);
    });
  }

  /**
   * Subscribe to per-request token usage (centralized token tracking).
   *
   * Every engine reports through one stable fan-out, so multiple
   * webview MessageHandlers can track usage concurrently without stealing
   * each other's callback slot. Returns an unsubscribe function — callers own
   * their registration and MUST release it on dispose.
   */
  addTokenUsageListener(listener: TokenUsageCallback): () => void {
    return this.tokenUsageListeners.add(listener);
  }

  /**
   * Dispose of all AI resources (cleanup)
   *
   * This disposes all AgentRunEngines and clears the resource map.
   */
  disposeResources(): void {
    Object.values(this.aiResources).forEach(resource => {
      resource?.engine.dispose();
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
    this.initialized = false;
    this.initialization = undefined;
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
      const client = new OpenRouterClient(apiKey, model, this.outputChannel);
      const conversationManager = new ConversationManager(this.outputChannel);
      const engine = new AgentRunEngine(
        client,
        conversationManager,
        this.statusCallback,
        this.outputChannel,
        this.tokenUsageFanout,
        this.settings
      );

      this.outputChannel?.appendLine(
        `[AIResourceManager] Initialized ${scope} model: ${model} (generation ${this.generation})`
      );

      return {
        model,
        generation: this.generation,
        engine
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
