/**
 * Which proposed context-path patterns are refused, before anything
 * normalizes them (ADR 2026-11-19 D22). The resolver strips a leading `/`
 * and a `workspace:` prefix silently; a proposal never gets that far with
 * either.
 *
 * Refused: empty after trimming; holding a comma (it would split the
 * setting); starting with `/` or `\`, a drive (`C:`), `~` or `workspace:`;
 * holding a `..` segment, a backslash or a control character; longer than
 * `patternCharacters`. A repeat of a pattern already listed is `duplicate`,
 * and every entry past `patternsPerGroup` is `over-cap`.
 *
 * Pure: no I/O, no log.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ContextPathPatternRefusal } from '@messages';

// A C0 or C1 control, DEL, or a line or paragraph separator.
// eslint-disable-next-line no-control-regex -- the rule is about control characters.
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/** Why `pattern` (as written) is unsafe, or `undefined` when it may be checked. */
export function contextPathPatternRefusal(
  pattern: string,
  maxCharacters: number = PROMPT_BUDGETS.contextPaths.patternCharacters
): ContextPathPatternRefusal | undefined {
  const text = pattern.trim();
  if (text === '') {
    return 'empty';
  }
  if (CONTROL.test(text)) {
    return 'control-character';
  }
  if (text.length > maxCharacters) {
    return 'too-long';
  }
  if (text.includes(',')) {
    return 'comma';
  }
  if (text.startsWith('/') || text.startsWith('\\')) {
    return 'absolute';
  }
  if (/^[A-Za-z]:/.test(text)) {
    return 'drive';
  }
  if (text.startsWith('~')) {
    return 'home';
  }
  if (/^workspace:/i.test(text)) {
    return 'workspace-prefix';
  }
  if (text.includes('\\')) {
    return 'backslash';
  }
  if (text.split('/').some((segment) => segment === '..')) {
    return 'parent-segment';
  }
  return undefined;
}

export interface ContextPathPatternTriage {
  /** Safe patterns, trimmed, in the order proposed, each once. */
  readonly safe: readonly string[];
  readonly refused: ReadonlyArray<{ readonly pattern: string; readonly reason: ContextPathPatternRefusal }>;
}

/** A group's proposed patterns, sorted into those to check and those refused (positionally capped). */
export function triageContextPathPatterns(
  patterns: readonly string[],
  bounds: Pick<typeof PROMPT_BUDGETS.contextPaths, 'patternsPerGroup' | 'patternCharacters'> = PROMPT_BUDGETS.contextPaths
): ContextPathPatternTriage {
  const safe: string[] = [];
  const refused: Array<{ pattern: string; reason: ContextPathPatternRefusal }> = [];
  patterns.forEach((written, index) => {
    const pattern = written.trim();
    if (index >= bounds.patternsPerGroup) {
      refused.push({ pattern, reason: 'over-cap' });
      return;
    }
    const reason = contextPathPatternRefusal(written, bounds.patternCharacters);
    if (reason) {
      refused.push({ pattern, reason });
      return;
    }
    if (safe.includes(pattern)) {
      refused.push({ pattern, reason: 'duplicate' });
      return;
    }
    safe.push(pattern);
  });
  return { safe, refused };
}

/** A setting's value as the resolver reads it: split on commas, trimmed, empties dropped. */
export function contextPathSettingPatterns(value: string | undefined): string[] {
  return (value ?? '').split(',').map((pattern) => pattern.trim()).filter((pattern) => pattern.length > 0);
}
