/**
 * ProjectMemoryStore's contracts (epic 2026-11-04, Slice 1): where memory
 * is kept, what a listing, a read and each write answer, and the store's
 * options. The store re-exports every name here.
 */

import type { ProjectMemory } from '@shared/types/projectMemory';
import type { ProjectMemoryInvalidReason, ProjectMemoryKey } from '@/infrastructure/storage/ProjectMemoryCodec';
import type { ProjectMemoryConflict, ProjectMemoryHeldFile, ProjectMemoryUnreadableFile } from '@/infrastructure/storage/ProjectMemoryFiles';

export type ProjectMemoryUnavailableReason = 'no-workspace' | 'multi-root';

/** Where memory is kept now, read live: the workspace's one folder, or nowhere. */
export type ProjectMemoryAvailability =
  | { available: true; rootPath: string; directory: string; displayPath: string }
  | { available: false; reason: ProjectMemoryUnavailableReason };

/** A memory, and the name of the file that holds it (host-side: never a model's or the webview's to name). */
export interface ProjectMemoryEntry {
  readonly fileName: string;
  readonly memory: ProjectMemory;
}

export type ProjectMemoryListing =
  | {
    kind: 'listed';
    /** Every memory that reads, sorted by file name. */
    memories: ProjectMemoryEntry[];
    /** Every file that does not, with its reason; never rewritten or deleted. */
    unreadable: ProjectMemoryUnreadableFile[];
    /** Ids more than one readable file holds; none of those files is a memory here, and none is rewritten or deleted. */
    conflicts: ProjectMemoryConflict[];
    /** Files another window holds under a live claim now. */
    busy: ProjectMemoryHeldFile[];
  }
  /** Memory is off: no folder, or several (memory has no session-only mode). */
  | { kind: 'unavailable'; reason: ProjectMemoryUnavailableReason }
  /** The folder could not be read; never an empty folder. */
  | { kind: 'unknown' };

export type ProjectMemoryRead =
  | { kind: 'memory'; entry: ProjectMemoryEntry }
  /** No file holds the id (looked for, and not found). */
  | { kind: 'missing' }
  /** Another window holds it under a live claim now. */
  | { kind: 'busy' }
  /** More than one file holds the id; neither is read. */
  | { kind: 'conflict' }
  | { kind: 'unavailable'; reason: ProjectMemoryUnavailableReason }
  | { kind: 'unknown' };

/** What a new memory is made of: the store mints its id and its times. Its body is as stored (`projectMemoryBody`). */
export type ProjectMemoryDraft = Omit<ProjectMemory, 'id' | 'created' | 'updated'>;

export type ProjectMemoryCreateResult =
  | { kind: 'created'; entry: ProjectMemoryEntry }
  /** The draft would not read back as format 1; nothing was written. */
  | { kind: 'invalid'; reason: ProjectMemoryInvalidReason; key?: ProjectMemoryKey }
  /** The commit point declined it; nothing was written. */
  | { kind: 'withdrawn' }
  | { kind: 'unavailable'; reason: ProjectMemoryUnavailableReason }
  | { kind: 'failed' };

export type ProjectMemoryReplaceResult =
  | { kind: 'replaced'; entry: ProjectMemoryEntry }
  /** The update changed nothing, so nothing was written. */
  | { kind: 'unchanged'; entry: ProjectMemoryEntry }
  | { kind: 'missing' }
  | { kind: 'busy' }
  /** More than one file holds the id: left as they are. */
  | { kind: 'conflict' }
  /** The update changed the memory's id or creation time, or would not read back; nothing was written. */
  | { kind: 'invalid'; reason: ProjectMemoryInvalidReason | 'identity-changed'; key?: ProjectMemoryKey }
  | { kind: 'withdrawn' }
  | { kind: 'unavailable'; reason: ProjectMemoryUnavailableReason }
  | { kind: 'failed' };

export type ProjectMemoryDeleteResult =
  | { kind: 'deleted' }
  | { kind: 'missing' }
  | { kind: 'busy' }
  /** More than one file holds the id: left as they are. */
  | { kind: 'conflict' }
  | { kind: 'unavailable'; reason: ProjectMemoryUnavailableReason }
  | { kind: 'failed' };

/** The memory as it reads now, changed; undefined to leave it as it is. */
export type ProjectMemoryUpdate = (memory: ProjectMemory) => ProjectMemory | undefined;

export interface ProjectMemoryWriteOptions {
  /** The commit point: called synchronously immediately before the rename that commits. `false` withdraws the write. */
  beforeCommit?: () => boolean;
}

export interface ProjectMemoryStoreOptions {
  now?: () => Date;
  /** The private part of a staged file's or a claim's name; a random UUID by default. */
  mintStagingId?: () => string;
  /** A new memory's six hex digits; random by default. */
  mintMemoryId?: () => string;
  /** The clock claims are timed by; `now` by default. */
  claimNow?: () => Date;
}
