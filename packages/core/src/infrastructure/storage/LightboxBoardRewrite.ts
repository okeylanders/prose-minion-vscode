/**
 * Rewriting a saved board's file in place (Slice 5A.1; ADR 2026-10-19 D12
 * addendum; epic decisions 33 and 35): a board named or renamed, or a spark
 * set aside, on the file that already holds the board. Split from
 * `LightboxBoardStore`, which owns the queue and calls this inside it; the
 * small file helpers here serve the store's new-file writes too.
 *
 * - **Only a whole board.** The file is read and checked first: it reads
 *   whole (a rename may replace a name that did not read, and nothing else
 *   left out) and holds the board expected. A file it cannot read is never
 *   overwritten.
 * - **Staged privately,** under the saved name, hidden, with a random id,
 *   as a new save stages (PR #163 F-03). What would be written is decoded
 *   first; a board that would not read back whole is not written.
 * - **Claimed, then committed.** The saved file is renamed, never over
 *   anything, to a hidden name private to this write. A rename is atomic,
 *   so once the claim holds no other writer (another window's store) can
 *   delete or rewrite the file; and a file another writer deleted first
 *   cannot be claimed, so a rewrite never brings a deleted board back. The
 *   claimed bytes must be the bytes that were read, or the claim is put back
 *   and the file read again (at most three times). The commit point runs,
 *   then the staged file takes the saved name, never over anything, and the
 *   claim is dropped.
 * - **The last rewrite to commit wins,** and each reports only bytes it
 *   wrote. A rewrite that finds the file changed since it read it reads
 *   again; one that finds it claimed by another writer's rewrite says the
 *   board is busy (`busy`), and writes nothing.
 * - **A claim left behind** (a window closed mid-rewrite) is put back under
 *   its saved name when the folder is next listed. Putting it back never
 *   overwrites, and a writer still mid-rewrite then finds its saved name
 *   taken and fails, reporting nothing it did not write.
 * - **Logs** carry file ids and reasons, never the writer's text or a name.
 */

import * as path from 'node:path';
import type { FileSystem, LogSink } from '@/platform';
import {
  decodeLightboxBoardFile,
  writeLightboxBoardFile,
  type LightboxBoardFile
} from '@/infrastructure/storage/LightboxBoardCodec';
import { LIGHTBOX_BOARD_CLAIM, errorMessage, type LightboxBoardFiles } from '@/infrastructure/storage/LightboxBoardFiles';

const encoder = new TextEncoder();
const LOG = '[LightboxBoardStore]';
/** A rewrite whose file changed under it reads it again, this many times at most. */
const ATTEMPTS = 3;
/** The one part a rename may find left out of a file and still rewrite it: the name it replaces. */
const NAME_PATH = 'file.board.name';

export type LightboxBoardReplaceResult =
  | { kind: 'replaced'; fileId: string }
  /** The update changed nothing, so nothing was written. */
  | { kind: 'unchanged'; fileId: string }
  /** No file to rewrite: none was named, or it is gone (deleted here or by another writer). */
  | { kind: 'missing' }
  /** Another writer (another window's store) is rewriting it now; nothing was written. */
  | { kind: 'busy' }
  /** The file does not read whole, or holds another board: left as it is. */
  | { kind: 'unreadable' }
  /** The commit point declined it; the file is as it was. */
  | { kind: 'withdrawn' }
  | { kind: 'session' }
  | { kind: 'failed' };

/** The file a rewrite in place changes, and the board it must hold (any board when absent). */
export interface LightboxBoardReplaceTarget {
  fileId: string;
  boardId?: string;
}

export interface LightboxBoardReplaceOptions {
  /** The rewrite sets the board's name, so a name the file held that did not read is replaced, not lost. */
  renames?: boolean;
  /** The commit point, as for a save: synchronous, immediately before the rewrite takes the saved name. */
  beforeCommit?: () => boolean;
}

