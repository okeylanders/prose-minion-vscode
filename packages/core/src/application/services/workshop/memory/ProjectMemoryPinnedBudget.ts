/**
 * Two checks the library's writes share (ADR 2026-11-04 D5, D10), moved out
 * of `ProjectMemoryWrites` so its edits stay small (epic Slice 6c): whether
 * a change touches what a memory says, and the pinned budget. Pure.
 */

import type { WorkshopMemoryPinnedEstimate } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ProjectMemory } from '@shared/types/projectMemory';
import {
  isProjectMemoryInEffect,
  listProjectMemories,
  type ProjectMemoryListed
} from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import { projectMemoryPinnedTokens } from '@/application/services/workshop/memory/ProjectMemoryCatalogFrame';
import { projectMemoryVersion } from '@/application/services/workshop/memory/ProjectMemoryVersion';

const PINNED_BUDGET = PROMPT_BUDGETS.workshopProjectMemory.pinnedTokens;

/** Whether the change touches what the memory says (D10): the fields `updated` follows. */
export function saysSomethingElse(before: ProjectMemory, after: ProjectMemory): boolean {
  return before.title !== after.title
    || before.kind !== after.kind
    || before.summary !== after.summary
    || before.body !== after.body
    || before.supersedes.join(',') !== after.supersedes.join(',');
}

/**
 * Memories loaded in full, with `candidate` in place of the memory `id`
 * names (or added, for a new one), by the frame's renderer and estimator.
 * Refused when the candidate loads in full, the total passes the budget,
 * and the change grows it: shortening an over-budget memory, or turning one
 * off, is always allowed.
 */
export function pinnedBudget(
  memories: readonly ProjectMemoryListed[],
  candidate: ProjectMemory,
  id: string | undefined
): WorkshopMemoryPinnedEstimate {
  const total = (set: readonly ProjectMemoryListed[]): number => set
    .filter((listed) => listed.memory.pinned && isProjectMemoryInEffect(listed))
    .reduce((sum, listed) => sum + projectMemoryPinnedTokens(listed), 0);
  const before = total(memories);
  const others = memories.filter(({ memory }) => memory.id !== id).map(({ memory, busy }) => ({ memory, ...(busy ? { busy: true as const } : {}) }));
  const after = listProjectMemories([...others, { memory: candidate }]);
  const totalTokens = total(after);
  const self = after.find(({ memory }) => memory === candidate)
    ?? { memory: candidate, superseded: false, supersededBy: [], busy: false, version: projectMemoryVersion(candidate, false) };
  return {
    thisTokens: projectMemoryPinnedTokens(self),
    totalTokens,
    budgetTokens: PINNED_BUDGET,
    refused: candidate.pinned && totalTokens > PINNED_BUDGET && totalTokens > before
  };
}
