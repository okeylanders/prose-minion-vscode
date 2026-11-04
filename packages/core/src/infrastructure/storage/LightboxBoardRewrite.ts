/**
 * Rewriting a saved board's file in place (Slice 5A.1; ADR 2026-10-19 D12
 * addendum; epic decisions 33 and 35): a board named or renamed, or a spark
 * set aside, on the file that already holds the board. Split from
 * `LightboxBoardStore`, which owns the queue and calls this inside it; the
 * claim itself, and what becomes of claims left behind, are
 * `LightboxBoardClaims`'.
 *
 * - **Only a whole board.** The file is read and checked first: it reads
 *   whole (a rename may replace a name that did not read, and nothing else
 *   left out) and holds the board expected. A file it cannot read is never
 *   overwritten.
 * - **Staged privately,** under the saved name, hidden, with a random id,
 *   as a new save stages (PR #163 F-03). What would be written is decoded
 *   first; a board that would not read back whole is not written.
 * - **Claimed, then committed.** The saved file is renamed, never over
 *   anything, to a hidden name private to this write that records when it
 *   was taken (`LightboxBoardClaims`). A rename is atomic, so once the claim
 *   holds no other writer (another window's store) can delete or rewrite
 *   the file; and a file another writer deleted first cannot be claimed, so
 *   a rewrite never brings a deleted board back. The claimed bytes must be
 *   the bytes that were read, or the claim is put back and the file read
 *   again (at most three times). The claim must still be this write's (one
 *   held past the lease may have been put back by another window), then the
 *   commit point runs, the staged file takes the saved name, never over
 *   anything, and the claim is dropped.
 * - **The last rewrite to commit wins,** and each reports only bytes it
 *   wrote. A rewrite that finds the file changed since it read it reads
 *   again; one that finds it claimed by another writer's rewrite says the
 *   board is busy (`busy`), and writes nothing.
 * - **A claim left behind** (a window closed mid-rewrite) is put back under
 *   its saved name once it is older than the lease, when the folder is next
 *   listed or the file next read; a claim left beside a committed rewrite
 *   is removed (`LightboxBoardClaims`). A file found gone is settled first:
 *   held by a live claim, it is busy.
 * - **A save in place (Slice 5A.2, epic decision 46)** names the revision
 *   it expects (the bytes its window last read or wrote): a file found at
 *   another one (another window changed it since) is `changed`, and is left
 *   as it is; the store then saves the board to a new file, so neither
 *   window's work is lost. Every rewrite reports the revision it read and
 *   the one it wrote, at its commit (`onCommitted`).
 * - **The commit is shared.** Staging, the claim and the commit are
 *   `commitStoredFileRewrite`'s (`StoredFileRewrite`), which the Workshop's
 *   project memory store uses too; this module reads and checks the board
 *   and builds what replaces it.
 * - **Logs** carry file ids and reasons, never the writer's text or a name.
 */

import * as path from 'node:path';
import type { FileSystem, LogSink } from '@/platform';
import {
  decodeLightboxBoardFile,
  writeLightboxBoardFile,
  type LightboxBoardFile
} from '@/infrastructure/storage/LightboxBoardCodec';
import { lightboxBoardRevision, type LightboxBoardFiles } from '@/infrastructure/storage/LightboxBoardFiles';
import {
  freeBoardFileName,
  type LightboxBoardClaimState,
  type LightboxBoardClaims
} from '@/infrastructure/storage/LightboxBoardClaims';
import { commitStoredFileRewrite, type StoredFileRewritePorts } from '@/infrastructure/storage/StoredFileRewrite';

const encoder = new TextEncoder();
const LOG = '[LightboxBoardStore]';
/** A rewrite whose file changed under it reads it again, this many times at most. */
const ATTEMPTS = 3;
/** The one part a rename may find left out of a file and still rewrite it: the name it replaces. */
const NAME_PATH = 'file.board.name';

export type LightboxBoardReplaceResult =
  | { kind: 'replaced'; fileId: string }
  /** The update changed nothing, so nothing was written. */
  | { kind: 'unchanged'; fileId: string }
  /** No file to rewrite: none was named, or it is gone (deleted here or by another writer). */
  | { kind: 'missing' }
  /** Another writer (another window's store) is rewriting or deleting it now; nothing was written. */
  | { kind: 'busy' }
  /** The file does not read whole, or holds another board: left as it is. */
  | { kind: 'unreadable' }
  /** The commit point declined it; the file is as it was. */
  | { kind: 'withdrawn' }
  /** The file is not at the revision the target expected (Slice 5A.2): another writer changed it since; left as it is. */
  | { kind: 'changed' }
  | { kind: 'session' }
  | { kind: 'failed' };

/** The file a rewrite in place changes, and the board it must hold (any board when absent). */
export interface LightboxBoardReplaceTarget {
  fileId: string;
  boardId?: string;
  /** The bytes the file must still hold, by `lightboxBoardRevision` (a save in place, Slice 5A.2); any when absent. */
  revision?: string;
}

