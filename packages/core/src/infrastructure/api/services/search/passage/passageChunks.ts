/**
 * Passage Search's chunks (ADR 2026-11-20 D5, D5a): a whole text when it
 * fits a call's word budget, else split at paragraphs with one paragraph of
 * overlap, so a moment that straddles a cut is still read whole once.
 *
 * - **The overlap is inside the budget.** A chunk's overlap and its own text
 *   together stay within `budget`. The overlap is the previous chunk's last
 *   paragraph, or only its closing sentences when that paragraph is longer
 *   than `overlapWords`; when even that leaves no room beside the chunk's
 *   first paragraph, the overlap shrinks, to nothing if it must.
 * - **A paragraph over the budget is split at sentence ends**
 *   (`proseSentenceSpans`, the shared rule), each piece after the first
 *   overlapping the one before by a sentence.
 * - **A sentence over the budget cannot be split:** the text is
 *   `unsplittable`, and its file is left out of the plan.
 *
 * A chunk is one contiguous slice of the text, overlap first. The text is
 * read raw: nothing is masked. Draft Edit's `chunkParagraphs` is unchanged;
 * only its paragraph rule is shared. Pure.
 */

import { paragraphRanges } from '@/utils/draftEdit/chunkParagraphs';
import { proseSentenceSpans } from '@/tools/measure/passageProseStats';
import { countWords } from '@/utils/textUtils';

export interface PassageChunk {
  /** Where the slice starts: the overlap's start, or the chunk's own text's when it has none. */
  readonly start: number;
  /** Where the chunk's own text starts. */
  readonly bodyStart: number;
  readonly end: number;
  /** Words in the slice, overlap included. */
  readonly words: number;
}

export type PassageChunks =
  | { readonly kind: 'chunks'; readonly chunks: readonly PassageChunk[] }
  /** A sentence is longer than the budget. */
  | { readonly kind: 'unsplittable' };

/** A paragraph, or one sentence of a paragraph that was over the budget. */
interface Unit {
  readonly start: number;
  readonly end: number;
  readonly words: number;
  readonly sentence: boolean;
}

/** Split `text` into chunks of at most `budget` words each, overlap included. No words, no chunks. */
export function passageChunks(text: string, budget: number, overlapWords: number): PassageChunks {
  const units = unitsOf(text, budget);
  if (units.some((unit) => unit.words > budget)) {
    return { kind: 'unsplittable' };
  }
  const chunks: PassageChunk[] = [];
  let index = 0;
  while (index < units.length) {
    const first = units[index];
    const overlap = index > 0 ? overlapOf(text, units[index - 1], budget - first.words, overlapWords) : undefined;
    let end = first.end;
    let words = first.words + (overlap?.words ?? 0);
    index += 1;
    while (index < units.length && words + units[index].words <= budget) {
      end = units[index].end;
      words += units[index].words;
      index += 1;
    }
    chunks.push({ start: overlap?.start ?? first.start, bodyStart: first.start, end, words });
  }
  return { kind: 'chunks', chunks };
}

/** Paragraphs with words, in order; a paragraph over the budget as its sentences. */
function unitsOf(text: string, budget: number): Unit[] {
  const units: Unit[] = [];
  for (const paragraph of paragraphRanges(text)) {
    const words = countWords(text.slice(paragraph.start, paragraph.end));
    if (words === 0) {
      continue;
    }
    if (words <= budget) {
      units.push({ ...paragraph, words, sentence: false });
    } else {
      units.push(...sentencesOf(text, paragraph.start, paragraph.end));
    }
  }
  return units;
}

/**
 * A paragraph's sentences, tiling it: each runs from where the shared rule
 * starts it to where the next starts, so words the rule reads as no sentence
 * (a stray mark, a fragment) stay with a neighbour and none is lost.
 */
function sentencesOf(text: string, start: number, end: number): Unit[] {
  const spans = proseSentenceSpans(text.slice(start, end));
  const starts = spans.length > 0 ? [0, ...spans.slice(1).map((span) => span.start)] : [0];
  return starts.flatMap((from, index): Unit[] => {
    const to = index + 1 < starts.length ? starts[index + 1] : end - start;
    const slice = text.slice(start + from, start + to);
    const words = countWords(slice);
    // The space between two sentences belongs to neither.
    const lead = slice.length - slice.trimStart().length;
    return words > 0 ? [{ start: start + from + lead, end: start + from + slice.trimEnd().length, words, sentence: true }] : [];
  });
}

/**
 * What a chunk repeats of the unit before it, within `room` words: a
 * sentence whole; a paragraph whole when it is within `overlapWords`, else
 * its closing sentences within it. Undefined when nothing fits.
 */
function overlapOf(text: string, previous: Unit, room: number, overlapWords: number): { start: number; words: number } | undefined {
  if (previous.sentence) {
    return previous.words <= room ? { start: previous.start, words: previous.words } : undefined;
  }
  const limit = Math.min(room, overlapWords);
  if (previous.words <= limit) {
    return { start: previous.start, words: previous.words };
  }
  let kept: { start: number; words: number } | undefined;
  for (const sentence of sentencesOf(text, previous.start, previous.end).reverse()) {
    const words = (kept?.words ?? 0) + sentence.words;
    if (words > limit) {
      break;
    }
    kept = { start: sentence.start, words };
  }
  return kept;
}
