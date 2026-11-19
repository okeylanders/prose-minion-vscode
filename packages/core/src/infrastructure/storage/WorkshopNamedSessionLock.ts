/**
 * Every write that replaces or removes a named Workshop session holds the
 * session file's lock (ADR 2026-11-19 D6a, D6b, D6d, D6e; PR #286 reviews).
 *
 * - **The lock** is `.<name>.lock/` beside the session file. It holds the
 *   owner file `owner-<token>.json` (`{ token, at }`) and the owner's own
 *   folder `<token>/`, where its staged `next.json` and its `prior.json`
 *   live. It is taken by renaming a staged directory to that name, never
 *   over anything: of two windows, one takes it and the other is refused.
 * - **No writer moves or deletes another writer's lock** (D6e). A lock
 *   within its lease is busy (`WorkshopNamedSessionBusyError`); one past it
 *   (its owner's `at` older than `STORED_FILE_CLAIM_LEASE_MS`, or no owner
 *   file and the directory older) is recovery-required
 *   (`WorkshopNamedSessionRecoveryRequiredError`). Nothing is taken over:
 *   recovery is the writer's, explicit (`WorkshopNamedSessionRecovery`).
 * - **Claim and publish are renames into and out of the owner's folder,**
 *   never over anything; renames never create a missing parent (D6d).
 * - **Release is the owner's alone,** three steps none of which can touch
 *   another owner's lock: detach `<token>/` to `.<name>.retired-<id>` and
 *   delete that; delete `owner-<token>.json`; delete the lock directory
 *   non-recursively, which fails while it holds anything.
 * - **"Missing" is decided only under the lock** (`decideMissing`): a
 *   reader that found no file takes the lock of every name its session may
 *   be under and reads again; a held lock answers busy, a stale one
 *   recovery-required, never missing.
 * - **Logs** never name a session file: its name carries a title slug.
 */

