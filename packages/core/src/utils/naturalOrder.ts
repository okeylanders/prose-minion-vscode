/**
 * Natural order for paths (ADR 2026-11-20 D4): the order a reader expects of
 * numbered files. Pure.
 *
 * - Compared segment by segment, a parent before what it holds.
 * - The last segment's extension is set aside, so `6.9.2.md` sorts after
 *   `6.9.md`: compared whole, `.2.md` would sort before `.md`. An extension
 *   holds a letter, so the `.10` of a bare `6.10` is part of its name.
 * - Within a segment, runs of digits compare as numbers, so `6.9` < `6.9.2`
 *   < `6.10`. Everything else compares case-folded, then as written, so the
 *   order is total and stable.
 */

/** Compare two `/`- or `\`-separated paths in natural order. */
export function compareNaturalPaths(a: string, b: string): number {
  const left = segmentsOf(a);
  const right = segmentsOf(b);
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const order = compareSegments(left[index], right[index]);
    if (order !== 0) {
      return order;
    }
  }
  if (left.length !== right.length) {
    return left.length - right.length;
  }
  // Equal but for the extension or letter case: as written, so equal only when identical.
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A name, then a dot and letters or digits holding at least one letter. */
const EXTENSION = /^(.+)\.(?=[0-9]*[A-Za-z])[A-Za-z0-9]+$/;

/** The path's segments, the last one without its extension. */
function segmentsOf(path: string): string[] {
  const segments = path.split(/[\\/]+/).filter((segment) => segment.length > 0);
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    // A leading dot names a hidden file, and a run of digits is a number in the name (`6.10`): neither is an extension.
    segments[segments.length - 1] = last.replace(EXTENSION, '$1');
  }
  return segments;
}

/** A segment as alternating runs of digits and of everything else. */
function runsOf(segment: string): string[] {
  return segment.match(/\d+|\D+/g) ?? [];
}

function compareSegments(a: string, b: string): number {
  const left = runsOf(a);
  const right = runsOf(b);
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const order = compareRuns(left[index], right[index]);
    if (order !== 0) {
      return order;
    }
  }
  return left.length - right.length;
}

function compareRuns(a: string, b: string): number {
  const aDigits = /^\d/.test(a);
  const bDigits = /^\d/.test(b);
  if (aDigits && bDigits) {
    // Compared without converting, so a run too long for a number still orders: fewer digits first, once leading zeros are gone.
    const left = a.replace(/^0+(?=\d)/, '');
    const right = b.replace(/^0+(?=\d)/, '');
    if (left.length !== right.length) {
      return left.length - right.length;
    }
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (aDigits !== bDigits) {
    return aDigits ? -1 : 1;
  }
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
}
