/**
 * The Lightbox quote verifier (ADR 2026-10-19 D7). Pure: no host, no I/O.
 *
 * A reading's quote is checked against the one chapter paragraph it names,
 * never against context files or any other text. The check is exact first.
 * Failing that, both sides are folded and compared again:
 * - Unicode NFKC (so "…" is "...", and compatibility forms match);
 * - curly and straight double quotes are one mark, as are single quotes
 *   and apostrophes;
 * - every dash and hyphen is one mark, a run of them is one, and spaces
 *   beside a dash are dropped ("word — word" matches "word--word");
 * - runs of whitespace (line breaks included) are one space.
 * Case is preserved: a quote in the wrong case is not the chapter's.
 *
 * A match returns the span as it stands in the chapter (mapped back through
 * the fold), so the writer always sees their own text. A paragraph number the
 * host never declared fails: a model may cite only what the host declared
 * (the widgets' referential-integrity rule). When a quote fails, the verifier
 * says whether its words stand in another paragraph, which helps the writer
 * read the reason; it never moves the quote there.
 */

import type { LightboxQuoteFailure, LightboxQuoteMatch } from '@messages';

/** Fewer letters than this anchor nothing ("the", "Oh"). */
export const LIGHTBOX_QUOTE_MINIMUM_LETTERS = 4;

export type LightboxQuoteVerdict =
  | { found: true; paragraph: number; text: string; match: LightboxQuoteMatch }
  | { found: false; paragraph: number; reason: LightboxQuoteFailure; foundIn?: number[] };

export interface LightboxQuoteVerifier {
  /** `paragraph` is 1-based. */
  verify(paragraph: number, quote: string): LightboxQuoteVerdict;
  readonly paragraphCount: number;
}

interface FoldedText {
  folded: string;
  /** For each folded character, the original start and end offsets of its source segment. */
  starts: number[];
  ends: number[];
}

const DOUBLE_QUOTES = /["“”„‟″〝〞＂«»]/u;
const SINGLE_QUOTES = /['‘’‚‛′`´]/u;
const DASHES = /[-‐‑‒–—―−⁃﹘﹣－]/u;
const LETTER = /\p{L}/u;
/** A base character with its combining marks, so NFKC composes each unit whole. */
const SEGMENT = /\P{M}\p{M}*|\p{M}+/gu;

/** Build a verifier over the chapter's paragraphs (index 0 is ¶1). */
export function createLightboxQuoteVerifier(paragraphs: readonly string[]): LightboxQuoteVerifier {
  const folded = paragraphs.map((paragraph) => foldWithMap(paragraph));

  /** Exact first; then folded, with the quote's own wrapping marks, then without them. */
  const locate = (index: number, quote: string, foldedForms: readonly string[]): LightboxQuoteVerdict | undefined => {
    const paragraph = paragraphs[index];
    const exact = paragraph.indexOf(quote);
    if (exact >= 0) {
      return { found: true, paragraph: index + 1, text: paragraph.slice(exact, exact + quote.length), match: 'exact' };
    }
    const target = folded[index];
    for (const form of foldedForms) {
      const at = target.folded.indexOf(form);
      if (at >= 0) {
        const start = target.starts[at];
        const end = target.ends[at + form.length - 1];
        return { found: true, paragraph: index + 1, text: paragraph.slice(start, end), match: 'normalized' };
      }
    }
    return undefined;
  };

  return {
    paragraphCount: paragraphs.length,
    verify(paragraph: number, rawQuote: string): LightboxQuoteVerdict {
      const quote = rawQuote.trim();
      const foldedQuote = foldWithMap(quote).folded;
      const inner = unwrapQuoted(foldedQuote);
      if (letterCount(inner) < LIGHTBOX_QUOTE_MINIMUM_LETTERS) {
        return { found: false, paragraph, reason: 'too-short' };
      }
      const foldedForms = inner === foldedQuote ? [foldedQuote] : [foldedQuote, inner];
      const declared = Number.isSafeInteger(paragraph) && paragraph >= 1 && paragraph <= paragraphs.length;
      if (declared) {
        const hit = locate(paragraph - 1, quote, foldedForms);
        if (hit) {
          return hit;
        }
      }
      const foundIn: number[] = [];
      paragraphs.forEach((_, index) => {
        if (index !== paragraph - 1 && locate(index, quote, foldedForms)) {
          foundIn.push(index + 1);
        }
      });
      if (!declared) {
        return { found: false, paragraph, reason: 'undeclared-paragraph', ...(foundIn.length > 0 ? { foundIn } : {}) };
      }
      return foundIn.length > 0
        ? { found: false, paragraph, reason: 'not-in-paragraph', foundIn }
        : { found: false, paragraph, reason: 'not-in-chapter' };
    }
  };
}

/** The fold both sides are compared under, with a map from folded characters back to the original. */
export function foldWithMap(text: string): FoldedText {
  const out: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  const push = (character: string, start: number, end: number): void => {
    out.push(character);
    starts.push(start);
    ends.push(end);
  };
  const pop = (): void => {
    out.pop();
    starts.pop();
    ends.pop();
  };

  for (const match of text.matchAll(SEGMENT)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    for (const character of match[0].normalize('NFKC')) {
      const mark = foldCharacter(character);
      const previous = out[out.length - 1];
      if (mark === ' ') {
        // Collapse runs of space, and drop a space after a dash or at the start.
        if (previous === undefined || previous === ' ' || previous === '-') {
          continue;
        }
        push(' ', start, end);
      } else if (mark === '-') {
        if (previous === ' ') {
          pop();
        }
        if (out[out.length - 1] === '-') {
          // A run of dashes is one dash; widen it to cover the whole run.
          ends[ends.length - 1] = end;
          continue;
        }
        push('-', start, end);
      } else {
        push(mark, start, end);
      }
    }
  }
  if (out[out.length - 1] === ' ') {
    pop();
  }
  return { folded: out.join(''), starts, ends };
}

function foldCharacter(character: string): string {
  if (/\s/u.test(character)) {
    return ' ';
  }
  if (DOUBLE_QUOTES.test(character)) {
    return '"';
  }
  if (SINGLE_QUOTES.test(character)) {
    return "'";
  }
  if (DASHES.test(character)) {
    return '-';
  }
  return character;
}

/** A model sometimes wraps a quote in quotation marks the chapter does not have around it. */
function unwrapQuoted(folded: string): string {
  return folded.length > 2 && folded.startsWith('"') && folded.endsWith('"') && !folded.slice(1, -1).includes('"')
    ? folded.slice(1, -1).trim()
    : folded;
}

function letterCount(text: string): number {
  let count = 0;
  for (const character of text) {
    if (LETTER.test(character)) {
      count += 1;
    }
  }
  return count;
}
