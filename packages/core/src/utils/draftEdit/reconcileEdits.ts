/**
 * What became of each edit a host was asked to make (ADR 2026-10-21 D4 step
 * 7). A host's "applied" never says which edits landed: the writer may tick
 * only some in review, and type meanwhile. So the document is replayed from
 * the edits' version through every change it saw, and each edit is read
 * where it stands. Nothing is searched for.
 *
 * A host's own change need not look like the edits it was asked for. VS Code
 * may split one replacement into smaller changes inside it, and it merges
 * 1,000 operations or more into one change spanning all of them, the text
 * between them included (`PieceTreeTextBuffer._reduceOperations`). So, per
 * change event:
 * - Changes and the edits they touch (edges included) form clusters. A
 *   change touching no edit only moves what comes after it.
 * - A cluster's new text must read as the text between its edits, as it
 *   was, with each edit either as it was or as its replacement, and in only
 *   one way (`readCluster`). Then the cluster is exactly those replacements:
 *   they are what the history returns, so a flag in the text between them
 *   stays on its text.
 * - A cluster that reads no way, or more than one, is something else (the
 *   writer typing): an edit a change reached into is `unknown`, one a change
 *   only met at an edge is left where it is, and the changes are returned as
 *   they came.
 *
 * Then: the replacement stands there → `applied`; the original →
 * `not-applied`; anything else → `unknown`. Edits must not overlap or touch:
 * the applier joins touching edits into one before asking.
 */

import type { TextRange } from '@/domain/models/DraftEdit';
import type { TextChange } from '@/utils/draftEdit/shiftRanges';

export interface ReconcilableEdit extends TextRange {
  readonly original: string;
  readonly replacement: string;
}

export type EditLanding<T extends ReconcilableEdit> =
  | { readonly edit: T; readonly landing: 'applied' | 'not-applied'; readonly range: TextRange }
  | { readonly edit: T; readonly landing: 'unknown' };

export interface Reconciliation<T extends ReconcilableEdit> {
  readonly landings: Array<EditLanding<T>>;
  /**
   * The same history, each host change that reads as these edits' replacements
   * returned as exactly those replacements; every other change as it came.
   */
  readonly events: TextChange[][];
}

/** Readings a cluster may branch into before it is called unreadable; real clusters keep one or two. */
const MAX_READINGS = 64;

interface Tracked<T> {
  readonly edit: T;
  start: number;
  end: number;
  state: 'original' | 'replaced' | 'broken';
}

export function reconcileEdits<T extends ReconcilableEdit>(
  edits: readonly T[],
  startText: string,
  events: ReadonlyArray<readonly TextChange[]>
): Reconciliation<T> {
  const tracked: Array<Tracked<T>> = [...edits]
    .sort((a, b) => a.start - b.start)
    .map((edit) => ({ edit, start: edit.start, end: edit.end, state: 'original' }));
  let text = startText;
  const normalized: TextChange[][] = [];
  for (const changes of events) {
    const read = readEvent(text, changes, tracked);
    normalized.push(read.changes);
    text = applyChanges(text, changes);
  }
  const landings = tracked.map((each): EditLanding<T> => {
    if (each.state === 'broken') {
      return { edit: each.edit, landing: 'unknown' };
    }
    const standing = text.slice(each.start, each.end);
    const expected = each.state === 'replaced' ? each.edit.replacement : each.edit.original;
    if (standing !== expected) {
      return { edit: each.edit, landing: 'unknown' };
    }
    return { edit: each.edit, landing: each.state === 'replaced' ? 'applied' : 'not-applied', range: { start: each.start, end: each.end } };
  });
  return { landings, events: normalized };
}

/** One event read against the tracked edits; moves them, and returns the event as it reads. */
function readEvent<T extends ReconcilableEdit>(pre: string, changes: readonly TextChange[], tracked: Array<Tracked<T>>): { changes: TextChange[] } {
  const live = tracked.filter((each) => each.state !== 'broken');
  const clusters = clustersOf([...changes].sort((a, b) => a.offset - b.offset), live);
  const out: TextChange[] = [];
  const replacedHere = new Set<Tracked<T>>();
  for (const cluster of clusters) {
    if (cluster.edits.length === 0) {
      out.push(...cluster.changes);
      continue;
    }
    const reading = readCluster(pre, cluster);
    if (!reading) {
      // Not these edits' replacements: the writer's own change. An edit it reached into is unknown; one it only met at an edge stays.
      cluster.edits
        .filter((each) => cluster.changes.some((change) => reachesInto(change, each)))
        .forEach((each) => {
          each.state = 'broken';
        });
      out.push(...cluster.changes);
      continue;
    }
    cluster.edits.forEach((each, index) => {
      if (reading[index] === 'replacement' && each.state === 'original') {
        out.push({ offset: each.start, length: each.end - each.start, text: each.edit.replacement });
        replacedHere.add(each);
      }
    });
  }
  // Move every edit still followed through the event as it reads.
  out.sort((a, b) => a.offset - b.offset);
  const shiftBefore = deltaBefore(out);
  for (const each of live) {
    if (each.state === 'broken') {
      continue;
    }
    // Text inserted at an edit's start lands before it, and moves it; text inserted at its end lands after it.
    const start = each.start + shiftBefore(each.start, true);
    if (replacedHere.has(each)) {
      each.state = 'replaced';
      each.end = start + each.edit.replacement.length;
    } else {
      each.end = each.end + shiftBefore(each.end, false);
    }
    each.start = start;
  }
  return { changes: out };
}

