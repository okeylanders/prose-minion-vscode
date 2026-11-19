/**
 * A reply's context-paths proposal, checked before completion and settled
 * in it (ADR 2026-11-19 D27).
 *
 * - **Resolve (awaits allowed):** a reply holding the tag has its one
 *   proposal checked by C1's checker over the real resolver, before the
 *   reply commits. A reply without the tag costs no await.
 * - **Settle (synchronous, in the reply's commit):** typed verdicts. A
 *   proposal whose every pattern was dropped or refused is `nothing-kept`:
 *   no card. One the checker could not check (no folder open, a failure, or
 *   a context resolved for another reply) is dropped, never shown as zero
 *   matches. Otherwise the card commits `pending`, with the view, each
 *   group's value as read, and the patterns Apply would write.
 * - **Logs carry counts and reasons only,** never a pattern, a path or a
 *   folder name (D28).
 */

import type { WorkshopLocationsProposalCard } from '@messages';
import { CONTEXT_PATH_GROUPS, type ContextPathGroup } from '@shared/types';
import type { ContextPathCheck, ContextPathProposalChecker } from '@/application/services/contextPaths/ContextPathProposalChecker';
import {
  extractWorkshopReplyControls,
  hasWorkshopLocationsProposalText
} from '@/utils/workshopReplyControls';
import type { WorkshopReplyLocationsControl, WorkshopReplyLocationsRejection } from '@/utils/workshopReplyLocationsProposal';

/** Every reason a context-paths frame can end with no card for. */
export type WorkshopLocationsDropCode =
  | WorkshopReplyLocationsRejection
  | 'nothing-kept'
  | 'no-workspace'
  | 'check-failed'
  | 'not-checked';

/** What was checked for one reply, before completion. */
export interface WorkshopReplyLocationsContext {
  /** The reply it was resolved from: used only for that reply. */
  readonly reply: string;
  readonly check: ContextPathCheck | { readonly kind: 'failed' } | { readonly kind: 'none' };
}

export interface WorkshopReplyLocationsPatterns {
  readonly kept: number;
  readonly unmatched: number;
  readonly incomplete: number;
  readonly refused: number;
}

export interface WorkshopReplyLocationsSettlement {
  readonly card?: WorkshopLocationsProposalCard;
  readonly drops: readonly WorkshopLocationsDropCode[];
  readonly patterns: WorkshopReplyLocationsPatterns;
  readonly logs: readonly string[];
}

const NO_PATTERNS: WorkshopReplyLocationsPatterns = { kept: 0, unmatched: 0, incomplete: 0, refused: 0 };

/** Check a reply's proposal before completion; undefined when the reply holds no tag. */
export async function resolveWorkshopReplyLocations(
  reply: string,
  checker: Pick<ContextPathProposalChecker, 'check'> | undefined,
  signal: AbortSignal
): Promise<WorkshopReplyLocationsContext | undefined> {
  if (!hasWorkshopLocationsProposalText(reply)) {
    return undefined;
  }
  const proposal = extractWorkshopReplyControls(reply, { memoryOpen: false }).locations?.proposal;
  if (!proposal) {
    return { reply, check: { kind: 'none' } };
  }
  if (!checker || signal.aborted) {
    return { reply, check: { kind: 'failed' } };
  }
  try {
    return { reply, check: await checker.check(proposal) };
  } catch {
    return { reply, check: { kind: 'failed' } };
  }
}

/** Settle the reply's frames into at most one card and typed drops. */
export function settleWorkshopReplyLocations(
  control: WorkshopReplyLocationsControl | undefined,
  context: WorkshopReplyLocationsContext | undefined
): WorkshopReplyLocationsSettlement {
  if (!control) {
    return { drops: [], patterns: NO_PATTERNS, logs: [] };
  }
  const drops: WorkshopLocationsDropCode[] = [...control.rejections];
  const log = (outcome: string, patterns = NO_PATTERNS): string =>
    `Locations proposal ${outcome} (kept=${patterns.kept}; unmatched=${patterns.unmatched}; ` +
    `incomplete=${patterns.incomplete}; refused=${patterns.refused}; dropped=${drops.length})`;
  if (!control.proposal) {
    return { drops, patterns: NO_PATTERNS, logs: drops.length > 0 ? [log('dropped')] : [] };
  }
  const check = context?.check;
  if (!check || check.kind === 'none' || check.kind === 'failed' || check.kind === 'no-workspace') {
    const code: WorkshopLocationsDropCode = !check || check.kind === 'none'
      ? 'not-checked'
      : check.kind === 'failed' ? 'check-failed' : 'no-workspace';
    drops.push(code);
    return { drops, patterns: NO_PATTERNS, logs: [log(`not checked (reason=${code})`)] };
  }
  const { proposal } = check;
  const patterns = { kept: 0, unmatched: 0, incomplete: 0, refused: 0 };
  for (const group of proposal.view.groups) {
    patterns.kept += group.proposed?.kept.length ?? 0;
    for (const dropped of group.proposed?.dropped ?? []) {
      if (dropped.reason === 'unmatched') {
        patterns.unmatched += 1;
      } else if (dropped.reason === 'incomplete') {
        patterns.incomplete += 1;
      } else {
        patterns.refused += 1;
      }
    }
  }
  // Every pattern dropped or refused: no card. An incomplete check is never zero matches, so it is shown (D22a).
  if (patterns.kept === 0 && patterns.incomplete === 0) {
    drops.push('nothing-kept');
    return { drops, patterns, logs: [log('dropped (reason=nothing-kept)', patterns)] };
  }
  const kept: Partial<Record<ContextPathGroup, string[]>> = {};
  for (const group of CONTEXT_PATH_GROUPS) {
    const patternsKept = proposal.kept[group];
    if (patternsKept) {
      kept[group] = [...patternsKept];
    }
  }
  const card: WorkshopLocationsProposalCard = {
    view: JSON.parse(JSON.stringify(proposal.view)) as WorkshopLocationsProposalCard['view'],
    baselines: { ...proposal.baselines },
    kept,
    state: 'pending'
  };
  const offered = proposal.view.groups.filter((group) => group.offer.offered).length;
  return { card, drops, patterns, logs: [log(`shown (offered=${offered})`, patterns)] };
}
