/**
 * Keep shown flags on their text while the writer types (ADR 2026-10-21 D3).
 * A host editor does not move its annotations for us, so the annotator feeds
 * each document change through this arithmetic: a range wholly before a
 * change stays, a range wholly after it moves by the change's length delta,
 * and a range the change touches is dropped. Its text is no longer the text
 * that was flagged.
 *
 * A range's `related` ranges (a continuity flag's other side, Slice 3c part
 * 4) move by the same rule, each on its own, and a change touching any of
 * them drops the range: the pair no longer says what it said.
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
export function shiftRanges<T extends TextRange & { readonly related?: readonly TextRange[] }>(
  ranges: readonly T[],
  changes: readonly TextChange[]
): T[] {
  const ordered = [...changes].sort((a, b) => b.offset - a.offset);
  let current: T[] = [...ranges];
  for (const change of ordered) {
    const next: T[] = [];
    for (const range of current) {
      const moved = shiftOne(range, change);
      const related = range.related?.map((each) => shiftOne(each, change));
      // A change touching the flagged text, or any related range, drops it.
      if (moved && !related?.some((each) => each === undefined)) {
        next.push(related ? { ...moved, related } : moved);
      }
    }
    current = next;
  }
  return current;
}

/** One range through one change: kept, moved by the change's length delta, or (touched) undefined. */
function shiftOne<R extends TextRange>(range: R, change: TextChange): R | undefined {
  const changeEnd = change.offset + change.length;
  if (range.end <= change.offset) {
    return range;
  }
  if (range.start >= changeEnd) {
    const delta = change.text.length - change.length;
    return { ...range, start: range.start + delta, end: range.end + delta };
  }
  return undefined;
}
