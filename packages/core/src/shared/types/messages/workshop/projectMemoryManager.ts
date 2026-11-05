/**
 * The memory manager's routes (ADR 2026-11-04 D5, D8, D10; epic Slice 4b):
 * the folder as the Memory tab and the manager draw it, and the manager's
 * own actions. Archive and Restore are Slice 3's Forget route, Edit and New
 * its sheet, and Rename its edit; this module adds only what those don't:
 * the listing (with the frame's estimate and each memory's residency),
 * Always load in full, Delete, Open file and Open memory folder.
 *
 * - **Correlated.** Each request carries a webview-minted `requestId` the
 *   host echoes; the webview takes only the answer it still waits for.
 * - **Entry handles, never paths** (D10, PR #192 F-02). Every row carries an
 *   opaque `entryKey`, distinct for every row the host lists (a set-aside
 *   copy apart from the standing file it sits beside). Open file names a
 *   key; every mutation names a unique `mem-` id. The webview never sends a
 *   path.
 * - **The host's figures.** Standing, residency and the estimate come from
 *   the library's listing and the frame's own renderer; the webview infers
 *   none of them.
 *
 * The UI says "Always load in full" and "Loaded in full", never "pin"
 * (Slice 0d decision 16); the fields keep `pinned`.
 */

import type { MessageEnvelope, MessageType } from '../base';
import type { ProjectMemoryKind, ProjectMemoryOrigin, ProjectMemoryStatus } from '@shared/types/projectMemory';
import type { WorkshopMemoryPinnedEstimate } from './projectMemory';

/** Where the frame builder put a memory in effect: its body whole, a list entry, or neither (PR #199 F-02). */
export type WorkshopMemoryResidency = 'full' | 'listed' | 'searchable';

/** Where a memory came from, as the host resolved it now (D3). */
export type WorkshopMemoryManagerSource =
  | { readonly kind: 'session'; readonly title: string }
  /** It names a session that can't be named now: the current room, unnamed, deleted or unreadable. */
  | { readonly kind: 'unnamed' }
  | { readonly kind: 'none' };

/** One readable, unique memory. */
export interface WorkshopMemoryManagerEntry {
  readonly entryKey: string;
  readonly id: string;
  readonly title: string;
  readonly kind: ProjectMemoryKind;
  readonly summary: string;
  readonly status: ProjectMemoryStatus;
  readonly pinned: boolean;
  readonly created: string;
  readonly updated: string;
  readonly origin: ProjectMemoryOrigin;
  /** The proposing persona's display name. */
  readonly proposedByLabel?: string;
  readonly source: WorkshopMemoryManagerSource;
  readonly superseded: boolean;
  readonly supersededBy: readonly string[];
  readonly busy: boolean;
  /** For a pinned memory in effect: whether its body loaded whole. Null otherwise. */
  readonly fullLoad: 'loaded' | 'doesnt-fit' | null;
  /** For a memory in effect: the renderer's own result. */
  readonly residency?: WorkshopMemoryResidency;
}

/** A file that doesn't read as a memory, with the store's reason. */
export interface WorkshopMemoryManagerUnreadable {
  readonly entryKey: string;
  readonly fileName: string;
  readonly reason: string;
  readonly key?: string;
}

/** Readable files that hold one id: each its own row. */
export interface WorkshopMemoryManagerConflict {
  readonly id: string;
  readonly files: ReadonlyArray<{ readonly entryKey: string; readonly fileName: string }>;
}

/** The frame's size, from its own renderer (D5). */
export interface WorkshopMemoryManagerEstimate {
  readonly memories: number;
  readonly pinned: number;
  readonly pinnedLoaded: number;
  readonly pinnedTokens: number;
  readonly pinnedOver: boolean;
  readonly catalogTokens: number;
  readonly frameTokens: number;
  readonly pinnedLoadedTokens: number;
  readonly catalogEntries: number;
}

/** Whether this workspace holds memory now, and why not (D8, D10). `unknown`: the folder couldn't be listed. */
export type WorkshopMemoryManagerWorkspace =
  | { readonly kind: 'available' }
  | { readonly kind: 'unavailable'; readonly reason: 'no-workspace' | 'multi-root' }
  | { readonly kind: 'unknown' };

/** Ask for the folder as the tab and the manager draw it; `query` narrows the rows (titles, summaries and notes). */
export interface WorkshopMemoryListPayload {
  requestId: string;
  query: string;
}

export interface WorkshopMemoryListMessage extends MessageEnvelope<WorkshopMemoryListPayload> {
  type: MessageType.WORKSHOP_MEMORY_LIST;
}

export interface WorkshopMemoryListingPayload {
  requestId: string;
  workspace: WorkshopMemoryManagerWorkspace;
  /** Every readable memory in the folder, whatever the query. */
  saved: number;
  /** The frame's size; absent when the workspace holds no memory. */
  estimate?: WorkshopMemoryManagerEstimate;
  /** The rows the query matched (every row for an empty query). */
  memories: WorkshopMemoryManagerEntry[];
  unreadable: WorkshopMemoryManagerUnreadable[];
  conflicts: WorkshopMemoryManagerConflict[];
}

export interface WorkshopMemoryListingMessage extends MessageEnvelope<WorkshopMemoryListingPayload> {
  type: MessageType.WORKSHOP_MEMORY_LISTING;
}

/** The manager's own actions: mutations by `mem-` id, a file by its `entryKey`. */
export type WorkshopMemoryManagerActionPayload =
  | { requestId: string; action: 'set-load-in-full'; memoryId: string; loadInFull: boolean }
  | { requestId: string; action: 'delete'; memoryId: string }
  | { requestId: string; action: 'open-file'; entryKey: string }
  | { requestId: string; action: 'open-folder' };

export interface WorkshopMemoryManagerActionMessage extends MessageEnvelope<WorkshopMemoryManagerActionPayload> {
  type: MessageType.WORKSHOP_MEMORY_MANAGER_ACTION;
}

/** Done, or refused with a reason in the writer's words that names no memory text; a refusal changed nothing. */
export interface WorkshopMemoryManagerResultPayload {
  requestId: string;
  ok: boolean;
  error?: string;
  /** A refused Always load in full: the pinned budget's numbers. */
  budget?: WorkshopMemoryPinnedEstimate;
}

export interface WorkshopMemoryManagerResultMessage extends MessageEnvelope<WorkshopMemoryManagerResultPayload> {
  type: MessageType.WORKSHOP_MEMORY_MANAGER_RESULT;
}