export interface LightboxBoardReplaceOptions {
  /** The rewrite sets the board's name, so a name the file held that did not read is replaced, not lost. */
  renames?: boolean;
  /** The commit point, as for a save: synchronous, immediately before the rewrite takes the saved name. */
  beforeCommit?: () => boolean;
  /**
   * Called synchronously once the rewrite stands, before the store's next
   * operation (Slice 5A.2), with the revision it read (`from`) and the one
   * it wrote (`revision`).
   */
  onCommitted?: (committed: { fileId: string; from: string; revision: string }) => void;
}

/** The changed file, or undefined to leave it as it is. */
export type LightboxBoardUpdate = (file: LightboxBoardFile) => LightboxBoardFile | undefined;

export class LightboxBoardRewrites {
  private readonly ports: StoredFileRewritePorts;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly files: LightboxBoardFiles,
    private readonly claims: LightboxBoardClaims,
    private readonly log: LogSink,
    mintStagingId: () => string
  ) {
    this.ports = { fileSystem, claims, log, logPrefix: LOG, noun: 'board', mintStagingId };
  }

  /** Rewrite `filePath`, the file `target` names, by `update`. Run inside the store's queue. */
  async rewrite(
    target: LightboxBoardReplaceTarget,
    filePath: string,
    update: LightboxBoardUpdate,
    options: LightboxBoardReplaceOptions
  ): Promise<LightboxBoardReplaceResult> {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const result = await this.once(target, filePath, update, options);
      if (result !== 'again') {
        return result;
      }
    }
    this.log.appendLine(`${LOG} ${target.fileId} kept changing while it was rewritten; it was left as another writer left it.`);
    return { kind: 'failed' };
  }

  /** One rewrite: read, stage, claim, commit. `again` when the file changed or moved under it. */
  private async once(
    target: LightboxBoardReplaceTarget,
    filePath: string,
    update: LightboxBoardUpdate,
    options: LightboxBoardReplaceOptions
  ): Promise<LightboxBoardReplaceResult | 'again'> {
    const { fileId } = target;
    const { read, bytes } = await this.files.readWithBytes(fileId, filePath);
    if (read.kind === 'missing' || read.kind === 'unavailable') {
      return gone(await this.claims.settle(filePath));
    }
    // Only a whole board is rewritten: a part left out would be lost. A rename replaces a name that did not read.
    const whole = read.kind === 'board' && (read.dropped === 0 || (options.renames === true
      && read.droppedAt.length === read.dropped && read.droppedAt.every((at) => at === NAME_PATH)));
    if (read.kind !== 'board' || !bytes || !whole || (target.boardId !== undefined && read.file.board.boardId !== target.boardId)) {
      this.log.appendLine(`${LOG} ${fileId} was not rewritten: it does not read whole, or holds another board.`);
      return { kind: 'unreadable' };
    }
    if (target.revision !== undefined && read.revision !== target.revision) {
      this.log.appendLine(`${LOG} ${fileId} was not rewritten: another writer changed it since this window read it.`);
      return { kind: 'changed' };
    }
    const next = update(read.file);
    if (!next) {
      return { kind: 'unchanged', fileId };
    }
    const json = writeLightboxBoardFile(next);
    const check = decodeLightboxBoardFile(json);
    if (check.kind !== 'board' || check.dropped > 0 || check.file.board.boardId !== read.file.board.boardId) {
      this.log.appendLine(`${LOG} A rewrite of ${fileId} would not read back whole; it was not written.`);
      return { kind: 'failed' };
    }
    const folder = path.dirname(filePath);
    const stamp = path.basename(filePath).replace(/(?:-\d+)?\.board\.json$/, '');
    const written = encoder.encode(json);
    const outcome = await commitStoredFileRewrite(this.ports, {
      filePath,
      label: fileId,
      read: bytes,
      written,
      beforeCommit: options.beforeCommit,
      onCommitted: () => {
        this.files.forget(fileId);
        options.onCommitted?.({ fileId, from: read.revision, revision: lightboxBoardRevision(written) });
      },
      fallbackPath: async () => path.join(folder, await freeBoardFileName(this.fileSystem, folder, stamp))
    });
    switch (outcome.kind) {
      case 'committed':
        return { kind: 'replaced', fileId };
      case 'again':
        return 'again';
      case 'gone':
        return gone(outcome.state);
      case 'withdrawn':
      case 'failed':
        return { kind: outcome.kind };
    }
  }
}

/** A file found gone, once its claims are settled: put back (read it again), held by a live claim, gone, or not known (failed). */
function gone(state: LightboxBoardClaimState): LightboxBoardReplaceResult | 'again' {
  switch (state) {
    case 'present':
      return 'again';
    case 'busy':
      return { kind: 'busy' };
    case 'absent':
      return { kind: 'missing' };
    case 'unknown':
      return { kind: 'failed' };
  }
}
