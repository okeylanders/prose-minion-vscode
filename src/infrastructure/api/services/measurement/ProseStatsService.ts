/**
 * ProseStatsService
 *
 * Single Responsibility: Wrap PassageProseStats measurement tool
 *
 * This service provides a thin wrapper around the PassageProseStats measurement tool
 * for architectural consistency. All handlers should depend on services, not tools directly.
 *
 * This wrapper:
 * - Provides a clean extension point for future orchestration
 * - Maintains consistent abstraction level across the codebase
 * - Follows the same pattern as analysis service wrappers (AssistantToolService, etc.)
 */

import { PassageProseStats } from '../../../../tools/measure/passageProseStats';

/**
 * Service wrapper for prose statistics analysis
 *
 * Provides prose analysis including:
 * - Word count and sentence count
 * - Average words per sentence
 * - Average sentences per paragraph
 * - Lexical density (content words vs total words)
 * - Dialogue percentage
 * - Word length distribution
 * - Unique word count
 * - Reading time estimates
 * - Pacing metrics
 */
export class ProseStatsService {
  private proseStats: PassageProseStats;

  constructor() {
    this.proseStats = new PassageProseStats();
  }

  /**
   * Analyze prose statistics for the given text
   *
   * @param input - Input object containing text to analyze
   * @returns Prose statistics object with metrics
   */
  analyze(input: { text: string }): any {
    return this.proseStats.analyze(input);
  }
}
