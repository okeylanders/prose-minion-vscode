/**
 * Apply a checked context-path proposal (ADR 2026-11-19 D24, D22a, D25):
 * the writer's action, keyed by a proposal the host holds. The Settings
 * sheet calls it now; a persona's card will (C2).
 *
 * For each ticked group, in `CONTEXT_PATH_GROUPS` order:
 * - **offered in the view,** or it is left (`not-offered`);
 * - **not set by the workspace now** (`workspace-set`);
 * - **its value unchanged** since the view was made (`changed`), so a
 *   newer edit is never overwritten;
 * - **its kept patterns checked again** through the same resolver seam:
 *   an incomplete check leaves it (`incomplete`, D22a), and so does a kept
 *   pattern that no longer matches anything (`matches-changed`). The writer
 *   is never handed a subset they did not see.
 *
 * Then one write per group, at the user level (L1), each preceded by one
 * more synchronous read of the value and its level, so drift during the
 * re-check or an earlier group's write leaves the group (PR #288 P1). A
 * failed write stops
 * the rest (`write-failed`, then `not-reached`), so the answer says exactly
 * which groups landed. Logs carry counts and reasons only.
 */

import type { LogSink } from '@/platform';
import {
  CONTEXT_PATH_GROUPS,
  type ContextPathGroup,
  type ContextPathGroupApplyOutcome,
  type ContextPathLeftReason
} from '@shared/types';
import type { ContextPathCheckedProposal, ContextPathProposalChecker } from './ContextPathProposalChecker';
import { triageContextPathPatterns } from './ContextPathPatternSafety';
import type { ContextPathSettingsWriter } from './ContextPathSettingsWriter';

export interface ContextPathApplyDeps {
  readonly checker: Pick<ContextPathProposalChecker, 'recheck'>;
  readonly settings: Pick<ContextPathSettingsWriter, 'read' | 'write'>;
  readonly log: Pick<LogSink, 'appendLine'>;
}

const LOG = '[ContextPaths]';

export async function applyContextPathProposal(
  proposal: ContextPathCheckedProposal,
  ticked: readonly ContextPathGroup[],
  deps: ContextPathApplyDeps
): Promise<ContextPathGroupApplyOutcome[]> {
  const wanted = new Set(ticked);
  const outcomes = new Map<ContextPathGroup, ContextPathGroupApplyOutcome>();
  const toCheck: Partial<Record<ContextPathGroup, readonly string[]>> = {};
  const order = CONTEXT_PATH_GROUPS.filter((group) => wanted.has(group));

  for (const group of order) {
    const left = (reason: ContextPathLeftReason) => outcomes.set(group, { group, outcome: 'left', reason });
    const view = proposal.view.groups.find((candidate) => candidate.group === group);
    const kept = proposal.kept[group];
    // The kept list is the checker's; it is triaged again only so nothing unsafe can ever reach a write.
    if (!view?.offer.offered || !kept || kept.length === 0 || triageContextPathPatterns(kept).safe.length !== kept.length) {
      left('not-offered');
      continue;
    }
    const live = deps.settings.read(group);
    if (live.level === 'workspace' || live.level === 'workspace-folder') {
      left('workspace-set');
      continue;
    }
    if (live.value !== proposal.baselines[group]) {
      left('changed');
      continue;
    }
    toCheck[group] = kept;
  }

  const checking = Object.keys(toCheck) as ContextPathGroup[];
  if (checking.length > 0) {
    const rechecked = await deps.checker.recheck(toCheck);
    for (const group of checking) {
      const matches = rechecked?.[group];
      if (!matches || matches.some((match) => match.status === 'incomplete')) {
        outcomes.set(group, { group, outcome: 'left', reason: 'incomplete' });
      } else if (matches.some((match) => match.status === 'unmatched')) {
        outcomes.set(group, { group, outcome: 'left', reason: 'matches-changed' });
      }
    }
  }

  let stopped = false;
  for (const group of order) {
    if (outcomes.has(group)) {
      continue;
    }
    if (stopped) {
      outcomes.set(group, { group, outcome: 'left', reason: 'not-reached' });
      continue;
    }
    // Read again with nothing awaited between this read and the write: the matching awaited above,
    // and an earlier group's write awaited just before, so the writer may have changed the value, or
    // the workspace may have begun setting it, meanwhile (PR #288 P1).
    const now = deps.settings.read(group);
    if (now.level === 'workspace' || now.level === 'workspace-folder') {
      outcomes.set(group, { group, outcome: 'left', reason: 'workspace-set' });
      continue;
    }
    if (now.value !== proposal.baselines[group]) {
      outcomes.set(group, { group, outcome: 'left', reason: 'changed' });
      continue;
    }
    try {
      await deps.settings.write(group, proposal.kept[group]!);
      outcomes.set(group, { group, outcome: 'applied' });
    } catch {
      // The error is not logged: a host message could quote the value.
      outcomes.set(group, { group, outcome: 'left', reason: 'write-failed' });
      stopped = true;
    }
  }

  const result = order.map((group) => outcomes.get(group)!);
  const applied = result.filter((entry) => entry.outcome === 'applied').length;
  const reasons = result.flatMap((entry) => (entry.outcome === 'left' ? [entry.reason] : []));
  deps.log.appendLine(
    `${LOG} Apply: ${applied} of ${order.length} ticked group(s) written at the user level`
    + (reasons.length > 0 ? `; left: ${reasons.join(', ')}` : '')
  );
  return result;
}
