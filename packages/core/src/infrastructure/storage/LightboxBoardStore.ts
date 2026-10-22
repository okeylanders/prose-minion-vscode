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

const encoder = new TextEncoder();
const LOG = '[LightboxBoardStore]';
/** A commit that finds its final name taken tries the next free one, this many times at most. */
const COMMIT_ATTEMPTS = 3;

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

export type LightboxBoardDeleteResult = { kind: 'deleted' } | { kind: 'missing' } | { kind: 'unreadable' } | { kind: 'unavailable' } | { kind: 'failed' };

export interface LightboxBoardSaveInput {
  board: LightboxBoard;
  /** The text the board was measured from. */
  text: string;
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
}

type Location =
  | { kind: 'project'; root: string; directory: string }
  | { kind: 'session'; reason: 'no-workspace' | 'multi-root' };

export class LightboxBoardStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly files: LightboxBoardFiles;
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
      return location.kind === 'session' ? { entries: [], unreadable: 0 } : this.files.list(location.directory, source);
    });
  }

  /** A saved board's file, decoded. */
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
      return this.files.read(fileId, filePath);
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
      const json = encodeLightboxBoardFile({ board: input.board, text: input.text, savedAt });
      const check = decodeLightboxBoardFile(json);
      if (check.kind !== 'board' || check.dropped > 0) {
        this.log.appendLine(`${LOG} A board would not read back whole (${check.kind === 'invalid' ? `${check.reason} at ${check.at ?? 'the file'}` : `${check.dropped} parts dropped`}); it was not saved.`);
        return { kind: 'failed' };
      }
      return this.writeNew(location, folder, savedAt, encoder.encode(json), options);
    });
  }

  /** Delete a saved board's file, if it reads as one; a file that does not is left as it is. */
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
      const read = await this.files.read(fileId, filePath);
      if (read.kind !== 'board') {
        return { kind: read.kind === 'missing' ? 'missing' : 'unreadable' };
      }
      try {
        await this.fileSystem.delete(filePath);
      } catch (error) {
        this.log.appendLine(`${LOG} Could not delete ${fileId}: ${errorMessage(error)}`);
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
      const name = await this.freeName(folder, savedAt);
      const finalPath = path.join(folder, name);
      // The commit point: nothing is awaited between it and the rename that commits.
      if (options.beforeCommit && !options.beforeCommit()) {
        await this.deleteQuietly(temporaryPath);
        return { kind: 'withdrawn' };
      }
      try {
        await this.fileSystem.rename(temporaryPath, finalPath, { overwrite: false });
      } catch (error) {
        // Another writer took the name between the look and the rename: take the next one; this save's bytes are still staged.
        if (attempt < COMMIT_ATTEMPTS && await this.exists(finalPath) && await this.exists(temporaryPath)) {
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

  private async exists(filePath: string): Promise<boolean> {
    try {
      await this.fileSystem.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /** The timestamp's name, or the first numbered one free: a save never takes an existing file's name. */
  private async freeName(folder: string, savedAt: Date): Promise<string> {
    const stamp = savedAt.toISOString().replace(/[:.]/g, '-');
    for (let attempt = 1; ; attempt++) {
      const name = attempt === 1 ? `${stamp}.board.json` : `${stamp}-${attempt}.board.json`;
      try {
        await this.fileSystem.stat(path.join(folder, name));
      } catch {
        return name;
      }
    }
  }

  private async failWrite(temporaryPath: string, error: unknown): Promise<LightboxBoardSaveResult> {
    this.lastSaveFailed = true;
    this.log.appendLine(`${LOG} Could not save a board; it stays for this session: ${errorMessage(error)}`);
    await this.deleteQuietly(temporaryPath);
    return { kind: 'failed' };
  }

  /** Best effort: a leftover temporary file is never read as a board. */
  private async deleteQuietly(filePath: string): Promise<void> {
    try {
      await this.fileSystem.delete(filePath);
    } catch {
      // The write may have failed before the file existed.
    }
  }
}
