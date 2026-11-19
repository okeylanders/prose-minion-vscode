/**
 * Every write that replaces or removes a named Workshop session holds the
 * session file's lock (ADR 2026-11-19 D6a, D6b; PR #286 re-review, finding
 * 1). Modelled on the pinned list's lock (`WorkshopPinnedContextLock`,
 * reused here with a lock per file): the staged checkpoint lives inside the
 * lock, so a takeover removes it, and a stalled writer cannot publish.
 *
 * - **The lock** is `.<name>.lock/` beside the session file, holding
 *   `owner.json` (`{ token, at }`). Of two windows, one takes it and the
 *   other is busy (`WorkshopNamedSessionBusyError`, in host words).
 * - **Replace:** holding the lock, stage `next-<id>.json` inside it; read the
 *   saved file and refuse unless it equals `expected` (changed); move it,
 *   never over anything, to `prior.json` inside the lock (a file already
 *   deleted cannot be moved: missing); check the lock is still held; publish
 *   by renaming the staged file to the saved name, never over anything. A
 *   takeover that moved the lock aside left no source, so a late publish
 *   fails. Then `prior.json` goes and the lock is released.
 * - **Remove:** holding the lock, move the saved file to `prior.json`, then
 *   release the lock, which deletes the directory with all it holds.
 * - **Takeover of an abandoned lock** (owner older than the lease, or not
 *   readable): `prior.json` goes back to the saved name only if that name
 *   is empty, never over anything; the moved-aside directory is deleted with
 *   every staged file in it.
 * - **Readers:** an empty saved name beside a live lock is busy; beside an
 *   abandoned one, the reader takes over (restoring the file) and reads again.
 * - **Logs** never name a session file: its name carries a title slug.
 */

import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { FileType, type FileSystem, type LogSink } from '@/platform';
import { WorkshopPinnedContextLock, type WorkshopPinnedContextHeldLock } from '@/infrastructure/storage/WorkshopPinnedContextLock';
import { assertPersistedJsonNestingDepth } from '@/application/services/workshop/persistedJson';
import type { WorkshopPersistedSessionCheckpointDecodeResult, WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';

const encoder = new TextEncoder();
const PRIOR = 'prior.json';
/** A named session's lock directory: `.<name>.json.lock`. Group 1 is the saved name. */
export const WORKSHOP_NAMED_SESSION_LOCK = /^\.([^/\\]+\.json)\.lock$/;

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

/** Test seams: a step run just before the publish rename (the witness pauses there). */
export interface WorkshopNamedSessionLockHooks {
  readonly beforePublish?: () => Promise<void>;
}

export class WorkshopNamedSessionLock {
  private readonly lock: WorkshopPinnedContextLock;

  constructor(
    private readonly fileSystem: FileSystem,
    log: LogSink,
    now: () => Date,
    private readonly maximumBytes: number,
    private readonly errors: WorkshopNamedSessionLockErrors,
    private readonly hooks: WorkshopNamedSessionLockHooks = {}
  ) {
    this.lock = new WorkshopPinnedContextLock(fileSystem, log, now, randomUUID, {
      lockPathOf: lockPathOf,
      beforeRemovingAbandoned: (aside, target) => this.restorePrior(aside, target),
      logPrefix: '[WorkshopNamedSessionLock]'
    });
  }

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
      const staged = held.stagingPath(`next-${randomUUID()}.json`);
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
      // The fence is the placement: a takeover moved the lock, and the staged file with it, aside.
      await this.fileSystem.rename(staged, target.filePath, { overwrite: false }).catch(async (error: unknown) => {
        if (await held.stillHeld()) {
          await this.fileSystem.rename(held.stagingPath(PRIOR), target.filePath, { overwrite: false }).catch(() => undefined);
        }
        throw error instanceof Error ? error : new Error('The saved Workshop session could not be written.');
      });
    });
  }

  /** Delete the named file under its lock: the file and the lock go together. */
  async remove(filePath: string, sessionId: string): Promise<void> {
    await this.holding(filePath, (held) => this.claim(held, filePath, sessionId));
  }

  /** A reader found no file: busy (throws) beside a live lock; true when an abandoned one was taken over (read again). */
  async settledWhenMissing(folder: string): Promise<boolean> {
    const entries = await this.fileSystem.readDirectory(folder).catch((): Array<[string, FileType]> => []);
    let settled = false;
    for (const [name, type] of entries) {
      const saved = type === FileType.Directory ? WORKSHOP_NAMED_SESSION_LOCK.exec(name)?.[1] : undefined;
      if (!saved) {
        continue;
      }
      const target = path.join(folder, saved);
      const state = await this.lock.state(target);
      if (state === 'live') {
        throw new WorkshopNamedSessionBusyError();
      }
      if (state === 'abandoned') {
        const held = await this.lock.acquire(target);
        if (held === 'busy') {
          throw new WorkshopNamedSessionBusyError();
        }
        if (held !== 'io') {
          await held.release();
          settled = true;
        }
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

  /** Run `work` holding the file's lock, released however it ends. */
  private async holding(filePath: string, work: (held: WorkshopPinnedContextHeldLock) => Promise<void>): Promise<void> {
    const held = await this.lock.acquire(filePath);
    if (held === 'busy') {
      throw new WorkshopNamedSessionBusyError();
    }
    if (held === 'io') {
      throw new Error('The saved Workshop session could not be locked for writing.');
    }
    try {
      await work(held);
    } finally {
      await held.release();
    }
  }

  /** Move the saved file into the lock as `prior.json`, never over anything; missing when it is not there. */
  private async claim(held: WorkshopPinnedContextHeldLock, filePath: string, sessionId: string): Promise<void> {
    await this.fileSystem.rename(filePath, held.stagingPath(PRIOR), { overwrite: false }).catch(() => {
      throw this.errors.missing(sessionId);
    });
    if (!(await held.stillHeld())) {
      // Taken over while claiming: the successor restored the file; nothing here publishes.
      throw new WorkshopNamedSessionBusyError();
    }
  }

  /** An abandoned lock's `prior.json` back to the saved name, only if it is empty. */
  private async restorePrior(aside: string, target: string): Promise<void> {
    await this.fileSystem.rename(path.join(aside, PRIOR), target, { overwrite: false }).catch(() => undefined);
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
