/**
 * Implementation of IProseAnalysisService
 * Integrates all prose analysis tools
 */

import * as vscode from 'vscode';
import { IProseAnalysisService } from '../../domain/services/IProseAnalysisService';
import { AnalysisResult, MetricsResult, AnalysisResultFactory } from '../../domain/models/AnalysisResult';
import { OpenRouterClient } from './OpenRouterClient';
import { PromptLoader } from '../../tools/shared/prompts';
import { GuideLoader } from '../../tools/shared/guides';
import { DialogueMicrobeatAssistant } from '../../tools/assist/dialogueMicrobeatAssistant';
import { ProseAssistant } from '../../tools/assist/proseAssistant';
import { PassageProseStats } from '../../tools/measure/passageProseStats';
import { StyleFlags } from '../../tools/measure/styleFlags';
import { WordFrequency } from '../../tools/measure/wordFrequency';
import { AIResourceOrchestrator, StatusCallback } from '../../application/services/AIResourceOrchestrator';
import { ConversationManager } from '../../application/services/ConversationManager';
import { GuideRegistry } from '../../infrastructure/guides/GuideRegistry';
import { DictionaryUtility } from '../../tools/utility/dictionaryUtility';
import { ModelScope } from '../../shared/types';

interface AIResourceBundle {
  model: string;
  orchestrator: AIResourceOrchestrator;
}

export class ProseAnalysisService implements IProseAnalysisService {
  private proseStats: PassageProseStats;
  private styleFlags: StyleFlags;
  private wordFrequency: WordFrequency;

  private statusCallback?: StatusCallback;

  private promptLoader?: PromptLoader;
  private guideLoader?: GuideLoader;
  private guideRegistry?: GuideRegistry;

  private aiResources: Partial<Record<ModelScope, AIResourceBundle>> = {};
  private resolvedModels: Partial<Record<ModelScope, string>> = {};

  private dialogueAssistant?: DialogueMicrobeatAssistant;
  private proseAssistant?: ProseAssistant;
  private dictionaryUtility?: DictionaryUtility;

  constructor(
    private readonly extensionUri?: vscode.Uri,
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    // Initialize measurement tools (don't need API key)
    this.proseStats = new PassageProseStats();
    this.styleFlags = new StyleFlags();
    this.wordFrequency = new WordFrequency();

    // Initialize AI tools if API key is configured
    this.initializeAITools();
  }

  private async initializeAITools(): Promise<void> {
    const config = vscode.workspace.getConfiguration('proseMinion');
    const apiKey = config.get<string>('openRouterApiKey');

    this.disposeAIResources();

    if (!OpenRouterClient.isConfigured(apiKey)) {
      this.outputChannel?.appendLine('[ProseAnalysisService] OpenRouter API key not configured. AI tools disabled.');
      this.dialogueAssistant = undefined;
      this.proseAssistant = undefined;
      this.dictionaryUtility = undefined;
      this.resolvedModels = {};
      return;
    }

    if (!this.extensionUri) {
      this.outputChannel?.appendLine('[ProseAnalysisService] Extension URI unavailable; cannot initialize AI tools.');
      return;
    }

    this.ensureSharedResources();

    const fallbackModel = config.get<string>('model') || 'z-ai/glm-4.6';
    const assistantModel = config.get<string>('assistantModel') || fallbackModel;
    const dictionaryModel = config.get<string>('dictionaryModel') || fallbackModel;
    const contextModel = config.get<string>('contextModel') || fallbackModel;

    const assistantResources = this.createAIResources(apiKey!, 'assistant', assistantModel);
    const dictionaryResources = this.createAIResources(apiKey!, 'dictionary', dictionaryModel);
    const contextResources = this.createAIResources(apiKey!, 'context', contextModel);

    this.aiResources = {
      assistant: assistantResources,
      dictionary: dictionaryResources,
      context: contextResources
    };

    if (assistantResources) {
      this.dialogueAssistant = new DialogueMicrobeatAssistant(
        assistantResources.orchestrator,
        this.promptLoader!
      );

      this.proseAssistant = new ProseAssistant(
        assistantResources.orchestrator,
        this.promptLoader!
      );
    } else {
      this.dialogueAssistant = undefined;
      this.proseAssistant = undefined;
    }

    this.dictionaryUtility = dictionaryResources
      ? new DictionaryUtility(dictionaryResources.orchestrator, this.promptLoader!)
      : undefined;

    const callback = this.statusCallback;
    if (callback) {
      Object.values(this.aiResources).forEach(resource => resource?.orchestrator.setStatusCallback(callback));
    }

    this.resolvedModels = {
      assistant: assistantModel,
      dictionary: dictionaryModel,
      context: contextModel
    };
  }

  /**
   * Set the status callback for guide loading notifications
   * This should be called by the MessageHandler to receive status updates
   */
  setStatusCallback(callback: StatusCallback): void {
    this.statusCallback = callback;
    Object.values(this.aiResources).forEach(resource => resource?.orchestrator.setStatusCallback(callback));
  }

  /**
   * Reload model configuration and rebuild AI tool scaffolding
   */
  async refreshConfiguration(): Promise<void> {
    await this.initializeAITools();
  }

