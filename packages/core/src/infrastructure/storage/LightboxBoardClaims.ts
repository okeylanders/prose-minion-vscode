/**
 * Claims on saved boards' files (Slice 5A.1; PR #164 F-01, F-02). A rewrite
 * in place, and a delete, first *claim* the saved file: an atomic rename,
 * never over anything, to a hidden name of their own that records when it
 * was taken (`.<saved name>.claim-<epoch ms>-<writer's id>`). While a claim
 * holds it, the saved name stands empty, so no other writer (another
 * window's store) can claim, rewrite or delete the file.
 *
 * - **Live or abandoned, by age.** A writer holds its claim for the few file
 *   operations between taking it and committing. A claim younger than the
 *   lease (`LIGHTBOX_BOARD_CLAIM_LEASE_MS`) is live and is never touched by
 *   anyone else; an older one was abandoned (its window closed mid-write).
 *   A writer stalled longer than the lease can lose its claim: then its
 *   commit finds the claim gone and writes nothing (`LightboxBoardRewrite`).
 *   The one race left needs that stall *and* another window's recovery and
 *   delete inside the stalled writer's last file operation; the slice notes
 *   record it.
 * - **Settling a saved name** (on a listing that finds claims, and when a
 *   read, a rewrite or a delete finds the file gone):
 *   - a live claim with the saved name empty: the file is **busy**;
 *   - no live claim, the saved name empty: the newest abandoned claim holds
 *     the board as it last stood, and goes back under the saved name, never
 *     over anything;
 *   - beside a standing file, an abandoned claim is a rewrite's leftover
 *     (the bytes the file held before a committed rewrite whose clean-up
 *     failed), and is removed, never put back.
 * - **A delete retires a file's leftovers.** Holding the file under its own
 *   claim, a delete removes every other claim of that saved name, of any
 *   age, and looks again: only when none is left may it remove its own
 *   (PR #164 F-01, re-review). No earlier version can come back after a
 *   delete.
 * - **A folder that cannot be read is not an empty one** (PR #164 F-01,
 *   F-02, re-review). Only a folder that is not there counts as holding
 *   nothing; any other error leaves the state `unknown`, never `absent`.
 * - **Logs** carry file names, never the writer's text or a name.
 *
 * The small file helpers at the end serve the store's new-file writes too.
 */

import * as path from 'node:path';
import type { FileSystem, LogSink } from '@/platform';
import { isMissingFileSystemPathError } from '@/infrastructure/storage/fileSystemErrors';

const LOG = '[LightboxBoardStore]';

/** A claim's name: the saved file's own name, hidden, then when it was taken and the writer's private id. Never listed. */
export const LIGHTBOX_BOARD_CLAIM = /^\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:-\d+)?\.board\.json)\.claim-(\d{13})-[A-Za-z0-9-]+$/;

/**
 * How long a claim is live. A rewrite holds its claim for a few file
 * operations; thirty seconds leaves room for a busy extension host, and is
 * how long a board cut off mid-rewrite stays hidden before a listing or a
 * read puts it back.
 */
export const LIGHTBOX_BOARD_CLAIM_LEASE_MS = 30_000;

/**
 * What a saved name is once its claims are settled: standing, gone (neither
 * the file nor a claim is there), held by a live claim, or not known (its
 * folder could not be read).
 */
export type LightboxBoardClaimState = 'present' | 'absent' | 'busy' | 'unknown';

interface Claim {
  name: string;
  at: number;
}

export class LightboxBoardClaims {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly log: LogSink,
    private readonly now: () => Date
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
  async settle(filePath: string): Promise<LightboxBoardClaimState> {
    const folder = path.dirname(filePath);
    const entries = await this.entriesOf(folder);
    if (!entries) {
      this.log.appendLine(`${LOG} Could not look for ${path.basename(filePath)}'s claims; it is not taken for gone.`);
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
      const saved = LIGHTBOX_BOARD_CLAIM.exec(entry)?.[1];
      return saved ? [saved] : [];
    }));
    let changed = false;
    for (const saved of savedNames) {
      changed = (await this.settleName(folder, saved, entries)).changed || changed;
    }
    return changed;
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
    const others = (entries: readonly string[]) => claimsOf(entries, saved).filter((claim) => claim.name !== path.basename(own));
    const entries = await this.entriesOf(folder);
    if (!entries) {
      this.log.appendLine(`${LOG} Could not look for earlier versions of ${saved}; it was not deleted.`);
      return false;
    }
    for (const claim of others(entries)) {
      if (await deleteBoardFileQuietly(this.fileSystem, path.join(folder, claim.name))) {
        this.log.appendLine(`${LOG} Removed an earlier version of ${saved}, left by a rewrite, with it.`);
      }
    }
    const after = await this.entriesOf(folder);
    if (!after || others(after).length > 0) {
      this.log.appendLine(`${LOG} An earlier version of ${saved} could not be removed, or the folder could not be read again; it was not deleted.`);
      return false;
    }
    return true;
  }

  private async settleName(folder: string, saved: string, entries: readonly string[]): Promise<{ state: LightboxBoardClaimState; changed: boolean }> {
    const claims = claimsOf(entries, saved);
    const standing = entries.includes(saved);
    if (claims.length === 0) {
      return { state: standing ? 'present' : 'absent', changed: false };
    }
    const now = this.now().getTime();
    const live = claims.filter((claim) => Math.abs(now - claim.at) < LIGHTBOX_BOARD_CLAIM_LEASE_MS);
    // Newest first: the newest claim holds the board as its saved file last stood.
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
        return { state: (await boardFileExists(this.fileSystem, path.join(folder, saved))) ? 'present' : 'busy', changed: false };
      }
      this.log.appendLine(`${LOG} Put back ${saved}, left mid-rewrite.`);
      await this.removeLeftovers(folder, saved, older);
      return { state: 'present', changed: true };
    }
    return { state: 'present', changed: await this.removeLeftovers(folder, saved, abandoned) };
  }

  /** Abandoned claims beside a standing file: the bytes it held before a committed rewrite. Removed, never put back. */
  private async removeLeftovers(folder: string, saved: string, leftovers: readonly Claim[]): Promise<boolean> {
    let removed = false;
    for (const claim of leftovers) {
      if (await deleteBoardFileQuietly(this.fileSystem, path.join(folder, claim.name))) {
        removed = true;
        this.log.appendLine(`${LOG} Removed an earlier version of ${saved}, left by a rewrite.`);
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
}

function claimsOf(entries: readonly string[], saved: string): Claim[] {
  return entries.flatMap((name) => {
    const match = LIGHTBOX_BOARD_CLAIM.exec(name);
    return match && match[1] === saved ? [{ name, at: Number(match[2]) }] : [];
  });
}

export async function boardFileExists(fileSystem: FileSystem, filePath: string): Promise<boolean> {
  try {
    await fileSystem.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/** The timestamp's name, or the first numbered one free: a save never takes an existing file's name. */
export async function freeBoardFileName(fileSystem: FileSystem, folder: string, stamp: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const name = attempt === 1 ? `${stamp}.board.json` : `${stamp}-${attempt}.board.json`;
    if (!(await boardFileExists(fileSystem, path.join(folder, name)))) {
      return name;
    }
  }
}

/** Best effort, for a temporary file or a claim: whether it was there to delete. */
export async function deleteBoardFileQuietly(fileSystem: FileSystem, filePath: string): Promise<boolean> {
  try {
    await fileSystem.delete(filePath);
    return true;
  } catch {
    // The write may have failed before the file existed, or another writer removed it.
    return false;
  }
}
