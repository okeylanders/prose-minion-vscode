/**
 * LightboxBoardStore's rewrites in place (Slice 5A.1; epic decisions 33 and
 * 35): a board named, or a spark set aside, on the file that holds it.
 *
 * - **Atomic.** The new bytes are staged under a name private to the write,
 *   the saved file is claimed (renamed, never over anything, to a name of
 *   its own), and the staged file takes the saved name, never over
 *   anything. One file stands after, with its id and save time; nothing is
 *   left over; no rename overwrites.
 * - **Never a file it cannot read,** nor one holding another board, nor one
 *   with a part left out (a rename may replace a name that did not read).
 * - **A delete stays a delete.** In this store the queue orders the two; in
 *   another window's store, a file deleted before the claim cannot be
 *   claimed, so it is never brought back, and a delete that finds the file
 *   claimed says it is busy, never that it deleted it.
 * - **Two windows renaming one file:** the last to commit wins, a rewrite
 *   that finds the file changed since it read it reads again (keeping the
 *   other writer's change), one that finds it claimed says busy, and each
 *   reports only bytes it wrote.
 * - **A spark set aside** changes the file in place: no new file.
 *
 * What becomes of a claim, live, abandoned or left beside a committed
 * rewrite, and why a delete is never undone, is `LightboxBoardClaims.test.ts`
 * (PR #164 F-01, F-02).
 *
 * The board is the production service's measure of ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain), with every reading kind.
 * Names are made up.
 */
import * as path from 'node:path';
import type { LightboxBoard, LightboxReadingGroup } from '@messages';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import { LightboxBoardStore } from '@/infrastructure/storage/LightboxBoardStore';
import { namedLightboxBoardFile, type LightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';
import { setLightboxSparkDismissed } from '@/infrastructure/lightbox/LightboxSparkLane';
import { everyKindBoard } from '@/__tests__/infrastructure/lightbox/lightboxSavedBoardFixtures';
import { deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';
import {
  SAVED_AT,
  claimBy,
  everyFile,
  fileIdOf,
  named,
  pathOf,
  readSaved as read,
  storeHost as host
} from '@/__tests__/infrastructure/storage/lightboxBoardStoreHost';

const NAME = '3.2.1 - after the cut - model B';

let BOARD: LightboxBoard;
let TEXT: string;
let SPARK: string;

beforeAll(async () => {
  ({ board: BOARD, text: TEXT } = await everyKindBoard());
  const spark = BOARD.readings.flatMap((group) => group.tiles).find((tile) => tile.kind === 'spark');
  if (!spark) {
    throw new Error('the every-kind board holds a spark');
  }
  SPARK = spark.id;
});

/** The spark set aside on the file's readings, as the library's spark rewrite does. */
const sparkSetAside = (file: LightboxBoardFile): LightboxBoardFile | undefined => {
  const marked = setLightboxSparkDismissed(file.board.readings, SPARK, true);
  return marked.ok && marked.changed ? { ...file, board: { ...file.board, readings: marked.readings } } : undefined;
};
const sparkOf = (readings: readonly LightboxReadingGroup[]) =>
  readings.flatMap((group) => group.tiles).find((tile) => tile.id === SPARK);

describe('a rewrite in place is atomic', () => {
  it('stages the new bytes privately, claims the file, then gives the staged bytes its name: one file after, nothing overwritten', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    const name = path.basename(fileId);
    const before = read(fileSystem, fileId);
    fileSystem.renameCalls.length = 0;
    const atCommit: string[] = [];

    const result = await store.replace({ fileId, boardId: BOARD.boardId }, named(NAME), {
      renames: true,
      beforeCommit: () => {
        atCommit.push(...everyFile(fileSystem).map((file) => path.basename(file)));
        return true;
      }
    });

    expect(result).toEqual({ kind: 'replaced', fileId });
    // At the commit point the file is claimed under a name of its own, and the new bytes are staged beside it.
    expect(atCommit.sort()).toEqual([`.${name}.claim-${SAVED_AT}-s3`, `.${name}.tmp-s2`]);
    expect(fileSystem.renameCalls.map((call) => [path.basename(call.fromPath), path.basename(call.toPath), call.overwrite])).toEqual([
      [name, `.${name}.claim-${SAVED_AT}-s3`, false],
      [`.${name}.tmp-s2`, name, false]
    ]);
    expect(everyFile(fileSystem)).toEqual([fileId]);
    const after = read(fileSystem, fileId);
    expect(after.board.name).toBe(NAME);
    expect(after.savedAt).toBe(before.savedAt);
    expect(namedLightboxBoardFile(after, undefined)).toEqual(before);
  });

  it('writes nothing when the update changes nothing', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT, name: NAME }));
    const bytes = fileSystem.files.get(pathOf(fileId));
    fileSystem.renameCalls.length = 0;

    expect(await store.replace({ fileId }, () => undefined)).toEqual({ kind: 'unchanged', fileId });
    expect(fileSystem.renameCalls).toEqual([]);
    expect(fileSystem.files.get(pathOf(fileId))).toBe(bytes);
  });

  it('puts the file back as it was when the commit point declines', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    const bytes = fileSystem.files.get(pathOf(fileId));

    expect(await store.replace({ fileId }, named(NAME), { beforeCommit: () => false })).toEqual({ kind: 'withdrawn' });
    expect(everyFile(fileSystem)).toEqual([fileId]);
    expect(new TextDecoder().decode(fileSystem.files.get(pathOf(fileId)))).toBe(new TextDecoder().decode(bytes));
  });

  it('a spark set aside rewrites the file that holds the board, and writes no new file', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    expect(sparkOf(read(fileSystem, fileId).board.readings)).not.toHaveProperty('dismissedOrder');

    expect(await store.replace({ fileId, boardId: BOARD.boardId }, sparkSetAside)).toEqual({ kind: 'replaced', fileId });

    expect(everyFile(fileSystem)).toEqual([fileId]);
    expect(sparkOf(read(fileSystem, fileId).board.readings)).toMatchObject({ kind: 'spark', dismissedOrder: 1 });
    expect((await store.list(BOARD.source)).entries.map((entry) => entry.fileId)).toEqual([fileId]);
  });
});

