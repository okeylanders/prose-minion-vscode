/**
 * LightboxBoardStore (ADR 2026-10-19 D12 addendum; Slice 5A; epic decisions
 * 27, 28 and 30): where boards are saved, how a save is staged and
 * committed, that a file the store cannot read is never overwritten or
 * deleted, newest-first listings by source, delete, the reload pointer,
 * path containment, and logs that never carry the writer's text. Whole
 * histories, colliding slugs and two stores on one folder are in
 * `LightboxBoardStoreHistory.test.ts` (PR #163 F-03, F-04).
 *
 * The board is the production service's measure of ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain), read from the worked
 * examples (`lightboxSavedBoardFixtures`).
 */
import * as path from 'node:path';
import type { LightboxBoard } from '@messages';
import type { LogSink } from '@/platform';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import {
  LIGHTBOX_BOARD_POINTER_KEY,
  LightboxBoardStore,
  lightboxBoardFolder,
  lightboxBoardSlug,
  lightboxSavedSourceKey,
  type LightboxBoardMemory
} from '@/infrastructure/storage/LightboxBoardStore';
import { everyKindBoard } from '@/__tests__/infrastructure/lightbox/lightboxSavedBoardFixtures';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';

const ROOT = '/workspace';
const BOARDS = path.join(ROOT, 'prose-minion', 'boards');
/** The source's folder: its slug (`drafts-alice-1-md`), then the first eight hex digits of the SHA-256 of `file:Drafts/alice-1.md`. */
const FOLDER = 'drafts-alice-1-md-9b099095';

let BOARD: LightboxBoard;
let TEXT: string;

beforeAll(async () => {
  ({ board: BOARD, text: TEXT } = await everyKindBoard());
});

function memory(): LightboxBoardMemory & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    get: <T>(key: string) => values.get(key) as T | undefined,
    update: async (key: string, value: unknown) => {
      values.set(key, value);
    }
  };
}

function host(options: { folders?: string[]; clock?: string[] } = {}) {
  const fileSystem = new MemoryFileSystem();
  const folders = options.folders ?? [ROOT];
  const workspace = createFakeWorkspace({ workspaceFolders: () => folders.map((folder) => ({ path: folder, name: path.basename(folder) })) });
  const lines: string[] = [];
  const times = [...(options.clock ?? ['2026-10-22T14:05:09.123Z', '2026-10-22T15:10:00.000Z', '2026-10-22T16:20:30.500Z', '2026-10-23T09:00:00.000Z'])];
  let staged = 0;
  const store = new LightboxBoardStore(fileSystem, workspace, logSink(lines), {
    memory: memoryOf,
    now: () => new Date(times.length > 1 ? (times.shift() as string) : times[0]),
    // Each write's private staging id; a random UUID in production.
    mintStagingId: () => `s${++staged}`
  });
  return { fileSystem, store, lines, folders };
}
let memoryOf: ReturnType<typeof memory>;

function logSink(lines: string[]): LogSink {
  return { appendLine: (line: string) => { lines.push(line); }, show: jest.fn(), clear: jest.fn() } as unknown as LogSink;
}
beforeEach(() => {
  memoryOf = memory();
});

/** The board with no readings: what a source's first build saves. */
function measuredOnly(board: LightboxBoard = BOARD): LightboxBoard {
  return { ...board, readings: board.readings.map((group) => emptyLightboxReadingGroup(group.group)) };
}

const files = (fileSystem: MemoryFileSystem) => [...fileSystem.files.keys()].sort();

