/**
 * Where speech stands in prose, for the Draft Edit checks that leave it
 * alone (ADR 2026-10-21): the narration baseline (Slice 3b part 1) reads
 * only the sentences no one speaks, and Craft Flags' cliché category
 * (Slice 3c) never flags a character's words. Pure.
 *
 * Speech is the shared dialogue rule's double-quoted spans
 * (`findDialogueSpans`, which stays double-quotes-only for every count that
 * shares it) and single-quoted speech, whole, by the rule below. Where a
 * mark's role is unclear, more is taken as speech, never less.
 */

import type { TextRange } from '@/domain/models/DraftEdit';
import { findDialogueSpans } from '@/utils/dialogueSpans';

const SINGLE_QUOTATION_MARKS: ReadonlySet<string> = new Set(["'", '‘', '’']);
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
/** A character that ends speech before its closing mark: neither word-like nor space ("?", ",", "—", "…"). */
const CLOSING_PUNCTUATION = /[^\p{L}\p{N}\s]/u;

/**
 * Every stretch of speech in `text`, double- or single-quoted, in order and
 * never overlapping: spans that overlap or touch (a single-quoted line
 * inside double-quoted speech) are joined, so one binary search answers
 * whether a range touches speech.
 */
export function findSpeechSpans(text: string): TextRange[] {
  return joined([...findDialogueSpans(text), ...singleQuotedSpans(text)]);
}

/**
 * Speech as the prose writes it, with protected syntax set aside (Craft
 * Flags, PR #177 F-03 and its re-review). A protected region is read as if
 * it were not there:
 * - A quotation mark inside it neither opens nor closes speech: the shared
 *   rules read a view of the text in which each of its characters but white
 *   space is a letter, so offsets, and the paragraphs the blank-line rule
 *   finds, stay the text's own.
 * - A single quotation mark beside it is judged by the prose on its far side
 *   (`<em>‘Late,’</em> said Alice` opens and closes as `‘Late,’ said Alice`
 *   does), never by the view's letters or the markup's own characters.
 * The narration baseline, which leaves protected regions out on its own,
 * still reads the raw text with `findSpeechSpans`.
 */
export function findSpeechSpansOutsideProtected(text: string, protectedRegions: readonly TextRange[]): TextRange[] {
  const concealed = joined(protectedRegions.map(({ start, end }) => ({ start: Math.max(0, start), end: Math.min(text.length, end) })));
  let view = '';
  let at = 0;
  for (const region of concealed) {
    // Per UTF-16 code unit (no `u` flag), so the view is exactly as long as the text.
    view += text.slice(at, region.start) + text.slice(region.start, region.end).replace(/\S/g, 'x');
    at = region.end;
  }
  view += text.slice(at);
  return joined([...findDialogueSpans(view), ...singleQuotedSpans(view, concealed)]);
}

/**
 * Single-quoted speech (PR #174 F-01, for the narration baseline). Within each
 * paragraph, a single quotation mark with nothing word-like before it opens a
 * span; one after a letter or digit ("don't", "Alice's", "the sisters' bank")
 * opens nothing. An open span closes only at a mark after closing
 * punctuation (`?'`, `,'`, `—'`) with nothing word-like after it (`closesSpeech`).
 * A mark after a letter may close the speech or belong to its word (a plural
 * possessive, "sisters'"; a trailing elision, "sittin'"), so it leaves the
 * span open (the PR's re-review). A span still open at its paragraph's end
 * runs to it, as speech running over several paragraphs is written; so does
 * a quoted word closed after a letter, or a span an elision ("'tis") opens.
 * Where a mark's role is unclear, more is left out, never less.
 *
 * `concealed` (sorted and joined, as `findSpeechSpansOutsideProtected` gives
 * them, over a view holding no mark inside them) are stretches read as if
 * absent: a mark's neighbours are the characters just past them.
 */
export function singleQuotedSpans(text: string, concealed: readonly TextRange[] = []): TextRange[] {
  const spans: TextRange[] = [];
  const paragraphBreak = /\n\s*\n/g;
  let start = 0;
  for (let match = paragraphBreak.exec(text); match; match = paragraphBreak.exec(text)) {
    collectSingleQuoted(text, { start, end: match.index }, concealed, spans);
    start = match.index + match[0].length;
  }
  collectSingleQuoted(text, { start, end: text.length }, concealed, spans);
  return spans;
}

function collectSingleQuoted(text: string, paragraph: TextRange, concealed: readonly TextRange[], spans: TextRange[]): void {
  let openedAt: number | undefined;
  for (let at = paragraph.start; at < paragraph.end; at += 1) {
    if (!SINGLE_QUOTATION_MARKS.has(text[at])) {
      continue;
    }
    if (openedAt === undefined) {
      if (!WORD_CHARACTER.test(neighbour(text, at, -1, paragraph, concealed))) {
        openedAt = at;
      }
    } else if (closesSpeech(neighbour(text, at, -1, paragraph, concealed), neighbour(text, at, 1, paragraph, concealed))) {
      spans.push({ start: openedAt, end: at + 1 });
      openedAt = undefined;
    }
  }
  if (openedAt !== undefined) {
    spans.push({ start: openedAt, end: paragraph.end });
  }
}

/** Whether a mark between `before` and `after` closes open speech: after closing punctuation, before no word. */
function closesSpeech(before: string, after: string): boolean {
  return CLOSING_PUNCTUATION.test(before) && !WORD_CHARACTER.test(after);
}

/**
 * The character beside `at` in the direction `step`, past any concealed
 * stretch it touches, within its paragraph; '' where there is none. One jump
 * suffices: joined stretches never touch one another.
 */
function neighbour(text: string, at: number, step: -1 | 1, paragraph: TextRange, concealed: readonly TextRange[]): string {
  let next = at + step;
  const range = rangeAt(concealed, next);
  if (range) {
    next = step < 0 ? range.start - 1 : range.end;
  }
  return next >= paragraph.start && next < paragraph.end ? text[next] : '';
}

/** The concealed stretch holding `at`, by binary search; undefined where none does. */
function rangeAt(ranges: readonly TextRange[], at: number): TextRange | undefined {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const range = ranges[middle];
    if (range.end <= at) {
      low = middle + 1;
    } else if (range.start > at) {
      high = middle - 1;
    } else {
      return range;
    }
  }
  return undefined;
}

/** Ranges in order, with those that overlap or touch joined into one. */
function joined(ranges: readonly TextRange[]): TextRange[] {
  const out: Array<{ start: number; end: number }> = [];
  for (const { start, end } of [...ranges].sort((a, b) => a.start - b.start)) {
    if (end <= start) {
      continue;
    }
    const last = out[out.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
    } else {
      out.push({ start, end });
    }
  }
  return out;
}
