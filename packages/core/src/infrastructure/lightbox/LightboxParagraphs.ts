/**
 * The Lightbox paragraph model (ADR 2026-10-19 D4). Pure: no host, no I/O.
 *
 * One splitter addresses everything on the board. It uses the blank-line rule
 * (`/\n\s*\n/`) PassageProseStats counts paragraphs with, so "48 paragraphs"
 * means the same thing in the Metrics tab and on the board. Paragraphs are
 * numbered from 1 and carry offsets into the text as it was read; a heading
 * line between blank lines is a paragraph.
 *
 * Per-paragraph counts reuse the measure tools' own rules: words are
 * whitespace-separated tokens, sentences are `proseSentenceSpans` (the
 * prose-stats count, with each sentence's words kept for the rhythm lens,
 * Slice 4B), and
 * dialogue uses the shared dialogue-span matcher (straight and curly double
 * quotes), never a matcher of its own. Because no dialogue span crosses a
 * paragraph break, per-paragraph dialogue words sum to the whole-text count.
 * Per-paragraph sentences can sum higher than the whole-text count: a
 * paragraph that ends without punctuation (a heading) counts as its own
 * sentence here, where the whole-text split runs it into the next one.
 */

import { createHash } from 'node:crypto';
import type { LightboxParagraphMetric, LightboxRibbonColumn } from '@messages';
import { countWords } from '@/utils/textUtils';
import { countDialogueWords } from '@/utils/dialogueSpans';
import { proseSentenceSpans } from '@/tools/measure/passageProseStats';

/** A paragraph of the source text. `text` is trimmed; offsets bound it exactly. */
export interface LightboxParagraph {
  /** Numbered from 1. */
  index: number;
  text: string;
  /** UTF-16 offset of the paragraph's first non-space character. */
  start: number;
  /** Offset just past its last non-space character. */
  end: number;
  words: number;
}

/** An inclusive, 1-based run of paragraphs. */
export interface LightboxParagraphRange {
  from: number;
  to: number;
}

/** Split `text` into paragraphs with the shared blank-line rule. */
export function splitLightboxParagraphs(text: string): LightboxParagraph[] {
  const paragraphs: LightboxParagraph[] = [];
  // A fresh literal per call, so the global regex's lastIndex is never shared.
  const paragraphBreak = /\n\s*\n/g;
  let chunkStart = 0;
  let match: RegExpExecArray | null;
  while ((match = paragraphBreak.exec(text)) !== null) {
    pushParagraph(text, chunkStart, match.index, paragraphs);
    chunkStart = match.index + match[0].length;
  }
  pushParagraph(text, chunkStart, text.length, paragraphs);
  return paragraphs;
}

function pushParagraph(text: string, from: number, to: number, paragraphs: LightboxParagraph[]): void {
  const chunk = text.slice(from, to);
  const trimmed = chunk.trim();
  if (trimmed.length === 0) {
    return;
  }
  const start = from + (chunk.length - chunk.trimStart().length);
  paragraphs.push({
    index: paragraphs.length + 1,
    text: trimmed,
    start,
    end: start + trimmed.length,
    words: countWords(trimmed)
  });
}

/** Words, sentences, rhythm and dialogue share for one paragraph. */
export function measureLightboxParagraph(paragraph: LightboxParagraph): LightboxParagraphMetric {
  const sentenceWords = lightboxSentenceWords(paragraph.text);
  const sentences = sentenceWords.length;
  const dialogueWords = countDialogueWords(paragraph.text);
  return {
    index: paragraph.index,
    start: paragraph.start,
    end: paragraph.end,
    words: paragraph.words,
    sentences,
    avgWordsPerSentence: roundTo(sentences > 0 ? paragraph.words / sentences : 0, 1),
    dialogueWords,
    dialogueShare: roundTo(paragraph.words > 0 ? dialogueWords / paragraph.words : 0, 3),
    sentenceWords
  };
}

/** The words in each sentence of `text`, by the prose-stats splitter and word rule. */
export function lightboxSentenceWords(text: string): number[] {
  return proseSentenceSpans(text).map(({ start, end }) => countWords(text.slice(start, end)));
}

/**
 * The text a board's hash is taken over: line endings folded to `\n`, Unicode
 * composed (NFC), outer whitespace trimmed. Saving a file from another editor
 * or OS therefore does not mark its board stale.
 */
export function normalizeLightboxText(text: string): string {
  return text.replace(/\r\n?/g, '\n').normalize('NFC').trim();
}

/** SHA-256 (hex) over the normalized text; a change marks a board stale (D4). */
export function lightboxContentHash(text: string): string {
  return createHash('sha256').update(normalizeLightboxText(text), 'utf8').digest('hex');
}

/**
 * Ribbon columns for `count` paragraphs: one per paragraph up to `columns`,
 * otherwise exactly `columns` contiguous ranges whose sizes differ by at most
 * one. Every paragraph lands in exactly one range, in order.
 */
export function bucketParagraphs(count: number, columns: number): LightboxParagraphRange[] {
  if (!Number.isInteger(count) || count <= 0) {
    return [];
  }
  const width = Math.max(1, Math.floor(columns));
  if (count <= width) {
    return Array.from({ length: count }, (_, offset) => ({ from: offset + 1, to: offset + 1 }));
  }
  const ranges: LightboxParagraphRange[] = [];
  for (let column = 0; column < width; column++) {
    ranges.push({
      from: Math.floor((column * count) / width) + 1,
      to: Math.floor(((column + 1) * count) / width)
    });
  }
  return ranges;
}

/**
 * The ribbon's columns with their lanes: rhythm is words ÷ sentences pooled
 * over the column's paragraphs, dialogue is dialogue words ÷ words.
 */
export function buildLightboxRibbon(
  paragraphs: readonly LightboxParagraphMetric[],
  columns: number
): LightboxRibbonColumn[] {
  return bucketParagraphs(paragraphs.length, columns).map(({ from, to }) => {
    let words = 0;
    let sentences = 0;
    let dialogueWords = 0;
    for (let index = from; index <= to; index++) {
      const paragraph = paragraphs[index - 1];
      words += paragraph.words;
      sentences += paragraph.sentences;
      dialogueWords += paragraph.dialogueWords;
    }
    return {
      from,
      to,
      avgWordsPerSentence: roundTo(sentences > 0 ? words / sentences : 0, 1),
      dialogueShare: roundTo(words > 0 ? dialogueWords / words : 0, 3)
    };
  });
}

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
