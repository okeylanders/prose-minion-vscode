/**
 * Every write that replaces or removes a named Workshop session holds the
 * session file's lock (ADR 2026-11-19 D6a, D6b, D6d; PR #286 re-reviews).
 *
 * - **The lock** is `.<name>.lock/` beside the session file, `owner.json`
 *   (`{ token, at }`) at its top. It is taken by renaming a staged
 *   directory to that name, never over anything: of two windows, one takes
 *   it and the other is busy (`WorkshopNamedSessionBusyError`).
 * - **One subdirectory per owner** (D6d): everything an owner writes lives
 *   under `.<name>.lock/<token>/`, its staged `next.json` and its
 *   `prior.json`. A successor's token differs, so a retired owner's paths
 *   never alias the successor's.
 * - **Claim, publish and cleanup are renames from or into the owner's own
 *   subdirectory.** Once a takeover moved the lock away, each finds no
 *   source or no destination directory and fails: a stalled writer cannot
 *   publish, and cannot touch its successor's rollback copy.
 * - **Destructive steps act only on what was first detached:** cleanup
 *   renames the owner's subdirectory to `.<name>.retired-<id>` and deletes
 *   that; release renames the lock aside, checks `owner.json` is this
 *   token's, and deletes it, else puts it back.
 * - **A takeover is itself the recovery marker** (D6d): an abandoned lock
 *   (owner older than the lease, or unreadable) is renamed, never over
 *   anything, to `.<name>.recovering-<id>/`; `recovery.json` (`{ at, token }`)
 *   is written into it; the retired owner's `prior.json` goes back to the
 *   saved name only if that name is empty; then the directory is deleted.
 *   There is no moment with neither the file, the lock nor a marker.
 * - **Readers** return busy while a lock or a recovering directory stands
 *   live, and finish an abandoned one under the same lease rule; a session
 *   is missing only when the file, the lock and every marker are absent.
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
/** Takeovers and lost races tried before a window answers busy. */
const ATTEMPTS = 3;
/** A lock or a recovery marker beside a session file. Group 1 is the saved name. */
const MARKER = /^\.([^/\\]+\.json)\.(?:lock|recovering-[A-Za-z0-9-]+)$/;

/** The host's words for a write refused because another window holds the file (D6a). */
export const WORKSHOP_NAMED_SESSION_BUSY_WORDS = 'This saved session is being written by another window. Try again in a moment.';

export class WorkshopNamedSessionBusyError extends Error {
  constructor() {
    super(WORKSHOP_NAMED_SESSION_BUSY_WORDS);
    this.name = 'WorkshopNamedSessionBusyError';
  }
}

/** The store's errors, handed in so this module never imports the store. */
export interface WorkshopNamedSessionLockErrors {
  changed(): Error;
  missing(sessionId: string): Error;
}

/** Test seams: steps the witnesses pause at. */
export interface WorkshopNamedSessionLockHooks {
  readonly beforePublish?: () => Promise<void>;
  readonly beforeCleanup?: () => Promise<void>;
  readonly beforeRestore?: () => Promise<void>;
}

/** A lock this write holds. */
interface Held {
  readonly lock: string;
  readonly token: string;
  /** The owner's own subdirectory: `.<name>.lock/<token>/`. */
  readonly own: string;
}

