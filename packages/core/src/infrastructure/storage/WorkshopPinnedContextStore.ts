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
 * - **One queue, the board store's write discipline,** through the shared
 *   claimed-file primitive:
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
 *     first, so a list left mid-rewrite goes back and a leftover goes;
 *   - a file that does not read is never written (`unreadable`).
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
import { fileSystemErrorCategory, isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';

const LOG = '[WorkshopPinnedContextStore]';
const FILE_NAME = 'pinned-context.json';
/** A claim of the list's file: `.pinned-context.json.claim-<epoch ms>-<id>`. */
const CLAIM = /^\.(pinned-context\.json)\.claim-(\d{13})-[A-Za-z0-9-]+$/;
/** A read that finds the file moving under it (put back, or claimed and committed) looks again, this many times at most. */
const ATTEMPTS = 3;

/** The revision of a list with no file yet. Never a SHA-256's hex, so never a file's. */
export const WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION = 'absent';

export type WorkshopPinnedContextUnavailableReason = 'no-workspace' | 'multi-root';

/** Where the list is kept now, read live: the workspace's one folder, or nowhere. */
export type WorkshopPinnedContextAvailability =
  | { available: true; rootPath: string; filePath: string; displayPath: string }
  | { available: false; reason: WorkshopPinnedContextUnavailableReason };

export type WorkshopPinnedContextRead =
  /** No file yet: the list is empty, at the fixed absent revision. */
  | { state: 'absent'; revision: string }
  | { state: 'ok'; list: WorkshopPinnedContextList; revision: string }
  /** The file does not read as format 1; it is never written. */
  | { state: 'unreadable'; reason: WorkshopPinnedContextRefusal; entry?: number; revision: string }
  | { state: 'unavailable'; reason: WorkshopPinnedContextUnavailableReason }
  /** Another window holds the file under a live claim now. */
  | { state: 'busy' }
  /** The folder or the file could not be read; never taken for absent. */
  | { state: 'io' };

/** The list as it reads at the write's turn, changed; the store checks it reads back before writing. */
export type WorkshopPinnedContextChange = (list: WorkshopPinnedContextList) => WorkshopPinnedContextList;

export type WorkshopPinnedContextUpdateResult =
  | { ok: true; list: WorkshopPinnedContextList; revision: string }
  /** The file is not at the revision the caller read; nothing was written. `current` is how it reads now. */
  | { ok: false; reason: 'changed'; current: WorkshopPinnedContextRead }
  /** The changed list would not read back as format 1; nothing was written. */
  | { ok: false; reason: 'invalid'; refusal: WorkshopPinnedContextRefusal; entry?: number }
  | { ok: false; reason: 'unreadable' | 'unavailable' | 'busy' | 'io' };

export interface WorkshopPinnedContextUpdateOptions {
  /**
   * The caller's commit point (the library's accepted-workspace check):
   * asked at the write's turn and synchronously immediately before the
   * rename that commits. `false` withdraws the write as `unavailable`.
   */
  beforeCommit?: () => boolean;
}

export interface WorkshopPinnedContextStoreOptions {
  /** How paths compare: the host's platform by default. */
  platform?: WorkshopPinnedContextPathPlatform;
  /** The private part of a staged file's or a claim's name; a random UUID by default. */
  mintStagingId?: () => string;
  /** The clock claims are timed by. */
  claimNow?: () => Date;
}

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
      formatError: fileSystemErrorCategory
    });
    this.rewritePorts = { fileSystem, claims: this.claims, log, logPrefix: LOG, noun: 'pinned-context list', mintStagingId: this.mintStagingId };
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
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const result = await this.attemptUpdate(asked, revision, change, permitted);
        if (result !== 'again') {
          return result;
        }
      }
      this.log.appendLine(`${LOG} Not written: the file kept moving under the write.`);
      return { ok: false, reason: 'busy' };
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
    permitted: () => boolean
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
      ? await this.writeNew(filePath, prepared.bytes, permitted)
      : await this.rewrite(filePath, read.bytes, prepared.bytes, permitted);
    switch (outcome) {
      case 'committed':
        this.log.appendLine(`${LOG} Saved the list (${prepared.list.files.length} files).`);
        return { ok: true, list: prepared.list, revision: written };
      case 'again':
        return 'again';
      case 'withdrawn':
        this.log.appendLine(`${LOG} Not written: the workspace changed before the write committed.`);
        return { ok: false, reason: 'unavailable' };
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
  private async writeNew(filePath: string, bytes: Uint8Array, permitted: () => boolean): Promise<'committed' | 'again' | 'withdrawn' | 'io'> {
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
    permitted: () => boolean
  ): Promise<'committed' | 'again' | 'withdrawn' | 'busy' | 'io'> {
    const folder = path.dirname(filePath);
    const outcome = await commitStoredFileRewrite(this.rewritePorts, {
      filePath,
      label: 'the list',
      read,
      written,
      beforeCommit: permitted,
      onCommitted: () => undefined,
      // A claim given back when a new list took the saved name meanwhile: kept beside it, never over it.
      fallbackPath: async () => path.join(folder, `${FILE_NAME}.set-aside-${this.mintStagingId()}`)
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
        return 'withdrawn';
      case 'failed':
        return 'io';
    }
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

/** A store read as a caller sees it: without the bytes. */
function publicRead(read: StoreRead): WorkshopPinnedContextRead {
  return read.state === 'ok' ? { state: 'ok', list: read.list, revision: read.revision } : read;
}
