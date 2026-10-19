/**
 * Dialogue spans: where quoted speech starts and stops in prose.
 *
 * One pure matcher for every count that asks "how much of this is dialogue?",
 * so the Metrics tab's Dialogue % and Lightbox's per-paragraph dialogue share
 * (ADR 2026-10-19, D4) cannot disagree about the same text.
 *
 * Quote marks that delimit dialogue:
 * - Straight double quotes ("…") pair in sequence, as they always have.
 * - Curly double quotes (“…”) pair by direction: “ only opens, ” only closes.
 * - The two styles mix freely, even within one quotation (“Hello," she said),
 *   because text that has passed through more than one editor often does. Any
 *   double opener is closed by the next double closer.
 *
 * Deliberately not delimiters:
 * - Apostrophes and single quotes (' ‘ ’). They mark contractions, elisions and
 *   possessives (don’t, it's, ’em, the boys’) far more often than speech, and
 *   no character-level rule tells the two apart reliably. Single-quoted
 *   dialogue (‘…’) is therefore not matched. Single quotes nested inside
 *   double-quoted dialogue are just part of that span.
 * - Guillemets and low-9 quotes (« » „).
 *
 * Unbalanced quotes stay local. A span never crosses a paragraph break (the
 * blank-line rule PassageProseStats counts paragraphs with), so a stray or
 * missing quote mark can mislabel the rest of one paragraph, never the rest
 * of the chapter. A quote still open at the end of its paragraph runs to that
 * paragraph's end, which is also how multi-paragraph speech is written: each
 * paragraph opens a quote and only the last one closes it. A ” with nothing
 * open is ignored, and a “ inside an open span is plain text, so a curly
 * quotation nested in another closes at the first ”.
 */

import { countWords } from '@/utils/textUtils';

/** A run of quoted dialogue, as UTF-16 offsets into the text it was found in. */
export interface DialogueSpan {
  /** Offset of the opening quote mark. */
  start: number;
  /** Offset just past the closing quote mark, or the paragraph's end when the quote is never closed. */
  end: number;
  /** False when the paragraph ended before a closing quote mark. */
  closed: boolean;
}

const DOUBLE_QUOTE_OPENERS: ReadonlySet<string> = new Set(['"', '“']);
const DOUBLE_QUOTE_CLOSERS: ReadonlySet<string> = new Set(['"', '”']);

/** Every dialogue span in `text`, in order and never overlapping. */
export function findDialogueSpans(text: string): DialogueSpan[] {
  const spans: DialogueSpan[] = [];
  // A fresh literal per call, so the global regex's lastIndex is never shared.
  const paragraphBreak = /\n\s*\n/g;
  let paragraphStart = 0;
  let match: RegExpExecArray | null;
  while ((match = paragraphBreak.exec(text)) !== null) {
    collectParagraphSpans(text, paragraphStart, match.index, spans);
    paragraphStart = match.index + match[0].length;
  }
  collectParagraphSpans(text, paragraphStart, text.length, spans);
  return spans;
}

/**
 * Words inside dialogue spans, counted as whitespace-separated tokens the way
 * PassageProseStats counts words. A span's text includes its quote marks, so
 * straight-quoted text whose quotes close within their paragraph counts
 * exactly as the former `/"[^"]*"/g` match did.
 */
export function countDialogueWords(text: string): number {
  return findDialogueSpans(text).reduce(
    (total, span) => total + countWords(text.slice(span.start, span.end)),
    0
  );
}

function collectParagraphSpans(text: string, start: number, end: number, spans: DialogueSpan[]): void {
  let openedAt: number | undefined;
  for (let index = start; index < end; index++) {
    const mark = text[index];
    if (openedAt === undefined) {
      if (DOUBLE_QUOTE_OPENERS.has(mark)) {
        openedAt = index;
      }
    } else if (DOUBLE_QUOTE_CLOSERS.has(mark)) {
      spans.push({ start: openedAt, end: index + 1, closed: true });
      openedAt = undefined;
    }
  }
  if (openedAt !== undefined) {
    spans.push({ start: openedAt, end, closed: false });
  }
}
