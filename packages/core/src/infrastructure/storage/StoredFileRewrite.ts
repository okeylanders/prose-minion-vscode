/**
 * A stored file rewritten in place under a claim: the commit half of a
 * rewrite, shared by every store that rewrites a file another window may
 * also touch (extracted from `LightboxBoardRewrite` for Workshop Project
 * Memory Slice 1; the rules are Lightbox Slice 5A.1's and PR #164's). The
 * caller reads and checks the file and builds the bytes that replace it;
 * this stages, claims and commits them.
 *
 * - **Staged privately,** under the saved name, hidden, with a random id
 *   (PR #163 F-03), so another window's store never writes over it.
 * - **Claimed, then committed.** The saved file is renamed, never over
 *   anything, to a hidden name private to this write (`StoredFileClaims`).
 *   A file another writer deleted first cannot be claimed, so a rewrite
 *   never brings a deleted file back. The claimed bytes must be the bytes
 *   that were read, or the claim is put back and the caller reads again
 *   (`again`). The claim must still be this write's (one held past the
 *   lease may have been put back by another window), then the commit point
 *   runs, the staged file takes the saved name, never over anything, and
 *   the claim is dropped.
 * - **Released, never lost.** A claim given back without a commit returns
 *   to its saved name, or, should a new file have taken that name
 *   meanwhile, to the caller's fallback name.
 * - **Logs** carry the caller's label for the file (its id) and reasons,
 *   with errors as the claims' `formatError` gives them, never the
 *   writer's text.
 */

import * as path from 'node:path';
import type { FileSystem, LogSink } from '@/platform';
import {
  deleteStoredFileQuietly,
  storedFileExists,
  type StoredFileClaimState,
  type StoredFileClaims
} from '@/infrastructure/storage/StoredFileClaims';

export interface StoredFileRewritePorts {
  readonly fileSystem: FileSystem;
  readonly claims: StoredFileClaims;
  readonly log: LogSink;
  readonly logPrefix: string;
  /** What the store keeps, for a log line ("board", "memory"). */
  readonly noun: string;
  readonly mintStagingId: () => string;
}

export interface StoredFileRewriteCommit {
  readonly filePath: string;
  /** The file's id, for logs. */
  readonly label: string;
  /** The bytes the caller read and checked. */
  readonly read: Uint8Array;
  /** The bytes that replace them. */
  readonly written: Uint8Array;
  /**
   * Asked once the claim is confirmed, before the commit point: a check that
   * needs a read (a store's lock still being its own). `false` releases the
   * claim and withdraws, as `beforeCommit` does.
   */
  readonly confirm?: () => Promise<boolean>;
  /** The commit point: synchronous, immediately before the staged file takes the saved name. `false` withdraws. */
  readonly beforeCommit?: () => boolean;
  /** Called synchronously once the rewrite stands, before the claim is dropped. */
  readonly onCommitted: () => void;
  /** Where a released claim goes when a new file took its saved name meanwhile. */
  readonly fallbackPath: () => Promise<string>;
}

export type StoredFileRewriteOutcome =
  | { kind: 'committed' }
  /** The file changed or moved under the rewrite: read it again. */
  | { kind: 'again' }
  /** The file could not be claimed; what it is once its claims are settled. */
  | { kind: 'gone'; state: StoredFileClaimState }
  | { kind: 'withdrawn' }
  | { kind: 'failed' };

/** Stage `commit.written`, claim the file, and commit the rewrite. Run inside the store's queue. */
export async function commitStoredFileRewrite(
  ports: StoredFileRewritePorts,
  commit: StoredFileRewriteCommit
): Promise<StoredFileRewriteOutcome> {
  const { fileSystem, claims, log, logPrefix } = ports;
  const { filePath, label } = commit;
  const folder = path.dirname(filePath);
  const temporaryPath = path.join(folder, `.${path.basename(filePath)}.tmp-${ports.mintStagingId()}`);
  try {
    await fileSystem.writeFile(temporaryPath, commit.written);
  } catch (error) {
    log.appendLine(`${logPrefix} Could not stage a rewrite of ${label}: ${claims.formatError(error)}`);
    await deleteStoredFileQuietly(fileSystem, temporaryPath);
    return { kind: 'failed' };
  }
  // The claim: atomic, and never over anything. A file deleted since the read cannot be claimed, so it stays deleted.
  const claimPath = await claims.take(filePath, ports.mintStagingId());
  if (!claimPath) {
    await deleteStoredFileQuietly(fileSystem, temporaryPath);
    return { kind: 'gone', state: await claims.settle(filePath) };
  }
  let claimed: Uint8Array | undefined;
  try {
    claimed = await fileSystem.readFile(claimPath);
  } catch {
    claimed = undefined;
  }
  // Another writer rewrote it between the read and the claim: put it back, and read it again.
  if (!claimed || !sameBytes(claimed, commit.read)) {
    await release(ports, claimPath, commit, temporaryPath);
    return { kind: 'again' };
  }
  // Still this write's claim: one held past the lease may have been put back by another window, and is not written over.
  if (!(await storedFileExists(fileSystem, claimPath))) {
    await deleteStoredFileQuietly(fileSystem, temporaryPath);
    log.appendLine(`${logPrefix} ${label} was not rewritten: its claim was taken back while the rewrite waited.`);
    return { kind: 'failed' };
  }
  if (commit.confirm && !(await commit.confirm())) {
    await release(ports, claimPath, commit, temporaryPath);
    return { kind: 'withdrawn' };
  }
  // The commit point: nothing is awaited between it and the rename that commits.
  if (commit.beforeCommit && !commit.beforeCommit()) {
    await release(ports, claimPath, commit, temporaryPath);
    return { kind: 'withdrawn' };
  }
  try {
    await fileSystem.rename(temporaryPath, filePath, { overwrite: false });
  } catch (error) {
    log.appendLine(`${logPrefix} Could not rewrite ${label}; it is left as it was: ${claims.formatError(error)}`);
    await release(ports, claimPath, commit, temporaryPath);
    return { kind: 'failed' };
  }
  commit.onCommitted();
  // Should this fail, the claim is a leftover beside the rewritten file: removed once abandoned, or by a delete, never put back.
  await deleteStoredFileQuietly(fileSystem, claimPath);
  log.appendLine(`${logPrefix} Rewrote ${label} in place.`);
  return { kind: 'committed' };
}

/**
 * Give the claim back without committing: the claimed file returns to its
 * saved name (or, should a new file have taken that name meanwhile, the
 * fallback), and the staged bytes are dropped.
 */
async function release(
  ports: StoredFileRewritePorts,
  claimPath: string,
  commit: StoredFileRewriteCommit,
  temporaryPath: string
): Promise<void> {
  const { fileSystem } = ports;
  await deleteStoredFileQuietly(fileSystem, temporaryPath);
  for (const destination of [async () => commit.filePath, commit.fallbackPath]) {
    try {
      await fileSystem.rename(claimPath, await destination(), { overwrite: false });
      return;
    } catch {
      // Taken, or the claim is gone: try the next.
    }
  }
  // A claim another window already put back (held past the lease) is not this write's to report.
  if (await storedFileExists(fileSystem, claimPath)) {
    ports.log.appendLine(`${ports.logPrefix} A claimed ${ports.noun} could not be put back; it is kept as ${ports.claims.logName(path.basename(claimPath))}.`);
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}
