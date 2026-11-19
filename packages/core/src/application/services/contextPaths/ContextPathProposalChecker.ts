/**
 * ContextPathProposalChecker — one checker for every context-path proposal
 * (ADR 2026-11-19 D18, D22, D22a, D25), the Settings helper's draft now and
 * a persona's trailer later (C2).
 *
 * - **Unsafe patterns are refused before any normalization**
 *   (`triageContextPathPatterns`).
 * - **Each safe pattern runs through the real resolver**
 *   (`ContextResourceResolver.matchPatterns`): the catalog's own
 *   normalization, roots, exclusions, `.md`/`.txt` rule and symbolic-link
 *   refusal.
 * - **Only `unmatched` drops a pattern.** A pattern whose check was
 *   `incomplete` is never read as zero matches: its group is shown as not
 *   checked completely, and not offered (D22a). The same holds for the
 *   current patterns' count ("couldn't count").
 * - **A group left out keeps its patterns,** and so does a group whose
 *   every pattern was dropped or refused.
 * - **Overlap is counted per group,** from each group's own matches after
 *   Apply, never the catalog (which keeps a file in its first group only).
 * - **A group the workspace sets** is shown and not offered (D25).
 *
 * The view is writer data; this module logs nothing. The resolver's check
 * logs counts only.
 */

import {
  CONTEXT_PATH_GROUPS,
  type ContextPathDroppedPattern,
  type ContextPathGroup,
  type ContextPathGroupView,
  type ContextPathKeptPattern,
  type ContextPathOffer,
  type ContextPathProposalView,
  type ContextPathSharedFile
} from '@shared/types';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type {
  ContextPatternMatch,
  ContextPatternMatchFile,
  ContextPatternMatches,
  ContextPatternsByGroup
} from '@/infrastructure/context/ContextResourceResolver';
import { contextPathSettingPatterns, triageContextPathPatterns } from './ContextPathPatternSafety';
import type { ContextPathSettingRead } from './ContextPathSettingsWriter';

/** A proposal: per group, the patterns proposed. A group left out keeps its patterns. */
export type ContextPathProposal = Partial<Record<ContextPathGroup, readonly string[]>>;

/** The resolver's seam the checker reads (ADR 2026-11-19 D22). */
export interface ContextPatternMatcher {
  matchPatterns(patternsByGroup: ContextPatternsByGroup): Promise<ContextPatternMatches | undefined>;
}

export interface ContextPathSettingsReader {
  read(group: ContextPathGroup): ContextPathSettingRead;
}

/**
 * A checked proposal as the host holds it: the view the writer reviews,
 * each group's value as read (the baseline Apply compares), and the
 * patterns Apply would write for each offered group.
 */
export interface ContextPathCheckedProposal {
  readonly view: ContextPathProposalView;
  readonly baselines: Readonly<Record<ContextPathGroup, string>>;
  readonly kept: Readonly<Partial<Record<ContextPathGroup, readonly string[]>>>;
}

export type ContextPathCheck =
  | { readonly kind: 'checked'; readonly proposal: ContextPathCheckedProposal }
  | { readonly kind: 'no-workspace' };

export interface GroupFiles {
  readonly files: ReadonlyMap<string, ContextPatternMatchFile>;
  readonly incomplete: boolean;
}

function filesOf(matches: readonly ContextPatternMatch[] | undefined): GroupFiles {
  const files = new Map<string, ContextPatternMatchFile>();
  let incomplete = false;
  for (const match of matches ?? []) {
    if (match.status === 'incomplete') {
      incomplete = true;
    } else if (match.status === 'matched') {
      for (const file of match.files) {
        files.set(file.key, file);
      }
    }
  }
  return { files, incomplete };
}

function displayPath(file: ContextPatternMatchFile): string {
  return file.rootName ? `${file.rootName}/${file.relativePath}` : file.relativePath;
}

