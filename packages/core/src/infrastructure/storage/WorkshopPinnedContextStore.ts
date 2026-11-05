/**
 * WorkshopPinnedContextStore: the Workshop's pinned-context list on disk
 * (ADR 2026-11-04 D5; epic Slice 1). One file,
 * `<workspace>/prose-minion/pinned-context.json`, format 1
 * (`WorkshopPinnedContextCodec`). Slice 2b builds it once, at the
 * composition root.
 *
 * - **Where, read live.** One workspace folder keeps the list; none, or
 *   several, is unavailable, with that reason (`availability()`, read on
 *   every operation, as `LightboxBoardStore.location()` is).
 * - **Revisions.** A read names its revision, a SHA-256 of the file's bytes;
 *   an absent file has the fixed `WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION`,
 *   so a create is checked as any other write is.
 * - **Bounded reads.** The list, each claim (`maxBytes`, PR #204 F-04) and
 *   the lock's owner are `stat`ed before they are read: over its bound, a
 *   file is never read. The list is then `too-large` and never written; a
 *   claim is kept. The codec checks again, for a file that grew meanwhile.
 * - **One queue and one lock** (`WorkshopPinnedContextLock`, PR #204 F-01):
 *   every `update` holds the lock from before it reads at its turn until
 *   after it commits; a window that cannot take it is `busy`. At its turn:
 *   - another revision than the caller's refuses the write (`changed`, with
 *     the list as it reads now), and nothing is written;
 *   - the new list is staged *inside the lock*. A first write renames it to
 *     the list's name, never over anything; a later one is a claimed
 *     rewrite (`commitStoredFileRewrite`) whose claimed bytes must be the
 *     bytes read;
 *   - an abandoned claim beside the list is removed only when it holds the
 *     very bytes that stand (PR #204 F-02); any other is set aside
 *     (`pinned-context.json.set-aside-<id>`), never deleted;
 *   - a file that does not read is never written (`unreadable`).
 * - **Why no write is lost.** Writers are this store's windows, which hold
 *   the lock, and the writer's editor, which does not. A commit is one
 *   rename whose source is a staged list inside its writer's lock
 *   directory; a takeover renames that directory aside and deletes it, and
 *   a rename resolves its source when it runs. So a write commits only
 *   while its lock is in place, or never. For a holder stalled past the
 *   lease, at each step:
 *   - *before or while reading:* its successor reads and writes first; the
 *     stalled write stages where the lock now is (or nowhere), its token
 *     check finds another owner, and it is `busy`;
 *   - *between staging and its token check:* the takeover took its staged
 *     list; the check fails; `busy`;
 *   - *after the check, inside its commit rename* (the re-review's case):
 *     if the rename ran before the takeover, it committed as the only owner
 *     and the successor reads its list; if after, its source is gone, the
 *     rename fails, and it is `busy`. A rewrite's claim, meanwhile, goes back
 *     under its name by the claims' rules (the successor settles it once
 *     abandoned, or is `busy` while it is live), so nothing is lost;
 *   - *after committing, before releasing:* its list stands; a release
 *     renames the lock aside and deletes it only if it is still its own,
 *     else puts it back, so it never removes its successor's.
 *   - Within the lease, the lock alone serializes create vs create, create
 *     vs a claimed rewrite and rewrite vs rewrite.
 *   - *A hand edit:* before the read, it is what is read; before a create
 *     commits, the no-overwrite rename fails (`changed`); before a claim,
 *     the claimed bytes differ and go back (`changed`); under the claim, the
 *     commit fails, the edit stands and the claimed bytes are set aside
 *     (`io`); after the commit, it wins. "Never over anything" is the
 *     platform's no-overwrite rename, which every store here relies on.
 * - **A write belongs to the workspace it was asked in** (D5; Project
 *   Memory's PR #202 F01). `update` captures the list's file when it is
 *   called, before the queue can wait. A write whose turn or commit comes
 *   under another folder, or none, or whose caller's `beforeCommit` says no
 *   (the library's accepted-room check), is withdrawn as `unavailable`, even
 *   where the new workspace has a list of its own.
 * - **A folder that cannot be read is `io`,** never `absent`.
 * - **Owed writes.** `shutDown` waits for every write owed, and any started
 *   while it waits (PR #183 F-03).
 * - **Logs** carry outcomes and error categories (`fileSystemErrorCategory`),
 *   never a path, a file name from the list, or the file's contents.
 */

