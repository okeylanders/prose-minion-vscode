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
import type { LightboxQuoteVerifier, LightboxSpanFilter } from '@/infrastructure/lightbox/LightboxQuoteVerifier';

/** Where one occurrence of a term stands: its paragraph (1-based) and its tokens there. */
export interface LightboxTermOccurrence {
  paragraph: number;
  /** Index of its first token within the paragraph. */
  start: number;
  /** How many tokens it spans. */
  length: number;
}

export interface LightboxTermCounter {
  /** The term's occurrences and paragraphs; `term` is its normalized (lower-case token) form. */
  count(term: string): LightboxCountedSupport;
  /** Every occurrence of the term, in reading order (what `count` counts). */
  occurrences(term: string): LightboxTermOccurrence[];
  /** True when the term is one stopword ("she", "the"), which counts nothing worth showing. */
  isStopword(term: string): boolean;
}

export function lightboxTermTokens(text: string): string[] {
  return extractFrequencyWords(text.toLowerCase().replace(/[‘’]/g, "'"));
}

export function createLightboxTermCounter(paragraphs: readonly string[]): LightboxTermCounter {
  const tokens = paragraphs.map(lightboxTermTokens);
  return {
    occurrences(term: string): LightboxTermOccurrence[] {
      const parts = lightboxTermTokens(term);
      const found: LightboxTermOccurrence[] = [];
      if (parts.length > 0) {
        tokens.forEach((paragraphTokens, index) => {
          for (const start of startsOf(paragraphTokens, parts)) {
            found.push({ paragraph: index + 1, start, length: parts.length });
          }
        });
      }
      return found;
    },
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
  return startsOf(tokens, parts).length;
}

/** Where `parts` stand consecutively in `tokens`. */
function startsOf(tokens: readonly string[], parts: readonly string[]): number[] {
  const starts: number[] = [];
  for (let start = 0; start + parts.length <= tokens.length; start++) {
    if (parts.every((part, offset) => tokens[start + offset] === part)) {
      starts.push(start);
    }
  }
  return starts;
}

/** Whether `text` holds `term` (its tokens, consecutively), under the board's tokenizer. */
export function lightboxTextHoldsTerm(text: string, term: string): boolean {
  const parts = lightboxTermTokens(term);
  return parts.length > 0 && startsOf(lightboxTermTokens(text), parts).length > 0;
}

/** One token and the source span it was read from (UTF-16 offsets in the text). */
interface LightboxTokenSpan {
  token: string;
  start: number;
  end: number;
}

/**
 * The tokenizer's tokens with their spans in `text`. The tokenizer reads
 * each run of characters between whitespace and long dashes as one word;
 * a token's span runs from the first to the last character it keeps (so
 * "window." spans "window"). The tokens are exactly `lightboxTermTokens(text)`.
 */
function lightboxTokenSpans(text: string): LightboxTokenSpan[] {
  const spans: LightboxTokenSpan[] = [];
  for (const match of text.matchAll(/[^\s—–]+/g)) {
    const chunk = match[0];
    const [token] = lightboxTermTokens(chunk);
    if (!token) {
      continue;
    }
    // The token keeps letters, hyphens and inner apostrophes; its ends are its first and last letter or hyphen.
    let first = -1;
    let last = -1;
    for (let index = 0; index < chunk.length; index++) {
      if (/[a-z-]/.test(chunk[index].toLowerCase())) {
        first = first < 0 ? index : first;
        last = index;
      }
    }
    const at = match.index ?? 0;
    spans.push({ token, start: at + first, end: at + last + 1 });
  }
  return spans;
}

/** Where `term` stands in `text` as whole tokens, consecutively: each occurrence's source span (PR #155 F-03). */
export function lightboxTermSpans(text: string, term: string): Array<{ start: number; end: number }> {
  const parts = lightboxTermTokens(term);
  if (parts.length === 0) {
    return [];
  }
  const spans = lightboxTokenSpans(text);
  return startsOf(spans.map((span) => span.token), parts)
    .map((start) => ({ start: spans[start].start, end: spans[start + parts.length - 1].end }));
}

/**
 * Whether one of `quotes`, found in the paragraph it names, holds a whole
 * occurrence of `phrase` there (PR #155 F-03). The occurrence is found over
 * the whole paragraph, as the phrase was counted, and the quote's span must
 * contain it, so a quote cut inside a longer word ("very" of "every") holds
 * nothing. Every span the verifier would accept for a quote is offered,
 * exact before folded, so a quote whose words stand twice is judged by the
 * occurrence that holds the phrase. The witness rule for familiar phrasing,
 * fresh, carried and brought.
 */
export function lightboxPhraseHeld(
  verifier: Pick<LightboxQuoteVerifier, 'verify' | 'paragraphs'>,
  quotes: ReadonlyArray<{ paragraph: number; text: string }>,
  phrase: string
): boolean {
  const occurrences = new Map<number, Array<{ start: number; end: number }>>();
  const holds: LightboxSpanFilter = (paragraph, start, end) => {
    if (!occurrences.has(paragraph)) {
      occurrences.set(paragraph, lightboxTermSpans(verifier.paragraphs[paragraph - 1] ?? '', phrase));
    }
    return (occurrences.get(paragraph) ?? []).some((occurrence) => start <= occurrence.start && occurrence.end <= end);
  };
  return quotes.some((quote) => verifier.verify(quote.paragraph, quote.text, holds).found);
}
