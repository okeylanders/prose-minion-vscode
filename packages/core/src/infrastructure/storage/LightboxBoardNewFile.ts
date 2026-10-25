/**
 * A new saved board's file (Slice 5A; split from `LightboxBoardStore` in
 * Slice 5A.2, which owns the queue and calls this inside it). Staged in a
 * temporary sibling private to this write (a random id in its name, so
 * another store on the same workspace, in another window, never writes over
 * it: PR #163 F-03); then the caller's commit point (`beforeCommit`), run
 * synchronously with nothing awaited between it and the rename; then the
 * rename, which never overwrites. A final name another writer took first is
 * never reported as this save: the next free name is taken and the commit
 * point runs again, a few times at most. `onCommitted` runs synchronously
 * once the file stands; the store logs the save there. Logs never carry the
 * writer's text.
 */

import * as path from 'node:path';
import type { FileSystem, LogSink } from '@/platform';
import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';
import { LIGHTBOX_BOARDS_DISPLAY_PATH } from '@/infrastructure/storage/LightboxBoardFiles';
import { boardFileExists, deleteBoardFileQuietly, freeBoardFileName } from '@/infrastructure/storage/LightboxBoardClaims';

const LOG = '[LightboxBoardStore]';
/** A commit that finds its final name taken tries the next free one, this many times at most. */
const COMMIT_ATTEMPTS = 3;

export interface LightboxBoardNewFile {
  /** `prose-minion/boards` in the workspace's one folder. */
  directory: string;
  /** The source's folder (`lightboxBoardFolder`). */
  folderName: string;
  savedAt: Date;
  bytes: Uint8Array;
  beforeCommit?: () => boolean;
  /** Called synchronously once the file stands. */
  onCommitted: (fileId: string) => void;
}

export type LightboxBoardNewFileResult =
  | { kind: 'saved'; fileId: string }
  | { kind: 'withdrawn' }
  | { kind: 'failed'; error: unknown }
  /** The path would leave the boards folder; nothing was written. */
  | { kind: 'refused' };

/** Write `write.bytes` as a new file of its source's folder: staged, then committed by a rename that never overwrites. */
export async function writeNewLightboxBoardFile(
  fileSystem: FileSystem,
  log: LogSink,
  mintStagingId: () => string,
  write: LightboxBoardNewFile
): Promise<LightboxBoardNewFileResult> {
  const { directory, folderName, savedAt, bytes } = write;
  const folder = path.join(directory, folderName);
  const stamp = savedAt.toISOString().replace(/[:.]/g, '-');
  // Private to this write: another store on this workspace never stages under the same name.
  const temporaryPath = path.join(folder, `.${stamp}.board.json.tmp-${mintStagingId()}`);
  if (!isPathWithinRoot(directory, temporaryPath)) {
    log.appendLine(`${LOG} Refused to write outside ${LIGHTBOX_BOARDS_DISPLAY_PATH}.`);
    return { kind: 'refused' };
  }
  const fail = async (error: unknown): Promise<LightboxBoardNewFileResult> => {
    await deleteBoardFileQuietly(fileSystem, temporaryPath);
    return { kind: 'failed', error };
  };
  try {
    await fileSystem.createDirectory(folder);
    await fileSystem.writeFile(temporaryPath, bytes);
  } catch (error) {
    return fail(error);
  }
  for (let attempt = 1; ; attempt++) {
    const name = await freeBoardFileName(fileSystem, folder, stamp);
    const finalPath = path.join(folder, name);
    // The commit point: nothing is awaited between it and the rename that commits.
    if (write.beforeCommit && !write.beforeCommit()) {
      await deleteBoardFileQuietly(fileSystem, temporaryPath);
      return { kind: 'withdrawn' };
    }
    try {
      await fileSystem.rename(temporaryPath, finalPath, { overwrite: false });
    } catch (error) {
      // Another writer took the name between the look and the rename: take the next one; this save's bytes are still staged.
      if (attempt < COMMIT_ATTEMPTS && await boardFileExists(fileSystem, finalPath) && await boardFileExists(fileSystem, temporaryPath)) {
        continue;
      }
      return fail(error);
    }
    const fileId = `${folderName}/${name}`;
    write.onCommitted(fileId);
    return { kind: 'saved', fileId };
  }
}
