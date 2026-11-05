/**
 * WorkshopPinnedContextLock: one writer at a time for the pinned-context
 * list, across windows, and a fence on a stale one (PR #204 F-01 and its
 * re-review). Every write the store makes, a first write and a rewrite
 * alike, holds this lock from before it reads the list at its turn until
 * after it commits.
 *
 * - **The lock is a directory,** `.pinned-context.lock/`, beside the list,
 *   holding `owner.json` (`{ token, at }`: a token private to this write,
 *   and when it was taken, epoch ms). It is taken by renaming a staged
 *   directory to that name, never over anything: of two windows, one wins
 *   and the other is `busy`.
 * - **The fence.** A write stages its new list *inside* its lock directory
 *   (`stagingPath`), and both of its commits rename from there. A takeover
 *   moves the whole directory aside and deletes it, so a stale writer's
 *   staged list goes with it: a commit rename resolves its source when it
 *   runs, so a stalled owner's late rename finds no source and fails.
 * - **Live, or abandoned, by age.** A lock younger than the claims' lease
 *   (`STORED_FILE_CLAIM_LEASE_MS`) is live, and another window is `busy`.
 *   An older one, or one whose `owner.json` does not read as an owner
 *   (missing, malformed, or over `WORKSHOP_PINNED_CONTEXT_LOCK_OWNER_BYTES`, which is never read), is
 *   abandoned by its file's age, and is taken over: the directory is
 *   renamed, never over anything, to a unique name (only one window's rename
 *   finds it), checked to be the very lock judged abandoned (else put back:
 *   it was a new, live lock), and deleted with all it holds.
 * - **Checked before each commit** (`stillHeld`), a cheap early withdrawal;
 *   the fence is what a stall after it cannot get past.
 * - **Released** the way it is taken over: renamed aside, checked to be this
 *   write's, and deleted (else put back), so a release never deletes a lock
 *   a successor took.
 *
 * Logs carry outcomes and error categories, never a path or a token.
 */

