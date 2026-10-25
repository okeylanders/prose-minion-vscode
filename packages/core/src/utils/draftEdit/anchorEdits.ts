/**
 * Anchoring (ADR 2026-10-21 D2): find where a pass's quoted text lives in the
 * document. A model quotes well and counts badly, so it never reports
 * offsets; the host finds the quote, with optional context either side to
 * choose among repeats.
 *
 * - **Exact first.** Search for `before + quote + after`, then narrower
 *   forms: `before + quote`, `quote + after`, the quote alone.
 * - **A normalized fallback, for matching only.** Curly and straight quotes,
 *   NBSP and other spaces, whitespace runs, and an ellipsis character are
 *   folded on both sides, and a match maps back to the exact source span.
 *   The source text is never changed.
 * - **Ambiguity fails closed.** A form that matches more than once stops the
 *   search: a narrower form would be no less ambiguous.
 */

import type { DraftEditAnchor, TextRange } from '@/domain/models/DraftEdit';

export type AnchorResult =
  | ({ readonly kind: 'anchored' } & TextRange)
  | { readonly kind: 'unanchored' }
  | { readonly kind: 'ambiguous' };

/** Locate `anchor.quote` in `text`. */
export function anchorQuote(text: string, anchor: DraftEditAnchor): AnchorResult {
  if (anchor.quote.length === 0) {
    return { kind: 'unanchored' };
  }
  const normalizedText = normalizeForMatching(text);
  for (const form of anchorForms(anchor)) {
    const exact = findAll(text, form.needle);
    if (exact.length > 1) {
      return { kind: 'ambiguous' };
    }
    if (exact.length === 1) {
      const start = exact[0] + form.prefix.length;
      return { kind: 'anchored', start, end: start + anchor.quote.length };
    }
    const normalized = locateNormalized(normalizedText, form);
    if (normalized.kind !== 'unanchored') {
      return normalized;
    }
  }
  return { kind: 'unanchored' };
}

interface AnchorForm {
  readonly prefix: string;
  readonly quote: string;
  readonly suffix: string;
  readonly needle: string;
}

/** The search forms, most specific first, without repeats. */
function anchorForms(anchor: DraftEditAnchor): AnchorForm[] {
  const before = anchor.before ?? '';
  const after = anchor.after ?? '';
  const candidates: Array<[string, string]> = [[before, after], [before, ''], ['', after], ['', '']];
  const seen = new Set<string>();
  const forms: AnchorForm[] = [];
  for (const [prefix, suffix] of candidates) {
    const key = `${prefix.length}:${suffix.length}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    forms.push({ prefix, quote: anchor.quote, suffix, needle: prefix + anchor.quote + suffix });
  }
  return forms;
}

/** Every start index of `needle` in `haystack`, overlapping matches included. */
function findAll(haystack: string, needle: string): number[] {
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) {
      return found;
    }
    found.push(index);
    from = index + 1;
  }
}

function locateNormalized(normalizedText: NormalizedText, form: AnchorForm): AnchorResult {
  const prefix = normalizeForMatching(form.prefix).text;
  const quote = normalizeForMatching(form.quote).text;
  const suffix = normalizeForMatching(form.suffix).text;
  if (quote.trim().length === 0) {
    return { kind: 'unanchored' };
  }
  const matches = findAll(normalizedText.text, prefix + quote + suffix);
  if (matches.length > 1) {
    return { kind: 'ambiguous' };
  }
  if (matches.length === 0) {
    return { kind: 'unanchored' };
  }
  const first = matches[0] + prefix.length;
  const last = first + quote.length - 1;
  return { kind: 'anchored', start: normalizedText.sourceStart[first], end: normalizedText.sourceEnd[last] };
}

interface NormalizedText {
  readonly text: string;
  /** For each normalized character, the source index it starts at. */
  readonly sourceStart: readonly number[];
  /** For each normalized character, the source index just after it. */
  readonly sourceEnd: readonly number[];
}

const DOUBLE_QUOTES = /[“”„‟«»″]/u;
const SINGLE_QUOTES = /[‘’‚‛′]/u;
const WHITESPACE = /\s/u;

/** Fold the characters models most often re-type differently, keeping a map back to the source. */
export function normalizeForMatching(source: string): NormalizedText {
  let text = '';
  const sourceStart: number[] = [];
  const sourceEnd: number[] = [];
  const emit = (chars: string, start: number, end: number) => {
    for (const char of chars) {
      text += char;
      sourceStart.push(start);
      sourceEnd.push(end);
    }
  };

  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (WHITESPACE.test(char)) {
      let end = index + 1;
      while (end < source.length && WHITESPACE.test(source[end])) {
        end += 1;
      }
      emit(' ', index, end);
      index = end;
    } else if (DOUBLE_QUOTES.test(char)) {
      emit('"', index, index + 1);
      index += 1;
    } else if (SINGLE_QUOTES.test(char)) {
      emit('\'', index, index + 1);
      index += 1;
    } else if (char === '…') {
      emit('...', index, index + 1);
      index += 1;
    } else {
      emit(char, index, index + 1);
      index += 1;
    }
  }
  return { text, sourceStart, sourceEnd };
}
