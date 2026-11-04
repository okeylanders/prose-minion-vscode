/**
 * What the Memory tab and the memory manager draw from (Workshop Project
 * Memory, Slice 4b; ADR 2026-11-04 D5, D8, D10). The rows and the estimate
 * are the manager listing's own shapes (`projectMemoryManager.ts`), so the
 * views draw exactly what the host sent. Every figure is the host's (the frame builder's estimate, the
 * library's listing); the views never count, estimate or infer a standing
 * themselves (PR #196 watchpoint 3).
 *
 * Rows are named by the host's opaque `entryKey` (D10, PR #192 F-02).
 * Only a readable, unique memory carries its `mem-` id, and every mutation
 * names that id; opening a file names the key alone.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type {
  WorkshopMemoryManagerConflict,
  WorkshopMemoryManagerEntry,
  WorkshopMemoryManagerEstimate,
  WorkshopMemoryManagerSource,
  WorkshopMemoryManagerUnreadable,
  WorkshopMemoryResidency,
  WorkshopProjectMemoryMode
} from '@messages';

export type { WorkshopProjectMemoryMode };

/** The budgets the tab's well and meters state, read from `PROMPT_BUDGETS` so no number is a literal. */
export interface WorkshopMemoryBudgets {
  readonly pinnedTokens: number;
  readonly catalogTokens: number;
  /** The context attachments' word limit, for the "Memory isn't context" well. */
  readonly contextWords: number;
}

export const WORKSHOP_MEMORY_BUDGETS: WorkshopMemoryBudgets = Object.freeze({
  pinnedTokens: PROMPT_BUDGETS.workshopProjectMemory.pinnedTokens,
  catalogTokens: PROMPT_BUDGETS.workshopProjectMemory.catalogTokens,
  contextWords: PROMPT_BUDGETS.contextAttachments.words
});

/** The longest title a rename may save: the codec's bound. */
export const WORKSHOP_MEMORY_TITLE_CHARACTERS = PROMPT_BUDGETS.workshopProjectMemory.titleCharacters;

/** The frame's size, from the frame builder's own renderer (ADR D5): the listing's estimate. */
export type WorkshopMemoryFrameEstimate = WorkshopMemoryManagerEstimate;

/**
 * Whether this workspace can hold memory now (D8, D10). `unavailable` is
 * never a mode: the global mode still applies to every other project.
 * `unknown`: the folder could not be listed just now (never an empty one).
 */
export type WorkshopMemoryWorkspace =
  | { readonly kind: 'loading' }
  | { readonly kind: 'available' }
  | { readonly kind: 'unavailable'; readonly reason: 'no-workspace' | 'multi-root' }
  | { readonly kind: 'unknown' };

/** A file that does not read as a memory, with the store's reason; words in `workshopMemoryWords`. */
export type WorkshopMemoryUnreadableFile = WorkshopMemoryManagerUnreadable;

/** Readable files that hold one id: each is its own row, opened by its own key (D4, D10). */
export type WorkshopMemoryConflict = WorkshopMemoryManagerConflict;

/** Where a memory came from, as the host resolved it now (ADR D3; PR #196 watchpoint 5). */
export type WorkshopMemorySource = WorkshopMemoryManagerSource;

/**
 * One readable, unique memory, as the manager lists it. `fullLoad` and
 * `residency` are the frame builder's own result, never inferred from
 * dates (PR #196 F-03, PR #199 F-02); without `residency` the words promise
 * nothing about the list.
 */
export type WorkshopMemoryEntry = WorkshopMemoryManagerEntry;

export type { WorkshopMemoryResidency };

/** The folder as the manager lists it: every row the host can name. */
export interface WorkshopMemoryLibrary {
  readonly memories: readonly WorkshopMemoryEntry[];
  readonly unreadable: readonly WorkshopMemoryUnreadableFile[];
  readonly conflicts: readonly WorkshopMemoryConflict[];
}

/** An Always load in full the host refused (D5): the pinned total it would have made. */
export interface WorkshopMemoryLoadInFullRefusal {
  readonly entryKey: string;
  readonly wouldBeTokens: number;
}
