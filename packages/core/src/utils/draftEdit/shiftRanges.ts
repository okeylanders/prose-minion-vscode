/**
 * Keep shown flags on their text while the writer types (ADR 2026-10-21 D3).
 * A host editor does not move its annotations for us, so the annotator feeds
 * each document change through this arithmetic: a range wholly before a
 * change stays, a range wholly after it moves by the change's length delta,
 * and a range the change touches is dropped. Its text is no longer the text
 * that was flagged.
 */

import type { TextRange } from '@/domain/models/DraftEdit';

/** One replacement, in offsets of the document as it stood before the change event. */
export interface TextChange {
  readonly offset: number;
  /** Characters replaced, from `offset`. */
  readonly length: number;
  /** The text that replaced them. */
  readonly text: string;
}

/**
 * Apply one change event's replacements to `ranges`. All of an event's
 * changes refer to the document before the event, so they are applied from
 * the last to the first: an earlier change never moves a later one's offset.
 */
export function shiftRanges<T extends TextRange>(ranges: readonly T[], changes: readonly TextChange[]): T[] {
  const ordered = [...changes].sort((a, b) => b.offset - a.offset);
  let current: T[] = [...ranges];
  for (const change of ordered) {
    const changeEnd = change.offset + change.length;
    const delta = change.text.length - change.length;
    const next: T[] = [];
    for (const range of current) {
      if (range.end <= change.offset) {
        next.push(range);
      } else if (range.start >= changeEnd) {
        next.push({ ...range, start: range.start + delta, end: range.end + delta });
      }
      // Otherwise the change touched the flagged text: drop it.
    }
    current = next;
  }
  return current;
}
