/**
 * DictionaryService
 *
 * Single Responsibility: Wrap DictionaryUtility for AI-powered word lookups
 *
 * This service provides a clean interface for dictionary functionality:
 * - Word definitions with contextual understanding
 * - Synonyms, antonyms, and usage examples
 * - Context-aware explanations
 * - Parallel (fast) dictionary generation using fan-out pattern
 *
 * This wrapper:
 * - Centralizes dictionary tool orchestration
 * - Handles AI resource management and initialization
 * - Provides clean extension point for dictionary features
 * - Maintains consistent abstraction level across the codebase
 */

import * as vscode from 'vscode';
import pLimit from 'p-limit';
import { DictionaryUtility } from '../../../../tools/utility/dictionaryUtility';
import { AIResourceManager } from '../resources/AIResourceManager';
import { ResourceLoaderService } from '../resources/ResourceLoaderService';
import { ToolOptionsProvider } from '../shared/ToolOptionsProvider';
import { AnalysisResult, AnalysisResultFactory } from '../../../../domain/models/AnalysisResult';
import {
  DictionaryBlockResult,
  FastGenerateDictionaryResultPayload
} from '../../../../shared/types/messages/dictionary';
import { TokenUsage } from '../../../../shared/types/messages/base';

/**
 * Service wrapper for AI-powered dictionary lookups
 *
 * Provides comprehensive word information:
 * - Contextual definitions (understanding word usage in context)
 * - Synonyms and antonyms
 * - Usage examples and explanations
 * - Part-of-speech information
 */
/**
 * Block names for parallel dictionary generation
 */
const DICTIONARY_BLOCKS = [
  'definition',
  'pronunciation',
  'parts-of-speech',
  'sense-explorer',
  'register-connotation',
  'narrative-texture',
  'collocations-idioms',
  'morphology-family',
  'character-voice',
  'soundplay-rhyme',
  'translations-cognates',
  'usage-watchpoints',
  'semantic-gradient',
  'ai-advisory-notes'
] as const;

type DictionaryBlockName = typeof DICTIONARY_BLOCKS[number];

/**
 * Progress callback for parallel generation
 */
export type ParallelGenerationProgressCallback = (progress: {
  word: string;
  completedBlocks: string[];
  totalBlocks: number;
}) => void;

export class DictionaryService {
  private dictionaryUtility?: DictionaryUtility;

  // Parallel generation constants
  private readonly CONCURRENCY_LIMIT = 14;
  private readonly BLOCK_TIMEOUT = 15000; // 15 seconds per block

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

  // ============================================
  // Parallel Dictionary Generation (Fast Generate)
  // ============================================

  /**
   * Generate dictionary entry using parallel fan-out pattern
   * Fires concurrent API calls for each block and reassembles results
   *
   * @param word - Word to look up
   * @param context - Optional context text
   * @param onProgress - Optional callback for progress updates
   * @returns Combined dictionary result with metadata
   */
  async generateParallelDictionary(
    word: string,
    context?: string,
    onProgress?: ParallelGenerationProgressCallback
  ): Promise<FastGenerateDictionaryResultPayload> {
    const startTime = Date.now();
    this.outputChannel?.appendLine(`\n[DictionaryService] Starting parallel dictionary generation for "${word}"`);

    // Get orchestrator
    const orchestrator = this.aiResourceManager.getOrchestrator('dictionary');
    if (!orchestrator) {
      throw new Error('Dictionary service not initialized. Please configure your OpenRouter API key.');
    }

    // Load prompts
    const baseInstructions = await this.loadBlockPrompt('00-base-instructions');
    const completedBlocks: string[] = [];
    const totalBlocks = DICTIONARY_BLOCKS.length;

    // Create concurrency limiter
    const limit = pLimit(this.CONCURRENCY_LIMIT);

    // Create block generation promises
    const blockPromises = DICTIONARY_BLOCKS.map((blockName, index) =>
      limit(async () => {
        const result = await this.generateSingleBlock(
          orchestrator,
          baseInstructions,
          blockName,
          index + 1,
          word,
          context
        );

        // Update progress
        if (!result.error) {
          completedBlocks.push(blockName);
          onProgress?.({
            word,
            completedBlocks: [...completedBlocks],
            totalBlocks
          });
        }

        return result;
      })
    );

    // Execute all blocks with concurrency limit
    const blockResults = await Promise.all(blockPromises);

    // Assemble and return result
    return this.assembleParallelResult(word, blockResults, startTime);
  }