import { createHash, randomUUID } from 'node:crypto';
import * as path from 'node:path';
import type { FileSystem, LogSink, Workspace } from '@/platform';
import {
  WORKSHOP_PINNED_CONTEXT_DISPLAY_PATH,
  WORKSHOP_PINNED_CONTEXT_FILE_BYTES,
  workshopPinnedContextPlatformOf,
  type WorkshopPinnedContextList,
  type WorkshopPinnedContextPathPlatform,
  type WorkshopPinnedContextRefusal
} from '@shared/types/workshopPinnedContext';
import { decodeWorkshopPinnedContext, prepareWorkshopPinnedContext } from '@/infrastructure/storage/WorkshopPinnedContextCodec';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import { StoredFileClaims, deleteStoredFileQuietly, storedFileExists } from '@/infrastructure/storage/StoredFileClaims';
import { commitStoredFileRewrite, type StoredFileRewritePorts } from '@/infrastructure/storage/StoredFileRewrite';
import { WorkshopPinnedContextLock, type WorkshopPinnedContextHeldLock } from '@/infrastructure/storage/WorkshopPinnedContextLock';
import { fileSystemErrorCategory, isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';
import {
  WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION,
  type WorkshopPinnedContextAvailability,
  type WorkshopPinnedContextChange,
  type WorkshopPinnedContextRead,
  type WorkshopPinnedContextStoreOptions,
  type WorkshopPinnedContextUpdateOptions,
  type WorkshopPinnedContextUpdateResult
} from '@/infrastructure/storage/WorkshopPinnedContextStoreContracts';

export * from '@/infrastructure/storage/WorkshopPinnedContextStoreContracts';

const LOG = '[WorkshopPinnedContextStore]';
const FILE_NAME = 'pinned-context.json';
/** A claim of the list's file: `.pinned-context.json.claim-<epoch ms>-<id>`. */
const CLAIM = /^\.(pinned-context\.json)\.claim-(\d{13})-[A-Za-z0-9-]+$/;
/** A read that finds the file moving under it (put back, or claimed and committed) looks again, this many times at most. */
const ATTEMPTS = 3;


/** A read as the store keeps it: a readable list with the bytes a rewrite must claim. */
type StoreRead =
  | Exclude<WorkshopPinnedContextRead, { state: 'ok' }>
  | { state: 'ok'; list: WorkshopPinnedContextList; revision: string; bytes: Uint8Array };

type FileRead =
  | { state: 'absent' }
  | { state: 'present'; bytes: Uint8Array }
  /** Over the byte bound by its `stat`: never read. */
  | { state: 'too-large'; size: number; mtime: number }
  | { state: 'busy' | 'io' };

export class WorkshopPinnedContextStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly owed = new Set<Promise<unknown>>();
  private readonly platform: WorkshopPinnedContextPathPlatform;
  private readonly mintStagingId: () => string;
  private readonly claims: StoredFileClaims;
  private readonly rewritePorts: StoredFileRewritePorts;
  private readonly lock: WorkshopPinnedContextLock;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly log: LogSink,
    options: WorkshopPinnedContextStoreOptions = {}
  ) {
    this.platform = options.platform ?? workshopPinnedContextPlatformOf(process.platform);
    this.mintStagingId = options.mintStagingId ?? randomUUID;
    this.claims = new StoredFileClaims(fileSystem, log, options.claimNow ?? (() => new Date()), {
      claimPattern: CLAIM,
      logPrefix: LOG,
      formatError: fileSystemErrorCategory,
      // Recovery reads stay within the file bound (PR #204 F-04): a claim or list over it is never read, and is kept.
      maxBytes: WORKSHOP_PINNED_CONTEXT_FILE_BYTES,
      // Preserve whenever unsure (PR #204 F-02): only a claim of the very bytes that stand is shown to lose nothing.
      leftovers: {
        isEarlierVersion: (claimed, standing) => sameBytes(claimed, standing),
        freeName: async () => this.setAsideName()
      }
    });
    this.rewritePorts = { fileSystem, claims: this.claims, log, logPrefix: LOG, noun: 'pinned-context list', mintStagingId: this.mintStagingId };
    this.lock = new WorkshopPinnedContextLock(fileSystem, log, options.claimNow ?? (() => new Date()), this.mintStagingId);
  }

  /** Where the list is kept now, read live. */
  availability(): WorkshopPinnedContextAvailability {
    const folders = this.workspace.workspaceFolders();
    if (folders.length === 0) {
      return { available: false, reason: 'no-workspace' };
    }
    if (folders.length !== 1) {
      return { available: false, reason: 'multi-root' };
    }
    const rootPath = folders[0].path;
    return { available: true, rootPath, filePath: path.join(rootPath, 'prose-minion', FILE_NAME), displayPath: WORKSHOP_PINNED_CONTEXT_DISPLAY_PATH };
  }

  /** The list as it reads now, with its revision. */
  read(): Promise<WorkshopPinnedContextRead> {
    return this.enqueue(async () => {
      const where = this.availability();
      return where.available ? publicRead(await this.readState(where.filePath)) : { state: 'unavailable', reason: where.reason };
    });
  }

  /**
   * Apply `change` to the list as it reads at this write's turn, if it is
   * still at `revision`, and write the result. A change that leaves the
   * bytes as they are writes nothing.
   */
  update(
    revision: string,
    change: WorkshopPinnedContextChange,
    options: WorkshopPinnedContextUpdateOptions = {}
  ): Promise<WorkshopPinnedContextUpdateResult> {
    const asked = this.askedFile();
    const permitted = () => asked !== undefined && this.currentFile() === asked && (options.beforeCommit?.() ?? true);
    return this.owe(this.enqueue(async () => {
      if (!asked || !permitted()) {
        this.log.appendLine(`${LOG} Not written: the workspace changed before its turn.`);
        return { ok: false, reason: 'unavailable' };
      }
      // Held from before the read at this turn until after the commit (PR #204 F-01).
      const lock = await this.lock.acquire(asked);
      if (lock === 'busy' || lock === 'io') {
        this.log.appendLine(`${LOG} Not written: the list's lock is ${lock === 'busy' ? 'held by another window' : 'not readable'}.`);
        return { ok: false, reason: lock };
      }
      try {
        for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
          const result = await this.attemptUpdate(asked, revision, change, permitted, lock);
          if (result !== 'again') {
            return result;
          }
        }
        this.log.appendLine(`${LOG} Not written: the file kept moving under the write.`);
        return { ok: false, reason: 'busy' };
      } finally {
        await lock.release();
      }
    }));
  }

  /**
   * One try at a write, inside the queue: `again` when the write lost a race
   * (a claim, or a new file's name) but the file may still be at the
   * caller's revision, so it is read and tried again.
   */
  private async attemptUpdate(
    filePath: string,
    revision: string,
    change: WorkshopPinnedContextChange,
    permitted: () => boolean,
    lock: WorkshopPinnedContextHeldLock
  ): Promise<WorkshopPinnedContextUpdateResult | 'again'> {
    const read = await this.readState(filePath);
    if (!permitted()) {
      this.log.appendLine(`${LOG} Not written: the workspace changed while it was read.`);
      return { ok: false, reason: 'unavailable' };
    }
    switch (read.state) {
      case 'unavailable':
        return { ok: false, reason: 'unavailable' };
      case 'busy':
      case 'io':
        return { ok: false, reason: read.state };
      case 'unreadable':
        this.log.appendLine(`${LOG} Not written: the file does not read (${read.reason}), and is never rewritten.`);
        return { ok: false, reason: 'unreadable' };
      case 'absent':
      case 'ok':
        break;
    }
    if (read.revision !== revision) {
      this.log.appendLine(`${LOG} Not written: the file changed since it was read.`);
      return { ok: false, reason: 'changed', current: publicRead(read) };
    }
    const before: WorkshopPinnedContextList = read.state === 'ok' ? read.list : { files: [] };
    const prepared = prepareWorkshopPinnedContext(change(before), this.platform);
    if (!prepared.ok) {
      this.log.appendLine(`${LOG} Not written: the changed list would not read back (${prepared.reason}).`);
      return { ok: false, reason: 'invalid', refusal: prepared.reason, ...(prepared.entry !== undefined ? { entry: prepared.entry } : {}) };
    }
    const written = revisionOf(prepared.bytes);
    if (read.state === 'absent' ? prepared.list.files.length === 0 : written === read.revision) {
      return { ok: true, list: before, revision: read.revision };
    }
    const outcome = read.state === 'absent'
      ? await this.writeNew(filePath, prepared.bytes, permitted, lock)
      : await this.rewrite(filePath, read.bytes, prepared.bytes, permitted, lock);
    switch (outcome) {
      case 'committed':
        this.log.appendLine(`${LOG} Saved the list (${prepared.list.files.length} files).`);
        return { ok: true, list: prepared.list, revision: written };
      case 'again':
        return 'again';
      case 'withdrawn':
        this.log.appendLine(`${LOG} Not written: the workspace changed before the write committed.`);
        return { ok: false, reason: 'unavailable' };
      case 'lost':
        this.log.appendLine(`${LOG} Not written: the lock was taken over before the write committed.`);
        // A stale writer never reports ok: its staged list went with its lock (PR #204 F-01).
        return { ok: false, reason: 'busy' };
      case 'busy':
      case 'io':
        return { ok: false, reason: outcome };
    }
  }

  /** Settle every write owed, and any started while it waits (deactivation, PR #183 F-03). */
  async shutDown(): Promise<void> {
    while (this.owed.size > 0) {
      await Promise.allSettled([...this.owed]);
    }
  }

  /** The list's file now, or undefined when no one folder keeps it. */
  private currentFile(): string | undefined {
    const where = this.availability();
    return where.available ? where.filePath : undefined;
  }

  /** The list's file a write was asked for, captured at the call; undefined when none, or one outside its folder. */
  private askedFile(): string | undefined {
    const where = this.availability();
    if (!where.available) {
      return undefined;
    }
    return isPathWithinRoot(where.rootPath, where.filePath) ? where.filePath : undefined;
  }

  /** The list at `filePath`, decoded, with its claims settled first, and the bytes it was read from. */
  private async readState(filePath: string): Promise<StoreRead> {
    const file = await this.readFile(filePath);
    switch (file.state) {
      case 'absent':
        return { state: 'absent', revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION };
      case 'busy':
      case 'io':
        return { state: file.state };
      case 'too-large':
        // No bytes were read, so no hash: a revision from its size and time, never a SHA-256's hex. It is never written anyway.
        return { state: 'unreadable', reason: 'too-large', revision: `too-large-${file.size}-${file.mtime}` };
      case 'present': {
        const revision = revisionOf(file.bytes);
        const decoded = decodeWorkshopPinnedContext(file.bytes, this.platform);
        if (!decoded.ok) {
          return { state: 'unreadable', reason: decoded.reason, ...(decoded.entry !== undefined ? { entry: decoded.entry } : {}), revision };
        }
        return { state: 'ok', list: decoded.list, revision, bytes: file.bytes };
      }
    }
  }

  /**
   * The file's bytes once its claims are settled (a list left mid-rewrite
   * goes back; a leftover beside it goes), or what it is when they cannot
   * be read. A file that moves between the settling and the read is looked
   * at again.
   */
  private async readFile(filePath: string): Promise<FileRead> {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const state = await this.claims.settle(filePath);
      if (state === 'absent') {
        return { state: 'absent' };
      }
      if (state === 'busy') {
        return { state: 'busy' };
      }
      if (state === 'unknown') {
        this.log.appendLine(`${LOG} The list's folder could not be read.`);
        return { state: 'io' };
      }
      try {
        const stat = await this.fileSystem.stat(filePath);
        if (stat.size > WORKSHOP_PINNED_CONTEXT_FILE_BYTES) {
          this.log.appendLine(`${LOG} The list is over the size bound; it was not read.`);
          return { state: 'too-large', size: stat.size, mtime: stat.mtime };
        }
        return { state: 'present', bytes: await this.fileSystem.readFile(filePath) };
      } catch (error) {
        if (!isMissingFileSystemPathError(error)) {
          this.log.appendLine(`${LOG} The list could not be read: ${fileSystemErrorCategory(error)}`);
          return { state: 'io' };
        }
        // Claimed by another window between the settling and the read: look again.
      }
    }
    this.log.appendLine(`${LOG} The list kept moving while it was read.`);
    return { state: 'busy' };
  }

  /** The first write: staged inside the lock (the fence), then renamed into place, never over anything. */
  private async writeNew(
    filePath: string,
    bytes: Uint8Array,
    permitted: () => boolean,
    lock: WorkshopPinnedContextHeldLock
  ): Promise<'committed' | 'again' | 'withdrawn' | 'lost' | 'io'> {
    const temporaryPath = lock.stagingPath(`.${FILE_NAME}.tmp-${this.mintStagingId()}`);
    try {
      await this.fileSystem.writeFile(temporaryPath, bytes);
    } catch (error) {
      this.log.appendLine(`${LOG} Could not stage the list: ${fileSystemErrorCategory(error)}`);
      await deleteStoredFileQuietly(this.fileSystem, temporaryPath);
      return 'io';
    }
    if (!(await lock.stillHeld())) {
      await deleteStoredFileQuietly(this.fileSystem, temporaryPath);
      return 'lost';
    }
    // The commit point: nothing is awaited between it and the rename that commits.
    if (!permitted()) {
      await deleteStoredFileQuietly(this.fileSystem, temporaryPath);
      return 'withdrawn';
    }
    try {
      await this.fileSystem.rename(temporaryPath, filePath, { overwrite: false });
      return 'committed';
    } catch (error) {
      // A source that vanished with a takeover: this write was fenced off.
      if (!(await lock.stillHeld())) {
        return 'lost';
      }
      const taken = await storedFileExists(this.fileSystem, filePath);
      await deleteStoredFileQuietly(this.fileSystem, temporaryPath);
      if (taken) {
        // Another window saved a list first: read it, and let its revision decide.
        return 'again';
      }
      this.log.appendLine(`${LOG} Could not save the list: ${fileSystemErrorCategory(error)}`);
      return 'io';
    }
  }

  /** A later write: a claimed rewrite in place, of exactly the bytes that were read. */
  private async rewrite(
    filePath: string,
    read: Uint8Array,
    written: Uint8Array,
    permitted: () => boolean,
    lock: WorkshopPinnedContextHeldLock
  ): Promise<'committed' | 'again' | 'withdrawn' | 'lost' | 'busy' | 'io'> {
    const folder = path.dirname(filePath);
    let lost = false;
    const outcome = await commitStoredFileRewrite(this.rewritePorts, {
      filePath,
      stagingPath: lock.stagingPath(`.${FILE_NAME}.tmp-${this.mintStagingId()}`),
      label: 'the list',
      read,
      written,
      confirm: async () => {
        lost = !(await lock.stillHeld());
        return !lost;
      },
      beforeCommit: permitted,
      onCommitted: () => undefined,
      // A claim given back when a new list took the saved name meanwhile: kept beside it, never over it.
      fallbackPath: async () => path.join(folder, this.setAsideName())
    });
    switch (outcome.kind) {
      case 'committed':
        return 'committed';
      case 'again':
        return 'again';
      case 'gone':
        // Claimed, deleted or put back by another window meanwhile: read it again, and let its revision decide.
        return outcome.state === 'busy' ? 'busy' : outcome.state === 'unknown' ? 'io' : 'again';
      case 'withdrawn':
        return lost ? 'lost' : 'withdrawn';
      case 'failed':
        // A source that vanished with a takeover: this write was fenced off.
        return (await lock.stillHeld()) ? 'io' : 'lost';
    }
  }

  /** A free ordinary name in the list's folder for bytes set aside: never a claim, so never settled again. */
  private setAsideName(): string {
    return `${FILE_NAME}.set-aside-${this.mintStagingId()}`;
  }

  private owe<T>(write: Promise<T>): Promise<T> {
    this.owed.add(write);
    const settle = () => {
      this.owed.delete(write);
    };
    write.then(settle, settle);
    return write;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

/** A list's revision: the SHA-256 of its file's bytes, in hex. */
export function workshopPinnedContextRevisionOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const revisionOf = workshopPinnedContextRevisionOf;

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

/** A store read as a caller sees it: without the bytes. */
function publicRead(read: StoreRead): WorkshopPinnedContextRead {
  return read.state === 'ok' ? { state: 'ok', list: read.list, revision: read.revision } : read;
}
