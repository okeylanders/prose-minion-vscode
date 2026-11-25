/**
 * A context group narrowed by patterns (ADR 2026-11-20 S42–S46): the one
 * rule every reader of a narrowing follows, so what a group's inventory
 * lists is exactly what a search of that narrowed group reads.
 *
 * - **Read:** the list's form (`readContextGroupMatchList`: split as a
 *   context-path setting is, 1 to `matchPatterns`, each list at most
 *   `matchCharacters`), then each pattern held to
 *   `contextPathPatternRefusal`. One unsafe pattern refuses the whole
 *   narrowing, before anything is walked.
 * - **Narrowed:** the files of the group's authoritative listing that at
 *   least one pattern finds by the context-path walk (the resolver's
 *   `matchPatterns`), compared by the host's file identity. A narrowed group
 *   can never reach a file outside its group. Files keep the listing's
 *   order.
 * - **Counted per pattern:** the files of its group each pattern finds.
 * - **Incomplete is never zero** (ADR 2026-11-19 D22a): a walk that did not
 *   complete for any pattern of a narrowing makes it `incomplete`. With no
 *   workspace folder open there is nothing to walk, and every pattern finds
 *   nothing.
 * - **One walk per operation:** every narrowing an operation names is
 *   checked in one `matchPatterns` call.
 *
 * It logs nothing: a pattern, a path or a file name never leaves here.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ContextPathGroup } from '@shared/types/context';
import { contextPathPatternRefusal } from '@/application/services/contextPaths/ContextPathPatternSafety';
import { hostFileIdentity } from '@/infrastructure/context/ContextGroupFiles';
import type { ContextPatternMatches, ContextPatternsByGroup } from '@/infrastructure/context/ContextResourceResolver';
import { readContextGroupMatchList, type ContextGroupMatchFormFault } from '@/utils/contextGroupMatchList';

/** Why a narrowing as written cannot be read: its form, or a pattern the context-path rules refuse. */
export type ContextGroupMatchFault = ContextGroupMatchFormFault | 'unsafe';

export type ContextGroupMatchReading =
  | { readonly kind: 'patterns'; readonly patterns: readonly string[] }
  | { readonly kind: 'refused'; readonly fault: ContextGroupMatchFault };

/** A file of a group's authoritative listing, as a narrowing reads it. Its absolute path stays host-side. */
export interface ContextGroupListedFile {
  readonly group: ContextPathGroup;
  readonly absolutePath: string;
}

/** The context-path walk a narrowing is checked by: the resolver's `matchPatterns`. */
export interface ContextGroupPatternMatcher {
  matchPatterns(patternsByGroup: ContextPatternsByGroup): Promise<ContextPatternMatches | undefined>;
}

/** One narrowing an operation checks: a group and its patterns, already read. */
export interface ContextGroupMatchRequest {
  readonly group: ContextPathGroup;
  readonly patterns: readonly string[];
}

/** One walk, for every narrowing of an operation. */
export type ContextGroupPatternWalk =
  | { readonly kind: 'walked'; readonly matches: ContextPatternMatches }
  /** No workspace folder is open: there is nothing to walk. */
  | { readonly kind: 'no-folder' }
  | { readonly kind: 'failed' };

/** The files of its group a pattern finds. */
export interface ContextGroupPatternCount {
  readonly pattern: string;
  readonly files: number;
}

export type ContextGroupNarrowed<File> =
  | { readonly kind: 'narrowed'; readonly files: readonly File[]; readonly patterns: readonly ContextGroupPatternCount[] }
  | { readonly kind: 'incomplete' };

/** One or more lists as written (an attribute, or repeated elements), read by the narrowing's rule. */
export function readContextGroupMatch(written: readonly string[]): ContextGroupMatchReading {
  const form = readContextGroupMatchList(written);
  if (form.kind === 'refused') {
    return form;
  }
  return contextGroupMatchUnsafe(form.patterns) ? { kind: 'refused', fault: 'unsafe' } : form;
}

/** An already-split list held to the same rule: 1 to `matchPatterns`, each safe. Whether it would be refused. */
export function contextGroupMatchRefused(patterns: readonly string[]): boolean {
  return patterns.length === 0 || patterns.length > PROMPT_BUDGETS.contextPaths.matchPatterns || contextGroupMatchUnsafe(patterns);
}

function contextGroupMatchUnsafe(patterns: readonly string[]): boolean {
  return patterns.some((pattern) => contextPathPatternRefusal(pattern) !== undefined);
}

/** Walk every narrowing an operation names, once. A walk that throws is `failed`, never zero files. */
export async function walkContextGroupPatterns(
  matcher: ContextGroupPatternMatcher,
  requests: readonly ContextGroupMatchRequest[]
): Promise<ContextGroupPatternWalk> {
  const byGroup: Partial<Record<ContextPathGroup, string[]>> = {};
  for (const { group, patterns } of requests) {
    const listed = byGroup[group] ?? (byGroup[group] = []);
    for (const pattern of patterns) {
      if (!listed.includes(pattern)) {
        listed.push(pattern);
      }
    }
  }
  if (Object.keys(byGroup).length === 0) {
    return { kind: 'walked', matches: {} };
  }
  try {
    const matches = await matcher.matchPatterns(byGroup);
    return matches ? { kind: 'walked', matches } : { kind: 'no-folder' };
  } catch {
    return { kind: 'failed' };
  }
}

/** The files of `group` in `listed` that at least one of `patterns` finds, with each pattern's count. */
export function narrowContextGroup<File extends ContextGroupListedFile>(
  listed: readonly File[],
  { group, patterns }: ContextGroupMatchRequest,
  walk: ContextGroupPatternWalk
): ContextGroupNarrowed<File> {
  if (walk.kind === 'failed') {
    return { kind: 'incomplete' };
  }
  if (walk.kind === 'no-folder') {
    return { kind: 'narrowed', files: [], patterns: patterns.map((pattern) => ({ pattern, files: 0 })) };
  }
  const outcomes = walk.matches[group] ?? [];
  const found: Array<ReadonlySet<string>> = [];
  for (const pattern of patterns) {
    const outcome = outcomes.find((candidate) => candidate.pattern === pattern);
    // A pattern the walk never answered for is no evidence of zero.
    if (!outcome || outcome.status === 'incomplete') {
      return { kind: 'incomplete' };
    }
    found.push(new Set(outcome.status === 'matched' ? outcome.files.map((file) => file.identity) : []));
  }
  const inGroup = listed
    .filter((file) => file.group === group)
    .map((file) => ({ file, identity: hostFileIdentity(file.absolutePath) }));
  return {
    kind: 'narrowed',
    files: inGroup.filter(({ identity }) => found.some((identities) => identities.has(identity))).map(({ file }) => file),
    patterns: patterns.map((pattern, index) => ({
      pattern,
      files: inGroup.filter(({ identity }) => found[index].has(identity)).length
    }))
  };
}