  /**
   * Generate a single dictionary block
   */
  private async generateSingleBlock(
    orchestrator: any,
    baseInstructions: string,
    blockName: DictionaryBlockName,
    blockNumber: number,
    word: string,
    context?: string
  ): Promise<DictionaryBlockResult> {
    const startTime = Date.now();
    const paddedNumber = String(blockNumber).padStart(2, '0');

    try {
      // Load block-specific prompt
      const blockPrompt = await this.loadBlockPrompt(`${paddedNumber}-${blockName}-block`);

      // Build system message
      const systemMessage = `${baseInstructions}\n\n---\n\n${blockPrompt}`;

      // Build user message
      const userMessage = this.buildBlockUserMessage(word, context);

      this.outputChannel?.appendLine(`[DictionaryService] Generating block: ${blockName}`);

      // Execute with timeout
      const result = await Promise.race([
        orchestrator.executeWithoutCapabilities(
          `dictionary-fast-${blockName}`,
          systemMessage,
          userMessage,
          {
            temperature: 0.4,
            maxTokens: 3500 // Smaller max for individual blocks
          }
        ),
        this.createTimeout(this.BLOCK_TIMEOUT)
      ]);

      const duration = Date.now() - startTime;
      this.outputChannel?.appendLine(`[DictionaryService] Block "${blockName}" completed in ${duration}ms`);

      return {
        blockName,
        content: result.content,
        duration,
        usage: result.usage
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.outputChannel?.appendLine(`[DictionaryService] Block "${blockName}" failed: ${errorMessage}`);

      // Retry once
      try {
        this.outputChannel?.appendLine(`[DictionaryService] Retrying block "${blockName}"...`);
        const blockPrompt = await this.loadBlockPrompt(`${paddedNumber}-${blockName}-block`);
        const systemMessage = `${baseInstructions}\n\n---\n\n${blockPrompt}`;
        const userMessage = this.buildBlockUserMessage(word, context);

        const result = await orchestrator.executeWithoutCapabilities(
          `dictionary-fast-${blockName}-retry`,
          systemMessage,
          userMessage,
          {
            temperature: 0.4,
            maxTokens: 3500
          }
        );

        const retryDuration = Date.now() - startTime;
        this.outputChannel?.appendLine(`[DictionaryService] Block "${blockName}" retry succeeded in ${retryDuration}ms`);

        return {
          blockName,
          content: result.content,
          duration: retryDuration,
          usage: result.usage
        };
      } catch (retryError) {
        const retryDuration = Date.now() - startTime;
        const retryErrorMessage = retryError instanceof Error ? retryError.message : String(retryError);

        this.outputChannel?.appendLine(`[DictionaryService] Block "${blockName}" retry failed: ${retryErrorMessage}`);

        return {
          blockName,
          content: '',
          duration: retryDuration,
          error: retryErrorMessage
        };
      }
    }
  }

  /**
   * Load a block-specific prompt from the dictionary-fast directory
   */
  private async loadBlockPrompt(promptName: string): Promise<string> {
    const promptLoader = this.resourceLoader.getPromptLoader();
    try {
      return await promptLoader.loadPrompts([`dictionary-fast/${promptName}.md`]);
    } catch (error) {
      this.outputChannel?.appendLine(`[DictionaryService] Failed to load prompt ${promptName}: ${error}`);
      return '';
    }
  }

  /**
   * Build user message for block generation
   */
  private buildBlockUserMessage(word: string, context?: string): string {
    const lines = [
      `Generate the dictionary section for the following word:`,
      '',
      `Word: ${word.trim()}`
    ];

    if (context?.trim()) {
      lines.push('', 'Context (use to tailor examples and usage notes):', context.trim());
    }

    lines.push('', 'Output ONLY the section content as specified in the block instructions.');

    return lines.join('\n');
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Block generation timed out after ${ms}ms`)), ms);
    });
  }

  /**
   * Assemble parallel block results into final dictionary entry
   */
  private assembleParallelResult(
    word: string,
    blockResults: DictionaryBlockResult[],
    startTime: number
  ): FastGenerateDictionaryResultPayload {
    const totalDuration = Date.now() - startTime;

    // Collect metadata
    const blockDurations: Record<string, number> = {};
    const partialFailures: string[] = [];
    let successCount = 0;

    // Aggregate token usage across all blocks
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;
    let hasUsageData = false;

    // Sort blocks to maintain order and build result
    const orderedContent: string[] = [];

    for (const blockName of DICTIONARY_BLOCKS) {
      const result = blockResults.find(r => r.blockName === blockName);
      if (result) {
        blockDurations[blockName] = result.duration;

        // Aggregate usage
        if (result.usage) {
          hasUsageData = true;
          totalPromptTokens += result.usage.promptTokens || 0;
          totalCompletionTokens += result.usage.completionTokens || 0;
          totalTokens += result.usage.totalTokens || 0;
          totalCostUsd += result.usage.costUsd || 0;
        }

        if (result.error) {
          partialFailures.push(blockName);
        } else if (result.content.trim()) {
          successCount++;
          orderedContent.push(result.content.trim());
        }
      }
    }

    // Build header
    const header = `# Prose Minion | Writer's Dictionary Lookup\n\n# Word: *${word}*\n`;

    // Combine all successful blocks
    const combinedResult = header + '\n' + orderedContent.join('\n\n');

    this.outputChannel?.appendLine(
      `[DictionaryService] Parallel generation completed: ${successCount}/${DICTIONARY_BLOCKS.length} blocks in ${totalDuration}ms`
    );

    if (partialFailures.length > 0) {
      this.outputChannel?.appendLine(
        `[DictionaryService] Partial failures: ${partialFailures.join(', ')}`
      );
    }

    return {
      word,
      result: combinedResult,
      metadata: {
        totalDuration,
        blockDurations,
        partialFailures,
        successCount,
        totalBlocks: DICTIONARY_BLOCKS.length
      },
      usage: hasUsageData ? {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens,
        costUsd: totalCostUsd
      } : undefined
    };
  }
}