describe('LightboxBoardStore: where boards are saved', () => {
  it('saves under prose-minion/boards in a single-folder workspace', () => {
    expect(host().store.availability()).toEqual({ kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false });
  });

  it('keeps boards for the session only with no folder, or with several, and writes nothing', async () => {
    for (const [folders, reason] of [[[], 'no-workspace'], [[ROOT, '/second'], 'multi-root']] as const) {
      const { store, fileSystem } = host({ folders: [...folders] });
      expect(store.availability()).toEqual({ kind: 'session', reason });
      expect(await store.save({ board: BOARD, text: TEXT })).toEqual({ kind: 'session' });
      expect(await store.list(BOARD.source)).toEqual({ entries: [], unreadable: 0 });
      expect(await store.read(`${FOLDER}/2026-10-22T14-05-09-123Z.board.json`)).toEqual({ kind: 'unavailable' });
      expect(files(fileSystem)).toEqual([]);
    }
  });

  it('reads the workspace live: a folder opened later saves', async () => {
    const { store, folders, fileSystem } = host({ folders: [] });
    expect(await store.save({ board: BOARD, text: TEXT })).toEqual({ kind: 'session' });
    folders.push(ROOT);
    // A session-only save reads no clock, so this one takes its first time.
    expect(await store.save({ board: BOARD, text: TEXT })).toEqual({ kind: 'saved', fileId: `${FOLDER}/2026-10-22T14-05-09-123Z.board.json` });
    expect(files(fileSystem)).toEqual([path.join(BOARDS, FOLDER, '2026-10-22T14-05-09-123Z.board.json')]);
  });

  it('names a source\'s folder by its path in lower-case words and a short hash of its key, so no path can leave the boards folder', () => {
    expect(lightboxBoardFolder({ kind: 'file', displayPath: 'Drafts/alice-1.md' })).toBe(FOLDER);
    expect(lightboxBoardFolder({ kind: 'file', displayPath: 'drafts/alice 1.md' })).toBe('drafts-alice-1-md-d72d7266');
    expect(lightboxBoardSlug({ kind: 'file', displayPath: 'Drafts/alice-1.md' })).toBe('drafts-alice-1-md');
    expect(lightboxBoardSlug({ kind: 'file', displayPath: '../../etc/passwd' })).toBe('etc-passwd');
    expect(lightboxBoardSlug({ kind: 'file', displayPath: 'Châpitre/Café été.md' })).toBe('chapitre-cafe-ete-md');
    expect(lightboxBoardSlug({ kind: 'file', displayPath: '///' })).toBe('untitled');
    expect(lightboxBoardSlug({ kind: 'selection', displayPath: 'Drafts/alice-1.md', startLine: 3, endLine: 9 })).toBe('drafts-alice-1-md-lines-3-9');
    expect(lightboxSavedSourceKey({ kind: 'selection', displayPath: 'Drafts/alice-1.md', startLine: 3, endLine: 9 })).toBe('selection:Drafts/alice-1.md:3-9');
    expect(lightboxSavedSourceKey({ kind: 'file', displayPath: 'Drafts/alice-1.md' })).toBe('file:Drafts/alice-1.md');
  });
});

