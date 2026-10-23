/**
 * LightboxBoardStore — saved Lightbox boards on disk (ADR 2026-10-19 D12
 * addendum; Slice 5A; epic decisions 27, 28 and 30). Built once at the
 * composition root and carried in `CoreServices`.
 *
 * - **Where.** `prose-minion/boards/<source-slug>-<source-hash>/<timestamp>.board.json`,
 *   in the workspace's one folder (`LightboxBoardFiles` names and reads
 *   them). No folder, or several, keeps boards for the session only, read
 *   live on every operation (the rule the Workshop's project lens library
 *   follows, epic decision 28). Every path is checked with `isPathWithinRoot`
 *   before it is touched.
 * - **Writes** run through one queue, so they never interleave in this
 *   store, and are atomic: a board is staged in a temporary sibling private
 *   to this write (a random id in its name, so another store on the same
 *   workspace, in another window, never writes over it: PR #163 F-03), the
 *   caller's commit point (`beforeCommit`) runs synchronously with nothing
 *   awaited between it and the rename, and the rename never overwrites. A
 *   final name another writer took first is never reported as this save:
 *   the store takes the next free name and runs the commit point again.
 *   `onCommitted` runs synchronously once the file stands, before the next
 *   operation, so what the caller records about it (the board on screen,
 *   the reload pointer) is true for every later read.
 * - **Never a file it cannot read.** Every save is a new file, and a file
 *   that does not decode is never deleted or overwritten; listings count it.
 *   A board that would not read back whole is not written.
 * - **Rewrites in place (Slice 5A.1)**: a board named, or a spark set
 *   aside, on the file that already holds the board (`replace`), through
 *   the same queue. Only a file that reads whole and holds the board
 *   expected is rewritten. It is claimed before it is replaced (an atomic
 *   rename to a name private to the write), so a rewrite never brings back
 *   a board another writer deleted, and the last rewrite to commit wins
 *   (`LightboxBoardRewrite`).
 * - **Deletes claim too** (PR #164 F-01): a delete takes the file under a
 *   claim of its own, removes every earlier version a rewrite left beside
 *   it, then its own claim, so a deleted board never comes back. A file a
 *   live claim holds is busy, for a delete, a read or a rewrite; a claim
 *   abandoned mid-rewrite goes back under its saved name when a listing or
 *   a read finds it (`LightboxBoardClaims`).
 * - **The reload pointer** is the one new port, `LightboxBoardMemory`: the
 *   workspace's memento in VS Code, holding the file id of the last board
 *   on screen and the folder it belongs to.
 * - **Logs** carry file ids, counts and reasons, never the writer's text.
 */

