/**
 * A restore that finds its board's file under a claim (PR #164 F-02),
 * through the real handlers, service, runner, store and library
 * (`lightboxBoardsHarness`).
 *
 * - **Left mid-rewrite.** A window closed after a rename or a spark's
 *   rewrite claimed the file, more than the lease ago: the store's read puts
 *   the board back under its saved name, the restore reopens it, and the
 *   reload pointer stays.
 * - **Held now.** A live claim (another window mid-rewrite) is busy: nothing
 *   is restored this time, the claim is left alone, and the pointer stays,
 *   so a later session restores the board.
 * - **Only neither file nor claim forgets the pointer** (the 5A tech debt's
 *   rule, `LightboxSparkSaves.test.ts`).
 * - **The newer source still wins:** a source chosen while the restore's
 *   read puts the board back keeps the screen.
 * - **Only established absence forgets the pointer** (PR #164 re-review,
 *   2026-10-23). A board put back from an abandoned claim, then claimed by
 *   another window's rewrite before the restore reads it again, is busy:
 *   nothing is restored and the pointer stays. A folder that cannot be read
 *   is not an empty one: the pointer stays, and the claim with it.
 *
 * The chapter is ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public
 * domain), read from the worked examples. No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as path from 'node:path';
import { MessageType } from '@/shared/types/messages';
import { namedLightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';
import { LIGHTBOX_BOARD_POINTER_KEY } from '@/infrastructure/storage/LightboxBoardStore';
import { LIGHTBOX_BOARD_CLAIM_LEASE_MS } from '@/infrastructure/storage/LightboxBoardClaims';
import { LIGHTBOX_BOARD_NOTICES } from '@/application/services/lightbox/LightboxBoardLibrary';
import { CHAPTER, CHAPTER_PATH, SAVED_AT, WORKSPACE, createLightboxBoardsHost, quiet } from './lightboxBoardsHarness';
import { deferred } from './lightboxHandlerHarness';

type Host = ReturnType<typeof createLightboxBoardsHost>;

const BOARDS = path.posix.join(WORKSPACE, 'prose-minion', 'boards');
const OTHER_PATH = 'Drafts/alice-2.md';
const OTHER = 'Alice opened the little door and looked along the passage into the loveliest garden you ever saw.';
/** The harness's claim clock, and a claim taken more than the lease before it. */
const CLAIM_CLOCK = SAVED_AT(0);
const ABANDONED_AT = CLAIM_CLOCK - LIGHTBOX_BOARD_CLAIM_LEASE_MS - 1;

/** The chapter boarded and read in a first session: the read board's file is the reload pointer. */
async function readChapter() {
  const host = createLightboxBoardsHost();
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  host.writeChapter(OTHER_PATH, OTHER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  await tab.read();
  await quiet();
  return { host, pointed: pointer(host) as string };
}

const pointer = (host: Host) => (host.memory.values.get(LIGHTBOX_BOARD_POINTER_KEY) as { fileId?: string } | undefined)?.fileId;
const filePath = (fileId: string) => path.posix.join(BOARDS, fileId);

/** Move a saved file under a claim taken at `at`, as a window closed mid-rewrite leaves it; the claim's path. */
function claim(host: Host, fileId: string, at: number): string {
  const claimPath = path.posix.join(path.posix.dirname(filePath(fileId)), `.${path.posix.basename(fileId)}.claim-${at}-closed1`);
  const bytes = host.fileSystem.files.get(filePath(fileId));
  if (!bytes) {
    throw new Error(`${fileId} is not on disk`);
  }
  host.fileSystem.files.set(claimPath, bytes);
  host.fileSystem.files.delete(filePath(fileId));
  return claimPath;
}

/** A new session over the same files and memento, mounted as the tab mounts. */
async function reload(host: Host, claimNow?: () => number) {
  const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory, ...(claimNow ? { claimNow } : {}) });
  const tab = next.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  return { next, tab };
}

