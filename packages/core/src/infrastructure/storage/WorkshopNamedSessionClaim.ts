/**
 * The named-session store's claimed writes (ADR 2026-11-19 D6a; PR #286
 * F-01), kept out of `WorkshopSessionStore` so the store only calls them:
 *
 * - **`replace`**: reads the saved file's bytes, then the store's exact
 *   decode, and refuses unless it equals `expected`; then stages, claims
 *   and commits the new bytes (`rewriteWorkshopNamedSession`). The claim
 *   must still hold the bytes read, so a change in between, or an
 *   overlapping writer, is refused: changed, busy or missing, as the
 *   store's own errors.
 * - **`remove`**: a delete under the same claim (`StoredFileClaims.deleteClaimed`).
 * - **`settledWhenMissing`**: what a reader that found no file does with the
 *   folder's claims: a live one is busy, never missing (throws); an
 *   abandoned one is put back (true: read again).
 * - **`encode`**: the checkpoint's bytes, bounded as every store write is.
 */

import { randomUUID } from 'node:crypto';
import type { FileSystem, LogSink } from '@/platform';
import type { StoredFileClaims } from '@/infrastructure/storage/StoredFileClaims';
import { assertPersistedJsonNestingDepth } from '@/application/services/workshop/persistedJson';
import type { WorkshopPersistedSessionCheckpointDecodeResult, WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';
import {
  rewriteWorkshopNamedSession,
  workshopNamedSessionClaimState,
  workshopNamedSessionClaims,
  WorkshopNamedSessionBusyError
} from '@/infrastructure/storage/WorkshopNamedSessionClaims';

const encoder = new TextEncoder();

/** The store's errors, handed in so this module never imports the store. */
export interface WorkshopNamedSessionClaimErrors {
  changed(): Error;
  missing(sessionId: string): Error;
}

export class WorkshopNamedSessionClaim {
  private readonly claims: StoredFileClaims;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly log: LogSink,
    now: () => Date,
    private readonly maximumBytes: number,
    private readonly errors: WorkshopNamedSessionClaimErrors
  ) {
    this.claims = workshopNamedSessionClaims(fileSystem, log, now, maximumBytes);
  }

  /** Replace the named file with `session`, only while it still equals `expected`, under its claim. */
  async replace(target: {
    sessionId: string;
    filePath: string;
    readExact: () => Promise<WorkshopPersistedSessionCheckpointDecodeResult | undefined>;
    session: WorkshopPersistedSessionV2;
    expected: WorkshopPersistedSessionV2;
  }): Promise<void> {
    // Bytes first, then the decode: a change between them leaves the claim's bytes stale, and the claim refuses.
    const read = await this.fileSystem.readFile(target.filePath).catch(() => undefined);
    const latest = read && await target.readExact();
    if (!read || !latest || !hasSameWorkshopCheckpoint(latest.session, target.expected)) {
      throw this.errors.changed();
    }
    const outcome = await rewriteWorkshopNamedSession(this.fileSystem, this.claims, this.log, {
      filePath: target.filePath, read, written: this.encode(target.session, 'Workshop session')
    });
    if (outcome === 'busy') {
      throw new WorkshopNamedSessionBusyError();
    }
    if (outcome !== 'committed') {
      throw outcome === 'missing' ? this.errors.missing(target.sessionId) : this.errors.changed();
    }
  }

  /** Delete the named file under a claim of its own. */
  async remove(filePath: string, sessionId: string): Promise<void> {
    const deleted = await this.claims.deleteClaimed(filePath, 'a saved session', randomUUID());
    if (deleted === 'busy') {
      throw new WorkshopNamedSessionBusyError();
    }
    if (deleted !== 'deleted') {
      throw deleted === 'missing' ? this.errors.missing(sessionId) : new Error('The saved Workshop session could not be deleted.');
    }
  }

  /** A reader found no file: busy (throws) under a live claim; true when an abandoned claim was put back. */
  async settledWhenMissing(folder: string): Promise<boolean> {
    const state = await workshopNamedSessionClaimState(this.fileSystem, this.claims, folder);
    if (state === 'busy') {
      throw new WorkshopNamedSessionBusyError();
    }
    return state === 'settled';
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
}

/** A byte bound in words: whole MiB, or bytes. */
export function formatByteLimit(bytes: number): string {
  const mebibyte = 1024 * 1024;
  return bytes % mebibyte === 0
    ? `${bytes / mebibyte} MiB`
    : `${bytes.toLocaleString('en-US')} bytes`;
}
