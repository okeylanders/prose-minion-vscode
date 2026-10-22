/**
 * LightboxBoardStore's history and its writers (PR #163 F-03 and F-04).
 *
 * - **Whole histories.** A source's saved boards are listed every one,
 *   however many there are, and the same-text check that keeps a source's
 *   first measured board from saving twice reads them all.
 * - **Folders of their own.** Two sources whose paths slug alike never share
 *   a folder, so neither hides, or counts, the other's files.
 * - **Private staging.** Two stores on one workspace (two windows) saving
 *   the same source in the same millisecond each stage their own bytes, and
 *   each reports only the file that holds its own board. A final name that
 *   stays taken fails the save; it never reports another writer's file.
 *
 * File ids are taken from what each save returns, not spelled out. The
 * boards are the production service's measures of ¶1–¶8 and ¶1–¶7 of
 * "Alice's Adventures in Wonderland" (1865, public domain).
 */
import * as path from 'node:path';
import type { LightboxBoard } from '@messages';
import type { LogSink } from '@/platform';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import { LightboxBoardStore, lightboxBoardSlug, type LightboxBoardSaveResult } from '@/infrastructure/storage/LightboxBoardStore';
import { everyKindBoard } from '@/__tests__/infrastructure/lightbox/lightboxSavedBoardFixtures';
import { ALICE } from '@/__tests__/infrastructure/lightbox/lightboxOpinionFixtures';
import { boardWithNumbers } from '@/__tests__/infrastructure/lightbox/lightboxCraftFixtures';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';

const ROOT = '/workspace';
const BOARDS = path.join(ROOT, 'prose-minion', 'boards');
/** More than the two hundred files the folder was once cut to. */
const MANY = 205;

let BOARD: LightboxBoard;
let TEXT: string;
/** The same source measured from its first seven paragraphs: another text of it. */
let SHORTER: LightboxBoard;
let SHORTER_TEXT: string;

beforeAll(async () => {
  ({ board: BOARD, text: TEXT } = await everyKindBoard());
  const shorter = await boardWithNumbers(ALICE.slice(0, 7));
  SHORTER = { ...shorter, source: { ...shorter.source, displayPath: BOARD.source.displayPath } };
  SHORTER_TEXT = ALICE.slice(0, 7).join('\n\n');
});

function logSink(lines: string[] = []): LogSink {
  return { appendLine: (line: string) => { lines.push(line); }, show: jest.fn(), clear: jest.fn() } as unknown as LogSink;
}

/** A store on the one-folder workspace over `fileSystem`, saving by `clock`. */
function storeOn(fileSystem: MemoryFileSystem, clock: () => Date): LightboxBoardStore {
  const workspace = createFakeWorkspace({ workspaceFolders: () => [{ path: ROOT, name: 'workspace' }] });
  return new LightboxBoardStore(fileSystem, workspace, logSink(), { now: clock });
}

/** A clock a minute further on at each reading. */
function minutes(from = '2026-10-01T09:00:00.000Z'): () => Date {
  let at = Date.parse(from);
  return () => new Date((at += 60_000));
}

function fileIdOf(result: LightboxBoardSaveResult): string {
  if (result.kind !== 'saved') {
    throw new Error(`expected a save, got ${result.kind}`);
  }
  return result.fileId;
}

const folderOf = (fileId: string) => fileId.split('/')[0];
const measuredOnly = (board: LightboxBoard): LightboxBoard =>
  ({ ...board, readings: board.readings.map((group) => emptyLightboxReadingGroup(group.group)) });

describe('a source\'s whole history (PR #163 F-04)', () => {
  it('lists every saved board past two hundred, newest first, and finds its text in the oldest', async () => {
    const fileSystem = new MemoryFileSystem();
    const store = storeOn(fileSystem, minutes());
    const oldest = fileIdOf(await store.save({ board: measuredOnly(BOARD), text: TEXT }));
    for (let index = 0; index < MANY; index++) {
      fileIdOf(await store.save({ board: SHORTER, text: SHORTER_TEXT }));
    }

    const listing = await store.list(BOARD.source);

    expect(listing.unreadable).toBe(0);
    expect(listing.entries).toHaveLength(MANY + 1);
    expect(listing.entries.at(-1)?.fileId).toBe(oldest);
    const times = listing.entries.map((entry) => entry.savedAt);
    expect(times).toEqual([...times].sort((left, right) => right - left));
    // The same-text check reads the whole history: the oldest file holds this text, so nothing is written.
    expect(await store.save({ board: measuredOnly(BOARD), text: TEXT }, { onlyIfNewText: true })).toEqual({ kind: 'held', fileId: oldest });
    expect((await store.list(BOARD.source)).entries).toHaveLength(MANY + 1);
  });
});