type Marker = { kind: 'none' } | { kind: 'io' } | { kind: 'live' } | { kind: 'abandoned'; token?: string; identity: string };

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
    await this.holding(target.filePath, async (held) => {
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
      // The fence is the placement: a takeover moved the lock, and the staged file with it, away.
      await this.fileSystem.rename(staged, target.filePath, { overwrite: false }).catch(async (error: unknown) => {
        await this.fileSystem.rename(path.join(held.own, 'prior.json'), target.filePath, { overwrite: false }).catch(() => undefined);
        throw error instanceof Error ? error : new Error('The saved Workshop session could not be written.');
      });
    });
  }

  /** Delete the named file under its lock: the file and the lock go together. */
  async remove(filePath: string, sessionId: string): Promise<void> {
    await this.holding(filePath, (held) => this.claim(held, filePath, sessionId));
  }

  /** A reader found no file: busy (throws) beside a live lock or marker; true when an abandoned one was finished (read again). */
  async settledWhenMissing(folder: string): Promise<boolean> {
    const entries = await this.fileSystem.readDirectory(folder).catch((): Array<[string, FileType]> => []);
    let settled = false;
    for (const [name, type] of entries) {
      const saved = type === FileType.Directory ? MARKER.exec(name)?.[1] : undefined;
      if (!saved) {
        continue;
      }
      const marker = path.join(folder, name);
      const state = await this.markerState(marker);
      if (state.kind === 'live' || state.kind === 'io') {
        throw new WorkshopNamedSessionBusyError();
      }
      if (state.kind === 'abandoned') {
        await (name.endsWith('.lock') ? this.takeOver(marker, path.join(folder, saved), state.identity) : this.finishRecovery(marker, path.join(folder, saved)));
        settled = true;
      }
    }
    return settled;
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

  /** Run `work` holding the file's lock; clean up and release however it ends. */
  private async holding(filePath: string, work: (held: Held) => Promise<void>): Promise<void> {
    const held = await this.acquire(filePath);
    try {
      await work(held);
    } finally {
      await this.hooks.beforeCleanup?.();
      await this.cleanUp(held, filePath);
      await this.release(held);
    }
  }

  /** Move the saved file into the owner's subdirectory as `prior.json`, never over anything; missing when it is not there. */
  private async claim(held: Held, filePath: string, sessionId: string): Promise<void> {
    await this.fileSystem.rename(filePath, path.join(held.own, 'prior.json'), { overwrite: false }).catch(() => {
      throw this.errors.missing(sessionId);
    });
    if (!(await this.stillHeld(held))) {
      throw new WorkshopNamedSessionBusyError();
    }
  }

  private async acquire(filePath: string): Promise<Held> {
    const folder = path.dirname(filePath);
    const lock = lockPathOf(filePath);
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      await this.settleMarkers(filePath);
      const token = randomUUID();
      const staged = `${lock}.staged-${token}`;
      try {
        await this.fileSystem.createDirectory(path.join(staged, token));
        await this.fileSystem.writeFile(path.join(staged, 'owner.json'), encoder.encode(JSON.stringify({ token, at: this.now().getTime() })));
        await this.fileSystem.writeFile(path.join(staged, token, '.owner'), encoder.encode(token));
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
      const state = await this.markerState(lock);
      if (state.kind === 'live' || state.kind === 'io') {
        throw new WorkshopNamedSessionBusyError();
      }
      if (state.kind === 'abandoned') {
        await this.takeOver(lock, path.join(folder, path.basename(filePath)), state.identity);
      }
    }
    this.log.appendLine(`${LOG} The lock kept changing hands; this write is busy.`);
    throw new WorkshopNamedSessionBusyError();
  }

  /** Finish abandoned locks and markers of this file before taking its lock; busy beside a live one. */
  private async settleMarkers(filePath: string): Promise<void> {
    const folder = path.dirname(filePath);
    const prefix = `.${path.basename(filePath)}.recovering-`;
    const entries = await this.fileSystem.readDirectory(folder).catch((): Array<[string, FileType]> => []);
    for (const [name] of entries.filter(([entry, type]) => type === FileType.Directory && entry.startsWith(prefix))) {
      const marker = path.join(folder, name);
      const state = await this.markerState(marker);
      if (state.kind === 'live' || state.kind === 'io') {
        throw new WorkshopNamedSessionBusyError();
      }
      if (state.kind === 'abandoned') {
        await this.finishRecovery(marker, filePath);
      }
    }
  }

  /** Take over an abandoned lock: it becomes the recovery marker, the retired owner's prior file is restored, then it goes. */
  private async takeOver(lock: string, filePath: string, identity: string): Promise<void> {
    const marker = `${path.dirname(lock)}${path.sep}.${path.basename(filePath)}.recovering-${randomUUID()}`;
    try {
      await this.fileSystem.rename(lock, marker, { overwrite: false });
    } catch {
      return; // Another window took it over first.
    }
    const moved = await this.markerState(marker);
    if (moved.kind !== 'abandoned' || moved.identity !== identity) {
      // A new, live lock took the name meanwhile: put it back if the name is free.
      await this.fileSystem.rename(marker, lock, { overwrite: false }).catch(() => undefined);
      return;
    }
    await this.fileSystem.writeFile(path.join(marker, 'recovery.json'), encoder.encode(JSON.stringify({ at: this.now().getTime(), token: moved.token })))
      .catch(() => undefined);
    this.log.appendLine(`${LOG} Took over an abandoned lock.`);
    await this.finishRecovery(marker, filePath, moved.token);
  }

  /** Restore the retired owner's prior file if the saved name is empty, then delete the marker. */
  private async finishRecovery(marker: string, filePath: string, known?: string): Promise<void> {
    await this.hooks.beforeRestore?.();
    const token = known ?? await this.recoveryToken(marker);
    if (token) {
      await this.fileSystem.rename(path.join(marker, token, 'prior.json'), filePath, { overwrite: false }).catch(() => undefined);
    }
    await this.removeQuietly(marker);
  }

  /** The owner's own subdirectory, detached to a fresh name before anything is deleted. */
  private async cleanUp(held: Held, filePath: string): Promise<void> {
    const retired = `${path.dirname(filePath)}${path.sep}.${path.basename(filePath)}.retired-${randomUUID()}`;
    try {
      await this.fileSystem.rename(held.own, retired, { overwrite: false });
    } catch {
      return; // Taken over: nothing here is this owner's to delete.
    }
    await this.removeQuietly(retired);
  }

  /** Rename the lock aside, delete it if it is this token's, else put it back. */
  private async release(held: Held): Promise<void> {
    const aside = `${held.lock}.released-${randomUUID()}`;
    try {
      await this.fileSystem.rename(held.lock, aside, { overwrite: false });
    } catch {
      return;
    }
    if ((await this.ownerToken(aside)) === held.token) {
      await this.removeQuietly(aside);
      return;
    }
    await this.fileSystem.rename(aside, held.lock, { overwrite: false }).catch(() => this.removeQuietly(aside));
  }

  private async stillHeld(held: Held): Promise<boolean> {
    return (await this.ownerToken(held.lock)) === held.token;
  }

  /** A lock's or marker's standing, by its owner or recovery file's time, or its own age when neither reads. */
  private async markerState(directory: string): Promise<Marker> {
    const recovery = await this.readJson(path.join(directory, 'recovery.json'));
    const owner = await this.readJson(path.join(directory, 'owner.json'));
    if (recovery.kind === 'io' || owner.kind === 'io') {
      return { kind: 'io' };
    }
    const record = recovery.kind === 'json' ? recovery : owner;
    if (record.kind !== 'json') {
      const exists = await this.fileSystem.readDirectory(directory).then(() => true, () => false);
      return exists ? { kind: 'abandoned', identity: 'bare' } : { kind: 'none' };
    }
    const { token, at } = record.value as { token?: unknown; at?: unknown };
    const time = typeof at === 'number' && Number.isFinite(at) ? at : record.mtime;
    if (Math.abs(this.now().getTime() - time) < STORED_FILE_CLAIM_LEASE_MS) {
      return { kind: 'live' };
    }
    return { kind: 'abandoned', identity: `${String(token)}:${String(at)}`, ...(typeof token === 'string' ? { token } : {}) };
  }

  private async readJson(filePath: string): Promise<{ kind: 'none' } | { kind: 'io' } | { kind: 'json'; value: unknown; mtime: number }> {
    let mtime: number;
    try {
      ({ mtime } = await this.fileSystem.stat(filePath));
    } catch {
      return { kind: 'none' };
    }
    try {
      const value: unknown = JSON.parse(decoder.decode(await this.fileSystem.readFile(filePath)));
      return { kind: 'json', value: typeof value === 'object' && value !== null ? value : {}, mtime };
    } catch {
      return { kind: 'json', value: {}, mtime };
    }
  }

  private async ownerToken(lock: string): Promise<string | undefined> {
    const owner = await this.readJson(path.join(lock, 'owner.json'));
    const token = owner.kind === 'json' ? (owner.value as { token?: unknown }).token : undefined;
    return typeof token === 'string' ? token : undefined;
  }

  private async recoveryToken(marker: string): Promise<string | undefined> {
    for (const file of ['recovery.json', 'owner.json']) {
      const record = await this.readJson(path.join(marker, file));
      const token = record.kind === 'json' ? (record.value as { token?: unknown }).token : undefined;
      if (typeof token === 'string') {
        return token;
      }
    }
    return undefined;
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
