/**
 * Counted support for readings (ADR 2026-10-19 D7). Pure: no host, no I/O.
 *
 * A reading may name terms (a motif's words, a character's name); the host
 * counts them here and finds their paragraphs. The model never supplies a
 * count. Terms are tokenized exactly as the board's counted words are, with
 * the word-frequency tool's own tokenizer (lower case, letters, hyphens and
 * apostrophes), after folding curly apostrophes to straight ones on both
 * sides so "they’ll" in the chapter is "they'll" in a term. A multi-word term
 * counts where its tokens stand consecutively inside one paragraph.
 */

import type { LightboxCountedSupport } from '@messages';
import { WORD_FREQUENCY_STOPWORDS, extractFrequencyWords } from '@/tools/measure/wordFrequency';

export interface LightboxTermCounter {
  /** The term's occurrences and paragraphs; `term` is its normalized (lower-case token) form. */
  count(term: string): LightboxCountedSupport;
  /** True when the term is one stopword ("she", "the"), which counts nothing worth showing. */
  isStopword(term: string): boolean;
}

export function lightboxTermTokens(text: string): string[] {
  return extractFrequencyWords(text.toLowerCase().replace(/[‘’]/g, "'"));
}

export function createLightboxTermCounter(paragraphs: readonly string[]): LightboxTermCounter {
  const tokens = paragraphs.map(lightboxTermTokens);
  return {
    count(term: string): LightboxCountedSupport {
      const parts = lightboxTermTokens(term);
      let count = 0;
      const found: number[] = [];
      if (parts.length > 0) {
        tokens.forEach((paragraphTokens, index) => {
          const occurrences = occurrencesOf(paragraphTokens, parts);
          if (occurrences > 0) {
            count += occurrences;
            found.push(index + 1);
          }
        });
      }
      return { term: parts.join(' '), count, paragraphs: found };
    },
    isStopword(term: string): boolean {
      const parts = lightboxTermTokens(term);
      return parts.length === 1 && WORD_FREQUENCY_STOPWORDS.has(parts[0]);
    }
  };
}

function occurrencesOf(tokens: readonly string[], parts: readonly string[]): number {
  let occurrences = 0;
  for (let start = 0; start + parts.length <= tokens.length; start++) {
    if (parts.every((part, offset) => tokens[start + offset] === part)) {
      occurrences += 1;
    }
  }
  return occurrences;
}
