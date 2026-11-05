/**
 * Where a quote stands in a text, exactly once (ADR 2026-11-05 D3). Pure.
 * The one anchoring rule memory edits and persona file edits share: a model
 * quotes, host code finds the quote, never an offset a model gave.
 *
 * Occurrences are counted overlapping, so `aa` is twice in `aaa`. Counting
 * stops at two: the caller needs only none, one, or more than one.
 */
export function findExactlyOnce(text: string, find: string): { readonly start: number } | { readonly count: 0 | 2 } {
  const first = text.indexOf(find);
  if (first < 0) {
    return { count: 0 };
  }
  return text.indexOf(find, first + 1) < 0 ? { start: first } : { count: 2 };
}
