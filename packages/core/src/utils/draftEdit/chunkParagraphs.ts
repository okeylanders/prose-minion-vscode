/**
 * Paragraph chunking for Draft Edit passes (ADR 2026-10-21 D6): a long target
 * is split on blank lines into chunks under a word budget, so each model call
 * reads a passage it can check closely. A paragraph never splits; one longer
 * than the budget becomes a chunk of its own.
 */

import type { TextRange } from '@/domain/models/DraftEdit';
import { PROTECTED_PLACEHOLDER } from '@/utils/draftEdit/protectedRegions';

export interface TextChunk extends TextRange {
  /** `text.slice(start, end)` of the chunked text. */
  readonly text: string;
  /** Words outside protected placeholders. */
  readonly words: number;
}

const PARAGRAPH_BREAK = /\n(?:[ \t]*\r?\n)+/g;

/** Words a pass will read: whitespace-separated runs, protected placeholders excluded. */
export function countProseWords(text: string): number {
  return text.split(PROTECTED_PLACEHOLDER).join(' ').split(/\s+/).filter((word) => word.length > 0).length;
}

/** Split `text` into paragraph-aligned chunks of at most `maxWords` words each (one paragraph may exceed it). Chunks with no prose are left out. */
export function chunkParagraphs(text: string, maxWords: number): TextChunk[] {
  const paragraphs = paragraphRanges(text);
  const chunks: TextChunk[] = [];
  let current: { start: number; end: number; words: number } | undefined;

  const flush = () => {
    if (current && current.words > 0) {
      chunks.push({ ...current, text: text.slice(current.start, current.end) });
    }
    current = undefined;
  };

  for (const paragraph of paragraphs) {
    const words = countProseWords(text.slice(paragraph.start, paragraph.end));
    if (words === 0) {
      // No prose (a lone protected block): never what a chunk starts or ends on.
      continue;
    }
    if (current && current.words + words > maxWords) {
      flush();
    }
    current = current
      ? { start: current.start, end: paragraph.end, words: current.words + words }
      : { start: paragraph.start, end: paragraph.end, words };
  }
  flush();
  return chunks;
}

/** Each paragraph's span: the text between blank lines, trimmed of the breaks themselves. */
function paragraphRanges(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  let start = 0;
  for (const match of text.matchAll(PARAGRAPH_BREAK)) {
    if (match.index! > start) {
      ranges.push({ start, end: match.index! });
    }
    start = match.index! + match[0].length;
  }
  if (start < text.length) {
    ranges.push({ start, end: text.length });
  }
  return ranges;
}
