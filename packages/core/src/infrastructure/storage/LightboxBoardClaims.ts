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
 * The mechanics are `StoredFileClaims`', shared with the Workshop's
 * project memory store; this module names the Lightbox's claims (their
 * pattern and log prefix) and keeps the board's file-name helpers, which
 * serve the store's new-file writes too.
 */

import * as path from 'node:path';
import type { FileSystem, LogSink } from '@/platform';
import {
  STORED_FILE_CLAIM_LEASE_MS,
  StoredFileClaims,
  storedFileExists,
  type StoredFileClaimState
} from '@/infrastructure/storage/StoredFileClaims';

const LOG = '[LightboxBoardStore]';

/** A claim's name: the saved file's own name, hidden, then when it was taken and the writer's private id. Never listed. */
export const LIGHTBOX_BOARD_CLAIM = /^\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z(?:-\d+)?\.board\.json)\.claim-(\d{13})-[A-Za-z0-9-]+$/;

/** How long a claim is live (`STORED_FILE_CLAIM_LEASE_MS`). */
export const LIGHTBOX_BOARD_CLAIM_LEASE_MS = STORED_FILE_CLAIM_LEASE_MS;

/**
 * What a saved name is once its claims are settled: standing, gone (neither
 * the file nor a claim is there), held by a live claim, or not known (its
 * folder could not be read).
 */
export type LightboxBoardClaimState = StoredFileClaimState;

/** The boards folder's claims: `StoredFileClaims` over the Lightbox's claim names and log prefix. */
export class LightboxBoardClaims extends StoredFileClaims {
  constructor(fileSystem: FileSystem, log: LogSink, now: () => Date) {
    super(fileSystem, log, now, { claimPattern: LIGHTBOX_BOARD_CLAIM, logPrefix: LOG });
  }
}

/** The timestamp's name, or the first numbered one free: a save never takes an existing file's name. */
export async function freeBoardFileName(fileSystem: FileSystem, folder: string, stamp: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const name = attempt === 1 ? `${stamp}.board.json` : `${stamp}-${attempt}.board.json`;
    if (!(await storedFileExists(fileSystem, path.join(folder, name)))) {
      return name;
    }
  }
}