describe('LightboxBoardStore: saving', () => {
  it('stages the board in a temporary sibling, then renames it to a new name without overwriting, and leaves nothing else', async () => {
    const { store, fileSystem } = host();
    const writes: string[] = [];
    const write = fileSystem.writeFile.bind(fileSystem);
    jest.spyOn(fileSystem, 'writeFile').mockImplementation(async (filePath, data) => {
      writes.push(filePath);
      return write(filePath, data);
    });
    const committed: string[] = [];
    const result = await store.save({ board: BOARD, text: TEXT }, {
      beforeCommit: () => {
        // At the commit point the board is staged and not yet in place.
        committed.push(`staged ${files(fileSystem).map((file) => path.basename(file)).join(', ')}`);
        return true;
      }
    });
    const fileId = `${FOLDER}/2026-10-22T14-05-09-123Z.board.json`;
    expect(result).toEqual({ kind: 'saved', fileId });
    expect(writes).toEqual([path.join(BOARDS, FOLDER, '.2026-10-22T14-05-09-123Z.board.json.tmp-s1')]);
    expect(committed).toEqual(['staged .2026-10-22T14-05-09-123Z.board.json.tmp-s1']);
    expect(fileSystem.renameCalls).toEqual([{
      fromPath: path.join(BOARDS, FOLDER, '.2026-10-22T14-05-09-123Z.board.json.tmp-s1'),
      toPath: path.join(BOARDS, FOLDER, '2026-10-22T14-05-09-123Z.board.json'),
      overwrite: false
    }]);
    expect(files(fileSystem)).toEqual([path.join(BOARDS, FOLDER, '2026-10-22T14-05-09-123Z.board.json')]);
    const read = await store.read(fileId);
    expect(read.kind === 'board' && read.file.board.boardId).toBe(BOARD.boardId);
  });

  it('withdraws a save its commit point declines: nothing is put in place, and the staged file is removed', async () => {
    const { store, fileSystem } = host();
    expect(await store.save({ board: BOARD, text: TEXT }, { beforeCommit: () => false })).toEqual({ kind: 'withdrawn' });
    expect(files(fileSystem)).toEqual([]);
    expect(fileSystem.renameCalls).toEqual([]);
  });

  it('records a committed file before its next operation runs', async () => {
    const { store, fileSystem } = host();
    const order: string[] = [];
    const list = fileSystem.readDirectory.bind(fileSystem);
    jest.spyOn(fileSystem, 'readDirectory').mockImplementation(async (directory) => {
      order.push('listed');
      return list(directory);
    });
    const saving = store.save({ board: BOARD, text: TEXT }, { onCommitted: (fileId) => order.push(`committed ${fileId}`) });
    const listing = store.list(BOARD.source);
    await Promise.all([saving, listing]);
    expect(order).toEqual([`committed ${FOLDER}/2026-10-22T14-05-09-123Z.board.json`, 'listed']);
    expect((await listing).entries.map((entry) => entry.fileId)).toEqual([`${FOLDER}/2026-10-22T14-05-09-123Z.board.json`]);
  });

  it('never takes an existing file\'s name: two saves in one millisecond get two files', async () => {
    const { store, fileSystem } = host({ clock: ['2026-10-22T14:05:09.123Z'] });
    expect(await store.save({ board: BOARD, text: TEXT })).toEqual({ kind: 'saved', fileId: `${FOLDER}/2026-10-22T14-05-09-123Z.board.json` });
    expect(await store.save({ board: BOARD, text: TEXT })).toEqual({ kind: 'saved', fileId: `${FOLDER}/2026-10-22T14-05-09-123Z-2.board.json` });
    expect(files(fileSystem).map((file) => path.basename(file))).toEqual(['2026-10-22T14-05-09-123Z-2.board.json', '2026-10-22T14-05-09-123Z.board.json']);
  });

  it('says a save failed, keeps the board for the session, and clears the note on the next save', async () => {
    const { store, fileSystem, lines } = host();
    jest.spyOn(fileSystem, 'writeFile').mockRejectedValueOnce(new Error('EACCES: permission denied'));
    expect(await store.save({ board: BOARD, text: TEXT })).toEqual({ kind: 'failed' });
    expect(store.availability()).toEqual({ kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: true });
    expect(files(fileSystem)).toEqual([]);
    expect(lines).toContain('[LightboxBoardStore] Could not save a board; it stays for this session: EACCES: permission denied');
    expect((await store.save({ board: BOARD, text: TEXT })).kind).toBe('saved');
    expect(store.availability()).toEqual({ kind: 'project', displayPath: 'prose-minion/boards', lastSaveFailed: false });
  });

  it('does not write a board that would not read back whole', async () => {
    const { store, fileSystem, lines } = host();
    const running: LightboxBoard = { ...BOARD, readings: BOARD.readings.map((group, index) => (index === 0 ? { ...group, status: 'running' } : group)) };
    expect(await store.save({ board: running, text: TEXT })).toEqual({ kind: 'failed' });
    expect(files(fileSystem)).toEqual([]);
    expect(lines).toContain('[LightboxBoardStore] A board would not read back whole (shape at file.board.readings[0].status); it was not saved.');
  });

  it('holds a source\'s first measured board when a saved board already holds its text, and saves it when none does', async () => {
    const { store } = host();
    const first = await store.save({ board: BOARD, text: TEXT });
    expect(await store.save({ board: measuredOnly(), text: TEXT }, { onlyIfNewText: true })).toEqual({
      kind: 'held', fileId: first.kind === 'saved' ? first.fileId : ''
    });
    // Another source with no saved board: its first measured board is saved.
    const other: LightboxBoard = { ...measuredOnly(), source: { ...BOARD.source, displayPath: 'Drafts/alice-2.md' } };
    expect(await store.save({ board: other, text: TEXT }, { onlyIfNewText: true }))
      .toEqual({ kind: 'saved', fileId: 'drafts-alice-2-md-47b46978/2026-10-22T15-10-00-000Z.board.json' });
  });
});

