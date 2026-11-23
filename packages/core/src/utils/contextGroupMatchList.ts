/**
 * A narrowing's patterns as written (ADR 2026-11-20 S42, S46): the list's
 * form, read as a context-path setting is read. Pure, and it imports
 * nothing of a feature, so a reply trailer's codec and the shared narrowing
 * (`ContextGroupNarrowing`) read a list by the same rule.
 *
 * - **Split as a setting is:** on commas, each pattern trimmed, empties
 *   dropped, so a trailing comma is harmless.
 * - **Bounded before it is split:** each list as written is at most
 *   `matchCharacters`.
 * - **Lists join:** several lists (a call's repeated `<match>`) are one
 *   list, in the order written.
 * - **1 to `matchPatterns`** once joined.
 *
 * Whether each pattern is safe is the narrowing's question, and what it
 * finds the resolver's. Nothing here logs.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

export type ContextGroupMatchFormFault = 'empty' | 'too-long' | 'too-many';

export type ContextGroupMatchForm =
  | { readonly kind: 'patterns'; readonly patterns: readonly string[] }
  | { readonly kind: 'refused'; readonly fault: ContextGroupMatchFormFault };

type MatchBounds = Pick<typeof PROMPT_BUDGETS.contextPaths, 'matchPatterns' | 'matchCharacters'>;

/** A comma-separated list of patterns as the resolver reads a setting: split, trimmed, empties dropped. */
export function splitContextPathList(value: string): string[] {
  return value.split(',').map((pattern) => pattern.trim()).filter((pattern) => pattern.length > 0);
}

/** One or more lists as written, joined, in the narrowing's form; or the fault that refuses them. */
export function readContextGroupMatchList(
  written: readonly string[],
  bounds: MatchBounds = PROMPT_BUDGETS.contextPaths
): ContextGroupMatchForm {
  if (written.some((list) => list.length > bounds.matchCharacters)) {
    return { kind: 'refused', fault: 'too-long' };
  }
  const patterns = written.flatMap(splitContextPathList);
  if (patterns.length === 0) {
    return { kind: 'refused', fault: 'empty' };
  }
  if (patterns.length > bounds.matchPatterns) {
    return { kind: 'refused', fault: 'too-many' };
  }
  return { kind: 'patterns', patterns };
}