describe('a rewrite never touches a file it cannot read', () => {
  it('leaves a file that does not read as a board exactly as it is', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    const garbage = new TextEncoder().encode('{ "formatVersion": 1, "kind": "lightbox-board"');
    fileSystem.files.set(pathOf(fileId), garbage);
    fileSystem.renameCalls.length = 0;

    expect(await store.replace({ fileId }, named(NAME), { renames: true })).toEqual({ kind: 'unreadable' });
    expect(fileSystem.files.get(pathOf(fileId))).toBe(garbage);
    expect(fileSystem.renameCalls).toEqual([]);
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });

  it('leaves a file holding another board, or one with a part left out, as it is; a rename may replace a name that did not read', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    expect(await store.replace({ fileId, boardId: 'board-another' }, named(NAME), { renames: true })).toEqual({ kind: 'unreadable' });

    // A hand-edited tile that no longer reads: rewriting would lose it.
    const edited = JSON.parse(new TextDecoder().decode(fileSystem.files.get(pathOf(fileId))));
    edited.board.readings[0].tiles[0].kind = 'not-a-kind';
    fileSystem.setJson(pathOf(fileId), edited);
    const bytes = fileSystem.files.get(pathOf(fileId));
    expect(await store.replace({ fileId }, named(NAME), { renames: true })).toEqual({ kind: 'unreadable' });
    expect(fileSystem.files.get(pathOf(fileId))).toBe(bytes);

    // A name that does not read is the one part a rename replaces.
    const second = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    const badName = JSON.parse(new TextDecoder().decode(fileSystem.files.get(pathOf(second))));
    badName.board = { boardId: badName.board.boardId, name: 'two\nlines', ...badName.board };
    fileSystem.setJson(pathOf(second), badName);
    expect(await store.replace({ fileId: second }, sparkSetAside)).toEqual({ kind: 'unreadable' });
    expect(await store.replace({ fileId: second }, named(NAME), { renames: true })).toEqual({ kind: 'replaced', fileId: second });
    expect(read(fileSystem, second).board.name).toBe(NAME);
  });

  it('says a missing file is missing and writes nothing, and keeps a session-only store\'s hands off the disk', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    const absent = fileId.replace('14-05-09-123Z', '14-05-09-124Z');
    expect(await store.replace({ fileId: absent }, named(NAME), { renames: true })).toEqual({ kind: 'missing' });
    expect(await store.replace(() => undefined, named(NAME))).toEqual({ kind: 'missing' });
    expect(await store.replace({ fileId: '../../outside.board.json' }, named(NAME))).toEqual({ kind: 'missing' });
    expect(everyFile(fileSystem)).toEqual([fileId]);

    const session = new LightboxBoardStore(fileSystem, createFakeWorkspace({ workspaceFolders: () => [] }), { appendLine: jest.fn() } as never);
    expect(await session.replace({ fileId }, named(NAME))).toEqual({ kind: 'session' });
    expect(read(fileSystem, fileId).board.name).toBeUndefined();
  });
});