  /**
   * Expose the currently resolved models (with fallbacks applied)
   */
  getResolvedModelSelections(): Partial<Record<ModelScope, string>> {
    return { ...this.resolvedModels };
  }

  private disposeAIResources(): void {
    Object.values(this.aiResources).forEach(resource => resource?.orchestrator.dispose());
    this.aiResources = {};
  }

  private ensureSharedResources(): void {
    if (!this.promptLoader) {
      this.promptLoader = new PromptLoader(this.extensionUri!);
    }

    if (!this.guideLoader) {
      this.guideLoader = new GuideLoader(this.extensionUri!);
    }

    if (!this.guideRegistry) {
      this.guideRegistry = new GuideRegistry(this.extensionUri!, this.outputChannel);
    }
  }

  private createAIResources(apiKey: string, scope: ModelScope, model: string): AIResourceBundle | undefined {
    if (!this.guideRegistry || !this.guideLoader) {
      return undefined;
    }

    try {
      const client = new OpenRouterClient(apiKey, model);
      const conversationManager = new ConversationManager();
      const orchestrator = new AIResourceOrchestrator(
        client,
        conversationManager,
        this.guideRegistry,
        this.guideLoader,
        this.statusCallback,
        this.outputChannel
      );

      this.outputChannel?.appendLine(
        `[ProseAnalysisService] Initialized ${scope} model: ${model}`
      );

      return {
        model,
        orchestrator
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(
        `[ProseAnalysisService] Failed to initialize ${scope} model ${model}: ${message}`
      );
      return undefined;
    }
  }

  private getToolOptions() {
    const config = vscode.workspace.getConfiguration('proseMinion');
    return {
      includeCraftGuides: config.get<boolean>('includeCraftGuides') ?? true,
      temperature: config.get<number>('temperature') ?? 0.7,
      maxTokens: config.get<number>('maxTokens') ?? 2000
    };
  }

  async analyzeDialogue(text: string): Promise<AnalysisResult> {
    if (!this.dialogueAssistant) {
      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        this.getApiKeyWarning()
      );
    }

    try {
      const options = this.getToolOptions();
      const executionResult = await this.dialogueAssistant.analyze({ text }, options);
      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        executionResult.content,
        executionResult.usedGuides
      );
    } catch (error) {
      return AnalysisResultFactory.createAnalysisResult(
        'dialogue_analysis',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async analyzeProse(text: string): Promise<AnalysisResult> {
    if (!this.proseAssistant) {
      return AnalysisResultFactory.createAnalysisResult(
        'prose_analysis',
        this.getApiKeyWarning()
      );
    }

    try {
      const options = this.getToolOptions();
      const executionResult = await this.proseAssistant.analyze({ text }, options);
      return AnalysisResultFactory.createAnalysisResult(
        'prose_analysis',
        executionResult.content,
        executionResult.usedGuides
      );
    } catch (error) {
      return AnalysisResultFactory.createAnalysisResult(
        'prose_analysis',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async measureProseStats(text: string): Promise<MetricsResult> {
    try {
      const stats = this.proseStats.analyze({ text });
      return AnalysisResultFactory.createMetricsResult('prose_stats', stats);
    } catch (error) {
      return AnalysisResultFactory.createMetricsResult('prose_stats', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async measureStyleFlags(text: string): Promise<MetricsResult> {
    try {
      const flags = this.styleFlags.analyze({ text });
      return AnalysisResultFactory.createMetricsResult('style_flags', flags);
    } catch (error) {
      return AnalysisResultFactory.createMetricsResult('style_flags', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async measureWordFrequency(text: string): Promise<MetricsResult> {
    try {
      const frequency = this.wordFrequency.analyze({ text });
      return AnalysisResultFactory.createMetricsResult('word_frequency', frequency);
    } catch (error) {
      return AnalysisResultFactory.createMetricsResult('word_frequency', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async lookupDictionary(word: string, contextText?: string): Promise<AnalysisResult> {
    if (!this.dictionaryUtility) {
      return AnalysisResultFactory.createAnalysisResult(
        'dictionary_lookup',
        this.getApiKeyWarning()
      );
    }

    try {
      const options = this.getToolOptions();
      const executionResult = await this.dictionaryUtility.lookup(
        {
          word,
          contextText
        },
        {
          temperature: options.temperature ?? 0.4,
          maxTokens: options.maxTokens ?? 2200
        }
      );

      return AnalysisResultFactory.createAnalysisResult(
        'dictionary_lookup',
        executionResult.content
      );
    } catch (error) {
      return AnalysisResultFactory.createAnalysisResult(
        'dictionary_lookup',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private getApiKeyWarning(): string {
    return `⚠️ OpenRouter API key not configured

To use AI-powered analysis tools, you need to configure your OpenRouter API key:

1. Get an API key from https://openrouter.ai/
2. Open VS Code Settings (Cmd+, or Ctrl+,)
3. Search for "Prose Minion"
4. Enter your API key in "OpenRouter API Key"
5. Pick models for assistants and utilities under the Prose Minion settings

The measurement tools (Prose Statistics, Style Flags, Word Frequency) work without an API key.`;
  }
}
