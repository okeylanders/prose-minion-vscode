/**
 * WordFrequencyService
 *
 * Single Responsibility: Wrap WordFrequency measurement tool
 *
 * This service provides a thin wrapper around the WordFrequency measurement tool
 * for architectural consistency. All handlers should depend on services, not tools directly.
 *
 * This wrapper:
 * - Provides a clean extension point for future orchestration
 * - Maintains consistent abstraction level across the codebase
 * - Handles configuration retrieval via ToolOptionsProvider
 * - Follows the same pattern as other measurement service wrappers
 */

import * as vscode from 'vscode';
import { WordFrequency } from '../../../../tools/measure/wordFrequency';
import { ToolOptionsProvider, WordFrequencyOptions } from '../shared/ToolOptionsProvider';

/**
 * Service wrapper for word frequency analysis
 *
 * Provides comprehensive word frequency analysis including:
 * - Top N most frequent words
 * - Stopwords table (most common function words)
 * - Hapax legomena (words appearing only once) with count and percentage
 * - Part-of-speech tagging via wink-nlp (offline)
 * - Bigrams and trigrams (word pairs and triplets)
 * - Word length histogram (1-10+ characters)
 * - Optional lemmatization (base word forms)
 * - Content words only filter
 * - Minimum character length filter
 */
export class WordFrequencyService {
  private wordFrequency: WordFrequency;

  constructor(
    private readonly toolOptions: ToolOptionsProvider,
    private readonly outputChannel?: vscode.OutputChannel
  ) {
    this.wordFrequency = new WordFrequency(
      (msg: string) => this.outputChannel?.appendLine(msg)
    );
  }

  /**
   * Analyze word frequency for the given text
   *
   * @param text - Text content to analyze
   * @param options - Optional word frequency options override (defaults to settings)
   * @returns Word frequency analysis with top words, stopwords, hapax, POS, n-grams, etc.
   */
  analyze(text: string, options?: WordFrequencyOptions): any {
    const wfOptions = options || this.toolOptions.getWordFrequencyOptions();
    return this.wordFrequency.analyze({ text }, wfOptions);
  }
}
