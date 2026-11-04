/**
 * What the Memory tab and the memory manager draw from (Workshop Project
 * Memory, Slice 4b-ui; ADR 2026-11-04 D5, D8, D10). Presentation-owned
 * shapes, not message contracts: Slice 4b-wire maps the library's answers
 * into them. Every figure is the host's (the frame builder's estimate, the
 * library's listing); the views never count, estimate or infer a standing
 * themselves (PR #196 watchpoint 3).
 *
 * Rows are named by the host's opaque `entryKey` (D10, PR #192 F-02).
 * Only a readable, unique memory carries its `mem-` id, and every mutation
 * names that id; opening a file names the key alone.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ProjectMemoryKind, ProjectMemoryOrigin, ProjectMemoryStatus } from '@shared/types/projectMemory';
import type { WorkshopProjectMemoryMode } from '@messages';

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

/**
 * The frame's size, from the frame builder (ADR D5). The first seven
 * fields are Slice 2a's `ProjectMemoryFrameEstimate`. The last two are what
 * the design states that 2a's estimate does not yet carry (see the slice
 * doc): the tokens of the bodies that loaded, and how many list entries
 * the frame showed.
 */
export interface WorkshopMemoryFrameEstimate {
  /** Memories in effect: active, readable, unconflicted, not superseded. */
  readonly memories: number;
  /** In effect and set to load in full (`pinned: true`). */
  readonly pinned: number;
  /** Of those, the bodies the builder loaded whole. */
  readonly pinnedLoaded: number;
  /** Every pinned body in effect, loaded or not: what was requested. */
  readonly pinnedTokens: number;
  readonly pinnedOver: boolean;
  /** The list entries' tokens. */
  readonly catalogTokens: number;
  /** The whole frame: what a conversation starts with. */
  readonly frameTokens: number;
  /** The loaded bodies' tokens; never above the pinned budget. */
  readonly pinnedLoadedTokens: number;
  /** The list entries the frame showed. */
  readonly catalogEntries: number;
}

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

/**
 * A file that does not read as a memory, with the codec's reason (Slice 1's
 * `ProjectMemoryUnreadableReason`) and the key it failed at. Reasons are
 * words in `workshopMemoryWords`; one this build does not know reads as a
 * plain "doesn't read".
 */
export interface WorkshopMemoryUnreadableFile {
  readonly entryKey: string;
  readonly fileName: string;
  readonly reason: string;
  readonly key?: string;
}

/** Readable files that hold one id: each is its own row, opened by its own key (D4, D10). */
export interface WorkshopMemoryConflict {
  readonly id: string;
  readonly files: ReadonlyArray<{ readonly entryKey: string; readonly fileName: string }>;
}

/**
 * Where a memory came from, as the host resolved it now (ADR D3; PR #196
 * watchpoint 5): a saved session by its title, a conversation that cannot
 * be named (the current room, unnamed, deleted, unreadable), or none.
 */
export type WorkshopMemorySource =
  | { readonly kind: 'session'; readonly title: string }
  | { readonly kind: 'unnamed' }
  | { readonly kind: 'none' };

/** One readable, unique memory, as the manager lists it. */
export interface WorkshopMemoryEntry {
  readonly entryKey: string;
  readonly id: string;
  readonly title: string;
  readonly kind: ProjectMemoryKind;
  readonly summary: string;
  readonly status: ProjectMemoryStatus;
  /** Set to Always load in full (the file's `pinned:`). */
  readonly pinned: boolean;
  readonly created: string;
  readonly updated: string;
  readonly origin: ProjectMemoryOrigin;
  /** The proposing persona's display name, for `proposed` and `auto`. */
  readonly proposedByLabel?: string;
  readonly source: WorkshopMemorySource;
  /** Derived (D4): another readable memory names it in `supersedes`. */
  readonly superseded: boolean;
  /** The ids of the memories that supersede it. */
  readonly supersededBy: readonly string[];
  /** Another window rewrites it now (D10, PR #194 N-02): listed, not editable. */
  readonly busy: boolean;
  /**
   * The frame builder's own result for a pinned memory in effect: its body
   * `loaded` whole, or `doesnt-fit` (an entry marked not loaded). Null for
   * every other memory. Never inferred from dates (PR #196 F-03).
   */
  readonly fullLoad: 'loaded' | 'doesnt-fit' | null;
  /**
   * Where the frame builder put a memory in effect (PR #199 F-02): its body
   * `full`, `listed` as an entry, or `searchable` only (not in the starting
   * frame at all). A memory that doesn't fit in full is only a list
   * candidate, so this is the renderer's own result, never inferred.
   * Absent when the host doesn't say; the words then promise nothing.
   */
  readonly residency?: WorkshopMemoryResidency;
}

export type WorkshopMemoryResidency = 'full' | 'listed' | 'searchable';

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
