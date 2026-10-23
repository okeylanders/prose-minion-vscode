/**
 * Claims when the file system fails or another window moves first (PR #164
 * re-review, 2026-10-23; `LightboxBoardClaims`, `LightboxBoardStore`).
 *
 * - **A delete is acknowledged only once no earlier version can come back
 *   (F-01).** A leftover that would not go, or a folder that could not be
 *   read while the delete held the file (first or when it looked again),
 *   puts the board back exactly as it was and says the delete `failed`.
 *   Past the lease, the board is the latest version, never the earlier one.
 * - **Every `missing` a read returns is classified (F-02).** A board put
 *   back from an abandoned claim and claimed again by another window before
 *   it was read again is `busy`, not gone; a folder that could not be read
 *   is `unreadable`, never gone; the claim stays as it was.
 * - **Controls:** a delete whose own claim will not go puts the latest bytes
 *   back and says `failed`; once the file system recovers, the same delete
 *   succeeds and nothing comes back; a read with a healthy folder recovers
 *   the claim.
 *
 * The board is the production service's measure of ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain). Names are made up.
 */
import type { LightboxBoard } from '@messages';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { LIGHTBOX_BOARD_CLAIM_LEASE_MS } from '@/infrastructure/storage/LightboxBoardClaims';
import { everyKindBoard } from '@/__tests__/infrastructure/lightbox/lightboxSavedBoardFixtures';
import { deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';
import {
  PAST_LEASE,
  SAVED_AT,
  claimBy,
  claimOf,
  everyFile,
  fileIdOf,
  named,
  pathOf,
  readSaved as read,
  storeHost as host,
  text
} from '@/__tests__/infrastructure/storage/lightboxBoardStoreHost';

let BOARD: LightboxBoard;
let TEXT: string;

beforeAll(async () => {
  ({ board: BOARD, text: TEXT } = await everyKindBoard());
});

/**
 * A board saved as "Original" and renamed "Renamed" by window `a`, whose
 * clean-up of its claim failed: the renamed file stands, with the original's
 * bytes beside it in that claim. `stuck` keeps that claim from being
 * deleted while it is true.
 */
async function renamedWithLeftover() {
  const fileSystem = new MemoryFileSystem();
  const mine = host(fileSystem, 'a');
  const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT, name: 'Original' }));
  const failures = { stuck: true };
  const remove = fileSystem.delete.bind(fileSystem);
  jest.spyOn(fileSystem, 'delete').mockImplementation(async (filePath) => {
    if (failures.stuck && claimBy('a')(filePath)) {
      throw new Error(`EBUSY: ${filePath}`);
    }
    return remove(filePath);
  });
  expect(await mine.store.replace({ fileId }, named('Renamed'), { renames: true })).toEqual({ kind: 'replaced', fileId });
  const leftover = claimOf(fileId, SAVED_AT, 'a3');
  expect(fileSystem.files.has(leftover)).toBe(true);
  return { fileSystem, fileId, leftover, failures, renamed: text(fileSystem.files.get(pathOf(fileId))) };
}

/** After the lease, a healthy window's listing and read: the board as it stands then. */
async function pastTheLease(fileSystem: MemoryFileSystem, fileId: string) {
  const later = host(fileSystem, 'd', [], { at: PAST_LEASE });
  const listed = (await later.store.list(BOARD.source)).entries.map((entry) => entry.name ?? null);
  const opened = await later.store.read(fileId);
  return { listed, name: opened.kind === 'board' ? opened.file.board.name : opened.kind };
}

