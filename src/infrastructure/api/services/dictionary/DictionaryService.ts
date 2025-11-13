/**
 * DictionaryService
 *
 * Single Responsibility: Wrap DictionaryUtility for AI-powered word lookups
 *
 * This service provides a clean interface for dictionary functionality:
 * - Word definitions with contextual understanding
 * - Synonyms, antonyms, and usage examples
 * - Context-aware explanations
 *
 * This wrapper:
 * - Centralizes dictionary tool orchestration
 * - Handles AI resource management and initialization
 * - Provides clean extension point for dictionary features
 * - Maintains consistent abstraction level across the codebase
 */

import * as vscode from 'vscode';
import { DictionaryUtility } from '../../../../tools/utility/dictionaryUtility';
import { AIResourceManager } from '../resources/AIResourceManager';
import { ResourceLoaderService } from '../resources/ResourceLoaderService';
import { ToolOptionsProvider } from '../shared/ToolOptionsProvider';
import { AnalysisResult, AnalysisResultFactory } from '../../../../domain/models/AnalysisResult';

/**
 * Service wrapper for AI-powered dictionary lookups
 *
 * Provides comprehensive word information:
 * - Contextual definitions (understanding word usage in context)
 * - Synonyms and antonyms
 * - Usage examples and explanations
 * - Part-of-speech information
 */
export class DictionaryService {
  private dictionaryUtility?: DictionaryUtility;

  constructor(
    private readonly aiResourceManager: AIResourceManager,
    private readonly resourceLoader: ResourceLoaderService,
    private readonly toolOptions: ToolOptionsProvider,
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    // Dictionary will be initialized when AI resources are available
    void this.initializeDictionary();
  }

  /**
   * Initialize dictionary tool with AI orchestrator
   *
   * Called during construction and when configuration changes
   */
  private async initializeDictionary(): Promise<void> {
    // Wait for AI resources to be initialized
    await this.aiResourceManager.initializeResources();

    // Get dictionary orchestrator from AIResourceManager
    const orchestrator = this.aiResourceManager.getOrchestrator('dictionary');

    if (orchestrator) {
      const promptLoader = this.resourceLoader.getPromptLoader();

      // Initialize dictionary utility
      this.dictionaryUtility = new DictionaryUtility(orchestrator, promptLoader);
    } else {
      // No orchestrator available (no API key configured)
      this.dictionaryUtility = undefined;
    }
  }

  /**
   * Reinitialize dictionary after configuration changes
   *
   * Should be called when model selections or API key changes
   */
  async refreshConfiguration(): Promise<void> {
    await this.initializeDictionary();
  }

  /**
   * Look up a word in the dictionary with AI assistance
   *
   * @param word - Word to look up
   * @param contextText - Optional context text to understand word usage
   * @returns Dictionary lookup result with definitions, synonyms, and usage
   */
  async lookupWord(word: string, contextText?: string): Promise<AnalysisResult> {
    if (!this.dictionaryUtility) {
      return AnalysisResultFactory.createAnalysisResult(
        'dictionary_lookup',
        this.getApiKeyWarning()
      );
    }

    try {
      // Get options from ToolOptionsProvider
      const options = this.toolOptions.getOptions();

      const executionResult = await this.dictionaryUtility.lookup(
        {
          word,
          contextText
        },
        {
          temperature: options.temperature ?? 0.4,
          maxTokens: options.maxTokens
        }
      );

      return AnalysisResultFactory.createAnalysisResult(
        'dictionary_lookup',
        executionResult.content,
        undefined,
        executionResult.usage
      );
    } catch (error) {
      return AnalysisResultFactory.createAnalysisResult(
        'dictionary_lookup',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get warning message for missing API key
   */
  private getApiKeyWarning(): string {
    return `⚠️ OpenRouter API key not configured

To use AI-powered dictionary tools, you need to configure your OpenRouter API key:

1. Get an API key from https://openrouter.ai/
2. Click the ⚙️ gear icon at the top of the Prose Minion view
3. Enter your API key in the "OpenRouter API Key" field
4. Click Save
5. Select your preferred models for assistants and utilities

The measurement tools (Prose Statistics, Style Flags, Word Frequency) work without an API key.`;
  }
}
