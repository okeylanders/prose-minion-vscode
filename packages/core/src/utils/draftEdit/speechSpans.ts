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
  const spans = [...findDialogueSpans(text).map(({ start, end }) => ({ start, end })), ...singleQuotedSpans(text)]
    .sort((a, b) => a.start - b.start);
  const joined: Array<{ start: number; end: number }> = [];
  for (const span of spans) {
    const last = joined[joined.length - 1];
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
    } else {
      joined.push({ ...span });
    }
  }
  return joined;
}

/**
 * Speech as the prose writes it, with protected syntax set aside (Craft
 * Flags, PR #177 F-03): every character of a protected region but a line
 * break is read as a letter, so a quotation mark inside inline code or a
 * fence neither opens nor closes speech, and offsets stay the text's own.
 * The shared rules read that view unchanged; the narration baseline, which
 * leaves protected regions out on its own, still reads the raw text.
 */
export function findSpeechSpansOutsideProtected(text: string, protectedRegions: readonly TextRange[]): TextRange[] {
  let view = '';
  let at = 0;
  for (const region of [...protectedRegions].sort((a, b) => a.start - b.start)) {
    const start = Math.max(at, region.start);
    const end = Math.min(text.length, region.end);
    if (end <= start) {
      continue;
    }
    view += text.slice(at, start) + text.slice(start, end).replace(/[^\r\n]/g, 'x');
    at = end;
  }
  return findSpeechSpans(view + text.slice(at));
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
 */
export function singleQuotedSpans(text: string): TextRange[] {
  const spans: TextRange[] = [];
  const paragraphBreak = /\n\s*\n/g;
  let start = 0;
  for (let match = paragraphBreak.exec(text); match; match = paragraphBreak.exec(text)) {
    collectSingleQuoted(text, start, match.index, spans);
    start = match.index + match[0].length;
  }
  collectSingleQuoted(text, start, text.length, spans);
  return spans;
}

function collectSingleQuoted(text: string, start: number, end: number, spans: TextRange[]): void {
  let openedAt: number | undefined;
  for (let at = start; at < end; at += 1) {
    if (!SINGLE_QUOTATION_MARKS.has(text[at])) {
      continue;
    }
    if (openedAt === undefined) {
      if (!(at > start && WORD_CHARACTER.test(text[at - 1]))) {
        openedAt = at;
      }
    } else if (closesSpeech(text[at - 1], at + 1 < end ? text[at + 1] : '')) {
      spans.push({ start: openedAt, end: at + 1 });
      openedAt = undefined;
    }
  }
  if (openedAt !== undefined) {
    spans.push({ start: openedAt, end });
  }
}

/** Whether a mark between `before` and `after` closes open speech: after closing punctuation, before no word. */
function closesSpeech(before: string, after: string): boolean {
  return CLOSING_PUNCTUATION.test(before) && !WORD_CHARACTER.test(after);
}