describe('a delete that cannot retire an earlier version is not acknowledged (F-01)', () => {
  it('a leftover that will not go: the delete fails, the latest board stays as it was, and past the lease it is still the latest', async () => {
    const { fileSystem, fileId, leftover, failures, renamed } = await renamedWithLeftover();

    const fresh = host(fileSystem, 'c');
    expect(await fresh.store.delete(fileId)).toEqual({ kind: 'failed' });

    expect(text(fileSystem.files.get(pathOf(fileId)))).toBe(renamed);
    expect(fileSystem.files.has(leftover)).toBe(true);
    failures.stuck = false;
    expect(await pastTheLease(fileSystem, fileId)).toEqual({ listed: ['Renamed'], name: 'Renamed' });
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });

  it('a folder that cannot be read while the delete holds the file: the delete fails, and past the lease the board is still the latest', async () => {
    const { fileSystem, fileId, failures, renamed } = await renamedWithLeftover();
    failures.stuck = false;

    const fresh = host(fileSystem, 'c');
    // The delete's look for earlier versions, made while it holds the file, fails.
    jest.spyOn(fileSystem, 'readDirectory').mockRejectedValueOnce(new Error('EIO: the boards folder'));
    expect(await fresh.store.delete(fileId)).toEqual({ kind: 'failed' });

    expect(text(fileSystem.files.get(pathOf(fileId)))).toBe(renamed);
    expect(await pastTheLease(fileSystem, fileId)).toEqual({ listed: ['Renamed'], name: 'Renamed' });
  });

  it('a folder that cannot be read when the delete looks again: the delete fails, and the board stays as it was', async () => {
    const { fileSystem, fileId, failures, renamed } = await renamedWithLeftover();
    failures.stuck = false;
    const readDirectory = fileSystem.readDirectory.bind(fileSystem);
    let looks = 0;
    jest.spyOn(fileSystem, 'readDirectory').mockImplementation(async (folder) => {
      looks += 1;
      if (looks === 2) {
        throw new Error('EIO: the boards folder');
      }
      return readDirectory(folder);
    });

    const fresh = host(fileSystem, 'c');
    expect(await fresh.store.delete(fileId)).toEqual({ kind: 'failed' });

    expect(text(fileSystem.files.get(pathOf(fileId)))).toBe(renamed);
    expect((await fresh.store.read(fileId)).kind).toBe('board');
  });

  it('control: once the leftover goes, the same delete succeeds, and nothing comes back past the lease', async () => {
    const { fileSystem, fileId, failures } = await renamedWithLeftover();
    const fresh = host(fileSystem, 'c');
    expect(await fresh.store.delete(fileId)).toEqual({ kind: 'failed' });
    failures.stuck = false;

    expect(await fresh.store.delete(fileId)).toEqual({ kind: 'deleted' });
    expect(await pastTheLease(fileSystem, fileId)).toEqual({ listed: [], name: 'missing' });
    expect(everyFile(fileSystem)).toEqual([]);
  });

  it('control: a delete whose own claim will not go fails, and the latest bytes are back under the saved name', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host(fileSystem, 'a');
    const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT, name: 'Original' }));
    await mine.store.replace({ fileId }, named('Renamed'), { renames: true });
    const renamed = text(fileSystem.files.get(pathOf(fileId)));
    const remove = fileSystem.delete.bind(fileSystem);
    jest.spyOn(fileSystem, 'delete').mockImplementation(async (filePath) => {
      if (claimBy('c')(filePath)) {
        throw new Error(`EBUSY: ${filePath}`);
      }
      return remove(filePath);
    });

    expect(await host(fileSystem, 'c').store.delete(fileId)).toEqual({ kind: 'failed' });
    expect(text(fileSystem.files.get(pathOf(fileId)))).toBe(renamed);
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });
});

describe('a read classifies every missing file (F-02)', () => {
  it('a board put back from an abandoned claim, then claimed by another window before it is read again, is busy, not gone', async () => {
    const fileSystem = new MemoryFileSystem();
    const reader = host(fileSystem, 'x');
    const fileId = fileIdOf(await reader.store.save({ board: BOARD, text: TEXT, name: 'Original' }));
    const abandoned = claimOf(fileId, SAVED_AT - LIGHTBOX_BOARD_CLAIM_LEASE_MS - 1, 'gone1');
    await fileSystem.rename(pathOf(fileId), abandoned);
    // Hold the reader once it has put the board back, before it reads it again.
    const putBack = deferred<void>();
    const resume = deferred<void>();
    const rename = fileSystem.rename.bind(fileSystem);
    jest.spyOn(fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      await rename(fromPath, toPath, options);
      if (fromPath === abandoned) {
        putBack.resolve();
        await resume.promise;
      }
    });
    // Hold the other window once it has claimed the file, as it checks the claimed bytes.
    const claimed = deferred<void>();
    const commit = deferred<void>();
    const readFile = fileSystem.readFile.bind(fileSystem);
    jest.spyOn(fileSystem, 'readFile').mockImplementation(async (filePath) => {
      if (claimBy('y')(filePath)) {
        claimed.resolve();
        await commit.promise;
      }
      return readFile(filePath);
    });

    const reading = reader.store.read(fileId);
    await putBack.promise;
    const other = host(fileSystem, 'y');
    const renaming = other.store.replace({ fileId }, named('Renamed'), { renames: true });
    await claimed.promise;
    resume.resolve();

    expect(await reading).toEqual({ kind: 'busy' });
    commit.resolve();
    expect(await renaming).toEqual({ kind: 'replaced', fileId });
    expect(read(fileSystem, fileId).board.name).toBe('Renamed');
  });

  it('a folder that cannot be read is unreadable, never gone, and the claim stays as it was; read again with the folder healthy, the board is back', async () => {
    const fileSystem = new MemoryFileSystem();
    const { store } = host(fileSystem, 'x');
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT, name: 'Original' }));
    const abandoned = claimOf(fileId, SAVED_AT - LIGHTBOX_BOARD_CLAIM_LEASE_MS - 1, 'gone1');
    await fileSystem.rename(pathOf(fileId), abandoned);
    jest.spyOn(fileSystem, 'readDirectory').mockRejectedValueOnce(new Error('EIO: the boards folder'));

    expect(await store.read(fileId)).toEqual({ kind: 'unreadable', reason: 'Its folder could not be read.' });
    expect(fileSystem.files.has(abandoned)).toBe(true);
    expect(fileSystem.files.has(pathOf(fileId))).toBe(false);

    expect(await store.read(fileId)).toMatchObject({ kind: 'board', file: { board: { name: 'Original' } } });
  });

  it('control: a folder that is not there at all is gone', async () => {
    const { store } = host(new MemoryFileSystem(), 'x');
    expect(await store.read('drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json')).toEqual({ kind: 'missing' });
  });
});