import * as path from 'node:path';
import type { FileSystem, LogSink } from '@/platform';
import { STORED_FILE_CLAIM_LEASE_MS } from '@/infrastructure/storage/StoredFileClaims';
import { fileSystemErrorCategory, isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';

const LOG = '[WorkshopPinnedContextLock]';
const LOCK_NAME = '.pinned-context.lock';
const OWNER = 'owner.json';
/** The most bytes of `owner.json` read (PR #204 F-04): an owner is a few dozen. */
export const WORKSHOP_PINNED_CONTEXT_LOCK_OWNER_BYTES = 4 * 1024;
/** Takeovers and lost races tried before a window answers busy. */
const ATTEMPTS = 3;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A lock this write holds. */
export interface WorkshopPinnedContextHeldLock {
  /** Where this write stages a file it will commit by rename: inside the lock, so a takeover removes it. */
  stagingPath(name: string): string;
  /** Whether the lock still holds this write's token: read from disk, so asked immediately before a commit. */
  stillHeld(): Promise<boolean>;
  /** Remove the lock, if it is still this write's. */
  release(): Promise<void>;
}

/** What a lock directory's owner reads as: `identity` tells one lock from another. */
type Owner =
  | { kind: 'none' }
  | { kind: 'io' }
  | { kind: 'owner'; identity: string; token?: string; at?: number };

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
    const lockPath = path.join(folder, LOCK_NAME);
    const token = this.mintId();
    const staged = `${lockPath}.staged-${token}`;
    try {
      await this.fileSystem.createDirectory(staged);
      await this.fileSystem.writeFile(path.join(staged, OWNER), encoder.encode(JSON.stringify({ token, at: this.now().getTime() })));
    } catch (error) {
      this.log.appendLine(`${LOG} Could not stage the lock: ${fileSystemErrorCategory(error)}`);
      await this.remove(staged);
      return 'io';
    }
    const outcome = await this.take(staged, lockPath);
    if (outcome !== 'held') {
      await this.remove(staged);
      return outcome;
    }
    const ours = (owner: Owner) => owner.kind === 'owner' && owner.token === token;
    return {
      stagingPath: (name) => path.join(lockPath, name),
      stillHeld: async () => ours(await this.readOwner(lockPath)),
      release: async () => {
        await this.removeIf(lockPath, `${lockPath}.released-${this.mintId()}`, ours);
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
      const judged = await this.readOwner(lockPath);
      if (judged.kind === 'io') {
        return 'io';
      }
      if (judged.kind === 'none') {
        continue;
      }
      if (judged.at !== undefined && Math.abs(this.now().getTime() - judged.at) < STORED_FILE_CLAIM_LEASE_MS) {
        return 'busy';
      }
      const removed = await this.removeIf(lockPath, `${lockPath}.stale-${this.mintId()}`, (moved) => moved.kind === 'owner' && moved.identity === judged.identity);
      if (removed === 'kept') {
        return 'busy';
      }
      if (removed === 'removed') {
        this.log.appendLine(`${LOG} Took over an abandoned lock.`);
      }
    }
    this.log.appendLine(`${LOG} The lock kept changing hands; this write is busy.`);
    return 'busy';
  }

  /**
   * Rename the lock at `lockPath` aside to `aside`, never over anything, and
   * delete it with all it holds if `matches` its owner; else put it back.
   * `gone` when it was not there to move.
   */
  private async removeIf(lockPath: string, aside: string, matches: (moved: Owner) => boolean): Promise<'removed' | 'kept' | 'gone'> {
    try {
      await this.fileSystem.rename(lockPath, aside, { overwrite: false });
    } catch {
      return 'gone';
    }
    if (matches(await this.readOwner(aside))) {
      await this.remove(aside);
      return 'removed';
    }
    try {
      await this.fileSystem.rename(aside, lockPath, { overwrite: false });
    } catch {
      // A new lock took the name meanwhile. This one's holder finds its lock gone and its staged list with it, and
      // withdraws; a lock holds nothing a writer was told was saved.
      await this.remove(aside);
    }
    return 'kept';
  }

  /** The lock directory's owner: read only within its bound; its age from its file when it does not read as an owner. */
  private async readOwner(lockPath: string): Promise<Owner> {
    const ownerPath = path.join(lockPath, OWNER);
    let size: number;
    let mtime: number;
    try {
      ({ size, mtime } = await this.fileSystem.stat(ownerPath));
    } catch (error) {
      if (!isMissingFileSystemPathError(error)) {
        return { kind: 'io' };
      }
      // No owner: no lock, or a directory that is not one this store made (abandoned).
      return (await this.exists(lockPath)) ? { kind: 'owner', identity: 'no-owner' } : { kind: 'none' };
    }
    const unread: Owner = { kind: 'owner', identity: `unread:${size}:${mtime}`, at: mtime };
    if (size > WORKSHOP_PINNED_CONTEXT_LOCK_OWNER_BYTES) {
      return unread;
    }
    let text: string;
    try {
      text = decoder.decode(await this.fileSystem.readFile(ownerPath));
    } catch (error) {
      return isMissingFileSystemPathError(error) ? { kind: 'none' } : { kind: 'io' };
    }
    try {
      const value: unknown = JSON.parse(text);
      const { token, at } = (typeof value === 'object' && value !== null ? value : {}) as { token?: unknown; at?: unknown };
      if (typeof token === 'string' && typeof at === 'number' && Number.isFinite(at)) {
        return { kind: 'owner', identity: `owner:${token}:${at}`, token, at };
      }
    } catch {
      // Not an owner this store wrote.
    }
    return { kind: 'owner', identity: `text:${text}`, at: mtime };
  }

  private async exists(target: string): Promise<boolean> {
    try {
      await this.fileSystem.stat(target);
      return true;
    } catch {
      return false;
    }
  }

  private async remove(directory: string): Promise<void> {
    try {
      await this.fileSystem.delete(directory, { recursive: true });
    } catch {
      // Not there, or already removed by another window.
    }
  }
}