import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import type { LightboxBoard, LightboxBoardsAvailability } from '@messages';
import type { FileSystem, LogSink, Workspace } from '@/platform';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import { decodeLightboxBoardFile, encodeLightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';
import {
  LightboxBoardClaims,
  boardFileExists,
  deleteBoardFileQuietly,
  freeBoardFileName
} from '@/infrastructure/storage/LightboxBoardClaims';
import {
  LightboxBoardRewrites,
  type LightboxBoardReplaceOptions,
  type LightboxBoardReplaceResult,
  type LightboxBoardReplaceTarget,
  type LightboxBoardUpdate
} from '@/infrastructure/storage/LightboxBoardRewrite';
import {
  LIGHTBOX_BOARDS_DISPLAY_PATH,
  LIGHTBOX_BOARD_FILE_ID,
  LightboxBoardFiles,
  errorMessage,
  lightboxBoardFilePath,
  lightboxBoardFolder,
  lightboxSavedSourceKey,
  type LightboxBoardListing,
  type LightboxBoardRead,
  type LightboxSavedSourceRef
} from '@/infrastructure/storage/LightboxBoardFiles';

export {
  LIGHTBOX_BOARDS_DISPLAY_PATH,
  lightboxBoardFolder,
  lightboxBoardSlug,
  lightboxSavedSourceKey
} from '@/infrastructure/storage/LightboxBoardFiles';
export type {
  LightboxBoardListing,
  LightboxBoardRead,
  LightboxSavedBoardEntry,
  LightboxSavedSourceRef
} from '@/infrastructure/storage/LightboxBoardFiles';
export type {
  LightboxBoardReplaceOptions,
  LightboxBoardReplaceResult,
  LightboxBoardReplaceTarget,
  LightboxBoardUpdate
} from '@/infrastructure/storage/LightboxBoardRewrite';

const encoder = new TextEncoder();
const LOG = '[LightboxBoardStore]';
/** A commit that finds its final name taken tries the next free one, this many times at most. */
const COMMIT_ATTEMPTS = 3;
/** A read that finds its file gone, then put back, then gone again, reads it this many times at most. */
const READ_ATTEMPTS = 3;

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

export interface LightboxBoardSaveOptions {
  /** Save only when no saved board of the source holds this text (a source's first measured board). */
  onlyIfNewText?: boolean;
  /** The commit point: called synchronously after staging, immediately before each rename. `false` withdraws the save. */
  beforeCommit?: () => boolean;
  /** Called synchronously once the file stands, before the store's next operation. */
  onCommitted?: (fileId: string) => void;
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

type Location =
  | { kind: 'project'; root: string; directory: string }
  | { kind: 'session'; reason: 'no-workspace' | 'multi-root' };

export class LightboxBoardStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly files: LightboxBoardFiles;
  private readonly claims: LightboxBoardClaims;
  private readonly rewrites: LightboxBoardRewrites;
  private readonly now: () => Date;
  private readonly mintStagingId: () => string;
  private lastSaveFailed = false;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly log: LogSink,
    private readonly options: LightboxBoardStoreOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.mintStagingId = options.mintStagingId ?? randomUUID;
    this.files = new LightboxBoardFiles(fileSystem, log, options.maximumFileBytes ?? 32 * 1024 * 1024);
    this.claims = new LightboxBoardClaims(fileSystem, log, options.claimNow ?? this.now);
    this.rewrites = new LightboxBoardRewrites(fileSystem, this.files, this.claims, log, this.mintStagingId);
  }

  /** Where boards are saved now, read live. */
  availability(): LightboxBoardsAvailability {
    const location = this.location();
    return location.kind === 'session'
      ? { kind: 'session', reason: location.reason }
      : { kind: 'project', displayPath: LIGHTBOX_BOARDS_DISPLAY_PATH, lastSaveFailed: this.lastSaveFailed };
  }

  /** Every saved board of the source, newest first, and how many files of its folder could not be read. */
  list(source: LightboxSavedSourceRef): Promise<LightboxBoardListing> {
    return this.enqueue(async () => {
      const location = this.location();
      if (location.kind === 'session') {
        return { entries: [], unreadable: 0 };
      }
      const { claimed, ...listing } = await this.files.list(location.directory, source);
      // Claims beside the boards: a board left mid-rewrite goes back, a rewrite's leftover goes; the folder is read again.
      if (!claimed || !(await this.claims.settleFolder(path.join(location.directory, lightboxBoardFolder(source))))) {
        return listing;
      }
      const { claimed: _settled, ...again } = await this.files.list(location.directory, source);
      return again;
    });
  }

  /**
   * A saved board's file, decoded. Every `missing` is classified first
   * (PR #164 F-02, and its re-review): a board left under an abandoned claim
   * is put back and read again; one a live claim holds, or one that keeps
   * moving, is `busy`; a folder that cannot be read is `unreadable`, never
   * gone. `missing` is neither file nor claim, looked for and not found.
   */
  read(fileId: string): Promise<LightboxBoardRead> {
    return this.enqueue(async () => {
      const location = this.location();
      if (location.kind === 'session') {
        return { kind: 'unavailable' };
      }
      const filePath = lightboxBoardFilePath(location.directory, fileId);
      if (!filePath) {
        return { kind: 'missing' };
      }
      const read = await this.settledRead(fileId, filePath);
      return read.kind === 'unknown' ? { kind: 'unreadable', reason: 'Its folder could not be read.' } : read;
    });
  }

  /** Write a new file holding the board: staged, then committed by a rename that never overwrites. */
  save(input: LightboxBoardSaveInput, options: LightboxBoardSaveOptions = {}): Promise<LightboxBoardSaveResult> {
    return this.enqueue(async () => {
      const location = this.location();
      if (location.kind === 'session') {
        return { kind: 'session' };
      }
      const folder = lightboxBoardFolder(input.board.source);
      if (options.onlyIfNewText) {
        // The source's whole history, never a page of it: the newest file holding this text.
        const key = lightboxSavedSourceKey(input.board.source);
        const same = (await this.files.list(location.directory, input.board.source)).entries
          .find((entry) => entry.sourceKey === key && entry.contentHash === input.board.source.contentHash);
        if (same) {
          return { kind: 'held', fileId: same.fileId };
        }
      }
      const savedAt = this.now();
      const json = encodeLightboxBoardFile({ board: input.board, text: input.text, savedAt, name: input.name });
      const check = decodeLightboxBoardFile(json);
      if (check.kind !== 'board' || check.dropped > 0) {
        this.log.appendLine(`${LOG} A board would not read back whole (${check.kind === 'invalid' ? `${check.reason} at ${check.at ?? 'the file'}` : `${check.dropped} parts dropped`}); it was not saved.`);
        return { kind: 'failed' };
      }
      return this.writeNew(location, folder, savedAt, encoder.encode(json), options);
    });
  }

  /**
   * Rewrite a saved board's file in place (Slice 5A.1): `update` gets the
   * file as it reads now and returns it changed, or undefined to leave it.
   * `target` is resolved when the rewrite's turn in the queue comes, so a
   * save queued before it has committed and named its file first. Only a
   * file that reads whole and holds `target.boardId` is rewritten, and
   * never one another writer deleted (`LightboxBoardRewrite`).
   */
  replace(
    target: LightboxBoardReplaceTarget | (() => LightboxBoardReplaceTarget | undefined),
    update: LightboxBoardUpdate,
    options: LightboxBoardReplaceOptions = {}
  ): Promise<LightboxBoardReplaceResult> {
    return this.enqueue(async () => {
      const location = this.location();
      if (location.kind === 'session') {
        return { kind: 'session' };
      }
      const named = typeof target === 'function' ? target() : target;
      const filePath = named && lightboxBoardFilePath(location.directory, named.fileId);
      if (!named || !filePath) {
        return { kind: 'missing' };
      }
      return this.rewrites.rewrite(named, filePath, update, options);
    });
  }

  /**
   * Delete a saved board's file, if it reads as one; a file that does not is
   * left as it is. The file is claimed first, as a rewrite claims it, and
   * every earlier version a rewrite left beside it goes with it (PR #164
   * F-01). Only once none is left is the file deleted: a leftover that would
   * not go, or a folder that could not be read again, puts the board back as
   * it was and says the delete `failed` (its re-review). A file another
   * writer holds is `busy`.
   */
  delete(fileId: string): Promise<LightboxBoardDeleteResult> {
    return this.enqueue(async () => {
      const location = this.location();
      if (location.kind === 'session') {
        return { kind: 'unavailable' };
      }
      const filePath = lightboxBoardFilePath(location.directory, fileId);
      if (!filePath) {
        return { kind: 'missing' };
      }
      // Gone, held by another window (busy: it is not gone), left mid-rewrite (put back, then deleted), or not known.
      const read = await this.settledRead(fileId, filePath);
      if (read.kind === 'missing' || read.kind === 'busy') {
        return { kind: read.kind };
      }
      if (read.kind === 'unknown') {
        return { kind: 'failed' };
      }
      if (read.kind !== 'board') {
        return { kind: 'unreadable' };
      }
      // Held under a claim of its own, so no other writer rewrites it meanwhile.
      const claimPath = await this.claims.take(filePath, this.mintStagingId());
      if (!claimPath) {
        const state = await this.claims.settle(filePath);
        return { kind: state === 'busy' ? 'busy' : state === 'absent' ? 'missing' : 'failed' };
      }
      // Every earlier version a rewrite left beside it goes first, so none can come back after the delete.
      if (!(await this.claims.retire(filePath, claimPath))) {
        await this.fileSystem.rename(claimPath, filePath, { overwrite: false })
          .catch(() => this.log.appendLine(`${LOG} ${fileId} could not be put back at once; it comes back once its claim is older than the lease.`));
        return { kind: 'failed' };
      }
      try {
        await this.fileSystem.delete(claimPath);
      } catch (error) {
        this.log.appendLine(`${LOG} Could not delete ${fileId}: ${errorMessage(error)}`);
        // Back under its saved name at once, rather than hidden under the claim until the lease runs out.
        await this.fileSystem.rename(claimPath, filePath, { overwrite: false }).catch(() => undefined);
        return { kind: 'failed' };
      }
      this.files.forget(fileId);
      if (this.lastOnScreen() === fileId) {
        this.rememberOnScreen(undefined);
      }
      this.log.appendLine(`${LOG} Deleted ${fileId}.`);
      return { kind: 'deleted' };
    });
  }

  /** The file id of the last board on screen in this folder, if one was recorded. */
  lastOnScreen(): string | undefined {
    const location = this.location();
    const recorded = this.options.memory?.get<{ root?: unknown; fileId?: unknown }>(LIGHTBOX_BOARD_POINTER_KEY);
    return location.kind === 'project' && recorded?.root === location.root && typeof recorded.fileId === 'string' && LIGHTBOX_BOARD_FILE_ID.test(recorded.fileId)
      ? recorded.fileId
      : undefined;
  }

  /** Record the file holding the board on screen (or none), for a reload to reopen. */
  rememberOnScreen(fileId: string | undefined): void {
    const location = this.location();
    const memory = this.options.memory;
    if (location.kind !== 'project' || !memory || this.lastOnScreen() === fileId) {
      return;
    }
    Promise.resolve(memory.update(LIGHTBOX_BOARD_POINTER_KEY, fileId ? { root: location.root, fileId } : undefined))
      .catch((error: unknown) => this.log.appendLine(`${LOG} Could not record the board on screen: ${errorMessage(error)}`));
  }

  /**
   * A file read with every `missing` classified by its claims: put back and
   * read again (a few times at most), `busy` under a live claim or while it
   * keeps moving, `unknown` when its folder could not be read, and `missing`
   * only when neither the file nor a claim is there.
   */
  private async settledRead(fileId: string, filePath: string): Promise<LightboxBoardRead | { kind: 'unknown' }> {
    for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt++) {
      const read = await this.files.read(fileId, filePath);
      if (read.kind !== 'missing') {
        return read;
      }
      const state = await this.claims.settle(filePath);
      if (state !== 'present') {
        return state === 'absent' ? read : { kind: state };
      }
      // Put back, or standing again: read it again.
    }
    this.log.appendLine(`${LOG} ${fileId} kept moving while it was read; another window is changing it.`);
    return { kind: 'busy' };
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private location(): Location {
    const folders = this.workspace.workspaceFolders();
    if (folders.length === 0) {
      return { kind: 'session', reason: 'no-workspace' };
    }
    if (folders.length !== 1) {
      return { kind: 'session', reason: 'multi-root' };
    }
    return { kind: 'project', root: folders[0].path, directory: path.join(folders[0].path, 'prose-minion', 'boards') };
  }

  private async writeNew(
    location: Extract<Location, { kind: 'project' }>,
    folderName: string,
    savedAt: Date,
    bytes: Uint8Array,
    options: LightboxBoardSaveOptions
  ): Promise<LightboxBoardSaveResult> {
    const folder = path.join(location.directory, folderName);
    // Private to this write: another store on this workspace never stages under the same name.
    const temporaryPath = path.join(folder, `.${savedAt.toISOString().replace(/[:.]/g, '-')}.board.json.tmp-${this.mintStagingId()}`);
    if (!isPathWithinRoot(location.directory, temporaryPath)) {
      this.log.appendLine(`${LOG} Refused to write outside ${LIGHTBOX_BOARDS_DISPLAY_PATH}.`);
      return { kind: 'failed' };
    }
    try {
      await this.fileSystem.createDirectory(folder);
      await this.fileSystem.writeFile(temporaryPath, bytes);
    } catch (error) {
      return this.failWrite(temporaryPath, error);
    }
    for (let attempt = 1; ; attempt++) {
      const name = await freeBoardFileName(this.fileSystem, folder, savedAt.toISOString().replace(/[:.]/g, '-'));
      const finalPath = path.join(folder, name);
      // The commit point: nothing is awaited between it and the rename that commits.
      if (options.beforeCommit && !options.beforeCommit()) {
        await deleteBoardFileQuietly(this.fileSystem, temporaryPath);
        return { kind: 'withdrawn' };
      }
      try {
        await this.fileSystem.rename(temporaryPath, finalPath, { overwrite: false });
      } catch (error) {
        // Another writer took the name between the look and the rename: take the next one; this save's bytes are still staged.
        if (attempt < COMMIT_ATTEMPTS && await boardFileExists(this.fileSystem, finalPath) && await boardFileExists(this.fileSystem, temporaryPath)) {
          continue;
        }
        return this.failWrite(temporaryPath, error);
      }
      const fileId = `${folderName}/${name}`;
      if (this.lastSaveFailed) {
        this.log.appendLine(`${LOG} Boards are saved again after an earlier failure.`);
      }
      this.lastSaveFailed = false;
      this.log.appendLine(`${LOG} Saved ${fileId} (${bytes.byteLength} bytes).`);
      options.onCommitted?.(fileId);
      return { kind: 'saved', fileId };
    }
  }

  private async failWrite(temporaryPath: string, error: unknown): Promise<LightboxBoardSaveResult> {
    this.lastSaveFailed = true;
    this.log.appendLine(`${LOG} Could not save a board; it stays for this session: ${errorMessage(error)}`);
    await deleteBoardFileQuietly(this.fileSystem, temporaryPath);
    return { kind: 'failed' };
  }
}