describe('a restore whose file a rewrite left under a claim', () => {
  it('puts the board back and restores it, when the claim was abandoned; the pointer stays', async () => {
    const { host, pointed } = await readChapter();
    const readings = host.service.currentBoard()?.readings.length;
    const claimPath = claim(host, pointed, ABANDONED_AT);

    const { next } = await reload(host);

    expect(next.service.currentBoard()?.readings).toHaveLength(readings as number);
    expect(next.service.savable(next.service.currentBoard()?.boardId as string)?.savedFileId).toBe(pointed);
    expect(pointer(host)).toBe(pointed);
    expect(host.fileSystem.files.has(filePath(pointed))).toBe(true);
    expect(host.fileSystem.files.has(claimPath)).toBe(false);
    expect(next.logged()).toContain(`Restored ${pointed}`);
  });

  it('restores nothing while the claim is live, leaves it alone and keeps the pointer; a later session restores the board', async () => {
    const { host, pointed } = await readChapter();
    const claimPath = claim(host, pointed, CLAIM_CLOCK);

    const { next } = await reload(host);

    expect(next.service.currentBoard()).toBeUndefined();
    expect(pointer(host)).toBe(pointed);
    expect(host.fileSystem.files.has(claimPath)).toBe(true);
    expect(next.logged()).toContain(`Could not restore ${pointed}: ${LIGHTBOX_BOARD_NOTICES.busy}`);

    // Past the lease the claim is abandoned: the next session puts the board back and restores it.
    const { next: later } = await reload(host, () => CLAIM_CLOCK + LIGHTBOX_BOARD_CLAIM_LEASE_MS + 1);
    expect(later.service.savable(later.service.currentBoard()?.boardId as string)?.savedFileId).toBe(pointed);
    expect(host.fileSystem.files.has(filePath(pointed))).toBe(true);
    expect(pointer(host)).toBe(pointed);
  });

  it('yields to a source chosen while its read puts the board back', async () => {
    const { host, pointed } = await readChapter();
    claim(host, pointed, ABANDONED_AT);
    const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const tab = next.openTab();
    // Held at the read after the put-back: the claim is settled, the board not yet read.
    const read = next.holdBoardRead();

    const mounting = tab.shelf(null);
    await tab.choose(OTHER_PATH);
    read.release();
    await mounting;
    await quiet();

    expect(next.service.currentBoard()?.source.displayPath).toBe(OTHER_PATH);
    expect(next.logged()).toContain(`[LightboxBoardLibrary] Dropped the restore of ${pointed}: a newer source was chosen`);
    // The board went back under its name all the same: nothing is left hidden.
    expect(host.fileSystem.files.has(filePath(pointed))).toBe(true);
  });
});

describe('a restore forgets the pointer only when the board is shown gone (PR #164 re-review)', () => {
  it('a board put back, then claimed by another window before the restore reads it again, is busy: nothing restored, the pointer kept', async () => {
    const { host, pointed } = await readChapter();
    const claimPath = claim(host, pointed, ABANDONED_AT);
    const next = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const other = createLightboxBoardsHost({ fileSystem: host.fileSystem, memory: host.memory });
    const tab = next.openTab();
    // Hold the restore once its read has put the board back, before it reads it again.
    const putBack = deferred<void>();
    const resume = deferred<void>();
    const rename = host.fileSystem.rename.bind(host.fileSystem);
    jest.spyOn(host.fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      await rename(fromPath, toPath, options);
      if (fromPath === claimPath) {
        putBack.resolve();
        await resume.promise;
      }
    });
    // Hold the other window's rename once it has claimed the file, as it checks the claimed bytes.
    const claimed = deferred<void>();
    const commit = deferred<void>();
    const readFile = host.fileSystem.readFile.bind(host.fileSystem);
    jest.spyOn(host.fileSystem, 'readFile').mockImplementation(async (filePath) => {
      if (/\.claim-\d{13}-/.test(filePath) && filePath !== claimPath) {
        claimed.resolve();
        await commit.promise;
      }
      return readFile(filePath);
    });

    const mounting = tab.shelf(null);
    await putBack.promise;
    const renaming = other.store.replace({ fileId: pointed }, (file) => namedLightboxBoardFile(file, 'model A'), { renames: true });
    await claimed.promise;
    resume.resolve();
    await mounting;
    await quiet();

    expect(next.service.currentBoard()).toBeUndefined();
    expect(pointer(host)).toBe(pointed);
    expect(next.logged()).toContain(`Could not restore ${pointed}: ${LIGHTBOX_BOARD_NOTICES.busy}`);

    commit.resolve();
    expect(await renaming).toEqual({ kind: 'replaced', fileId: pointed });
    expect(host.fileSystem.files.has(filePath(pointed))).toBe(true);
    expect(pointer(host)).toBe(pointed);
  });

  it('a folder that cannot be read keeps the pointer and the claim; a later session restores the board', async () => {
    const { host, pointed } = await readChapter();
    const claimPath = claim(host, pointed, ABANDONED_AT);
    const readDirectory = host.fileSystem.readDirectory.bind(host.fileSystem);
    const failing = jest.spyOn(host.fileSystem, 'readDirectory').mockImplementation(async (folder) => {
      if (folder.startsWith(BOARDS)) {
        throw new Error(`EIO: ${folder}`);
      }
      return readDirectory(folder);
    });

    const { next } = await reload(host);

    expect(next.service.currentBoard()).toBeUndefined();
    expect(pointer(host)).toBe(pointed);
    expect(host.fileSystem.files.has(claimPath)).toBe(true);
    expect(next.logged()).toContain(`Could not restore ${pointed}: ${LIGHTBOX_BOARD_NOTICES.unreadable}`);

    failing.mockRestore();
    const { next: later } = await reload(host);
    expect(later.service.savable(later.service.currentBoard()?.boardId as string)?.savedFileId).toBe(pointed);
    expect(host.fileSystem.files.has(filePath(pointed))).toBe(true);
  });
});