describe('LightboxBoardStore: listing, reading and deleting', () => {
  it('lists the source\'s boards newest first, with when, words, the lenses read, which are stale and their cost', async () => {
    const { store } = host();
    await store.save({ board: measuredOnly(), text: TEXT });
    const stale = structuredClone(BOARD);
    stale.readings[0].staleLenses = [{ lens: 'motif', readAgainst: 'f'.repeat(64) }];
    await store.save({ board: BOARD, text: TEXT });
    await store.save({ board: stale, text: TEXT });
    const listing = await store.list(BOARD.source);
    expect(listing.unreadable).toBe(0);
    expect(listing.entries.map((entry) => [entry.fileId, entry.savedAt, entry.wordCount, entry.lenses.length, entry.staleLenses, entry.costUsd])).toEqual([
      [`${FOLDER}/2026-10-22T16-20-30-500Z.board.json`, Date.parse('2026-10-22T16:20:30.500Z'), 508, 20, ['motif'], 0.12],
      [`${FOLDER}/2026-10-22T15-10-00-000Z.board.json`, Date.parse('2026-10-22T15:10:00.000Z'), 508, 20, [], 0.12],
      [`${FOLDER}/2026-10-22T14-05-09-123Z.board.json`, Date.parse('2026-10-22T14:05:09.123Z'), 508, 0, [], undefined]
    ]);
    expect(listing.entries[1].lenses).toEqual([
      'headline', 'motif', 'tension', 'gravity', 'palette', 'characters', 'voice', 'subtext', 'genre', 'lineage', 'spark',
      'stock', 'rhythm', 'numbers', 'template', 'pressure', 'artifacts', 'summary', 'steering', 'opinion'
    ]);
  });

  it('counts a file it cannot read, never overwrites or deletes it, and keeps saving beside it', async () => {
    const { store, fileSystem, lines } = host();
    const garbagePath = path.join(BOARDS, FOLDER, '2026-10-22T15-10-00-000Z.board.json');
    const garbage = new TextEncoder().encode('{ "formatVersion": 1, "kind": "lightbox-board", "savedAt": ');
    fileSystem.files.set(garbagePath, garbage);
    const garbageId = `${FOLDER}/2026-10-22T15-10-00-000Z.board.json`;
    expect(await store.list(BOARD.source)).toEqual({ entries: [], unreadable: 1 });
    expect(await store.read(garbageId)).toEqual({ kind: 'unreadable', reason: 'It is not readable JSON.' });
    expect(await store.delete(garbageId)).toEqual({ kind: 'unreadable' });
    // The clock's first save would take 14:05; the second lands on the garbage file's own time and takes the next name.
    await store.save({ board: BOARD, text: TEXT });
    expect(await store.save({ board: BOARD, text: TEXT })).toEqual({ kind: 'saved', fileId: `${FOLDER}/2026-10-22T15-10-00-000Z-2.board.json` });
    expect(fileSystem.files.get(garbagePath)).toEqual(garbage);
    expect((await store.list(BOARD.source))).toEqual(expect.objectContaining({ unreadable: 1 }));
    expect(lines).toContain(`[LightboxBoardStore] ${garbageId} is not read: not-json.`);
  });

  it('counts a board saved in another format, and a file too large to read, as unreadable', async () => {
    const { store, fileSystem } = host();
    await store.save({ board: BOARD, text: TEXT });
    const saved = path.join(BOARDS, FOLDER, '2026-10-22T14-05-09-123Z.board.json');
    const json = JSON.parse(new TextDecoder().decode(fileSystem.files.get(saved)));
    json.formatVersion = 2;
    fileSystem.files.set(path.join(BOARDS, FOLDER, '2026-10-21T10-00-00-000Z.board.json'), new TextEncoder().encode(JSON.stringify(json)));
    const small = new LightboxBoardStore(fileSystem, createFakeWorkspace({ workspaceFolders: () => [{ path: ROOT, name: 'workspace' }] }), logSink([]), { maximumFileBytes: 1_000 });
    expect(await store.read(`${FOLDER}/2026-10-21T10-00-00-000Z.board.json`)).toEqual({ kind: 'unreadable', reason: 'It was saved in a board format this version does not read.' });
    expect(await small.read(`${FOLDER}/2026-10-22T14-05-09-123Z.board.json`)).toEqual({ kind: 'unreadable', reason: 'It is larger than a saved board can be.' });
    expect((await store.list(BOARD.source)).unreadable).toBe(1);
  });

  it('deletes a board it reads, and it is gone from the list', async () => {
    const { store, fileSystem } = host();
    const first = await store.save({ board: BOARD, text: TEXT });
    const second = await store.save({ board: BOARD, text: TEXT });
    const fileId = first.kind === 'saved' ? first.fileId : '';
    expect(await store.delete(fileId)).toEqual({ kind: 'deleted' });
    expect(await store.delete(fileId)).toEqual({ kind: 'missing' });
    expect((await store.list(BOARD.source)).entries.map((entry) => entry.fileId)).toEqual([second.kind === 'saved' ? second.fileId : '']);
    expect(files(fileSystem)).toHaveLength(1);
  });

  it('refuses a file id that is not the host\'s, so no request reaches outside the boards folder', async () => {
    const { store, fileSystem } = host();
    await store.save({ board: BOARD, text: TEXT });
    for (const fileId of [
      '../../etc/passwd',
      `${FOLDER}/../../secret.board.json`,
      '/workspace/prose-minion/boards/drafts-alice-1-md/2026-10-22T14-05-09-123Z.board.json',
      `${FOLDER}/2026-10-22T14-05-09-123Z.board.json/..`,
      `Drafts/2026-10-22T14-05-09-123Z.board.json`,
      `${FOLDER}/notes.json`
    ]) {
      expect({ fileId, read: await store.read(fileId), deleted: await store.delete(fileId) }).toEqual({ fileId, read: { kind: 'missing' }, deleted: { kind: 'missing' } });
    }
    expect(files(fileSystem)).toHaveLength(1);
  });
});

