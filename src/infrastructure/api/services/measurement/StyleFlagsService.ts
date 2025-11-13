/**
 * StyleFlagsService
 *
 * Single Responsibility: Wrap StyleFlags measurement tool
 *
 * This service provides a thin wrapper around the StyleFlags measurement tool
 * for architectural consistency. All handlers should depend on services, not tools directly.
 *
 * This wrapper:
 * - Provides a clean extension point for future orchestration
 * - Maintains consistent abstraction level across the codebase
 * - Follows the same pattern as other measurement service wrappers
 */

import { StyleFlags } from '../../../../tools/measure/styleFlags';

/**
 * Service wrapper for style flag detection
 *
 * Detects common style patterns and potential issues:
 * - Adverb overuse (-ly adverbs)
 * - Passive voice constructions
 * - Dialogue tag patterns
 * - Weak verbs (to be, to have)
 * - Filter words (seemed, appeared, felt)
 * - Telling vs showing patterns
 * - Cliché detection
 * - Hedging language
 */
export class StyleFlagsService {
  private styleFlags: StyleFlags;

  constructor() {
    this.styleFlags = new StyleFlags();
  }

  /**
   * Analyze text for style flags and patterns
   *
   * @param text - Text content to analyze
   * @returns Style flags analysis with detected patterns and suggestions
   */
  analyze(text: string): any {
    return this.styleFlags.analyze({ text });
  }
}
