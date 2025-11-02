/**
 * Text utility functions for word counting and trimming
 *
 * Clean Architecture: Domain/Infrastructure Layer
 * - Pure functions with no side effects
 * - Explicit interfaces and type safety
 * - Deterministic behavior (same input → same output)
 */

/**
 * Result of a trim operation
 * Provides detailed metadata about the trimming process
 */
export interface TrimResult {
  /** The trimmed text */
  trimmed: string;
  /** Original word count before trimming */
  originalWords: number;
  /** Final word count after trimming */
  trimmedWords: number;
  /** Whether any trimming occurred */
  wasTrimmed: boolean;
}

/**
 * Count words in text using simple whitespace splitting
 * Matches typical word processor counts
 *
 * @param text - The text to count words in
 * @returns Number of words (0 for empty/null text)
 *
 * @example
 * countWords('hello world') // => 2
 * countWords('') // => 0
 * countWords('  multiple   spaces  ') // => 2
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Trim text to maximum word count, preserving sentence boundaries when possible
 *
 * Strategy:
 * 1. If text is under limit, return unchanged
 * 2. Trim to exact word count
 * 3. Try to end at a sentence boundary (. ! ?) within last 50 words
 * 4. Return detailed metadata about the operation
 *
 * @param text - The text to trim
 * @param maxWords - Maximum number of words to keep
 * @returns TrimResult with trimmed text and metadata
 *
 * @example
 * trimToWordLimit('hello world', 5)
 * // => { trimmed: 'hello world', originalWords: 2, trimmedWords: 2, wasTrimmed: false }
 *
 * trimToWordLimit('one two three. four five six.', 4)
 * // => { trimmed: 'one two three.', originalWords: 6, trimmedWords: 3, wasTrimmed: true }
 */
export function trimToWordLimit(text: string, maxWords: number): TrimResult {
  const words = text.trim().split(/\s+/);
  const originalWords = words.length;

  // No trimming needed
  if (originalWords <= maxWords) {
    return {
      trimmed: text,
      originalWords,
      trimmedWords: originalWords,
      wasTrimmed: false
    };
  }

  // Trim to max words
  const trimmedWords = words.slice(0, maxWords);
  let trimmed = trimmedWords.join(' ');

  // Try to end at a sentence boundary (. ! ?) within last 50 words
  // This makes the trimmed text more readable and natural
  const lastFiftyWords = trimmedWords.slice(-50).join(' ');
  const lastSentenceMatch = lastFiftyWords.match(/[.!?]\s+/);

  if (lastSentenceMatch && lastSentenceMatch.index !== undefined) {
    const cutPoint = trimmed.length - lastFiftyWords.length + lastSentenceMatch.index + 1;
    trimmed = trimmed.substring(0, cutPoint).trim();
  }

  return {
    trimmed,
    originalWords,
    trimmedWords: countWords(trimmed),
    wasTrimmed: true
  };
}
