/**
 * WorkshopPinnedContextLock: one writer at a time for the pinned-context
 * list, across windows (PR #204 F-01). Every write the store makes, a first
 * write and a rewrite alike, holds this lock from before it reads the list
 * at its turn until after it commits, so no create can land while another
 * window's rewrite holds the list under its claim (when the saved name
 * stands empty, and looks absent).
 *
 * - **One fixed name,** `.pinned-context.json.lock`, beside the list. It
 *   holds `{ token, at }`: a token private to this write, and when it was
 *   taken (epoch ms).
 * - **Taken atomically.** The lock is staged under a private name, then
 *   renamed to the fixed name, never over anything: of two windows, one
 *   wins and the other is `busy`.
 * - **Live, or abandoned, by age.** A lock younger than the claims' lease
 *   (`STORED_FILE_CLAIM_LEASE_MS`) is live: another window answers `busy`.
 *   An older one (its window closed mid-write), or one that does not read
 *   as a lock, is abandoned and taken over: renamed, never over anything,
 *   to a unique name (only one window's rename finds it there), checked to
 *   be the very lock judged abandoned (else it is put back: it was a new,
 *   live lock), deleted, and the lock taken anew.
 * - **Checked before each commit.** The holder reads its token again
 *   immediately before the rename that commits (`stillHeld`), and
 *   withdraws if the lock is no longer its own.
 * - **Released** by deleting it, only while it still holds this token.
 *
 * Logs carry outcomes and error categories, never a path or a token.
 */

import * as path from 'node:path';
import type { FileSystem, LogSink } from '@/platform';
import { STORED_FILE_CLAIM_LEASE_MS, deleteStoredFileQuietly } from '@/infrastructure/storage/StoredFileClaims';
import { fileSystemErrorCategory, isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';

const LOG = '[WorkshopPinnedContextLock]';
/** Takeovers and lost races tried before a window answers busy. */
const ATTEMPTS = 3;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A lock this write holds. */
export interface WorkshopPinnedContextHeldLock {
  /** Whether the lock still holds this write's token: read from disk, so asked immediately before a commit. */
  stillHeld(): Promise<boolean>;
  /** Delete the lock, if it still holds this write's token. */
  release(): Promise<void>;
}

type LockFile =
  | { kind: 'missing' }
  | { kind: 'present'; bytes: Uint8Array; token?: string; at?: number }
  | { kind: 'io' };

export class WorkshopPinnedContextLock {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly log: LogSink,
    private readonly now: () => Date,
    private readonly mintId: () => string
  ) {}

  /** The lock of the list at `listPath`, or why it cannot be had now. */
  async acquire(listPath: string): Promise<WorkshopPinnedContextHeldLock | 'busy' | 'io'> {
    const folder = path.dirname(listPath);
    const lockPath = path.join(folder, `.${path.basename(listPath)}.lock`);
    const token = this.mintId();
    const staged = `${lockPath}.staged-${token}`;
    try {
      await this.fileSystem.createDirectory(folder);
      await this.fileSystem.writeFile(staged, encoder.encode(JSON.stringify({ token, at: this.now().getTime() })));
    } catch (error) {
      this.log.appendLine(`${LOG} Could not stage the lock: ${fileSystemErrorCategory(error)}`);
      await deleteStoredFileQuietly(this.fileSystem, staged);
      return 'io';
    }
    const outcome = await this.take(staged, lockPath);
    if (outcome !== 'held') {
      await deleteStoredFileQuietly(this.fileSystem, staged);
      return outcome;
    }
    return {
      stillHeld: async () => {
        const current = await this.readLock(lockPath);
        return current.kind === 'present' && current.token === token;
      },
      release: async () => {
        const current = await this.readLock(lockPath);
        if (current.kind === 'present' && current.token === token) {
          await deleteStoredFileQuietly(this.fileSystem, lockPath);
        }
      }
    };
  }

  /** Rename the staged lock to the fixed name, taking over an abandoned one on the way. */
  private async take(staged: string, lockPath: string): Promise<'held' | 'busy' | 'io'> {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        await this.fileSystem.rename(staged, lockPath, { overwrite: false });
        return 'held';
      } catch {
        // Taken, most likely: look at what holds the name.
      }
      const judged = await this.readLock(lockPath);
      if (judged.kind === 'missing') {
        continue;
      }
      if (judged.kind === 'io') {
        return 'io';
      }
      if (judged.at !== undefined && Math.abs(this.now().getTime() - judged.at) < STORED_FILE_CLAIM_LEASE_MS) {
        return 'busy';
      }
      if (!(await this.takeOver(lockPath, judged.bytes))) {
        return 'busy';
      }
    }
    this.log.appendLine(`${LOG} The lock kept changing hands; this write is busy.`);
    return 'busy';
  }

  /**
   * Remove the abandoned lock whose bytes are `judged`: renamed aside, never
   * over anything, then checked. A lock that is not the one judged (a window
   * took it anew in between) is put back, and the takeover fails.
   */
  private async takeOver(lockPath: string, judged: Uint8Array): Promise<boolean> {
    const aside = `${lockPath}.stale-${this.mintId()}`;
    try {
      await this.fileSystem.rename(lockPath, aside, { overwrite: false });
    } catch {
      // Another window moved it first: look again.
      return true;
    }
    const moved = await this.readLock(aside);
    if (moved.kind === 'present' && sameBytes(moved.bytes, judged)) {
      await deleteStoredFileQuietly(this.fileSystem, aside);
      this.log.appendLine(`${LOG} Took over an abandoned lock.`);
      return true;
    }
    try {
      await this.fileSystem.rename(aside, lockPath, { overwrite: false });
    } catch {
      // Its holder finds its lock gone before it commits, and withdraws; a lock holds no writer data.
      await deleteStoredFileQuietly(this.fileSystem, aside);
    }
    return false;
  }

  private async readLock(lockPath: string): Promise<LockFile> {
    let bytes: Uint8Array;
    try {
      bytes = await this.fileSystem.readFile(lockPath);
    } catch (error) {
      return isMissingFileSystemPathError(error) ? { kind: 'missing' } : { kind: 'io' };
    }
    try {
      const value: unknown = JSON.parse(decoder.decode(bytes));
      if (typeof value === 'object' && value !== null) {
        const { token, at } = value as { token?: unknown; at?: unknown };
        if (typeof token === 'string' && typeof at === 'number' && Number.isFinite(at)) {
          return { kind: 'present', bytes, token, at };
        }
      }
    } catch {
      // Not a lock this store wrote: abandoned, whatever its age.
    }
    return { kind: 'present', bytes };
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}
