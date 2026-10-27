/**
 * How often a flagged phrase stands in the document's narration (ADR
 * 2026-10-21, Amendment 2026-10-26: Slice 3c). Pure.
 *
 * A phrase the chapter leans on is a finding of its own, and one model call
 * may not say so reliably, so host code counts it:
 * - A phrase is matched in the text as written, its case, curly or straight
 *   apostrophes, dashes and runs of white space folded, its leading and
 *   trailing marks set aside ("time stood still." counts "time stood
 *   still,"), at word boundaries.
 * - An occurrence touching a skipped range (speech, protected regions) is
 *   not counted: the narration's lean is the finding.
 * - Occurrences that overlap count apart ("never say never" stands twice in
 *   "never say never say never"), found by one forward walk that always
 *   moves on by a whole code point (PR #177 F-04).
 * - Inflected forms ("ran down her spine", "runs down his spine") count
 *   apart: the stated limit.
 *
 * **Bounded on the extension host** (PR #177 N-02). Nothing is built for the
 * whole document up front: each distinct phrase asked about is one forward
 * walk of the text by a regular expression, and at most `PHRASE_REPEATS.phrases`
 * distinct phrases are counted per document. A phrase past that is not
 * counted (`undefined`), never guessed.
 */

import type { TextRange } from '@/domain/models/DraftEdit';

export const PHRASE_REPEATS = Object.freeze({
  /** Distinct phrases counted per document; each is one scan of it. */
  phrases: 40
});

export interface PhraseRepeats {
  /**
   * How many times `phrase` stands outside the skipped ranges; 0 for a phrase
   * with no word in it; undefined past the distinct-phrase bound.
   */
  count(phrase: string): number | undefined;
}

const EDGE_MARKS = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const SPECIAL = /[\\^$.*+?()[\]{}|/]/u;
const APOSTROPHES = "'’‘";
const DASHES = '-–—‒―';

export function phraseRepeats(text: string, skipped: readonly TextRange[]): PhraseRepeats {
  const ranges = joinedRanges(skipped);
  const counted = new Map<string, number>();
  return {
    count(phrase: string): number | undefined {
      const wanted = phrase.replace(EDGE_MARKS, '');
      if (wanted.length === 0) {
        return 0;
      }
      const key = wanted.toLocaleLowerCase('en-US').replace(/[’‘]/gu, "'").replace(/[–—‒―]/gu, '-').replace(/\s+/gu, ' ');
      const known = counted.get(key);
      if (known !== undefined) {
        return known;
      }
      if (counted.size >= PHRASE_REPEATS.phrases) {
        return undefined;
      }
      const count = matchesOutside(text, patternOf(wanted), ranges);
      counted.set(key, count);
      return count;
    }
  };
}

/**
 * How a walk counts matches that overlap: a phrase counts each (PR #177
 * N-03); a stock beat's aliases that overlap are one gesture written once
 * ("an eye roll of her eyes"; PR #179 N-01).
 */
export type OverlappingMatches = 'each' | 'once';

/**
 * How many times `pattern` (global) matches outside `skipped` (as
 * `joinedRanges` gives them). With `each`, occurrences that overlap all
 * count (PR #177 N-03): each search resumes one whole code point past the
 * last match's start (F-04). One code unit is not enough: under the `u` flag
 * a search resumed inside a surrogate pair backs up to its start and finds
 * the same match again. With `once`, a search resumes at the last match's
 * end, never before that code point. A match never starts before its
 * search, so each step moves forward and the walk ends. Stock beats are
 * counted by the same walk.
 */
export function matchesOutside(text: string, pattern: RegExp, skipped: readonly TextRange[], overlapping: OverlappingMatches = 'each'): number {
  let count = 0;
  for (let from = 0; from <= text.length; ) {
    pattern.lastIndex = from;
    const match = pattern.exec(text);
    if (!match || match.index < from) {
      break;
    }
    if (!touches(skipped, match.index, match.index + match[0].length)) {
      count += 1;
    }
    const next = match.index + ((text.codePointAt(match.index) ?? 0) > 0xffff ? 2 : 1);
    from = overlapping === 'each' ? next : Math.max(next, match.index + match[0].length);
  }
  return count;
}

/** The phrase as a pattern: its folds as character classes, whole words only. */
function patternOf(phrase: string): RegExp {
  let body = '';
  let spaced = false;
  for (const character of phrase) {
    if (/\s/u.test(character)) {
      if (!spaced) {
        body += '\\s+';
        spaced = true;
      }
      continue;
    }
    spaced = false;
    if (APOSTROPHES.includes(character)) {
      body += `[${APOSTROPHES}]`;
    } else if (DASHES.includes(character)) {
      body += `[${DASHES}]`;
    } else {
      body += SPECIAL.test(character) ? `\\${character}` : character;
    }
  }
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu');
}

/** Ranges sorted and joined where they touch, so one binary search answers. */
export function joinedRanges(ranges: readonly TextRange[]): TextRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: Array<{ start: number; end: number }> = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      out.push({ start: range.start, end: range.end });
    }
  }
  return out;
}

function touches(ranges: readonly TextRange[], start: number, end: number): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const range = ranges[middle];
    if (range.end <= start) {
      low = middle + 1;
    } else if (range.start >= end) {
      high = middle - 1;
    } else {
      return true;
    }
  }
  return false;
}
