/**
 * A word-level diff for a file-edit card's replace (ADR 2026-11-05 D9; epic
 * Slice 4b): what the find text loses and the replace-with text gains, as
 * runs of words.
 *
 * - **Tokens** are runs of whitespace and runs of anything else, so every
 *   segment's text, joined, gives back the input exactly.
 * - **Common prefix and suffix** are trimmed first; the middle is a longest
 *   common subsequence over tokens.
 * - **Bounded.** Past `WORD_DIFF_CELL_LIMIT` table cells the middle is shown
 *   as one removal and one addition: still exact, just coarser.
 * - **Readable.** A whitespace run alone between two changes joins them, so
 *   "a b c" → "x y z" reads as one change, not three.
 *
 * Pure; it changes nothing and reads nothing but its arguments.
 */

export type WorkshopFileEditDiffSegment =
  | { readonly kind: 'same'; readonly text: string }
  | { readonly kind: 'removed'; readonly text: string }
  | { readonly kind: 'added'; readonly text: string };

/** The largest LCS table the diff builds (find × replace-with tokens). */
export const WORD_DIFF_CELL_LIMIT = 1_000_000;

type Run = { kind: 'same'; text: string } | { kind: 'change'; removed: string; added: string };

const TOKENS = /\s+|\S+/gu;

function tokensOf(text: string): string[] {
  return text.match(TOKENS) ?? [];
}

export function workshopFileEditWordDiff(before: string, after: string): WorkshopFileEditDiffSegment[] {
  const a = tokensOf(before);
  const b = tokensOf(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start += 1;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const runs: Run[] = [];
  push(runs, { kind: 'same', text: a.slice(0, start).join('') });
  for (const run of middleRuns(a.slice(start, endA), b.slice(start, endB))) {
    push(runs, run);
  }
  push(runs, { kind: 'same', text: a.slice(endA).join('') });
  return segmentsOf(joinWhitespaceBetweenChanges(runs));
}

/** The changed middle, by LCS over tokens, or one change past the cell bound. */
function middleRuns(a: readonly string[], b: readonly string[]): Run[] {
  if (a.length === 0 || b.length === 0 || (a.length + 1) * (b.length + 1) > WORD_DIFF_CELL_LIMIT) {
    return [{ kind: 'change', removed: a.join(''), added: b.join('') }];
  }
  const width = b.length + 1;
  // Within the bound, min(a, b) ≤ 1,000, so a 16-bit length always fits.
  const table = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] = a[i] === b[j]
        ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const runs: Run[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push(runs, { kind: 'same', text: a[i] });
      i += 1;
      j += 1;
    } else if (j < b.length && (i === a.length || table[i * width + j + 1] >= table[(i + 1) * width + j])) {
      push(runs, { kind: 'change', removed: '', added: b[j] });
      j += 1;
    } else {
      push(runs, { kind: 'change', removed: a[i], added: '' });
      i += 1;
    }
  }
  return runs;
}

/** Appends a run, merging it into the last one of its kind. */
function push(runs: Run[], run: Run): void {
  if (run.kind === 'same' && run.text === '') {
    return;
  }
  const last = runs[runs.length - 1];
  if (last?.kind === 'same' && run.kind === 'same') {
    last.text += run.text;
  } else if (last?.kind === 'change' && run.kind === 'change') {
    last.removed += run.removed;
    last.added += run.added;
  } else {
    runs.push({ ...run });
  }
}

function joinWhitespaceBetweenChanges(runs: readonly Run[]): Run[] {
  const joined: Run[] = [];
  runs.forEach((run, at) => {
    const previous = runs[at - 1];
    const next = runs[at + 1];
    if (run.kind === 'same' && /^\s+$/u.test(run.text) && previous?.kind === 'change' && next?.kind === 'change') {
      push(joined, { kind: 'change', removed: run.text, added: run.text });
      return;
    }
    push(joined, run);
  });
  return joined;
}

function segmentsOf(runs: readonly Run[]): WorkshopFileEditDiffSegment[] {
  const segments: WorkshopFileEditDiffSegment[] = [];
  for (const run of runs) {
    if (run.kind === 'same') {
      segments.push({ kind: 'same', text: run.text });
      continue;
    }
    if (run.removed) {
      segments.push({ kind: 'removed', text: run.removed });
    }
    if (run.added) {
      segments.push({ kind: 'added', text: run.added });
    }
  }
  return segments;
}
