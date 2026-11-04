/**
 * Claims on stored files, for any store that rewrites or deletes a file
 * another window may also touch (extracted from `LightboxBoardClaims` for
 * Workshop Project Memory Slice 1; the rules are PR #164 F-01, F-02's). A
 * rewrite in place, and a delete, first *claim* the saved file: an atomic
 * rename, never over anything, to a hidden name of their own that records
 * when it was taken (`.<saved name>.claim-<epoch ms>-<writer's id>`). While
 * a claim holds it, the saved name stands empty, so no other writer
 * (another window's store) can claim, rewrite or delete the file.
 *
 * - **Live or abandoned, by age.** A writer holds its claim for the few file
 *   operations between taking it and committing. A claim younger than the
 *   lease (`STORED_FILE_CLAIM_LEASE_MS`) is live and is never touched by
 *   anyone else; an older one was abandoned (its window closed mid-write).
 *   A writer stalled longer than the lease can lose its claim: then its
 *   commit finds the claim gone and writes nothing (`commitClaimedRewrite`).
 *   The one race left needs that stall *and* another window's recovery and
 *   delete inside the stalled writer's last file operation.
 * - **Settling a saved name** (on a listing that finds claims, and when a
 *   read, a rewrite or a delete finds the file gone):
 *   - a live claim with the saved name empty: the file is **busy**;
 *   - no live claim, the saved name empty: the newest abandoned claim holds
 *     the file as it last stood, and goes back under the saved name, never
 *     over anything;
 *   - beside a standing file, an abandoned claim is a rewrite's leftover
 *     (the bytes the file held before a committed rewrite whose clean-up
 *     failed), and is removed, never put back.
 * - **A delete retires a file's leftovers.** Holding the file under its own
 *   claim, a delete removes every other claim of that saved name, of any
 *   age, and looks again: only when none is left may it remove its own. No
 *   earlier version can come back after a delete.
 * - **A folder that cannot be read is not an empty one.** Only a folder that
 *   is not there counts as holding nothing; any other error leaves the state
 *   `unknown`, never `absent`.
 * - **Each store names its own claims** (`StoredFileClaimsConfig`): the
 *   pattern that knows its saved names, and the prefix its log lines carry.
 *   Logs carry file names (as `logName` gives them), never the writer's
 *   text.
 *
 * The small file helpers at the end serve stores' new-file writes too.
 */

