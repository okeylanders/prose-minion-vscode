/**
 * One file per board (Lightbox Slice 5A.2; epic decision 41), at the store:
 * a save that names the file holding its board (`inPlace`) rewrites that
 * file through the 5A.1 claim, keeping its id, and records the save's time;
 * a new file names an unnamed board (`defaultName`). When the file cannot
 * be rewritten, the board is saved to a new file in the same turn and the
 * file is left exactly as it was:
 * - another window changed it since this window read it (`changed`);
 * - another window holds it under a live claim (`busy`);
 * - a part of it was left out when it was read (a hand-edited file);
 * - it is gone.
 * Every commit reports the revision it wrote, by SHA-256 of the bytes.
 *
 * The board is the production service's measure of ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain), with every reading kind.
 * Names are made up.
 */
import * as path from 'node:path';
import type { LightboxBoard } from '@messages';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { lightboxBoardFileOf, writeLightboxBoardFile, type LightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';
import { lightboxBoardRevision } from '@/infrastructure/storage/LightboxBoardFiles';
import type { LightboxBoardSaveOptions } from '@/infrastructure/storage/LightboxBoardStore';
import { everyKindBoard } from '@/__tests__/infrastructure/lightbox/lightboxSavedBoardFixtures';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import {
  BOARDS,
  SAVED_AT,
  claimOf,
  everyFile,
  fileIdOf,
  pathOf,
  readSaved as read,
  storeHost as host
} from '@/__tests__/infrastructure/storage/lightboxBoardStoreHost';

const NAME = '3.2.1 - after the cut - model B';
const LATER = SAVED_AT + 60_000;

let BOARD: LightboxBoard;
let TEXT: string;
let MEASURED: LightboxBoard;

beforeAll(async () => {
  ({ board: BOARD, text: TEXT } = await everyKindBoard());
  MEASURED = { ...BOARD, readings: BOARD.readings.map((group) => emptyLightboxReadingGroup(group.group)) };
});

/** The board's first file, measured only, named; its id and the revision this window wrote. */
async function firstSave(fileSystem = new MemoryFileSystem()) {
  const window = host(fileSystem, 'a');
  let revision = '';
  const fileId = fileIdOf(await window.store.save({ board: MEASURED, text: TEXT, name: NAME }, {
    onCommitted: (_id, committed) => {
      revision = committed.revision;
    }
  }));
  return { ...window, fileId, revision };
}

/** A save of `board` in place over `fileId` at `revision`, as the library asks for it, recording what it committed. */
function inPlace(fileId: string, revision: string, board: LightboxBoard = BOARD) {
  const committed: Array<{ fileId: string; name?: string; revision: string }> = [];
  const options: LightboxBoardSaveOptions = {
    inPlace: {
      holding: () => ({ fileId, boardId: board.boardId, revision }),
      update: (file: LightboxBoardFile, savedAt: Date) => lightboxBoardFileOf({ board, text: TEXT, savedAt, name: file.board.name })
    },
    defaultName: () => 'a default name',
    onCommitted: (id, saved) => committed.push({ fileId: id, ...saved })
  };
  return { options, committed };
}

const bytesOf = (fileSystem: MemoryFileSystem, fileId: string) => fileSystem.files.get(pathOf(fileId));

describe('a save in place (decision 41)', () => {
  it('rewrites the file that holds the board: the same id, the board as it stands, the save\'s time, and no other file', async () => {
    const { fileSystem, store, fileId, revision, clock } = await firstSave();
    clock.at = LATER;
    const { options, committed } = inPlace(fileId, revision);

    expect(await store.save({ board: BOARD, text: TEXT }, options)).toEqual({ kind: 'replaced', fileId });

    expect(everyFile(fileSystem)).toEqual([fileId]);
    const file = read(fileSystem, fileId);
    expect(file.savedAt).toBe(new Date(LATER).toISOString());
    expect(file.board.name).toBe(NAME);
    expect(file.board.readings).toEqual(BOARD.readings);
    // The revision reported is the bytes on disk.
    expect(committed).toEqual([{ fileId, name: NAME, revision: lightboxBoardRevision(bytesOf(fileSystem, fileId) as Uint8Array) }]);
  });

  it('writes a new file, named by default, for a board no file holds', async () => {
    const { fileSystem, store } = host(new MemoryFileSystem(), 'a');
    const { options, committed } = inPlace('', '');
    const noFile = { ...options, inPlace: { ...options.inPlace!, holding: () => undefined } };

    const result = await store.save({ board: MEASURED, text: TEXT }, noFile);

    const fileId = fileIdOf(result);
    expect(everyFile(fileSystem)).toEqual([fileId]);
    expect(read(fileSystem, fileId).board.name).toBe('a default name');
    expect(committed).toEqual([{ fileId, name: 'a default name', revision: lightboxBoardRevision(bytesOf(fileSystem, fileId) as Uint8Array) }]);
  });

  it('control: a board with a name keeps it in a new file; with no `defaultName`, a new file is unnamed, as 5A wrote it', async () => {
    const { fileSystem, store } = host(new MemoryFileSystem(), 'a');
    const named = fileIdOf(await store.save({ board: MEASURED, text: TEXT, name: NAME }, { defaultName: () => 'unused' }));
    const unnamed = fileIdOf(await store.save({ board: { ...MEASURED, boardId: 'board-other' }, text: TEXT }));

    expect(read(fileSystem, named).board.name).toBe(NAME);
    expect(read(fileSystem, unnamed).board.name).toBeUndefined();
  });
});

describe('when the file cannot be rewritten, the board goes to a new file and the file stays as it was', () => {
  /** Prepare the board's first file as another window, or a hand, leaves it; then save in place, and return both files. */
  async function fallsBack(prepare: (window: Awaited<ReturnType<typeof firstSave>>) => Promise<void> | void, expectedLog: string) {
    const window = await firstSave();
    await prepare(window);
    const before = bytesOf(window.fileSystem, window.fileId);
    window.clock.at = LATER;
    const { options, committed } = inPlace(window.fileId, window.revision);

    const result = await window.store.save({ board: BOARD, text: TEXT, name: NAME }, options);

    const fileId = fileIdOf(result);
    expect(fileId).not.toBe(window.fileId);
    expect(read(window.fileSystem, fileId).board).toMatchObject({ boardId: BOARD.boardId, name: NAME, readings: BOARD.readings });
    expect(committed.map((entry) => entry.fileId)).toEqual([fileId]);
    const log = window.lines.join('\n');
    expect(log).toContain(`${window.fileId} could not be saved in place (${expectedLog}); the board is saved to a new file.`);
    expect(log).not.toContain(NAME);
    // The file that held the board is exactly as it was before the save.
    expect(bytesOf(window.fileSystem, window.fileId)).toEqual(before);
    return { fileSystem: window.fileSystem, saved: window.fileId, fileId };
  }

  it('another window changed it since this window read it', async () => {
    const { fileSystem, saved, fileId } = await fallsBack(async ({ fileSystem: shared, fileId: own }) => {
      const other = host(shared, 'b');
      await other.store.replace({ fileId: own }, (file) => ({ ...file, board: { ...file.board, name: 'model A' } }), { renames: true });
    }, 'changed');
    expect(everyFile(fileSystem)).toEqual([saved, fileId].sort());
    // The other window's change stands in its file.
    expect(read(fileSystem, saved).board.name).toBe('model A');
  });

  it('another window holds it under a live claim', async () => {
    const { fileSystem, saved, fileId } = await fallsBack(({ fileSystem: shared, fileId: own }) => {
      shared.files.set(claimOf(own, LATER, 'b1'), shared.files.get(pathOf(own)) as Uint8Array);
      shared.files.delete(pathOf(own));
    }, 'busy');
    // The claim is left for its window; the board is in the new file.
    expect(everyFile(fileSystem)).toEqual([path.relative(BOARDS, claimOf(saved, LATER, 'b1')), fileId].sort());
  });

  it('a part of it could not be read (a hand-edited file): never written over', async () => {
    const { fileSystem, saved, fileId } = await fallsBack(({ fileSystem: shared, fileId: own }) => {
      const json = JSON.parse(new TextDecoder().decode(shared.files.get(pathOf(own))));
      json.board.readings[0].tiles.push({ kind: 'not-a-tile' });
      shared.files.set(pathOf(own), new TextEncoder().encode(writeLightboxBoardFile(json)));
    }, 'unreadable');
    expect(everyFile(fileSystem)).toEqual([saved, fileId].sort());
  });

  it('it is gone', async () => {
    const { fileSystem, fileId } = await fallsBack(({ fileSystem: shared, fileId: own }) => {
      shared.files.delete(pathOf(own));
    }, 'missing');
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });

  it('control: at the revision this window knows, the file is rewritten and nothing new is written', async () => {
    const window = await firstSave();
    const { options } = inPlace(window.fileId, window.revision);
    expect((await window.store.save({ board: BOARD, text: TEXT }, options)).kind).toBe('replaced');
    expect(everyFile(window.fileSystem)).toEqual([window.fileId]);
  });

  it('control: the commit point declines it, and nothing is written at all', async () => {
    const window = await firstSave();
    const before = bytesOf(window.fileSystem, window.fileId);
    const { options } = inPlace(window.fileId, window.revision);

    expect(await window.store.save({ board: BOARD, text: TEXT }, { ...options, beforeCommit: () => false })).toEqual({ kind: 'withdrawn' });

    expect(everyFile(window.fileSystem)).toEqual([window.fileId]);
    expect(bytesOf(window.fileSystem, window.fileId)).toEqual(before);
  });
});

describe('the board a save writes is read at its turn', () => {
  it('a save given a function writes the board as it then stands; one that finds none withdraws', async () => {
    const { fileSystem, store } = host(new MemoryFileSystem(), 'a');
    let current: LightboxBoard | undefined = MEASURED;
    const saving = store.save(() => (current ? { board: current, text: TEXT } : undefined));
    current = BOARD;
    const fileId = fileIdOf(await saving);
    expect(read(fileSystem, fileId).board.readings).toEqual(BOARD.readings);

    current = undefined;
    expect(await store.save(() => (current ? { board: current, text: TEXT } : undefined))).toEqual({ kind: 'withdrawn' });
    expect(everyFile(fileSystem)).toEqual([fileId]);
    expect(path.dirname(pathOf(fileId))).toContain('drafts-alice-1-md-');
  });
});