describe('a rename racing a delete never brings the board back', () => {
  it('in one store: the queue runs the delete first, and the rename finds nothing', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT }));

    const [deleted, renamed] = await Promise.all([store.delete(fileId), store.replace({ fileId }, named(NAME), { renames: true })]);

    expect([deleted, renamed]).toEqual([{ kind: 'deleted' }, { kind: 'missing' }]);
    expect(everyFile(fileSystem)).toEqual([]);
  });

  it('across two windows: deleted after the rename read it and before its claim, the board stays deleted', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host(fileSystem, 'a');
    const theirs = host(fileSystem, 'b');
    const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT }));
    // Hold this window's rename at its claim, once its bytes are staged.
    const gate = deferred<void>();
    const reached = deferred<void>();
    const rename = fileSystem.rename.bind(fileSystem);
    jest.spyOn(fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      if (claimBy('a')(toPath)) {
        reached.resolve();
        await gate.promise;
      }
      return rename(fromPath, toPath, options);
    });

    const renaming = mine.store.replace({ fileId }, named(NAME), { renames: true });
    await reached.promise;
    expect(await theirs.store.delete(fileId)).toEqual({ kind: 'deleted' });
    gate.resolve();

    expect(await renaming).toEqual({ kind: 'missing' });
    expect(everyFile(fileSystem)).toEqual([]);
  });

  it('across two windows: a delete that finds the file claimed says it is busy, and the renamed board stands', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host(fileSystem, 'a');
    const theirs = host(fileSystem, 'b');
    const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT }));
    // Hold this window's rename once it has claimed the file, as it checks the claimed bytes.
    const gate = deferred<void>();
    const reached = deferred<void>();
    const readFile = fileSystem.readFile.bind(fileSystem);
    jest.spyOn(fileSystem, 'readFile').mockImplementation(async (filePath) => {
      if (claimBy('a')(filePath)) {
        reached.resolve();
        await gate.promise;
      }
      return readFile(filePath);
    });

    const renaming = mine.store.replace({ fileId }, named(NAME), { renames: true });
    await reached.promise;
    expect(await theirs.store.delete(fileId)).toEqual({ kind: 'busy' });
    gate.resolve();

    expect(await renaming).toEqual({ kind: 'replaced', fileId });
    expect(everyFile(fileSystem)).toEqual([fileId]);
    expect(read(fileSystem, fileId).board.name).toBe(NAME);
  });
});

describe('two windows renaming one file', () => {
  it('one after the other: the last wins', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host(fileSystem, 'a');
    const theirs = host(fileSystem, 'b');
    const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT }));

    expect(await mine.store.replace({ fileId }, named('model A'), { renames: true })).toEqual({ kind: 'replaced', fileId });
    expect(await theirs.store.replace({ fileId }, named(NAME), { renames: true })).toEqual({ kind: 'replaced', fileId });

    expect(read(fileSystem, fileId).board.name).toBe(NAME);
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });

  it('read before the other committed: the later rewrite finds the file changed, reads it again, and keeps the other\'s change', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host(fileSystem, 'a');
    const theirs = host(fileSystem, 'b');
    const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT }));
    // Hold the other window's rename once it has read the file, as it stages its bytes.
    const gate = deferred<void>();
    const reached = deferred<void>();
    const writeFile = fileSystem.writeFile.bind(fileSystem);
    let held = false;
    jest.spyOn(fileSystem, 'writeFile').mockImplementation(async (filePath, data) => {
      if (filePath.includes('.tmp-b') && !held) {
        held = true;
        reached.resolve();
        await gate.promise;
      }
      return writeFile(filePath, data);
    });

    const theirRename = theirs.store.replace({ fileId }, named(NAME), { renames: true });
    await reached.promise;
    // Meanwhile this window sets a spark aside on the same file, and commits.
    expect(await mine.store.replace({ fileId }, sparkSetAside)).toEqual({ kind: 'replaced', fileId });
    gate.resolve();

    expect(await theirRename).toEqual({ kind: 'replaced', fileId });
    const after = read(fileSystem, fileId);
    expect(after.board.name).toBe(NAME);
    expect(sparkOf(after.board.readings)).toMatchObject({ dismissedOrder: 1 });
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });

  it('while the other holds its claim: says busy and writes nothing, and the other\'s name stands', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host(fileSystem, 'a');
    const theirs = host(fileSystem, 'b');
    const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT }));
    const gate = deferred<void>();
    const reached = deferred<void>();
    const readFile = fileSystem.readFile.bind(fileSystem);
    jest.spyOn(fileSystem, 'readFile').mockImplementation(async (filePath) => {
      if (claimBy('a')(filePath)) {
        reached.resolve();
        await gate.promise;
      }
      return readFile(filePath);
    });

    const myRename = mine.store.replace({ fileId }, named('model A'), { renames: true });
    await reached.promise;
    expect(await theirs.store.replace({ fileId }, named(NAME), { renames: true })).toEqual({ kind: 'busy' });
    gate.resolve();

    expect(await myRename).toEqual({ kind: 'replaced', fileId });
    expect(read(fileSystem, fileId).board.name).toBe('model A');
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });
});

describe('logs', () => {
  it('never carry a name', async () => {
    const { store, lines } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT, name: NAME }));
    await store.replace({ fileId }, named('model A'), { renames: true });
    await store.replace({ fileId: 'drafts-alice-1-md-9b099095/2026-10-22T14-05-09-999Z.board.json' }, named('model C'), { renames: true });
    expect(lines.join('\n')).not.toMatch(/model A|model B|model C|after the cut/);
  });
});
