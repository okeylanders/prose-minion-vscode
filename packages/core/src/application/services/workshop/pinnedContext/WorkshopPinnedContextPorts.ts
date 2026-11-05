/**
 * Pinned context as the Workshop's route owners reach it (ADR 2026-11-04 D8,
 * D9; epic Slice 3). No handler imports the library, the seed or the reader
 * (`boundaries.test.ts`); they name these shapes instead, and `extension.ts`
 * hands them the one library and the one seed through `CoreServices`.
 *
 * The description and seed-read shapes are the library's (Slice 2b), moved
 * here so a handler can name them; the library re-exports them.
 */

import type { ConfiguredResourceRef } from '@messages';
import type { WorkshopPinnedContextUnavailableReason } from '@/infrastructure/storage/WorkshopPinnedContextStoreContracts';
import type {
  WorkshopPinnedContextEntry,
  WorkshopPinnedContextPathPlatform,
  WorkshopPinnedContextRefusal
} from '@shared/types/workshopPinnedContext';
import type {
  WorkshopPinnedFileFault,
  WorkshopPinnedFileRead,
  WorkshopPinnedFileSource
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextFileReader';
import type { WorkshopRoomSeedReport } from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';

/** One pinned entry, resolved now, as the tab draws its row. */
export interface WorkshopPinnedContextRow {
  readonly path: string;
  readonly label: string;
  /** Unknown for a file that is gone. */
  readonly source?: WorkshopPinnedFileSource;
  /** `ready`, or `head-sliced` (attached as its first `words` of `totalWords`), `missing`, `unreadable`. */
  readonly state: 'ready' | 'head-sliced' | 'missing' | 'unreadable';
  /** The words an attach would bring; 0 when it brings none. */
  readonly words: number;
  readonly totalWords?: number;
  readonly fault?: WorkshopPinnedFileFault;
  /** The state in the tab's words: "Not found", "Can't read: …", "Attached as its first …". */
  readonly stateWords?: string;
}

/** The list as the tab draws it. */
export type WorkshopPinnedContextDescription =
  | { readonly state: 'listed'; readonly revision: string; readonly rows: readonly WorkshopPinnedContextRow[]; readonly words: number; readonly absent: boolean }
  | { readonly state: 'unreadable'; readonly revision: string; readonly reason: WorkshopPinnedContextRefusal; readonly entry?: number; readonly words: string }
  | { readonly state: 'unavailable'; readonly reason: WorkshopPinnedContextUnavailableReason; readonly words: string }
  | { readonly state: 'busy' | 'io'; readonly words: string };

/** What a seed attaches: every pinned file, in pinned order, or why the list gave none. */
export type WorkshopPinnedContextSeedRead =
  | { readonly state: 'listed'; readonly files: readonly WorkshopPinnedFileRead[] }
  /** Nothing is pinned, or there is no single folder (ADR D2: never seed then). */
  | { readonly state: 'nothing' }
  /** The list file is there and cannot be read now, as a category for the log. */
  | { readonly state: 'list-unreadable'; readonly category: 'unreadable' | 'busy' | 'io' | 'failed' };

export interface WorkshopPinnedContextAsk {
  /** False when there was no accepted workspace to ask in. */
  readonly accepted: boolean;
  /** Whether that workspace is still the accepted one: a write's `beforeCommit`, a seed's install check. */
  readonly still: () => boolean;
}

/**
 * What a change to the list came to:
 * - `ok`: written, or nothing to write;
 * - `changed`: the file isn't at the revision the tab read; nothing was
 *   written, and the tab is answered with the current list;
 * - `refused`: nothing was written, for the reason in the host's words.
 */
export type WorkshopPinnedContextWriteResult =
  | { readonly kind: 'ok'; readonly written: boolean }
  | { readonly kind: 'changed' }
  | { readonly kind: 'refused'; readonly words: string; readonly category: string };

/** Where Open file goes: a contained file, or why it can't. */
export type WorkshopPinnedContextOpenTarget =
  | { readonly kind: 'file'; readonly fsPath: string }
  | { readonly kind: 'refused'; readonly words: string; readonly category: string };

/** The library's half the tab uses (Slice 3), every write behind its live-room check. */
export interface WorkshopPinnedContextTabPort {
  /** How paths compare on this host; the webview's match rule needs it. */
  readonly platform: WorkshopPinnedContextPathPlatform;
  describe(): Promise<WorkshopPinnedContextDescription>;
  readForSeed(): Promise<WorkshopPinnedContextSeedRead>;
  /** Pin catalog files, by key, checked against a fresh catalog. */
  pinResources(revision: string, items: readonly ConfiguredResourceRef[]): Promise<WorkshopPinnedContextWriteResult>;
  /** Pin files a room holds, by the workspace-relative path the handler resolved from the live room. */
  pinPaths(revision: string, entries: readonly WorkshopPinnedContextEntry[]): Promise<WorkshopPinnedContextWriteResult>;
  unpin(revision: string, entryPath: string): Promise<WorkshopPinnedContextWriteResult>;
  move(revision: string, entryPath: string, direction: 'up' | 'down'): Promise<WorkshopPinnedContextWriteResult>;
  /** An entry's file, or the list file when `entryPath` is absent: resolved from the list as read now, contained. */
  openTarget(entryPath?: string): Promise<WorkshopPinnedContextOpenTarget>;
}

/** Pinned context in `CoreServices`: the one library and the seed's first-room report. */
export interface WorkshopPinnedContextServices {
  readonly library: WorkshopPinnedContextTabPort;
  /** The first room's seed report, once (Slice 2b, deviation 4). */
  takeFirstRoomReport(): WorkshopRoomSeedReport | undefined;
}
