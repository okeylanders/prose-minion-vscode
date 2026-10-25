/**
 * Saving a Lightbox board, at its turn in `LightboxBoardStore`'s queue
 * (Slice 5A.2, epic decision 46; split from the store for PR #167): in
 * place, when a file holds the board and can be rewritten at the revision
 * its window knows; otherwise to a new file, staged, then committed by a
 * rename that never overwrites.
 *
 * - **In place, or a new file.** A file that cannot be rewritten (gone,
 *   held by another window, a part left out, changed since, a failed write)
 *   is left as it is, and the board is saved to a new file in the same turn.
 * - **The store's save status (PR #167 F-01, N-01).** Every commit, in
 *   place or new, says boards are saved again before the caller hears it;
 *   every save that writes nothing it was owed (a board that would not read
 *   back whole, a refused path, a failed write) says the last save failed.
 *   The shelf reads that status, so it never says "Saved" over a lost save.
 * - **Logs** carry file ids, counts and reasons, never the writer's text.
 */

import type { FileSystem, LogSink } from '@/platform';
import { decodeLightboxBoardFile, encodeLightboxBoardFile, type LightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';
import { writeNewLightboxBoardFile } from '@/infrastructure/storage/LightboxBoardNewFile';
import type { LightboxBoardRewrites } from '@/infrastructure/storage/LightboxBoardRewrite';
import type {
  LightboxBoardCommitted,
  LightboxBoardSaveInput,
  LightboxBoardSaveOptions,
  LightboxBoardSaveResult
} from '@/infrastructure/storage/LightboxBoardStoreContracts';
import {
  errorMessage,
  lightboxBoardFilePath,
  lightboxBoardFolder,
  lightboxBoardRevision,
  lightboxSavedSourceKey,
  type LightboxBoardFiles
} from '@/infrastructure/storage/LightboxBoardFiles';

const encoder = new TextEncoder();
const LOG = '[LightboxBoardStore]';

export interface LightboxBoardSavingPorts {
  fileSystem: FileSystem;
  log: LogSink;
  files: LightboxBoardFiles;
  rewrites: LightboxBoardRewrites;
  mintStagingId: () => string;
  now: () => Date;
  /** The store's save status: a commit clears a failure; a save that wrote nothing it owed records one. */
  status: { committed: () => void; failed: () => void };
}

/** Save `input` (read at this turn when a function) under `directory`, the store's boards folder. */
export async function saveLightboxBoard(
  ports: LightboxBoardSavingPorts,
  directory: string,
  input: LightboxBoardSaveInput | (() => LightboxBoardSaveInput | undefined),
  options: LightboxBoardSaveOptions
): Promise<LightboxBoardSaveResult> {
  const { log, files, rewrites, now, status } = ports;
  // One clock reading per save, taken when first needed: a save held back by `onlyIfNewText` reads none.
  let at: Date | undefined;
  const savedAt = () => (at ??= now());
  const committed = (fileId: string, write: LightboxBoardCommitted) => {
    status.committed();
    options.onCommitted?.(fileId, write);
  };
  const target = options.inPlace?.holding();
  const filePath = target && lightboxBoardFilePath(directory, target.fileId);
  if (options.inPlace && target && filePath) {
    const { update } = options.inPlace;
    let written: LightboxBoardFile | undefined;
    const result = await rewrites.rewrite(target, filePath, (file) => (written = update(file, savedAt())), {
      beforeCommit: options.beforeCommit,
      onCommitted: ({ fileId, revision }) => committed(fileId, { revision, ...(written?.board.name !== undefined ? { name: written.board.name } : {}) })
    });
    if (result.kind === 'replaced' || result.kind === 'unchanged') {
      return { kind: 'replaced', fileId: result.fileId };
    }
    if (result.kind === 'withdrawn') {
      return result;
    }
    // Never lost, never over what cannot be read: the board goes to a new file, and its file stays as it is.
    log.appendLine(`${LOG} ${target.fileId} could not be saved in place (${result.kind}); the board is saved to a new file.`);
  }
  const saving = typeof input === 'function' ? input() : input;
  if (!saving) {
    return { kind: 'withdrawn' };
  }
  if (options.onlyIfNewText) {
    // The source's whole history, never a page of it: the newest file holding this text.
    const key = lightboxSavedSourceKey(saving.board.source);
    const same = (await files.list(directory, saving.board.source)).entries
      .find((entry) => entry.sourceKey === key && entry.contentHash === saving.board.source.contentHash);
    if (same) {
      return { kind: 'held', fileId: same.fileId };
    }
  }
  const name = saving.name ?? options.defaultName?.(savedAt());
  const json = encodeLightboxBoardFile({ board: saving.board, text: saving.text, savedAt: savedAt(), name });
  const check = decodeLightboxBoardFile(json);
  if (check.kind !== 'board' || check.dropped > 0) {
    log.appendLine(`${LOG} A board would not read back whole (${check.kind === 'invalid' ? `${check.reason} at ${check.at ?? 'the file'}` : `${check.dropped} parts dropped`}); it was not saved.`);
    status.failed();
    return { kind: 'failed' };
  }
  const bytes = encoder.encode(json);
  const result = await writeNewLightboxBoardFile(ports.fileSystem, log, ports.mintStagingId, {
    directory,
    folderName: lightboxBoardFolder(saving.board.source),
    savedAt: savedAt(),
    bytes,
    beforeCommit: options.beforeCommit,
    onCommitted: (fileId) => {
      log.appendLine(`${LOG} Saved ${fileId} (${bytes.byteLength} bytes).`);
      committed(fileId, { revision: lightboxBoardRevision(bytes), ...(name !== undefined ? { name } : {}) });
    }
  });
  switch (result.kind) {
    case 'saved':
    case 'withdrawn':
      return result;
    case 'refused':
      status.failed();
      return { kind: 'failed' };
    case 'failed':
      status.failed();
      log.appendLine(`${LOG} Could not save a board; it stays for this session: ${errorMessage(result.error)}`);
      return { kind: 'failed' };
  }
}
