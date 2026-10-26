/**
 * How often a flagged phrase stands in the document's narration (ADR
 * 2026-10-21, Amendment 2026-10-26: Slice 3c). Pure.
 *
 * A phrase the chapter leans on is a finding of its own, and one model call
 * may not say so reliably, so host code counts it:
 * - The document is folded once per run: case (`en-US`), curly apostrophes
 *   to straight, dashes to a hyphen, and each run of white space to one
 *   space. The folded text keeps a map back to source offsets.
 * - A phrase is folded the same way, its leading and trailing marks set
 *   aside ("time stood still." counts "time stood still,"), and matched at
 *   word boundaries.
 * - An occurrence touching a skipped range (speech, protected regions) is
 *   not counted: the narration's lean is the finding.
 * - Inflected forms ("ran down her spine", "runs down his spine") count
 *   apart: the stated limit.
 *
 * The work is one fold of the document and one scan of it per distinct
 * phrase asked about.
 */

import type { TextRange } from '@/domain/models/DraftEdit';

export interface PhraseRepeats {
  /** How many times `phrase` stands outside the skipped ranges; 0 for a phrase with no word in it. */
  count(phrase: string): number;
}

const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const EDGE_MARKS = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const WHITE_SPACE = /\s/u;
const APOSTROPHES: ReadonlySet<string> = new Set(['’', '‘']);
const DASHES: ReadonlySet<string> = new Set(['–', '—', '‒', '―']);

export function phraseRepeats(text: string, skipped: readonly TextRange[]): PhraseRepeats {
  const document = fold(text);
  const ranges = merged(skipped);
  const counted = new Map<string, number>();
  return {
    count(phrase: string): number {
      const wanted = fold(phrase.replace(EDGE_MARKS, '')).folded;
      if (wanted.length === 0) {
        return 0;
      }
      const known = counted.get(wanted);
      if (known !== undefined) {
        return known;
      }
      let count = 0;
      for (let at = document.folded.indexOf(wanted); at >= 0; at = document.folded.indexOf(wanted, at + 1)) {
        const after = at + wanted.length;
        if (WORD_CHARACTER.test(document.folded[at - 1] ?? '') || WORD_CHARACTER.test(document.folded[after] ?? '')) {
          continue;
        }
        if (!touches(ranges, document.sourceOf[at], document.sourceOf[after - 1] + 1)) {
          count += 1;
        }
      }
      counted.set(wanted, count);
      return count;
    }
  };
}

interface Folded {
  readonly folded: string;
  /** The source offset of each folded code unit. */
  readonly sourceOf: readonly number[];
}

function fold(text: string): Folded {
  const parts: string[] = [];
  const sourceOf: number[] = [];
  let spaced = false;
  for (let at = 0; at < text.length; at += 1) {
    const unit = text[at];
    if (WHITE_SPACE.test(unit)) {
      if (!spaced) {
        parts.push(' ');
        sourceOf.push(at);
        spaced = true;
      }
      continue;
    }
    spaced = false;
    const folded = APOSTROPHES.has(unit) ? "'" : DASHES.has(unit) ? '-' : unit.toLocaleLowerCase('en-US');
    for (const each of folded) {
      parts.push(each);
      sourceOf.push(at);
    }
  }
  return { folded: parts.join(''), sourceOf };
}

/** Ranges sorted and joined where they touch, so one binary search answers. */
function merged(ranges: readonly TextRange[]): TextRange[] {
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
