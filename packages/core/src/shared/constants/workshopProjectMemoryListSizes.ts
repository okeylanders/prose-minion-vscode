/**
 * How much of a project's notes the start of each conversation lists
 * (Everyday Conveniences, Round Two, item C; ADR 2026-11-17 D9). A closed
 * table: each size is one row of frame budgets, in tokens by the engine's
 * estimator, never characters.
 *
 * - `standard` (the default) is the list as it has always been, plus the
 *   titles-only tier.
 * - `pinnedTokens` is the same at every size: the pin refusal compares
 *   against one number.
 * - The entry cap grows with the size; without it the larger token budgets
 *   would stop at Standard's cap. The caps past Standard are the
 *   orchestrator's default (Q1, open): they are this table's alone.
 *
 * The setting is global, like the project-memory mode it sits beside. The
 * frame is built once per conversation, so a change applies from the next
 * conversation. The manifest's enum and the Memory tab are each held to
 * this list by a test.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

export const WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS = ['standard', 'larger', 'largest'] as const;
export type WorkshopProjectMemoryListSize = (typeof WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS)[number];

export const DEFAULT_WORKSHOP_PROJECT_MEMORY_LIST_SIZE: WorkshopProjectMemoryListSize = 'standard';

export const WORKSHOP_MEMORY_LIST_SIZE_SETTING = Object.freeze({
  section: 'proseMinion',
  key: 'workshop.memory.listSize'
});

/** The `<project-memory>` frame's budgets: one row of the table. */
export interface ProjectMemoryFrameBudgets {
  /** Whole pinned bodies. */
  readonly pinnedTokens: number;
  /** Titles and summaries: the `<entry>` tier's tokens, and how many entries it may hold. */
  readonly catalogTokens: number;
  readonly catalogEntries: number;
  /** Titles only: the `<title-only>` tier's tokens. It has no entry cap. */
  readonly titleTokens: number;
}

const row = (size: WorkshopProjectMemoryListSize): ProjectMemoryFrameBudgets => Object.freeze({
  pinnedTokens: PROMPT_BUDGETS.workshopProjectMemory.pinnedTokens,
  ...PROMPT_BUDGETS.workshopProjectMemory.listSizes[size]
});

export const WORKSHOP_PROJECT_MEMORY_LIST_SIZES: Readonly<Record<WorkshopProjectMemoryListSize, ProjectMemoryFrameBudgets>> =
  Object.freeze({ standard: row('standard'), larger: row('larger'), largest: row('largest') });

export function isWorkshopProjectMemoryListSize(raw: unknown): raw is WorkshopProjectMemoryListSize {
  return WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS.some((size) => size === raw);
}

/** Unset, or anything but a known size, reads as Standard: a bad value never grows the first message. */
export function coerceWorkshopProjectMemoryListSize(raw: unknown): WorkshopProjectMemoryListSize {
  return isWorkshopProjectMemoryListSize(raw) ? raw : DEFAULT_WORKSHOP_PROJECT_MEMORY_LIST_SIZE;
}