import * as path from 'node:path';
import type { FileSystem, LogSink } from '@/platform';
import { isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';

/**
 * How long a claim is live. A rewrite holds its claim for a few file
 * operations; thirty seconds leaves room for a busy extension host, and is
 * how long a file cut off mid-rewrite stays hidden before a listing or a
 * read puts it back.
 */
export const STORED_FILE_CLAIM_LEASE_MS = 30_000;

/**
 * What a saved name is once its claims are settled: standing, gone (neither
 * the file nor a claim is there), held by a live claim, or not known (its
 * folder could not be read).
 */
export type StoredFileClaimState = 'present' | 'absent' | 'busy' | 'unknown';

/** A delete's check of the bytes it claimed, and where refused bytes go when their saved name is taken (`deleteClaimed`). */
export interface StoredFileDeleteCheck {
  readonly verify: (claimed: Uint8Array) => boolean;
  /** A free name in the saved file's folder, looked up when it is needed. */
  readonly fallbackPath: () => Promise<string>;
}

/** Free names a refused delete tries, after its saved name, before it keeps its bytes under the claim. */
const REFUSED_RELEASE_FALLBACKS = 3;

/**
 * What a delete under a claim did (`StoredFileClaims.deleteClaimed`):
 * `changed` when the claimed bytes were not the file the caller meant, so
 * they were put back and nothing was deleted.
 */
export type StoredFileClaimedDelete = 'deleted' | 'missing' | 'busy' | 'changed' | 'failed';

export interface StoredFileClaimsConfig {
  /**
   * A claim's name. Group 1 is the saved file's name, group 2 when the claim
   * was taken (13 digits, epoch ms). A name it does not match is never a
   * claim.
   */
  readonly claimPattern: RegExp;
  /** Every log line's prefix, such as `[LightboxBoardStore]`. */
  readonly logPrefix: string;
  /**
   * How a log line names a saved file or a claim; the name itself by
   * default. A store whose file names carry writer text gives one that
   * leaves it out.
   */
  readonly logName?: (name: string) => string;
  /**
   * How a log line gives a file system error; its message by default. A
   * store whose paths carry writer text gives one that keeps a bounded
   * category and drops the message (PR #194 F-04).
   */
  readonly formatError?: (error: unknown) => string;
}

interface Claim {
  name: string;
  at: number;
}

export class StoredFileClaims {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly log: LogSink,
    private readonly now: () => Date,
    private readonly config: StoredFileClaimsConfig
  ) {}

  /** Take the saved file at `filePath` under a claim of its own; the claim's path, or undefined when the file was not there to take. */
  async take(filePath: string, id: string): Promise<string | undefined> {
    const claimPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.claim-${this.now().getTime()}-${id}`);
    try {
      await this.fileSystem.rename(filePath, claimPath, { overwrite: false });
      return claimPath;
    } catch {
      return undefined;
    }
  }

  /** Settle the claims of the saved file at `filePath`, and say what it is now. */
  async settle(filePath: string): Promise<StoredFileClaimState> {
    const folder = path.dirname(filePath);
    const entries = await this.entriesOf(folder);
    if (!entries) {
      this.log.appendLine(`${this.config.logPrefix} Could not look for ${this.logName(path.basename(filePath))}'s claims; it is not taken for gone.`);
      return 'unknown';
    }
    return (await this.settleName(folder, path.basename(filePath), entries)).state;
  }

  /** Settle every saved name in `folder` that has claims; whether anything changed on disk. */
  async settleFolder(folder: string): Promise<boolean> {
    const entries = await this.entriesOf(folder);
    if (!entries) {
      return false;
    }
    const savedNames = new Set(entries.flatMap((entry) => {
      const saved = this.config.claimPattern.exec(entry)?.[1];
      return saved ? [saved] : [];
    }));
    let changed = false;
    for (const saved of savedNames) {
      changed = (await this.settleName(folder, saved, entries)).changed || changed;
    }
    return changed;
  }

  /** A saved file's or a claim's name, as a log line gives it. */
  logName(name: string): string {
    return this.config.logName ? this.config.logName(name) : name;
  }

  /** A file system error, as a log line gives it. */
  formatError(error: unknown): string {
    return this.config.formatError ? this.config.formatError(error) : storedFileErrorMessage(error);
  }

  /** Whether `name` is one of this store's claims. */
  isClaim(name: string): boolean {
    return this.config.claimPattern.test(name);
  }

  /**
   * A delete holds the file under `own`: every other claim of its saved name,
   * of any age, is a leftover, and is removed. Whether the folder, looked at
   * again, shows none left: an error reading it, or a leftover that would not
   * go, is `false`, and the delete must not go on.
   */
  async retire(filePath: string, own: string): Promise<boolean> {
    const folder = path.dirname(filePath);
    const saved = path.basename(filePath);
    const others = (entries: readonly string[]) => this.claimsOf(entries, saved).filter((claim) => claim.name !== path.basename(own));
    const entries = await this.entriesOf(folder);
    if (!entries) {
      this.log.appendLine(`${this.config.logPrefix} Could not look for earlier versions of ${this.logName(saved)}; it was not deleted.`);
      return false;
    }
    for (const claim of others(entries)) {
      if (await deleteStoredFileQuietly(this.fileSystem, path.join(folder, claim.name))) {
        this.log.appendLine(`${this.config.logPrefix} Removed an earlier version of ${this.logName(saved)}, left by a rewrite, with it.`);
      }
    }
    const after = await this.entriesOf(folder);
    if (!after || others(after).length > 0) {
      this.log.appendLine(`${this.config.logPrefix} An earlier version of ${this.logName(saved)} could not be removed, or the folder could not be read again; it was not deleted.`);
      return false;
    }
    return true;
  }

  /**
   * Delete the saved file at `filePath` under a claim of its own (PR #164
   * F-01): taken first, so no other writer rewrites it meanwhile; every
   * earlier version a rewrite left beside it goes before it, so none can
   * come back; and only then is it deleted. A leftover that would not go,
   * or a folder that could not be read again, puts the file back as it was
   * and says the delete `failed`. `label` names the file in logs.
   *
   * With `check`, the claimed bytes are checked before anything goes
   * (PR #194 F-02): the path a listing named may hold another file by the
   * time it is claimed. Bytes `check.verify` refuses are never deleted, and
   * the delete says `changed`. They go back under the saved name, or,
   * should another file stand there by then, under a free name
   * (`check.fallbackPath`), as an ordinary file: never left under a claim,
   * where a later settling would remove them as a rewrite's leftover (the
   * re-review).
   */
  deleteClaimed(filePath: string, label: string, id: string): Promise<Exclude<StoredFileClaimedDelete, 'changed'>>;
  deleteClaimed(filePath: string, label: string, id: string, check: StoredFileDeleteCheck): Promise<StoredFileClaimedDelete>;
  async deleteClaimed(
    filePath: string,
    label: string,
    id: string,
    check?: StoredFileDeleteCheck
  ): Promise<StoredFileClaimedDelete> {
    const claimPath = await this.take(filePath, id);
    if (!claimPath) {
      const state = await this.settle(filePath);
      return state === 'busy' ? 'busy' : state === 'absent' ? 'missing' : 'failed';
    }
    if (check) {
      let claimed: Uint8Array | undefined;
      try {
        claimed = await this.fileSystem.readFile(claimPath);
      } catch {
        claimed = undefined;
      }
      if (!claimed || !check.verify(claimed)) {
        await this.releaseRefused(claimPath, filePath, label, check);
        this.log.appendLine(`${this.config.logPrefix} ${label} was not deleted: its file changed before it was claimed.`);
        return 'changed';
      }
    }
    if (!(await this.retire(filePath, claimPath))) {
      await this.fileSystem.rename(claimPath, filePath, { overwrite: false })
        .catch(() => this.log.appendLine(`${this.config.logPrefix} ${label} could not be put back at once; it comes back once its claim is older than the lease.`));
      return 'failed';
    }
    try {
      await this.fileSystem.delete(claimPath);
    } catch (error) {
      this.log.appendLine(`${this.config.logPrefix} Could not delete ${label}: ${this.formatError(error)}`);
      // Back under its saved name at once, rather than hidden under the claim until the lease runs out.
      await this.fileSystem.rename(claimPath, filePath, { overwrite: false }).catch(() => undefined);
      return 'failed';
    }
    return 'deleted';
  }

  /**
   * Refused bytes back as an ordinary file: under the saved name, else the
   * first free fallback name, never over anything. Only when every name is
   * taken in turn (another writer naming files at each step) do they stay
   * under the claim, and the log says so.
   */
  private async releaseRefused(claimPath: string, filePath: string, label: string, check: StoredFileDeleteCheck): Promise<void> {
    const destinations = [async () => filePath, ...Array.from({ length: REFUSED_RELEASE_FALLBACKS }, () => check.fallbackPath)];
    for (const destination of destinations) {
      try {
        await this.fileSystem.rename(claimPath, await destination(), { overwrite: false });
        return;
      } catch {
        // Taken: try the next.
      }
    }
    this.log.appendLine(`${this.config.logPrefix} The file claimed for ${label} could not be put back under any free name; it is kept under its claim.`);
  }

  private async settleName(folder: string, saved: string, entries: readonly string[]): Promise<{ state: StoredFileClaimState; changed: boolean }> {
    const claims = this.claimsOf(entries, saved);
    const standing = entries.includes(saved);
    if (claims.length === 0) {
      return { state: standing ? 'present' : 'absent', changed: false };
    }
    const now = this.now().getTime();
    const live = claims.filter((claim) => Math.abs(now - claim.at) < STORED_FILE_CLAIM_LEASE_MS);
    // Newest first: the newest claim holds the file as it last stood.
    const abandoned = claims.filter((claim) => !live.includes(claim))
      .sort((left, right) => right.at - left.at || (left.name < right.name ? 1 : -1));
    if (!standing) {
      if (live.length > 0 || abandoned.length === 0) {
        return { state: live.length > 0 ? 'busy' : 'absent', changed: false };
      }
      const [newest, ...older] = abandoned;
      try {
        await this.fileSystem.rename(path.join(folder, newest.name), path.join(folder, saved), { overwrite: false });
      } catch {
        // Another writer put it back, or took the name: nothing more here until the next look.
        return { state: (await storedFileExists(this.fileSystem, path.join(folder, saved))) ? 'present' : 'busy', changed: false };
      }
      this.log.appendLine(`${this.config.logPrefix} Put back ${this.logName(saved)}, left mid-rewrite.`);
      await this.removeLeftovers(folder, saved, older);
      return { state: 'present', changed: true };
    }
    return { state: 'present', changed: await this.removeLeftovers(folder, saved, abandoned) };
  }

  /** Abandoned claims beside a standing file: the bytes it held before a committed rewrite. Removed, never put back. */
  private async removeLeftovers(folder: string, saved: string, leftovers: readonly Claim[]): Promise<boolean> {
    let removed = false;
    for (const claim of leftovers) {
      if (await deleteStoredFileQuietly(this.fileSystem, path.join(folder, claim.name))) {
        removed = true;
        this.log.appendLine(`${this.config.logPrefix} Removed an earlier version of ${this.logName(saved)}, left by a rewrite.`);
      }
    }
    return removed;
  }

  /** The folder's entries; none when the folder is not there; undefined when it could not be read. */
  private async entriesOf(folder: string): Promise<string[] | undefined> {
    try {
      return (await this.fileSystem.readDirectory(folder)).map(([name]) => name);
    } catch (error) {
      return isMissingFileSystemPathError(error) ? [] : undefined;
    }
  }

  private claimsOf(entries: readonly string[], saved: string): Claim[] {
    return entries.flatMap((name) => {
      const match = this.config.claimPattern.exec(name);
      return match && match[1] === saved ? [{ name, at: Number(match[2]) }] : [];
    });
  }
}

export async function storedFileExists(fileSystem: FileSystem, filePath: string): Promise<boolean> {
  try {
    await fileSystem.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Best effort, for a temporary file or a claim: whether it was there to delete. */
export async function deleteStoredFileQuietly(fileSystem: FileSystem, filePath: string): Promise<boolean> {
  try {
    await fileSystem.delete(filePath);
    return true;
  } catch {
    // The write may have failed before the file existed, or another writer removed it.
    return false;
  }
}

export function storedFileErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
