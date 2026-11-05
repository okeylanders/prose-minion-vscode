/**
 * WorkshopPinnedContextStore's contracts (Workshop Pinned Context, Slice 1):
 * where the list is kept, what a read and an update answer, and the store's
 * options. The store re-exports every name here.
 */

import type {
  WorkshopPinnedContextList,
  WorkshopPinnedContextPathPlatform,
  WorkshopPinnedContextRefusal
} from '@shared/types/workshopPinnedContext';

/** The revision of a list with no file yet. Never a SHA-256's hex, so never a file's. */
export const WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION = 'absent';

export type WorkshopPinnedContextUnavailableReason = 'no-workspace' | 'multi-root';

/** Where the list is kept now, read live: the workspace's one folder, or nowhere. */
export type WorkshopPinnedContextAvailability =
  | { available: true; rootPath: string; filePath: string; displayPath: string }
  | { available: false; reason: WorkshopPinnedContextUnavailableReason };

export type WorkshopPinnedContextRead =
  /** No file yet: the list is empty, at the fixed absent revision. */
  | { state: 'absent'; revision: string }
  | { state: 'ok'; list: WorkshopPinnedContextList; revision: string }
  /** The file does not read as format 1; it is never written. */
  | { state: 'unreadable'; reason: WorkshopPinnedContextRefusal; entry?: number; revision: string }
  /**
   * No single folder, or (a read pinned to a file; Slice 2b, PR #208 F01)
   * the workspace's list is another file at the read's turn.
   */
  | { state: 'unavailable'; reason: WorkshopPinnedContextUnavailableReason | 'workspace-changed' }
  /** Another window holds the file under a live claim now. */
  | { state: 'busy' }
  /** The folder or the file could not be read; never taken for absent. */
  | { state: 'io' };

/** The list as it reads at the write's turn, changed; the store checks it reads back before writing. */
export type WorkshopPinnedContextChange = (list: WorkshopPinnedContextList) => WorkshopPinnedContextList;

export type WorkshopPinnedContextUpdateResult =
  | { ok: true; list: WorkshopPinnedContextList; revision: string }
  /** The file is not at the revision the caller read; nothing was written. `current` is how it reads now. */
  | { ok: false; reason: 'changed'; current: WorkshopPinnedContextRead }
  /** The changed list would not read back as format 1; nothing was written. */
  | { ok: false; reason: 'invalid'; refusal: WorkshopPinnedContextRefusal; entry?: number }
  | { ok: false; reason: 'unreadable' | 'unavailable' | 'busy' | 'io' };

export interface WorkshopPinnedContextUpdateOptions {
  /**
   * The caller's commit point (the library's accepted-workspace check):
   * asked at the write's turn and synchronously immediately before the
   * rename that commits. `false` withdraws the write as `unavailable`.
   */
  beforeCommit?: () => boolean;
}

export interface WorkshopPinnedContextReadOptions {
  /**
   * The list's file the caller captured (Slice 2b, PR #208 F01). At the
   * read's turn, a workspace whose list is another file answers
   * `unavailable` / `workspace-changed`, and nothing is read: a queued read
   * never reads another project's list for its caller.
   */
  filePath?: string;
}

export interface WorkshopPinnedContextStoreOptions {
  /** How paths compare: the host's platform by default. */
  platform?: WorkshopPinnedContextPathPlatform;
  /** The private part of a staged file's or a claim's name; a random UUID by default. */
  mintStagingId?: () => string;
  /** The clock claims are timed by. */
  claimNow?: () => Date;
}