interface Cluster<T> {
  readonly changes: TextChange[];
  readonly edits: Array<Tracked<T>>;
  start: number;
  end: number;
}

/**
 * How far a position before the event moves: the length change of every
 * change ending before it, and of one ending at it too when `atCounts` (a
 * start, which text inserted there lands before). `changes` are sorted and do
 * not overlap, so their ends are sorted too, and a binary search finds them.
 */
function deltaBefore(changes: readonly TextChange[]): (offset: number, atCounts: boolean) => number {
  const ends = changes.map((change) => change.offset + change.length);
  const sums = [0];
  changes.forEach((change, index) => sums.push(sums[index] + change.text.length - change.length));
  return (offset, atCounts) => {
    let low = 0;
    let high = ends.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (atCounts ? ends[middle] <= offset : ends[middle] < offset) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return sums[low];
  };
}

/** Changes joined with the edits they touch, edges included; clusters that overlap or share an edit are one. */
function clustersOf<T extends ReconcilableEdit>(changes: readonly TextChange[], live: ReadonlyArray<Tracked<T>>): Array<Cluster<T>> {
  const clusters: Array<Cluster<T>> = [];
  // Both are sorted and neither overlaps itself, so the edits a change touches start at a pointer that only moves forward.
  let first = 0;
  for (const change of changes) {
    const changeEnd = change.offset + change.length;
    while (first < live.length && live[first].end < change.offset) {
      first += 1;
    }
    const touched: Array<Tracked<T>> = [];
    for (let index = first; index < live.length && live[index].start <= changeEnd; index += 1) {
      touched.push(live[index]);
    }
    const start = Math.min(change.offset, ...touched.map((each) => each.start));
    const end = Math.max(changeEnd, ...touched.map((each) => each.end));
    const last = clusters[clusters.length - 1];
    const shares = last && touched.some((each) => last.edits.includes(each));
    if (last && (shares || start < last.end) && (touched.length > 0 || last.edits.length > 0)) {
      last.changes.push(change);
      touched.forEach((each) => {
        if (!last.edits.includes(each)) {
          last.edits.push(each);
        }
      });
      last.end = Math.max(last.end, end);
    } else {
      clusters.push({ changes: [change], edits: [...touched], start, end });
    }
  }
  clusters.forEach((cluster) => cluster.edits.sort((a, b) => a.start - b.start));
  return clusters;
}

/**
 * How a cluster's new text reads: per edit, `original` or `replacement`, the
 * text between its edits unchanged. Undefined when it reads no way, or more
 * than one.
 */
function readCluster<T extends ReconcilableEdit>(pre: string, cluster: Cluster<T>): Array<'original' | 'replacement'> | undefined {
  const { start, end, edits } = cluster;
  const after = applyChanges(pre.slice(start, end), cluster.changes.map((change) => ({ ...change, offset: change.offset - start })));
  // The text before each edit (between[k] precedes edit k), and after the last.
  const between = edits.map((each, index) => pre.slice(index === 0 ? start : edits[index - 1].end, each.start));
  const trailing = pre.slice(edits[edits.length - 1].end, end);
  const options = edits.map((each) => (each.state === 'replaced'
    ? [{ kind: 'replacement' as const, text: each.edit.replacement }]
    : [{ kind: 'original' as const, text: each.edit.original }, { kind: 'replacement' as const, text: each.edit.replacement }]));

  // Forward: where each edit can end, reading the text before it unchanged.
  const reach: Array<Set<number>> = [];
  let positions = new Set([0]);
  for (let k = 0; k < edits.length; k += 1) {
    const next = new Set<number>();
    for (const p of positions) {
      if (!after.startsWith(between[k], p)) {
        continue;
      }
      for (const option of options[k]) {
        if (after.startsWith(option.text, p + between[k].length)) {
          next.add(p + between[k].length + option.text.length);
        }
      }
    }
    if (next.size === 0 || next.size > MAX_READINGS) {
      return undefined;
    }
    reach.push(positions);
    positions = next;
  }
  const finals = [...positions].filter((p) => after.startsWith(trailing, p) && p + trailing.length === after.length);
  if (finals.length === 0) {
    return undefined;
  }

  // Backward: which option each edit takes in a whole reading; more than one is ambiguous.
  const reading: Array<'original' | 'replacement'> = [];
  let ends = new Set(finals);
  for (let k = edits.length - 1; k >= 0; k -= 1) {
    const kinds = new Set<'original' | 'replacement'>();
    const starts = new Set<number>();
    for (const p of reach[k]) {
      if (!after.startsWith(between[k], p)) {
        continue;
      }
      for (const option of options[k]) {
        const q = p + between[k].length + option.text.length;
        if (ends.has(q) && after.startsWith(option.text, p + between[k].length)) {
          kinds.add(option.kind);
          starts.add(p);
        }
      }
    }
    if (kinds.size !== 1) {
      return undefined;
    }
    reading[k] = [...kinds][0];
    ends = starts;
  }
  return reading;
}

/** Whether a change replaces or inserts inside an edit's text, not merely at one of its edges. */
function reachesInto(change: TextChange, edit: TextRange): boolean {
  const changeEnd = change.offset + change.length;
  return change.length === 0
    ? change.offset > edit.start && change.offset < edit.end
    : change.offset < edit.end && changeEnd > edit.start;
}

/** Apply one event's changes, in offsets of the text before it. */
function applyChanges(text: string, changes: readonly TextChange[]): string {
  let result = text;
  for (const change of [...changes].sort((a, b) => b.offset - a.offset)) {
    result = result.slice(0, change.offset) + change.text + result.slice(change.offset + change.length);
  }
  return result;
}
