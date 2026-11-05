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
 * - **Bounded reads.** The file is `stat`ed before it is read: one over
 *   `WORKSHOP_PINNED_CONTEXT_FILE_BYTES` is unreadable (`too-large`) without
 *   its bytes being read, and never written. The codec checks the bound
 *   again, since a file can grow between the `stat` and the read.
 * - **One queue, one lock, the board store's write discipline,** through
 *   the shared claimed-file primitive:
 *   - every `update` holds the list's lock (`WorkshopPinnedContextLock`,
 *     PR #204 F-01) from before it reads at its turn until after it
 *     commits; a window that cannot take it is `busy`;
 *   - every `update` names the revision its caller read. At its turn the
 *     file is read again; another revision refuses the write (`changed`,
 *     with the list as it reads now), and nothing is written;
 *   - the first write is staged under a private random name, then renamed
 *     into place, never over anything: a file that appeared meanwhile
 *     answers `changed`;
 *   - every later write is a claimed rewrite in place
 *     (`commitStoredFileRewrite`): the bytes read are the bytes claimed, or
 *     the write is refused as `changed`;
 *   - claims follow `StoredFileClaims`' lease rules: a read settles them
 *     first, so a list left mid-rewrite goes back;
 *   - **an abandoned claim beside a standing list is removed only when it
 *     holds exactly the standing bytes** (PR #204 F-02). The format records
 *     no ancestry, so no other claim can be shown to be an earlier version a
 *     committed write replaced: it may be bytes a refused rewrite could not
 *     put back. Those are set aside under a free ordinary name
 *     (`pinned-context.json.set-aside-<id>`), never deleted;
 *   - a file that does not read is never written (`unreadable`).
 * - **Why no write is lost (the race argument).** Writers are this store's
 *   windows, which take the lock, and the writer's editor, which does not.
 *   - *Create vs create:* only the lock's holder reads and writes; a window
 *     that waited for it reads the list at its turn, finds a revision other
 *     than absent, and is `changed`. Should two ever overlap (below), the
 *     create's no-overwrite rename lets one win and reads the other as
 *     `changed`.
 *   - *Create vs claimed rewrite* (F-01): the saved name stands empty only
 *     under a rewrite's claim, which only the lock's holder takes; a create
 *     cannot hold the lock then, so it is `busy` and never renames into it.
 *   - *Rewrite vs rewrite:* the lock serializes them; underneath, a claim is
 *     taken by a no-overwrite rename and its bytes must be the bytes read,
 *     so a rewrite that overlapped anyway claims nothing, or finds the file
 *     changed and puts it back.
 *   - *A lease that expires mid-write:* a holder stalled past the lease
 *     loses its lock to a takeover. It reads its token again immediately
 *     before its commit rename (a create's, and a rewrite's, after its claim
 *     is confirmed) and withdraws as `busy`. The one window left is a stall
 *     past the lease that falls between that check and the rename; then the
 *     claim and no-overwrite rules above still keep either write from
 *     landing over the other's file.
 *   - *A hand edit, at each step:* before the read, it is what is read;
 *     between the read and a create's commit, the no-overwrite rename fails
 *     and the create is `changed`; between the read and a claim, the claimed
 *     bytes differ, go back, and the write is `changed`; while the claim
 *     holds the list, the commit's no-overwrite rename fails, the edit
 *     stands, and the claimed bytes go to a set-aside name (`io`); after the
 *     commit, it simply wins. No step writes over a file it did not read.
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
import { WorkshopPinnedContextLock } from '@/infrastructure/storage/WorkshopPinnedContextLock';
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
          const result = await this.attemptUpdate(asked, revision, change, permitted, () => lock.stillHeld());
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
    held: () => Promise<boolean>
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
      ? await this.writeNew(filePath, prepared.bytes, permitted, held)
      : await this.rewrite(filePath, read.bytes, prepared.bytes, permitted, held);
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

  /** The first write: staged privately, then renamed into place, never over anything. */
  private async writeNew(
    filePath: string,
    bytes: Uint8Array,
    permitted: () => boolean,
    held: () => Promise<boolean>
  ): Promise<'committed' | 'again' | 'withdrawn' | 'lost' | 'io'> {
    const folder = path.dirname(filePath);
    const temporaryPath = path.join(folder, `.${FILE_NAME}.tmp-${this.mintStagingId()}`);
    try {
      await this.fileSystem.createDirectory(folder);
      await this.fileSystem.writeFile(temporaryPath, bytes);
    } catch (error) {
      this.log.appendLine(`${LOG} Could not stage the list: ${fileSystemErrorCategory(error)}`);
      await deleteStoredFileQuietly(this.fileSystem, temporaryPath);
      return 'io';
    }
    if (!(await held())) {
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
    held: () => Promise<boolean>
  ): Promise<'committed' | 'again' | 'withdrawn' | 'lost' | 'busy' | 'io'> {
    const folder = path.dirname(filePath);
    let lost = false;
    const outcome = await commitStoredFileRewrite(this.rewritePorts, {
      filePath,
      label: 'the list',
      read,
      written,
      confirm: async () => {
        lost = !(await held());
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
        return 'io';
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