describe('LightboxBoardStore: the reload pointer', () => {
  it('remembers the file on screen for this folder, forgets it when that file is deleted, and ignores another folder\'s', async () => {
    const { store } = host();
    const saved = await store.save({ board: BOARD, text: TEXT });
    const fileId = saved.kind === 'saved' ? saved.fileId : '';
    expect(store.lastOnScreen()).toBeUndefined();
    store.rememberOnScreen(fileId);
    await Promise.resolve();
    expect(memoryOf.values.get(LIGHTBOX_BOARD_POINTER_KEY)).toEqual({ root: ROOT, fileId });
    expect(store.lastOnScreen()).toBe(fileId);
    memoryOf.values.set(LIGHTBOX_BOARD_POINTER_KEY, { root: '/elsewhere', fileId });
    expect(store.lastOnScreen()).toBeUndefined();
    memoryOf.values.set(LIGHTBOX_BOARD_POINTER_KEY, { root: ROOT, fileId });
    expect(await store.delete(fileId)).toEqual({ kind: 'deleted' });
    await Promise.resolve();
    expect(memoryOf.values.get(LIGHTBOX_BOARD_POINTER_KEY)).toBeUndefined();
  });
});

describe('LightboxBoardStore: logs', () => {
  it('logs ids, counts and reasons, never the writer\'s text', async () => {
    const { store, lines, fileSystem } = host();
    const saved = await store.save({ board: BOARD, text: TEXT });
    await store.list(BOARD.source);
    const fileId = saved.kind === 'saved' ? saved.fileId : '';
    const json = JSON.parse(new TextDecoder().decode(fileSystem.files.get(path.join(BOARDS, fileId))));
    json.board.readings[0].tiles[0].zebraStripes = 1;
    fileSystem.files.set(path.join(BOARDS, FOLDER, '2026-10-20T10-00-00-000Z.board.json'), new TextEncoder().encode(JSON.stringify(json)));
    await store.read(`${FOLDER}/2026-10-20T10-00-00-000Z.board.json`);
    await store.delete(fileId);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    const words = TEXT.split(/\s+/);
    const runs = words.slice(0, -4).map((_word, index) => words.slice(index, index + 5).join(' '));
    const quotes = BOARD.readings.flatMap((group) => group.tiles.flatMap((tile) => tile.evidence.map((quote) => quote.text)));
    for (const line of lines) {
      expect({ line, run: runs.find((run) => line.includes(run)), quote: quotes.find((quote) => quote.length > 12 && line.includes(quote)) })
        .toEqual({ line, run: undefined, quote: undefined });
      expect(line).not.toContain('zebraStripes');
    }
  });
});
