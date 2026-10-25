/**
 * Whether an edit changes a line break (ADR 2026-10-21 D6; PR #171's
 * write-side hardening). Proofreading never needs to, and an edit that keeps
 * every line break where it stands keeps line-based provenance (an
 * `editor-selection` excerpt's lines) valid after a fix.
 *
 * Counting is not enough: `foo\nbar` → `fo\nobar` keeps one line break but
 * moves a character across it. The rule is that the changed text, between
 * the longest common prefix and the longest common suffix, holds no line
 * break on either side. Every line break then lies in text the edit leaves
 * as it was, with the same text before it on its line, so none was added,
 * removed or moved.
 *
 * It is strict by design: one edit changing text on both sides of a line
 * break it keeps reads the same as one moving text across it, and is
 * refused. Two edits, one per line, can make it.
 */

const LINE_BREAK = /[\r\n]/u;

export function changesLineBreaks(original: string, replacement: string): boolean {
  let prefix = 0;
  const shorter = Math.min(original.length, replacement.length);
  while (prefix < shorter && original[prefix] === replacement[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < shorter - prefix
    && original[original.length - 1 - suffix] === replacement[replacement.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return LINE_BREAK.test(original.slice(prefix, original.length - suffix))
    || LINE_BREAK.test(replacement.slice(prefix, replacement.length - suffix));
}
