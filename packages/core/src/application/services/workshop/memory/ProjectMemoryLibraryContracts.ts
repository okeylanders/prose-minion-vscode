/**
 * What the project-memory library answers (ADR 2026-11-04 D1, D3, D5, D8,
 * D10): data, never prose, like the recall service. The renderers and the
 * frame write the text. Pure types, plus the one derivation every reader
 * shares: which memories are in effect.
 */

import type { ProjectMemory } from '@shared/types/projectMemory';
import { acceptedProjectMemorySupersessions } from '@shared/types/projectMemory';
import { projectMemoryVersion } from '@/application/services/workshop/memory/ProjectMemoryVersion';
import type { WorkshopProjectMemoryMode } from '@messages';

/**
 * Why personas get no memory in this workspace now. `off` is the global
 * mode; the rest are this workspace's (D8): no folder, several, a root that
 * changed after the room loaded, or a room being replaced.
 */
export type ProjectMemoryClosedReason = 'off' | 'no-workspace' | 'multi-root' | 'workspace-changed' | 'not-ready';

/** Whether personas may read memory now, read live on every call. */
export type ProjectMemoryAccess =
  | { readonly open: true; readonly mode: Exclude<WorkshopProjectMemoryMode, 'off'> }
  | { readonly open: false; readonly reason: ProjectMemoryClosedReason };

/**
 * One readable, unconflicted memory as the library lists it, with its
 * derived standing (D4). Unreadable and conflicting files never become one:
 * they are counted, never shown to a model.
 */
export interface ProjectMemoryListed {
  readonly memory: ProjectMemory;
  /** Another readable memory names it in `supersedes` (not on a cycle). */
  readonly superseded: boolean;
  /** The ids of the readable memories that supersede it, sorted. */
  readonly supersededBy: readonly string[];
  /** Another window rewrites it now; a read answers "being edited" (D10, PR #194 N-02). */
  readonly busy: boolean;
  /** Its D14 version, computed here, never stored. */
  readonly version: string;
}

/** The folder as personas may see it: every readable memory, by id. */
export interface ProjectMemorySet {
  readonly memories: readonly ProjectMemoryListed[];
  /** Files that do not read, and ids several files hold: counted, never shown. */
  readonly unreadable: number;
  readonly conflicts: number;
}

/** Why the folder could not be read for a persona: closed, or the listing failed. */
export type ProjectMemoryRefusal =
  | { readonly kind: 'closed'; readonly reason: ProjectMemoryClosedReason }
  | { readonly kind: 'unknown' };

export type ProjectMemorySetResult = ({ readonly kind: 'set' } & ProjectMemorySet) | ProjectMemoryRefusal;

/** Active and not superseded: what the frame and `memory.catalog` list (D5). */
export function isProjectMemoryInEffect(listed: ProjectMemoryListed): boolean {
  return listed.memory.status === 'active' && !listed.superseded;
}

/**
 * Pinned first, then by `updated`, newest first, ties by id: the live
 * catalog's order (D1). The frame has its own pinned order (D5).
 */
export function compareProjectMemoryCatalogOrder(left: ProjectMemoryListed, right: ProjectMemoryListed): number {
  if (left.memory.pinned !== right.memory.pinned) {
    return left.memory.pinned ? -1 : 1;
  }
  return compareProjectMemoryNewestFirst(left, right);
}

/** By `updated`, newest first, ties by id. */
export function compareProjectMemoryNewestFirst(left: ProjectMemoryListed, right: ProjectMemoryListed): number {
  const updated = Date.parse(right.memory.updated) - Date.parse(left.memory.updated);
  if (updated !== 0 && Number.isFinite(updated)) {
    return updated;
  }
  return left.memory.id < right.memory.id ? -1 : left.memory.id > right.memory.id ? 1 : 0;
}

