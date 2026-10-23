/**
 * LightboxBoardStore's contracts (ADR 2026-10-19 D12 addendum; Slice 5A;
 * split from the store in Slice 5A.2 so the store stays one module of
 * logic): the reload pointer's port and key, what a save is given and
 * answers, what a delete answers, and the store's options. The store
 * re-exports every name here.
 */

import type { LightboxBoard } from '@messages';
import type { LightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';
import type { LightboxBoardReplaceTarget } from '@/infrastructure/storage/LightboxBoardRewrite';

/** The reload pointer's key in the workspace memento. */
export const LIGHTBOX_BOARD_POINTER_KEY = 'proseMinion.lightbox.lastBoardOnScreen';

/**
 * The reload pointer's port: a key-value memento scoped to the workspace
 * (`context.workspaceState` in VS Code). Structurally a `vscode.Memento`.
 */
export interface LightboxBoardMemory {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}

export type LightboxBoardSaveResult =
  | { kind: 'saved'; fileId: string }
  /** The file that holds the board was rewritten in place (Slice 5A.2, `inPlace`). */
  | { kind: 'replaced'; fileId: string }
  /** `onlyIfNewText`: a saved board of this source already holds this text; the newest such. */
  | { kind: 'held'; fileId: string }
  /** The commit point declined it; nothing was written. */
  | { kind: 'withdrawn' }
  | { kind: 'session' }
  | { kind: 'failed' };

export type LightboxBoardDeleteResult =
  | { kind: 'deleted' }
  | { kind: 'missing' }
  /** Another window's store is rewriting or deleting it now (Slice 5A.1); nothing was deleted. */
  | { kind: 'busy' }
  | { kind: 'unreadable' }
  | { kind: 'unavailable' }
  | { kind: 'failed' };

export interface LightboxBoardSaveInput {
  board: LightboxBoard;
  /** The text the board was measured from. */
  text: string;
  /** The writer's name for the board (Slice 5A.1). */
  name?: string;
}

/** What a committed save left on disk (Slice 5A.2): the name its board was saved under, and the bytes' revision. */
export interface LightboxBoardCommitted {
  name?: string;
  revision: string;
}

export interface LightboxBoardSaveOptions {
  /** Save only when no saved board of the source holds this text (a source's first measured board). */
  onlyIfNewText?: boolean;
  /** The commit point: called synchronously after staging, immediately before each rename. `false` withdraws the save. */
  beforeCommit?: () => boolean;
  /** Called synchronously once the file stands, before the store's next operation. */
  onCommitted?: (fileId: string, committed: LightboxBoardCommitted) => void;
  /**
   * One file per board (Slice 5A.2, epic decision 46): the file that holds
   * the board, found at this save's turn, with the revision it must still be
   * at, and the file as this save rewrites it (`update`, given the file as
   * it reads now and the save's time). Without a file, or when it cannot be
   * rewritten, the save writes a new file.
   */
  inPlace?: {
    holding: () => LightboxBoardReplaceTarget | undefined;
    update: (file: LightboxBoardFile, savedAt: Date) => LightboxBoardFile;
  };
  /** The name a new file gives a board that has none (`lightboxDefaultBoardName`, Slice 5A.2); unnamed without it. */
  defaultName?: (savedAt: Date) => string;
}

export interface LightboxBoardStoreOptions {
  memory?: LightboxBoardMemory;
  now?: () => Date;
  /** A file larger than this is not read (counted unreadable). */
  maximumFileBytes?: number;
  /** The private part of a staged file's name; a random UUID by default. */
  mintStagingId?: () => string;
  /** The clock claims are timed by (`LightboxBoardClaims`); `now` by default. A test whose `now` steps once per call gives claims a steady one. */
  claimNow?: () => Date;
}
