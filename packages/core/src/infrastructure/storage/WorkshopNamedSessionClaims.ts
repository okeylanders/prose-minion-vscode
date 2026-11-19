/**
 * Every write that replaces or removes a named Workshop session claims the
 * file first (ADR 2026-11-19 D6a; PR #286 F-01), through the per-file claim
 * the Lightbox's boards and project memory already share
 * (`StoredFileRewrite` over `StoredFileClaims`).
 *
 * - **Replace** (`rewriteWorkshopNamedSession`): the new checkpoint is
 *   staged under a hidden private name; the saved file is claimed by an
 *   atomic rename, never over anything; the claimed bytes must be the bytes
 *   the writer read and compared (else the claim is put back and the write
 *   is `WorkshopNamedSessionChangedError`); the claim must still be this
 *   write's; the staged file takes the saved name, never over anything.
 * - **Of two overlapping writers, exactly one claims the file.** The other
 *   finds the saved name empty under a live claim and is refused as busy
 *   (`WorkshopNamedSessionBusyError`), in host words.
 * - **Remove** (`deleteWorkshopNamedSession`): `StoredFileClaims.deleteClaimed`.
 * - **Logs** never name a session file: its name carries a title slug, the
 *   writer's words. They say "a saved session" and a file system category.
 */

import * as crypto from 'node:crypto';
import type { FileSystem, LogSink } from '@/platform';
import { StoredFileClaims } from '@/infrastructure/storage/StoredFileClaims';
import { commitStoredFileRewrite } from '@/infrastructure/storage/StoredFileRewrite';
import { fileSystemErrorCategory } from '@/infrastructure/storage/fileSystemErrors';

const LOG = '[WorkshopSessionStore]';

/** A named session's claim: `.<name>.json.claim-<epoch ms>-<writer id>`. Group 1 is the saved name, group 2 the time. */
export const WORKSHOP_NAMED_SESSION_CLAIM = /^\.([^/\\]+\.json)\.claim-(\d{13})-[A-Za-z0-9-]+$/;

/** The host's words for a write refused because another window holds the file (D6a). */
export const WORKSHOP_NAMED_SESSION_BUSY_WORDS = 'This saved session is being written by another window. Try again in a moment.';

export class WorkshopNamedSessionBusyError extends Error {
  constructor() {
    super(WORKSHOP_NAMED_SESSION_BUSY_WORDS);
    this.name = 'WorkshopNamedSessionBusyError';
  }
}

/** The claims of a named-session folder, as the store holds them. */
export function workshopNamedSessionClaims(fileSystem: FileSystem, log: LogSink, now: () => Date, maxBytes: number): StoredFileClaims {
  return new StoredFileClaims(fileSystem, log, now, {
    claimPattern: WORKSHOP_NAMED_SESSION_CLAIM,
    logPrefix: LOG,
    logName: () => 'a saved session',
    formatError: fileSystemErrorCategory,
    maxBytes
  });
}

export type WorkshopNamedSessionRewriteResult = 'committed' | 'changed' | 'busy' | 'missing';

/**
 * Replace the named session at `filePath` with `written`, only while it
 * still holds `read`, under a claim. Runs the store's `onCommitted` once the
 * rewrite stands. Throws for an outcome that is not one of the four.
 */
export async function rewriteWorkshopNamedSession(
  fileSystem: FileSystem,
  claims: StoredFileClaims,
  log: LogSink,
  rewrite: { filePath: string; read: Uint8Array; written: Uint8Array; onCommitted?: () => void }
): Promise<WorkshopNamedSessionRewriteResult> {
  const outcome = await commitStoredFileRewrite(
    { fileSystem, claims, log, logPrefix: LOG, noun: 'saved session', mintStagingId: () => crypto.randomUUID() },
    {
      filePath: rewrite.filePath,
      label: 'a saved session',
      read: rewrite.read,
      written: rewrite.written,
      onCommitted: () => rewrite.onCommitted?.(),
      fallbackPath: async () => `${rewrite.filePath}.restored-${crypto.randomUUID()}.json`
    }
  );
  switch (outcome.kind) {
    case 'committed':
      return 'committed';
    case 'again':
      return 'changed';
    case 'gone':
      if (outcome.state === 'busy') {
        return 'busy';
      }
      if (outcome.state === 'absent') {
        return 'missing';
      }
      if (outcome.state === 'present') {
        // Another writer rewrote it between the read and the claim: the compare is stale.
        return 'changed';
      }
      throw new Error('The saved Workshop session could not be written: its folder could not be read.');
    default:
      throw new Error('The saved Workshop session could not be written; it is left as it was.');
  }
}

/**
 * Settle a folder's claims (an abandoned one is put back): `busy` while a
 * live claim remains (a reader's busy, never missing), `settled` when
 * something was put back (read again), `none` when there were no claims.
 */
export async function workshopNamedSessionClaimState(fileSystem: FileSystem, claims: StoredFileClaims, folder: string): Promise<'busy' | 'settled' | 'none'> {
  const entries = await fileSystem.readDirectory(folder).catch(() => []);
  if (!entries.some(([name]) => claims.isClaim(name))) {
    return 'none';
  }
  const changed = await claims.settleFolder(folder);
  const after = await fileSystem.readDirectory(folder).catch(() => []);
  return after.some(([name]) => claims.isClaim(name)) ? 'busy' : changed ? 'settled' : 'none';
}
