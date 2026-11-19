/**
 * The Settings sheet's context-path review as drawn (ADR 2026-11-19 D23,
 * D24): which groups start ticked, which may be ticked, and the lines an
 * answer leaves. Pure.
 */

import type { ContextPathGroup, ContextPathGroupApplyOutcome, ContextPathProposalView } from '@shared/types';
import { CONTEXT_PATH_GROUP_LABELS, contextPathLeftWords } from '@shared/constants/contextPathSuggestionWords';

/** Ticked by default where something was proposed and kept: every offered group. */
export function contextPathsInitialTicked(view: ContextPathProposalView): ContextPathGroup[] {
  return view.groups.filter((group) => group.offer.offered).map((group) => group.group);
}

export function contextPathsTickable(view: ContextPathProposalView | undefined, group: ContextPathGroup): boolean {
  return view?.groups.some((candidate) => candidate.group === group && candidate.offer.offered) ?? false;
}

/** What Apply did, in lines: the groups written, then each group left with its reason. */
export function contextPathsAppliedLines(outcomes: readonly ContextPathGroupApplyOutcome[]): string[] {
  const applied = outcomes.filter((entry) => entry.outcome === 'applied').map((entry) => CONTEXT_PATH_GROUP_LABELS[entry.group]);
  const lines = applied.length > 0
    ? [`Applied to all your projects: ${applied.join(', ')}.`]
    : [outcomes.length === 0 ? 'Nothing was applied.' : 'Nothing was applied; your context paths are as they were.'];
  for (const entry of outcomes) {
    if (entry.outcome === 'left') {
      lines.push(contextPathLeftWords(entry.group, entry.reason));
    }
  }
  return lines;
}