import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { FileType, type FileSystem, type LogSink } from '@/platform';
import { STORED_FILE_CLAIM_LEASE_MS } from '@/infrastructure/storage/StoredFileClaims';
import { assertPersistedJsonNestingDepth } from '@/application/services/workshop/persistedJson';
import type { WorkshopPersistedSessionCheckpointDecodeResult, WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';

const LOG = '[WorkshopNamedSessionLock]';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
/** Lost races, and new locks found while deciding missing, tried before a window answers busy. */
const ATTEMPTS = 3;
/** A lock beside a session file. Group 1 is the saved name. */
const LOCK = /^\.([^/\\]+\.json)\.lock$/;
/** An owner file inside a lock. Group 1 is the token. */
const OWNER = /^owner-([A-Za-z0-9-]+)\.json$/;

/** The host's words for a write refused because another window holds the file (D6a). */
export const WORKSHOP_NAMED_SESSION_BUSY_WORDS = 'This saved session is being written by another window. Try again in a moment.';
/** The host's words for a lock left past its lease (D6e). */
export const WORKSHOP_NAMED_SESSION_RECOVERY_REQUIRED_WORDS =
  'This saved session was left mid-save, probably by a window that closed. Recover it to use it again.';

export class WorkshopNamedSessionBusyError extends Error {
  constructor() {
    super(WORKSHOP_NAMED_SESSION_BUSY_WORDS);
    this.name = 'WorkshopNamedSessionBusyError';
  }
}

export class WorkshopNamedSessionRecoveryRequiredError extends Error {
  constructor(readonly sessionId: string) {
    super(WORKSHOP_NAMED_SESSION_RECOVERY_REQUIRED_WORDS);
    this.name = 'WorkshopNamedSessionRecoveryRequiredError';
  }
}

/** The session a recovery-required refusal names, for the notice's Recover… (D6e). */
export function workshopRecoveryRequiredSessionId(error: unknown): string | undefined {
  return error instanceof WorkshopNamedSessionRecoveryRequiredError && error.sessionId ? error.sessionId : undefined;
}

/** The store's errors, handed in so this module never imports the store. */
export interface WorkshopNamedSessionLockErrors {
  changed(): Error;
  missing(sessionId: string): Error;
}

/** Test seams: steps the witnesses pause at. */
export interface WorkshopNamedSessionLockHooks {
  readonly beforePublish?: () => Promise<void>;
  readonly beforeRelease?: () => Promise<void>;
}

export type WorkshopNamedSessionLockState = 'busy' | 'recovery-required';

/** A copy an owner left in its folder: its path and, when it reads as JSON within bounds, its session id. */
export interface WorkshopNamedSessionLockCopy {
  readonly token: string;
  readonly kind: 'prior' | 'next';
  readonly path: string;
  readonly sessionId?: string;
}

/** A lock found beside a session file, as it stands. */
export interface WorkshopNamedSessionLockRow {
  readonly fileName: string;
  readonly filePath: string;
  readonly lock: string;
  readonly state: WorkshopNamedSessionLockState;
  readonly tokens: readonly string[];
  readonly ownerFiles: readonly string[];
  readonly copies: readonly WorkshopNamedSessionLockCopy[];
}

/** A lock this write holds. */
interface Held {
  readonly lock: string;
  readonly token: string;
  /** The owner's own folder: `.<name>.lock/<token>/`. */
  readonly own: string;
}

export class WorkshopNamedSessionLock {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly log: LogSink,
    private readonly now: () => Date,
    private readonly maximumBytes: number,
    private readonly errors: WorkshopNamedSessionLockErrors,
    private readonly hooks: WorkshopNamedSessionLockHooks = {}
  ) {}

  /** Replace the named file with `session`, only while it still equals `expected`, under its lock. */
  async replace(target: {
    sessionId: string;
    filePath: string;
    readExact: () => Promise<WorkshopPersistedSessionCheckpointDecodeResult | undefined>;
    session: WorkshopPersistedSessionV2;
    expected: WorkshopPersistedSessionV2;
  }): Promise<void> {
    const written = this.encode(target.session, 'Workshop session');
    await this.holding(target.filePath, target.sessionId, async (held) => {
      const staged = path.join(held.own, 'next.json');
      await this.fileSystem.writeFile(staged, written);
      const latest = await target.readExact();
      if (!latest) {
        throw this.errors.missing(target.sessionId);
      }
      if (!hasSameWorkshopCheckpoint(latest.session, target.expected)) {
        throw this.errors.changed();
      }
      await this.claim(held, target.filePath, target.sessionId);
      await this.hooks.beforePublish?.();
      await this.fileSystem.rename(staged, target.filePath, { overwrite: false }).catch(async (error: unknown) => {
        await this.fileSystem.rename(path.join(held.own, 'prior.json'), target.filePath, { overwrite: false }).catch(() => undefined);
        throw error instanceof Error ? error : new Error('The saved Workshop session could not be written.');
      });
    });
  }

  /** Delete the named file under its lock: the claimed file goes with the owner's folder at release. */
  async remove(filePath: string, sessionId: string): Promise<void> {
    await this.holding(filePath, sessionId, (held) => this.claim(held, filePath, sessionId));
  }

  /**
   * A reader found no file for `sessionId` (D6e): under the lock of every
   * name the session may be under (a lock holding its copy, or one whose
   * copy cannot be read, and the name the reader knew), read again. A held
   * lock answers busy and a stale one recovery-required, by throwing.
   * Returns what a read found, or undefined: missing.
   */
  async decideMissing<T>(folder: string, sessionId: string, knownFileName: string | undefined, reread: () => Promise<T | undefined>): Promise<T | undefined> {
    const checked = new Set<string>();
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const names = await this.namesOf(folder, sessionId, checked);
      if (knownFileName && !checked.has(knownFileName)) {
        names.add(knownFileName);
      }
      if (names.size === 0) {
        // No lock to take: read again, then make sure no lock of this session came meanwhile.
        const again = await reread();
        if (again !== undefined || (await this.namesOf(folder, sessionId, checked)).size === 0) {
          return again;
        }
        continue;
      }
      for (const name of names) {
        checked.add(name);
        const found = await this.holding(path.join(folder, name), sessionId, () => reread());
        if (found !== undefined) {
          return found;
        }
      }
    }
    this.log.appendLine(`${LOG} Locks kept appearing while deciding a session was missing; answering busy.`);
    throw new WorkshopNamedSessionBusyError();
  }

  /** Every lock in the folder, with its state and the copies its owners left. */
  async rowsIn(folder: string): Promise<WorkshopNamedSessionLockRow[]> {
    const entries = await this.fileSystem.readDirectory(folder).catch((): Array<[string, FileType]> => []);
    const rows: WorkshopNamedSessionLockRow[] = [];
    for (const [name, type] of entries) {
      const fileName = type === FileType.Directory ? LOCK.exec(name)?.[1] : undefined;
      if (fileName) {
        const row = await this.rowOf(path.join(folder, name), path.join(folder, fileName), fileName);
        if (row) {
          rows.push(row);
        }
      }
    }
    return rows;
  }

  /**
   * Remove a stale lock after recovery landed (D6e): each owner folder
   * detached and deleted, each owner file deleted, then the directory,
   * non-recursively. Throws on the first step that fails.
   */
  async removeRecovered(row: WorkshopNamedSessionLockRow): Promise<void> {
    for (const token of row.tokens) {
      const own = path.join(row.lock, token);
      const retired = this.retiredPath(row.filePath);
      try {
        await this.fileSystem.rename(own, retired, { overwrite: false });
      } catch (error) {
        if (await this.exists(own)) {
          throw error;
        }
        continue; // Emptied by the restore and gone with it: nothing to detach.
      }
      await this.fileSystem.delete(retired, { recursive: true });
    }
    for (const owner of row.ownerFiles) {
      await this.fileSystem.delete(path.join(row.lock, owner));
    }
    await this.fileSystem.delete(row.lock, { recursive: false }).catch(async (error: unknown) => {
      if (await this.exists(row.lock)) {
        throw error;
      }
    });
    this.log.appendLine(`${LOG} Removed a recovered lock (owners=${row.tokens.length}).`);
  }

  /** A persisted value's bytes, refused past the store's bound. */
  encode(value: unknown, description: string, maximumBytes = this.maximumBytes): Uint8Array {
    const text = JSON.stringify(value, undefined, 2);
    assertPersistedJsonNestingDepth(text, description);
    const bytes = encoder.encode(text);
    if (bytes.byteLength > maximumBytes) {
      const guidance = description === 'Workshop session'
        ? ' Start a new Workshop session or remove retained context; the existing checkpoint remains unchanged.'
        : '';
      throw new Error(`${description} exceeds the maximum persisted size of ${formatByteLimit(maximumBytes)}.${guidance}`);
    }
    return bytes;
  }

  /** Run `work` holding the file's lock; release however it ends. */
  private async holding<T>(filePath: string, sessionId: string, work: (held: Held) => Promise<T>): Promise<T> {
    const held = await this.acquire(filePath, sessionId);
    try {
      return await work(held);
    } finally {
      await this.hooks.beforeRelease?.();
      await this.release(held, filePath);
    }
  }

  /** Move the saved file into the owner's folder as `prior.json`, never over anything; missing when it is not there. */
  private async claim(held: Held, filePath: string, sessionId: string): Promise<void> {
    await this.fileSystem.rename(filePath, path.join(held.own, 'prior.json'), { overwrite: false }).catch(() => {
      throw this.errors.missing(sessionId);
    });
    if (!(await this.stillHeld(held))) {
      throw new WorkshopNamedSessionBusyError();
    }
  }

  private async acquire(filePath: string, sessionId: string): Promise<Held> {
    const lock = lockPathOf(filePath);
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const token = randomUUID();
      const staged = `${lock}.staged-${token}`;
      try {
        await this.fileSystem.createDirectory(path.join(staged, token));
        await this.fileSystem.writeFile(path.join(staged, `owner-${token}.json`), encoder.encode(JSON.stringify({ token, at: this.now().getTime() })));
      } catch {
        await this.removeQuietly(staged);
        throw new Error('The saved Workshop session could not be locked for writing.');
      }
      try {
        await this.fileSystem.rename(staged, lock, { overwrite: false });
        return { lock, token, own: path.join(lock, token) };
      } catch {
        await this.removeQuietly(staged);
      }
      const state = await this.stateOf(lock);
      if (state === 'recovery-required') {
        throw new WorkshopNamedSessionRecoveryRequiredError(sessionId);
      }
      if (state === 'busy') {
        throw new WorkshopNamedSessionBusyError();
      }
      // The lock was released between the rename and the look: try again.
    }
    this.log.appendLine(`${LOG} The lock kept changing hands; this write is busy.`);
    throw new WorkshopNamedSessionBusyError();
  }

  /** The owner's three steps (D6e); each acts only on paths this owner alone has, so none can touch a successor's lock. */
  private async release(held: Held, filePath: string): Promise<void> {
    const retired = this.retiredPath(filePath);
    if (await this.fileSystem.rename(held.own, retired, { overwrite: false }).then(() => true, () => false)) {
      await this.removeQuietly(retired);
    }
    await this.fileSystem.delete(path.join(held.lock, `owner-${held.token}.json`)).catch(() => undefined);
    await this.fileSystem.delete(held.lock, { recursive: false }).catch(() => undefined);
  }

  private async stillHeld(held: Held): Promise<boolean> {
    const owner = await this.readJson(path.join(held.lock, `owner-${held.token}.json`));
    return owner.kind === 'json' && (owner.value as { token?: unknown }).token === held.token;
  }

  /** Lock names, beyond `checked`, whose copies are this session's or cannot be read. */
  private async namesOf(folder: string, sessionId: string, checked: ReadonlySet<string>): Promise<Set<string>> {
    const rows = await this.rowsIn(folder);
    return new Set(rows
      .filter((row) => !checked.has(row.fileName) && row.copies.some((copy) => copy.sessionId === undefined || copy.sessionId === sessionId))
      .map((row) => row.fileName));
  }

  private async rowOf(lock: string, filePath: string, fileName: string): Promise<WorkshopNamedSessionLockRow | undefined> {
    const listed = await this.fileSystem.readDirectory(lock).catch(() => undefined);
    if (!listed) {
      return undefined;
    }
    const tokens = listed.filter(([, type]) => type === FileType.Directory).map(([name]) => name);
    const ownerFiles = listed.filter(([name, type]) => type === FileType.File && OWNER.test(name)).map(([name]) => name);
    const copies: WorkshopNamedSessionLockCopy[] = [];
    for (const token of tokens) {
      for (const kind of ['prior', 'next'] as const) {
        const copyPath = path.join(lock, token, `${kind}.json`);
        const read = await this.readJson(copyPath, this.maximumBytes);
        if (read.kind !== 'none') {
          const sessionId = read.kind === 'json' ? (read.value as { sessionId?: unknown }).sessionId : undefined;
          copies.push({ token, kind, path: copyPath, ...(typeof sessionId === 'string' ? { sessionId } : {}) });
        }
      }
    }
    return { fileName, filePath, lock, state: await this.stateFrom(lock, ownerFiles), tokens, ownerFiles, copies };
  }

  /** A lock's standing; none when it is not there. */
  private async stateOf(lock: string): Promise<WorkshopNamedSessionLockState | 'none'> {
    const listed = await this.fileSystem.readDirectory(lock).catch(() => undefined);
    if (!listed) {
      return 'none';
    }
    return this.stateFrom(lock, listed.filter(([name, type]) => type === FileType.File && OWNER.test(name)).map(([name]) => name));
  }

  /** Busy while any owner is within its lease; with no owner file, by the directory's own age (busy when it cannot be read). */
  private async stateFrom(lock: string, ownerFiles: readonly string[]): Promise<WorkshopNamedSessionLockState> {
    const now = this.now().getTime();
    const times: Array<number | undefined> = [];
    for (const owner of ownerFiles) {
      const read = await this.readJson(path.join(lock, owner));
      const at = read.kind === 'json' ? (read.value as { at?: unknown }).at : undefined;
      times.push(typeof at === 'number' && Number.isFinite(at) ? at : read.kind === 'none' ? undefined : read.mtime);
    }
    if (ownerFiles.length === 0) {
      times.push(await this.fileSystem.stat(lock).then((stat) => stat.mtime, () => undefined));
    }
    return times.some((time) => time === undefined || Math.abs(now - time) < STORED_FILE_CLAIM_LEASE_MS) ? 'busy' : 'recovery-required';
  }

  private async readJson(filePath: string, maximumBytes = 64 * 1024): Promise<
    { kind: 'none' } | { kind: 'unreadable'; mtime: number } | { kind: 'json'; value: unknown; mtime: number }
  > {
    let stat: { mtime: number; size: number };
    try {
      stat = await this.fileSystem.stat(filePath);
    } catch {
      return { kind: 'none' };
    }
    if (stat.size > maximumBytes) {
      return { kind: 'unreadable', mtime: stat.mtime };
    }
    try {
      const value: unknown = JSON.parse(decoder.decode(await this.fileSystem.readFile(filePath)));
      return typeof value === 'object' && value !== null ? { kind: 'json', value, mtime: stat.mtime } : { kind: 'unreadable', mtime: stat.mtime };
    } catch {
      return { kind: 'unreadable', mtime: stat.mtime };
    }
  }

  private async exists(target: string): Promise<boolean> {
    if (await this.fileSystem.stat(target).then(() => true, () => false)) {
      return true;
    }
    return this.fileSystem.readDirectory(target).then(() => true, () => false);
  }

  private retiredPath(filePath: string): string {
    return `${path.dirname(filePath)}${path.sep}.${path.basename(filePath)}.retired-${randomUUID()}`;
  }

  private async removeQuietly(directory: string): Promise<void> {
    await this.fileSystem.delete(directory, { recursive: true }).catch(() => undefined);
  }
}

/** A session file's lock: `.<name>.lock` beside it. */
function lockPathOf(target: string): string {
  return path.join(path.dirname(target), `.${path.basename(target)}.lock`);
}

/** A byte bound in words: whole MiB, or bytes. */
export function formatByteLimit(bytes: number): string {
  const mebibyte = 1024 * 1024;
  return bytes % mebibyte === 0
    ? `${bytes / mebibyte} MiB`
    : `${bytes.toLocaleString('en-US')} bytes`;
}
