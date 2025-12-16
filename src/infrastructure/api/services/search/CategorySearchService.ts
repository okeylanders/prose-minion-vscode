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
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { WordFrequency } from '@/tools/measure/wordFrequency';
import { PromptLoader } from '@/tools/shared/prompts';
import {
  CategorySearchResult,
  CategorySearchOptions,
  WordSearchResult,
  NGramMode
} from '@messages/search';
import { StatusEmitter } from '@messages/status';

const MAX_WORDS_PER_BATCH = 400;
const MAX_BIGRAMS_PER_BATCH = 200;
const MAX_TRIGRAMS_PER_BATCH = 150;

export class CategorySearchService {
  private readonly wordFrequency: WordFrequency;
  private readonly promptLoader: PromptLoader;
  private abortController: AbortController | null = null;

  constructor(
    private readonly aiResourceManager: AIResourceManager,
    private readonly wordSearchService: WordSearchService,
    private readonly extensionUri: vscode.Uri,
    private readonly outputChannel?: vscode.OutputChannel,
    private readonly statusEmitter?: StatusEmitter
  ) {
    this.wordFrequency = new WordFrequency((msg) => this.outputChannel?.appendLine(msg));
    this.promptLoader = new PromptLoader(extensionUri);
  }

  /**
   * Cancel any in-progress category search
   */
  public cancelSearch(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.outputChannel?.appendLine('[CategorySearchService] Search cancelled by user');
    }
  }

  /**
   * Check if a search is currently running
   */
  public isSearchRunning(): boolean {
    return this.abortController !== null;
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
      // Create new AbortController for this search
      this.abortController = new AbortController();
      const signal = this.abortController.signal;

      // 1. Extract unique words/n-grams from text
      const ngramMode = options?.ngramMode ?? 'words';
      const minOccurrences = options?.minOccurrences ?? 2;

      let uniqueItems: string[];
      let batchSize: number;
      let itemType: string;

      if (ngramMode === 'words') {
        uniqueItems = this.wordFrequency.extractUniqueWords(text, {
          minCharacterLength: 2,
          excludeStopwords: true
        });
        batchSize = MAX_WORDS_PER_BATCH;
        itemType = 'unique words';
      } else if (ngramMode === 'bigrams') {
        uniqueItems = this.extractUniqueNGrams(text, 2, minOccurrences);
        batchSize = MAX_BIGRAMS_PER_BATCH;
        itemType = 'unique bigrams';
      } else { // trigrams
        uniqueItems = this.extractUniqueNGrams(text, 3, minOccurrences);
        batchSize = MAX_TRIGRAMS_PER_BATCH;
        itemType = 'unique trigrams';
      }

      if (uniqueItems.length === 0) {
        this.abortController = null;
        return {
          query,
          matchedWords: [],
          wordSearchResult: this.createEmptyResult(),
          timestamp: Date.now(),
          ngramMode,
          error: `No ${itemType} found in text after filtering`
        };
      }

      this.outputChannel?.appendLine(
        `[CategorySearchService] Extracted ${uniqueItems.length} ${itemType} for category "${query}"`
      );
      this.sendStatus(`Total ${itemType}: ${uniqueItems.length}`);

      // 2. Build AI prompt and get matches (chunked to avoid token limits)
      const relevance = options?.relevance ?? 'focused';
      const wordLimit = options?.wordLimit ?? 50;
      const batches: string[][] = [];
      for (let i = 0; i < uniqueItems.length; i += batchSize) {
        batches.push(uniqueItems.slice(i, i + batchSize));
      }

      const matchedWordsSet = new Set<string>();
      let aggregatedPrompt = 0;
      let aggregatedCompletion = 0;
      let aggregatedTotal = 0;
      let aggregatedCost: number | undefined;
      let hadBatchFailure = false;
      let shouldStop = false;
      let haltStatusSent = false;

      // Run batches with a small concurrency pool (5)
      const concurrency = Math.min(5, batches.length);
      let nextIndex = 0;
      let completedBatches = 0;
      const runWorker = async () => {
        while (!shouldStop && nextIndex < batches.length) {
          // Check if cancelled
          if (signal.aborted) {
            this.outputChannel?.appendLine('[CategorySearchService] Search aborted');
            return;
          }

          const idx = nextIndex++;
          const batch = batches[idx];
          const batchLabel = `Batch ${idx + 1}/${batches.length}`;

          try {
            const aiResult = await this.getAIMatches(
              query,
              batch,
              relevance,
              wordLimit,
              ngramMode
            );
            aiResult.matchedWords.forEach(word => matchedWordsSet.add(word));

            if (aiResult.tokensUsed) {
              aggregatedPrompt += aiResult.tokensUsed.prompt || 0;
              aggregatedCompletion += aiResult.tokensUsed.completion || 0;
              aggregatedTotal += aiResult.tokensUsed.total || 0;
              if (typeof aiResult.tokensUsed.costUsd === 'number') {
                aggregatedCost = (aggregatedCost ?? 0) + aiResult.tokensUsed.costUsd;
              }
            }

            if (matchedWordsSet.size >= wordLimit) {
              shouldStop = true;
              if (!haltStatusSent) {
                haltStatusSent = true;
                this.sendStatus(
                  `Reached word limit (${wordLimit}). Stopped early; more words may match. Try increasing the limit or narrowing relevance.`
                );
              }
              break;
            }

            completedBatches++;

            this.sendStatus(
              `${batchLabel}: +${aiResult.matchedWords.length} matches (${matchedWordsSet.size} total found)`,
              { current: completedBatches, total: batches.length }
            );
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.outputChannel?.appendLine(`[CategorySearchService] ${batchLabel} failed: ${msg}`);
            completedBatches++;
            this.sendStatus(`${batchLabel} failed: ${msg}`, { current: completedBatches, total: batches.length });
            hadBatchFailure = true;
          }
        }
      };

      const workers = Array.from({ length: concurrency }, () => runWorker());
      await Promise.all(workers);

      // Track if this was a cancellation
      const wasCancelled = signal.aborted;

      const matchedWords = Array.from(matchedWordsSet).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
      const finalMatchedWords = matchedWords.slice(0, wordLimit);
      const tokensUsed = aggregatedTotal > 0 ? {
        prompt: aggregatedPrompt,
        completion: aggregatedCompletion,
        total: aggregatedTotal,
        costUsd: aggregatedCost
      } : undefined;

      const warnings: string[] = [];
      if (wasCancelled) {
        warnings.push(`Search cancelled after ${completedBatches}/${batches.length} batches; showing partial results.`);
        this.outputChannel?.appendLine(
          `[CategorySearchService] Cancelled with ${matchedWordsSet.size} matches from ${completedBatches}/${batches.length} batches`
        );
      }
      if (hadBatchFailure) {
        warnings.push('Some batches failed; results may be incomplete.');
      }
      if (shouldStop && matchedWordsSet.size >= wordLimit) {
        warnings.push(`Stopped after reaching word limit (${wordLimit}); additional words may match if you increase the limit or narrow relevance.`);
      }

      if (finalMatchedWords.length === 0) {
        this.abortController = null;
        // If cancelled with no results, add a specific message
        if (wasCancelled && warnings.length === 1) {
          // Replace the partial results message with no-results message
          warnings[0] = `Search cancelled after ${completedBatches}/${batches.length} batches; no matches found before cancellation.`;
        }
        return {
          query,
          matchedWords: [],
          wordSearchResult: this.createEmptyResult(),
          timestamp: Date.now(),
          ngramMode,
          tokensUsed,
          warnings: warnings.length ? warnings : undefined,
          haltedEarly: shouldStop && matchedWordsSet.size >= wordLimit
        };
      }

      this.outputChannel?.appendLine(
        `[CategorySearchService] AI matched ${finalMatchedWords.length} words: ${finalMatchedWords.slice(0, 10).join(', ')}${finalMatchedWords.length > 10 ? '...' : ''}`
      );
      if (tokensUsed) {
        this.outputChannel?.appendLine(
          `[CategorySearchService] Token usage: ${tokensUsed.prompt} prompt + ${tokensUsed.completion} completion = ${tokensUsed.total} total`
        );
        this.sendStatus(
          `Completed category search: ${finalMatchedWords.length} words matched, total tokens ${tokensUsed.total}`
        );
      }

      // 3. Delegate to WordSearchService for occurrence counting
      const wordSearchResult = await this.wordSearchService.searchWords(
        text,
        files,
        sourceMode,
        {
          wordsOrPhrases: finalMatchedWords,
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
        this.sendStatus(`Filtered ${hallucinatedCount} hallucinated words (0 hits).`);
      }

      // Update matchedWords to only include words that were actually found
      const validWords = finalMatchedWords.filter(word =>
        validTargets.some(t => t.normalized === word.toLowerCase() || t.target.toLowerCase() === word.toLowerCase())
      );

      this.abortController = null;
      return {
        query,
        matchedWords: validWords,
        wordSearchResult: {
          ...searchResult,
          targets: validTargets
        },
        timestamp: Date.now(),
        ngramMode,
        tokensUsed,
        warnings: warnings.length ? warnings : undefined,
        haltedEarly: shouldStop && matchedWordsSet.size >= wordLimit
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(`[CategorySearchService] Error: ${message}`);

      this.abortController = null;
      return {
        query,
        matchedWords: [],
        wordSearchResult: this.createEmptyResult(),
        timestamp: Date.now(),
        ngramMode: options?.ngramMode ?? 'words',
        error: message
      };
    }
  }

  /**
   * Get AI-matched words for a category
   * Returns both matched words and token usage
   */
  private async getAIMatches(
    query: string,
    words: string[],
    relevance: 'broad' | 'focused' | 'specific' | 'synonym',
    wordLimit: number,
    ngramMode: NGramMode
  ): Promise<{
    matchedWords: string[];
    tokensUsed?: { prompt: number; completion: number; total: number; costUsd?: number };
  }> {
    // Get orchestrator from AIResourceManager (uses 'category' model scope)
    const orchestrator = this.aiResourceManager.getOrchestrator('category');
    if (!orchestrator) {
      throw new Error('OpenRouter API key not configured. Please set your API key in settings.');
    }

    // Load system prompts
    const basePrompt = await this.promptLoader.loadPrompts([
      'category-search/00-role.md',
      'category-search/01-instructions.md',
      'category-search/02-constraints.md'
    ]);

    // Append constraint note based on relevance and word limit
    const relevanceDescriptions: Record<string, string> = {
      broad: '!!!IMPORTANT: Return loosely related category-adjacent words.',
      focused: '!!!IMPORTANT: Return closely related words that fit the category.',
      specific: '!!!IMPORTANT: Return exact semantic matches only.',
      synonym: '!!!IMPORTANT: Return strict synonyms only; no broader related terms.'
    };
    const constraintNote = `\n\n---\n**CONSTRAINTS**: RELEVANCE MODE SELECTED: ${relevance.toUpperCase()} — ${relevanceDescriptions[relevance]} Limit to ${wordLimit} words.`;
    const systemPrompt = basePrompt + constraintNote;

    // Build user message with appropriate label based on n-gram mode
    let itemLabel: string;
    if (ngramMode === 'words') {
      itemLabel = 'Words';
    } else if (ngramMode === 'bigrams') {
      itemLabel = 'Phrases (bigrams)';
    } else {
      itemLabel = 'Phrases (trigrams)';
    }
    const userMessage = `Category: ${query}\n${itemLabel}: ${words.join(', ')}`;

    // Call AI using orchestrator (single-turn, no guide capabilities needed)
    const result = await orchestrator.executeWithoutCapabilities(
      'category_search',
      systemPrompt,
      userMessage,
      {
        temperature: 0.3, // Lower temperature for more consistent matching
        maxTokens: 7500 // Fixed token limit for category search
      }
    );

    // Parse response and extract token usage
    const matchedWords = this.parseAIResponse(result.content);
    const tokensUsed = result.usage ? {
      prompt: result.usage.promptTokens,
      completion: result.usage.completionTokens,
      total: result.usage.totalTokens,
      costUsd: result.usage.costUsd
    } : undefined;

    return { matchedWords, tokensUsed };
  }

  /**
   * Parse AI response into array of matched words
   */
  private parseAIResponse(content: string): string[] {
    try {
      // Strip markdown code block delimiters if present
      let cleanContent = content;
      cleanContent = cleanContent.replace(/^```(?:json)?\s*\n?/i, '');
      cleanContent = cleanContent.replace(/\n?```\s*$/i, '');

      // Strip truncation notice if present (added by orchestrator when response hits token limit)
      cleanContent = cleanContent.replace(/\n*---\n*⚠️ Response truncated[\s\S]*$/i, '');

      // Try to extract JSON from the response
      let jsonMatch = cleanContent.match(/\[[\s\S]*\]/);

      // If no complete array found, try to repair truncated JSON
      if (!jsonMatch) {
        // Find the opening bracket
        const startIdx = cleanContent.indexOf('[');
        if (startIdx !== -1) {
          let arrayContent = cleanContent.substring(startIdx);
          // Remove trailing incomplete elements (anything after last complete string)
          arrayContent = arrayContent.replace(/,\s*"[^"]*$/, '');
          // Ensure it ends with ]
          if (!arrayContent.endsWith(']')) {
            arrayContent = arrayContent.trimEnd();
            if (arrayContent.endsWith(',')) {
              arrayContent = arrayContent.slice(0, -1);
            }
            arrayContent += ']';
          }
          jsonMatch = [arrayContent];
          this.outputChannel?.appendLine(`[CategorySearchService] Repaired truncated JSON array`);
        }
      }

      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        throw new Error('AI response is not an array');
      }

      // Filter to only valid strings and deduplicate
      const uniqueWords = [...new Set(
        parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
      )];

      return uniqueWords;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel?.appendLine(`[CategorySearchService] Failed to parse AI response: ${message}`);
      this.outputChannel?.appendLine(`[CategorySearchService] Response length: ${content.length}`);
      this.outputChannel?.appendLine(`[CategorySearchService] First 200 chars: ${content.substring(0, 200)}`);
      this.outputChannel?.appendLine(`[CategorySearchService] Last 200 chars: ${content.substring(content.length - 200)}`);
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

  private sendStatus(message: string, progress?: { current: number; total: number }, tickerMessage?: string): void {
    if (this.statusEmitter) {
      this.statusEmitter(message, progress, tickerMessage);
    }
  }

  /**
   * Extract unique n-grams from text with frequency filtering
   * @param text - Text to extract n-grams from
   * @param n - N-gram size (2 for bigrams, 3 for trigrams)
   * @param minOccurrences - Minimum frequency threshold
   * @returns Array of unique n-grams sorted by frequency (descending)
   */
  private extractUniqueNGrams(
    text: string,
    n: number,
    minOccurrences: number
  ): string[] {
    const tokens = text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const counts = new Map<string, number>();

    for (let i = 0; i <= tokens.length - n; i++) {
      const phrase = tokens.slice(i, i + n).join(' ');
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }

    return Array.from(counts.entries())
      .filter(([_, count]) => count >= minOccurrences)
      .sort((a, b) => b[1] - a[1])
      .map(([phrase]) => phrase);
  }
}
