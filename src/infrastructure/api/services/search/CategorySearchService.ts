/**
 * CategorySearchService
 *
 * Single Responsibility: AI-powered semantic word matching
 *
 * This service provides category-based word search:
 * - Extracts unique words from text using WordFrequency
 * - Uses AI to match words to semantic categories
 * - Delegates to WordSearchService for occurrence counting, clustering, etc.
 *
 * Architecture:
 * - Composes WordFrequency for tokenization
 * - Composes WordSearchService for search operations
 * - Uses OpenRouterClient for AI matching
 */

import * as vscode from 'vscode';
import { WordSearchService } from './WordSearchService';
import { AIResourceManager } from '../resources/AIResourceManager';
import { WordFrequency } from '../../../../tools/measure/wordFrequency';
import { PromptLoader } from '../../../../tools/shared/prompts';
import {
  CategorySearchResult,
  CategorySearchOptions,
  WordSearchResult
} from '../../../../shared/types/messages/search';

export class CategorySearchService {
  private readonly wordFrequency: WordFrequency;
  private readonly promptLoader: PromptLoader;

  constructor(
    private readonly aiResourceManager: AIResourceManager,
    private readonly wordSearchService: WordSearchService,
    private readonly extensionUri: vscode.Uri,
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    this.wordFrequency = new WordFrequency((msg) => this.outputChannel?.appendLine(msg));
    this.promptLoader = new PromptLoader(extensionUri);
  }

  /**
   * Search for words matching a semantic category
   *
   * @param query - Category description (e.g., "clothing", "color red")
   * @param text - Text content to search
   * @param files - File paths (for multi-file search)
   * @param sourceMode - Source mode ('selection', 'files', etc.)
   * @param options - Search options
   * @returns Category search result with matched words and occurrence data
   */
  async searchByCategory(
    query: string,
    text: string,
    files?: string[],
    sourceMode?: string,
    options?: CategorySearchOptions
  ): Promise<CategorySearchResult> {
    try {
      // 1. Extract unique words from text
      const uniqueWords = this.wordFrequency.extractUniqueWords(text, {
        minCharacterLength: 2,
        excludeStopwords: true
      });

      if (uniqueWords.length === 0) {
        return {
          query,
          matchedWords: [],
          wordSearchResult: this.createEmptyResult(),
          timestamp: Date.now(),
          error: 'No words found in text after filtering'
        };
      }

      this.outputChannel?.appendLine(
        `[CategorySearchService] Extracted ${uniqueWords.length} unique words for category "${query}"`
      );

      // 2. Build AI prompt and get matches
      const aiResult = await this.getAIMatches(query, uniqueWords);
      const matchedWords = aiResult.matchedWords;
      const tokensUsed = aiResult.tokensUsed;

      if (matchedWords.length === 0) {
        return {
          query,
          matchedWords: [],
          wordSearchResult: this.createEmptyResult(),
          timestamp: Date.now(),
          tokensUsed
        };
      }

      this.outputChannel?.appendLine(
        `[CategorySearchService] AI matched ${matchedWords.length} words: ${matchedWords.slice(0, 10).join(', ')}${matchedWords.length > 10 ? '...' : ''}`
      );
      if (tokensUsed) {
        this.outputChannel?.appendLine(
          `[CategorySearchService] Token usage: ${tokensUsed.prompt} prompt + ${tokensUsed.completion} completion = ${tokensUsed.total} total`
        );
      }

      // 3. Delegate to WordSearchService for occurrence counting
      const wordSearchResult = await this.wordSearchService.searchWords(
        text,
        files,
        sourceMode,
        {
          wordsOrPhrases: matchedWords,
          contextWords: options?.contextWords ?? 10,
          clusterWindow: options?.clusterWindow ?? 100,
          minClusterSize: options?.minClusterSize ?? 3,
          caseSensitive: options?.caseSensitive ?? false
        }
      );

      // 4. Filter out hallucinated words (0 occurrences)
      const searchResult = wordSearchResult.metrics as WordSearchResult;
      const validTargets = searchResult.targets.filter(t => t.totalOccurrences > 0);
      const hallucinatedCount = searchResult.targets.length - validTargets.length;

      if (hallucinatedCount > 0) {
        const hallucinatedWords = searchResult.targets
          .filter(t => t.totalOccurrences === 0)
          .map(t => t.target);
        this.outputChannel?.appendLine(
          `[CategorySearchService] Filtered ${hallucinatedCount} hallucinated words: ${hallucinatedWords.join(', ')}`
        );
      }

      // Update matchedWords to only include words that were actually found
      const validWords = matchedWords.filter(word =>
        validTargets.some(t => t.normalized === word.toLowerCase() || t.target.toLowerCase() === word.toLowerCase())
      );

      return {
        query,
        matchedWords: validWords,
        wordSearchResult: {
          ...searchResult,
          targets: validTargets
        },
        timestamp: Date.now(),
        tokensUsed
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(`[CategorySearchService] Error: ${message}`);

      return {
        query,
        matchedWords: [],
        wordSearchResult: this.createEmptyResult(),
        timestamp: Date.now(),
        error: message
      };
    }
  }

  /**
   * Get AI-matched words for a category
   * Returns both matched words and token usage
   */
  private async getAIMatches(query: string, words: string[]): Promise<{
    matchedWords: string[];
    tokensUsed?: { prompt: number; completion: number; total: number };
  }> {
    // Get orchestrator from AIResourceManager (uses 'context' model scope)
    const orchestrator = this.aiResourceManager.getOrchestrator('context');
    if (!orchestrator) {
      throw new Error('OpenRouter API key not configured. Please set your API key in settings.');
    }

    // Load system prompts
    const systemPrompt = await this.promptLoader.loadPrompts([
      'category-search/00-role.md',
      'category-search/01-instructions.md',
      'category-search/02-constraints.md'
    ]);

    // Build user message
    const userMessage = `Category: ${query}\nWords: ${words.join(', ')}`;

    // Call AI using orchestrator (single-turn, no guide capabilities needed)
    const result = await orchestrator.executeWithoutCapabilities(
      'category_search',
      systemPrompt,
      userMessage,
      {
        temperature: 0.3, // Lower temperature for more consistent matching
        maxTokens: 4000
      }
    );

    // Parse response and extract token usage
    const matchedWords = this.parseAIResponse(result.content);
    const tokensUsed = result.usage ? {
      prompt: result.usage.promptTokens,
      completion: result.usage.completionTokens,
      total: result.usage.totalTokens
    } : undefined;

    return { matchedWords, tokensUsed };
  }

  /**
   * Parse AI response into array of matched words
   */
  private parseAIResponse(content: string): string[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        throw new Error('AI response is not an array');
      }

      // Filter to only valid strings
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(`[CategorySearchService] Failed to parse AI response: ${message}`);
      this.outputChannel?.appendLine(`[CategorySearchService] Raw response: ${content.substring(0, 500)}`);
      throw new Error(`Invalid AI response format: ${message}`);
    }
  }

  /**
   * Create empty word search result structure
   */
  private createEmptyResult(): WordSearchResult {
    return {
      scannedFiles: [],
      options: {
        caseSensitive: false,
        contextWords: 10,
        clusterWindow: 100,
        minClusterSize: 3
      },
      targets: []
    };
  }
}