/** Each memory's derived standing, from the readable memories alone (D4). */
export function listProjectMemories(
  entries: ReadonlyArray<{ readonly memory: ProjectMemory; readonly busy?: true }>
): ProjectMemoryListed[] {
  const memories = entries.map((entry) => entry.memory);
  const links = acceptedProjectMemorySupersessions(memories);
  const superseded = new Set(links.map(({ older }) => older));
  return entries
    .map(({ memory, busy }) => ({
      memory,
      superseded: superseded.has(memory.id),
      // The same links as standing, so a cycle's ignored edge is never named (PR #197 N-02).
      supersededBy: [...new Set(links.filter(({ older }) => older === memory.id).map(({ newer }) => newer))].sort(),
      busy: busy === true,
      version: projectMemoryVersion(memory, superseded.has(memory.id))
    }))
    .sort((left, right) => (left.memory.id < right.memory.id ? -1 : left.memory.id > right.memory.id ? 1 : 0));
}

/**
 * The notes in effect a superseded memory's chain ends in: its superseders,
 * then theirs, along the links standing counts, through every archived or
 * superseded note in the middle, stopping at each one in effect (PR #197
 * F-02). Each is named once, and a cycle ends. Empty when the chain ends
 * only in archived notes, or in nothing readable.
 */
export function projectMemoryInEffectSuccessors(memories: readonly ProjectMemoryListed[], id: string): string[] {
  const byId = new Map(memories.map((listed) => [listed.memory.id, listed]));
  const found = new Set<string>();
  const seen = new Set<string>([id]);
  const queue = [...(byId.get(id)?.supersededBy ?? [])];
  while (queue.length > 0) {
    const next = queue.shift() as string;
    if (seen.has(next)) {
      continue;
    }
    seen.add(next);
    const listed = byId.get(next);
    if (!listed) {
      continue;
    }
    if (isProjectMemoryInEffect(listed)) {
      found.add(next);
    } else {
      // An archived or superseded note in the middle never ends the chain (PR #197 F-02 recheck).
      queue.push(...listed.supersededBy);
    }
  }
  return [...found].sort();
}

/** Where a memory's source session stands, for `memory.read`'s provenance (D3). */
export type ProjectMemoryProvenance =
  /** Recallable: its turns' positions now (turns no longer in the record are counted, never guessed). */
  | { readonly kind: 'recallable'; readonly sessionId: string; readonly title: string; readonly positions: readonly number[]; readonly missingTurns: number }
  /** The source room is the room this persona is in. */
  | { readonly kind: 'live-room' }
  /** No saved session holds it: the room was never named, or the session is gone. */
  | { readonly kind: 'not-saved' }
  /** Its session is saved but could not be read now. */
  | { readonly kind: 'unreadable' }
  /** Session recall is unavailable now. */
  | { readonly kind: 'recall-unavailable' }
  /** The memory names no source session. */
  | { readonly kind: 'none' };

/** One id a `memory.read` named, in the order asked. */
export type ProjectMemoryReadItem =
  | {
    readonly kind: 'memory';
    readonly listed: ProjectMemoryListed;
    readonly provenance: ProjectMemoryProvenance;
    /** The notes in effect that its supersession chain ends in, sorted; empty when none is (PR #197 F-02). */
    readonly inEffectSuccessors: readonly string[];
  }
  /** No readable memory holds the id (a conflicting or unreadable file never answers one). */
  | { readonly kind: 'unknown'; readonly id: string }
  /** Another window holds it under a live claim now: "being edited; try again". */
  | { readonly kind: 'busy'; readonly id: string }
  /** It was listed, but its file could not be read now. */
  | { readonly kind: 'unreadable'; readonly id: string };

export type ProjectMemoryReadResult =
  | { readonly kind: 'read'; readonly items: readonly ProjectMemoryReadItem[] }
  | ProjectMemoryRefusal;

/**
 * The frame's size, from the same renderer and estimator as the frame
 * (D5): what Slice 4b's tab shows. `pinnedTokens` is every pinned memory's
 * body in effect, loaded or not, so `pinnedOver` says whether the pinned
 * bodies exceed their budget.
 */
export interface ProjectMemoryFrameEstimate {
  readonly memories: number;
  readonly pinned: number;
  readonly pinnedLoaded: number;
  readonly pinnedTokens: number;
  readonly pinnedOver: boolean;
  readonly catalogTokens: number;
  readonly frameTokens: number;
}

export type ProjectMemoryFrameEstimateResult =
  | ({ readonly kind: 'estimate' } & ProjectMemoryFrameEstimate)
  | ProjectMemoryRefusal;