/** The changed file, or undefined to leave it as it is. */
export type LightboxBoardUpdate = (file: LightboxBoardFile) => LightboxBoardFile | undefined;

export class LightboxBoardRewrites {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly files: LightboxBoardFiles,
    private readonly log: LogSink,
    private readonly mintStagingId: () => string
  ) {}

  /** Rewrite `filePath`, the file `target` names, by `update`. Run inside the store's queue. */
  async rewrite(
    target: LightboxBoardReplaceTarget,
    filePath: string,
    update: LightboxBoardUpdate,
    options: LightboxBoardReplaceOptions
  ): Promise<LightboxBoardReplaceResult> {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const result = await this.once(target, filePath, update, options);
      if (result !== 'again') {
        return result;
      }
    }
    this.log.appendLine(`${LOG} ${target.fileId} kept changing while it was rewritten; it was left as another writer left it.`);
    return { kind: 'failed' };
  }

  /**
   * Claims a listing found with their saved names empty (`leftClaims`), left
   * by a writer that stopped mid-rewrite: each board goes back under its
   * saved name, never over anything.
   */
  async putBack(folder: string, claims: readonly string[]): Promise<void> {
    for (const name of claims) {
      const saved = LIGHTBOX_BOARD_CLAIM.exec(name)?.[1];
      if (!saved) {
        continue;
      }
      try {
        await this.fileSystem.rename(path.join(folder, name), path.join(folder, saved), { overwrite: false });
        this.log.appendLine(`${LOG} Put back ${saved}, left mid-rewrite.`);
      } catch {
        // Another writer put it back, or took the name: the claim stays for the next listing.
      }
    }
  }

  /** One rewrite: read, stage, claim, commit. `again` when the file changed or moved under it. */
  private async once(
    target: LightboxBoardReplaceTarget,
    filePath: string,
    update: LightboxBoardUpdate,
    options: LightboxBoardReplaceOptions
  ): Promise<LightboxBoardReplaceResult | 'again'> {
    const { fileId } = target;
    const { read, bytes } = await this.files.readWithBytes(fileId, filePath);
    if (read.kind === 'missing' || read.kind === 'unavailable') {
      return (await boardFileClaimed(this.fileSystem, filePath)) ? { kind: 'busy' } : { kind: 'missing' };
    }
    // Only a whole board is rewritten: a part left out would be lost. A rename replaces a name that did not read.
    const whole = read.kind === 'board' && (read.dropped === 0 || (options.renames === true
      && read.droppedAt.length === read.dropped && read.droppedAt.every((at) => at === NAME_PATH)));
    if (read.kind !== 'board' || !bytes || !whole || (target.boardId !== undefined && read.file.board.boardId !== target.boardId)) {
      this.log.appendLine(`${LOG} ${fileId} was not rewritten: it does not read whole, or holds another board.`);
      return { kind: 'unreadable' };
    }
    const next = update(read.file);
    if (!next) {
      return { kind: 'unchanged', fileId };
    }
    const json = writeLightboxBoardFile(next);
    const check = decodeLightboxBoardFile(json);
    if (check.kind !== 'board' || check.dropped > 0 || check.file.board.boardId !== read.file.board.boardId) {
      this.log.appendLine(`${LOG} A rewrite of ${fileId} would not read back whole; it was not written.`);
      return { kind: 'failed' };
    }
    const folder = path.dirname(filePath);
    const name = path.basename(filePath);
    const temporaryPath = path.join(folder, `.${name}.tmp-${this.mintStagingId()}`);
    const claimPath = path.join(folder, `.${name}.claim-${this.mintStagingId()}`);
    try {
      await this.fileSystem.writeFile(temporaryPath, encoder.encode(json));
    } catch (error) {
      this.log.appendLine(`${LOG} Could not stage a rewrite of ${fileId}: ${errorMessage(error)}`);
      await deleteBoardFileQuietly(this.fileSystem, temporaryPath);
      return { kind: 'failed' };
    }
    try {
      // The claim: atomic, and never over anything. A file deleted since the read cannot be claimed, so it stays deleted.
      await this.fileSystem.rename(filePath, claimPath, { overwrite: false });
    } catch {
      await deleteBoardFileQuietly(this.fileSystem, temporaryPath);
      if (await boardFileExists(this.fileSystem, filePath)) {
        return 'again';
      }
      return (await boardFileClaimed(this.fileSystem, filePath)) ? { kind: 'busy' } : { kind: 'missing' };
    }
    let claimed: Uint8Array | undefined;
    try {
      claimed = await this.fileSystem.readFile(claimPath);
    } catch {
      claimed = undefined;
    }
    // Another writer rewrote it between the read and the claim: put it back, and read it again.
    if (!claimed || !sameBytes(claimed, bytes)) {
      await this.release(claimPath, filePath, temporaryPath);
      return 'again';
    }
    if (options.beforeCommit && !options.beforeCommit()) {
      await this.release(claimPath, filePath, temporaryPath);
      return { kind: 'withdrawn' };
    }
    try {
      await this.fileSystem.rename(temporaryPath, filePath, { overwrite: false });
    } catch (error) {
      this.log.appendLine(`${LOG} Could not rewrite ${fileId}; it is left as it was: ${errorMessage(error)}`);
      await this.release(claimPath, filePath, temporaryPath);
      return { kind: 'failed' };
    }
    this.files.forget(fileId);
    await deleteBoardFileQuietly(this.fileSystem, claimPath);
    this.log.appendLine(`${LOG} Rewrote ${fileId} in place.`);
    return { kind: 'replaced', fileId };
  }

  /**
   * Give the claim back without committing: the claimed file returns to its
   * saved name (or, should a new save have taken that name meanwhile, the
   * next free one), and the staged bytes are dropped.
   */
  private async release(claimPath: string, filePath: string, temporaryPath: string): Promise<void> {
    await deleteBoardFileQuietly(this.fileSystem, temporaryPath);
    const folder = path.dirname(filePath);
    const stamp = path.basename(filePath).replace(/(?:-\d+)?\.board\.json$/, '');
    for (const destination of [() => filePath, async () => path.join(folder, await freeBoardFileName(this.fileSystem, folder, stamp))]) {
      try {
        await this.fileSystem.rename(claimPath, await destination(), { overwrite: false });
        return;
      } catch {
        // Taken, or the claim is gone: try the next.
      }
    }
    this.log.appendLine(`${LOG} A claimed board could not be put back; it is kept as ${path.basename(claimPath)}.`);
  }
}

/** Whether another writer holds a claim on the saved file at `filePath`: it is mid-rewrite, not gone. */
export async function boardFileClaimed(fileSystem: FileSystem, filePath: string): Promise<boolean> {
  const name = path.basename(filePath);
  try {
    return (await fileSystem.readDirectory(path.dirname(filePath)))
      .some(([entry]) => LIGHTBOX_BOARD_CLAIM.exec(entry)?.[1] === name);
  } catch {
    return false;
  }
}

export async function boardFileExists(fileSystem: FileSystem, filePath: string): Promise<boolean> {
  try {
    await fileSystem.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/** The timestamp's name, or the first numbered one free: a save never takes an existing file's name. */
export async function freeBoardFileName(fileSystem: FileSystem, folder: string, stamp: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const name = attempt === 1 ? `${stamp}.board.json` : `${stamp}-${attempt}.board.json`;
    if (!(await boardFileExists(fileSystem, path.join(folder, name)))) {
      return name;
    }
  }
}

/** Best effort: a leftover temporary or claim file is never read as a board. */
export async function deleteBoardFileQuietly(fileSystem: FileSystem, filePath: string): Promise<void> {
  try {
    await fileSystem.delete(filePath);
  } catch {
    // The write may have failed before the file existed.
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}