describe('sources whose paths slug alike (PR #163 F-04)', () => {
  const neighbourOf = (board: LightboxBoard): LightboxBoard => ({ ...board, source: { ...board.source, displayPath: 'drafts/alice 1.md' } });

  it('keep folders of their own: neither hides nor counts the other\'s files', async () => {
    const fileSystem = new MemoryFileSystem();
    const store = storeOn(fileSystem, minutes());
    const neighbour = neighbourOf(BOARD);
    expect(lightboxBoardSlug(neighbour.source)).toBe(lightboxBoardSlug(BOARD.source));
    const mine = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    // Many more of the neighbour's, and a file in its folder that does not read.
    let theirs = '';
    for (let index = 0; index < MANY; index++) {
      theirs = fileIdOf(await store.save({ board: measuredOnly(neighbour), text: TEXT }));
    }
    fileSystem.files.set(path.join(BOARDS, folderOf(theirs), '2026-09-30T09-00-00-000Z.board.json'), new TextEncoder().encode('{ "formatVersion": 1'));

    expect(folderOf(mine)).not.toBe(folderOf(theirs));
    expect(await store.list(BOARD.source)).toEqual({ entries: [expect.objectContaining({ fileId: mine })], unreadable: 0 });
    const listing = await store.list(neighbour.source);
    expect(listing.entries).toHaveLength(MANY);
    expect(listing.unreadable).toBe(1);
    expect(listing.entries.every((entry) => entry.sourceKey === 'file:drafts/alice 1.md')).toBe(true);
  });

  it('list only their own boards, even with another source\'s file copied into the folder', async () => {
    const fileSystem = new MemoryFileSystem();
    const store = storeOn(fileSystem, minutes());
    const mine = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    const theirs = fileIdOf(await store.save({ board: neighbourOf(BOARD), text: TEXT }));
    const copied = path.join(BOARDS, folderOf(mine), '2026-09-30T09-00-00-000Z.board.json');
    fileSystem.files.set(copied, fileSystem.files.get(path.join(BOARDS, theirs)) as Uint8Array);

    expect((await store.list(BOARD.source)).entries.map((entry) => entry.fileId)).toEqual([mine]);
  });
});

describe('two stores on one workspace (PR #163 F-03)', () => {
  it('each stage their own bytes, and each report only the file that holds their board', async () => {
    const fileSystem = new MemoryFileSystem();
    const instant = () => new Date('2026-10-22T14:05:09.123Z');
    const first = storeOn(fileSystem, instant);
    const second = storeOn(fileSystem, instant);
    const staged: string[] = [];
    const write = fileSystem.writeFile.bind(fileSystem);
    jest.spyOn(fileSystem, 'writeFile').mockImplementation(async (filePath, data) => {
      staged.push(filePath);
      return write(filePath, data);
    });
    // Each commit waits until both are staged and have chosen a final name, so the two race for one name.
    const rename = fileSystem.rename.bind(fileSystem);
    let arrived = 0;
    let bothArrived!: () => void;
    const together = new Promise<void>((resolve) => {
      bothArrived = resolve;
    });
    jest.spyOn(fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      arrived += 1;
      if (arrived === 2) {
        bothArrived();
      }
      if (arrived <= 2) {
        await together;
      }
      return rename(fromPath, toPath, options);
    });
    const otherWindow: LightboxBoard = { ...BOARD, boardId: 'board-other-window' };

    const [saved, alsoSaved] = await Promise.all([
      first.save({ board: BOARD, text: TEXT }),
      second.save({ board: otherWindow, text: TEXT })
    ]);

    expect(staged).toHaveLength(2);
    expect(new Set(staged).size).toBe(2);
    for (const name of staged) {
      expect(path.basename(name)).toMatch(/\.board\.json\.tmp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
    expect([saved.kind, alsoSaved.kind]).toEqual(['saved', 'saved']);
    expect(fileIdOf(saved)).not.toBe(fileIdOf(alsoSaved));
    const boardIn = async (store: LightboxBoardStore, fileId: string) => {
      const read = await store.read(fileId);
      return read.kind === 'board' ? read.file.board.boardId : read.kind;
    };
    expect(await boardIn(first, fileIdOf(saved))).toBe(BOARD.boardId);
    expect(await boardIn(second, fileIdOf(alsoSaved))).toBe('board-other-window');
    expect([...fileSystem.files.keys()].filter((file) => file.includes('.tmp-'))).toEqual([]);
  });

  it('fails a save whose final name stays taken, never reporting another writer\'s file, and leaves both writers\' files as they are', async () => {
    const fileSystem = new MemoryFileSystem();
    const store = storeOn(fileSystem, () => new Date('2026-10-22T14:05:09.123Z'));
    // Another writer takes each name this store chooses, just before its rename.
    const theirs = new TextEncoder().encode('another writer\'s bytes');
    const rename = fileSystem.rename.bind(fileSystem);
    const taken: string[] = [];
    jest.spyOn(fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      fileSystem.files.set(toPath, theirs);
      taken.push(toPath);
      return rename(fromPath, toPath, options);
    });

    expect(await store.save({ board: BOARD, text: TEXT })).toEqual({ kind: 'failed' });

    expect(taken.length).toBeGreaterThan(1);
    expect(taken.every((file) => fileSystem.files.get(file) === theirs)).toBe(true);
    expect([...fileSystem.files.keys()].sort()).toEqual([...taken].sort());
    expect(store.availability()).toMatchObject({ lastSaveFailed: true });
  });
});