function examplesOf(files: Iterable<ContextPatternMatchFile>, count: number): string[] {
  return [...files].map(displayPath).sort().slice(0, count);
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export class ContextPathProposalChecker {
  constructor(
    private readonly matcher: ContextPatternMatcher,
    private readonly settings: ContextPathSettingsReader,
    private readonly bounds: Pick<typeof PROMPT_BUDGETS.contextPaths, 'patternsPerGroup' | 'patternCharacters' | 'examples'> =
      PROMPT_BUDGETS.contextPaths
  ) {}

  /**
   * The current patterns' matches alone: `undefined` when no folder is open.
   * Serves the Settings section's one line ("every group matches nothing").
   */
  async currentMatches(): Promise<Partial<Record<ContextPathGroup, GroupFiles>> | undefined> {
    const current = this.readCurrent();
    const matches = await this.matcher.matchPatterns(current.patterns);
    if (!matches) {
      return undefined;
    }
    return Object.fromEntries(CONTEXT_PATH_GROUPS.map((group) => [group, filesOf(matches[group])]));
  }

  /** Re-check patterns Apply is about to write (D24): the matcher's answer per group, or `undefined` with no folder open. */
  async recheck(kept: ContextPatternsByGroup): Promise<ContextPatternMatches | undefined> {
    return this.matcher.matchPatterns(kept);
  }

  async check(proposal: ContextPathProposal): Promise<ContextPathCheck> {
    const current = this.readCurrent();
    const currentMatches = await this.matcher.matchPatterns(current.patterns);
    if (!currentMatches) {
      return { kind: 'no-workspace' };
    }
    const triage = new Map<ContextPathGroup, ReturnType<typeof triageContextPathPatterns>>();
    const safe: Partial<Record<ContextPathGroup, readonly string[]>> = {};
    for (const group of CONTEXT_PATH_GROUPS) {
      const proposed = proposal[group];
      if (!proposed) {
        continue;
      }
      const sorted = triageContextPathPatterns(proposed, this.bounds);
      triage.set(group, sorted);
      if (sorted.safe.length > 0) {
        safe[group] = sorted.safe;
      }
    }
    const proposedMatches = Object.keys(safe).length > 0 ? await this.matcher.matchPatterns(safe) : {};
    if (!proposedMatches) {
      return { kind: 'no-workspace' };
    }

    const currentFiles = new Map(CONTEXT_PATH_GROUPS.map((group) => [group, filesOf(currentMatches[group])]));
    const kept: Partial<Record<ContextPathGroup, string[]>> = {};
    const keptFiles = new Map<ContextPathGroup, GroupFiles>();
    for (const group of triage.keys()) {
      const matches = proposedMatches[group] ?? [];
      kept[group] = matches.filter((match) => match.status === 'matched').map((match) => match.pattern);
      keptFiles.set(group, filesOf(matches));
    }

    // Each group's files after Apply: its kept patterns' where something checked completely was kept, its current patterns otherwise.
    const after = new Map<ContextPathGroup, ReadonlyMap<string, ContextPatternMatchFile>>();
    for (const group of CONTEXT_PATH_GROUPS) {
      const proposed = keptFiles.get(group);
      const usesProposed = proposed && !proposed.incomplete && (kept[group]?.length ?? 0) > 0;
      after.set(group, usesProposed ? proposed.files : currentFiles.get(group)!.files);
    }

    const offeredKept: Partial<Record<ContextPathGroup, readonly string[]>> = {};
    const groups = CONTEXT_PATH_GROUPS.map((group): ContextPathGroupView => {
      const own = current.reads[group];
      const now = currentFiles.get(group)!;
      const view: ContextPathGroupView = {
        group,
        level: own.level,
        current: {
          patterns: current.patterns[group] ? [...current.patterns[group]!] : [],
          count: now.incomplete ? null : now.files.size,
          examples: examplesOf(now.files.values(), this.bounds.examples)
        },
        offer: { offered: false, reason: 'not-proposed' }
      };
      const sorted = triage.get(group);
      if (!sorted) {
        return view;
      }
      const matches = proposedMatches[group] ?? [];
      const keptPatterns: ContextPathKeptPattern[] = [];
      const dropped: ContextPathDroppedPattern[] = [];
      for (const match of matches) {
        if (match.status === 'matched') {
          keptPatterns.push({ pattern: match.pattern, count: match.files.length });
        } else {
          dropped.push({ pattern: match.pattern, reason: match.status });
        }
      }
      dropped.push(...sorted.refused.map(({ pattern, reason }) => ({ pattern, reason })));
      const mine = keptFiles.get(group)!;
      const shared: ContextPathSharedFile[] = [];
      let sharedCount = 0;
      for (const [key, file] of mine.files) {
        const others = CONTEXT_PATH_GROUPS.filter((other) => other !== group && after.get(other)!.has(key));
        if (others.length > 0) {
          sharedCount += 1;
          shared.push({ path: displayPath(file), groups: others });
        }
      }
      shared.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
      view.proposed = {
        kept: keptPatterns,
        dropped,
        count: mine.files.size,
        examples: examplesOf(mine.files.values(), this.bounds.examples),
        shared: { count: sharedCount, examples: shared.slice(0, this.bounds.examples) }
      };
      view.offer = this.offerFor(own, mine.incomplete, kept[group] ?? [], view.current.patterns);
      if (view.offer.offered) {
        offeredKept[group] = kept[group];
      }
      return view;
    });

    return {
      kind: 'checked',
      proposal: {
        view: { groups },
        baselines: Object.fromEntries(CONTEXT_PATH_GROUPS.map((group) => [group, current.reads[group].value])) as Record<ContextPathGroup, string>,
        kept: offeredKept
      }
    };
  }

  private offerFor(
    read: ContextPathSettingRead,
    incomplete: boolean,
    kept: readonly string[],
    currentPatterns: readonly string[]
  ): ContextPathOffer {
    if (read.level === 'workspace' || read.level === 'workspace-folder') {
      return { offered: false, reason: 'workspace-set' };
    }
    if (incomplete) {
      return { offered: false, reason: 'incomplete' };
    }
    if (kept.length === 0) {
      return { offered: false, reason: 'nothing-kept' };
    }
    if (sameList(kept, currentPatterns)) {
      return { offered: false, reason: 'unchanged' };
    }
    return { offered: true };
  }

  private readCurrent(): {
    reads: Record<ContextPathGroup, ContextPathSettingRead>;
    patterns: Partial<Record<ContextPathGroup, readonly string[]>>;
  } {
    const reads = {} as Record<ContextPathGroup, ContextPathSettingRead>;
    const patterns: Partial<Record<ContextPathGroup, readonly string[]>> = {};
    for (const group of CONTEXT_PATH_GROUPS) {
      reads[group] = this.settings.read(group);
      const list = contextPathSettingPatterns(reads[group].value);
      if (list.length > 0) {
        patterns[group] = list;
      }
    }
    return { reads, patterns };
  }
}
