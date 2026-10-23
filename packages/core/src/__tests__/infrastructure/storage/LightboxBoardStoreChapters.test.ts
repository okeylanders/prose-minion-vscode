/**
 * Every chapter's saved boards, at the store (Lightbox Slice 5A.2): the
 * boards browser lists every source's folder under `prose-minion/boards/`,
 * newest first, each folder's boards of its own source (two chapters whose
 * paths slug alike keep folders and rows of their own), with each folder's
 * claims settled as a source's listing settles them (PR #164 F-01, F-02); a
 * folder that cannot be read is counted, never taken for an empty one, and
 * the rest are listed. A file the writer picks is `locate`d: one of the
 * store's own by its id, anything else not; one outside the store is read
 * (`readOutside`) and never written.
 *
 * The board is the production service's measure of ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain).
 */
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { LightboxBoard } from '@messages';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import { LightboxBoardStore } from '@/infrastructure/storage/LightboxBoardStore';
import { encodeLightboxBoardFile } from '@/infrastructure/storage/LightboxBoardCodec';
import { everyKindBoard } from '@/__tests__/infrastructure/lightbox/lightboxSavedBoardFixtures';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import {
  BOARDS,
  PAST_LEASE,
  ROOT,
  SAVED_AT,
  claimOf,
  everyFile,
  fileIdOf,
  pathOf,
  storeHost as host
} from '@/__tests__/infrastructure/storage/lightboxBoardStoreHost';
import { FileType, type FileSystem, type LogSink } from '@/platform';

let BOARD: LightboxBoard;
let TEXT: string;

beforeAll(async () => {
  const fixture = await everyKindBoard();
  BOARD = { ...fixture.board, readings: fixture.board.readings.map((group) => emptyLightboxReadingGroup(group.group)) };
  TEXT = fixture.text;
});

/** The board as measured from `displayPath`, under its own id. */
const of = (displayPath: string, boardId: string): LightboxBoard => ({ ...BOARD, boardId, source: { ...BOARD.source, displayPath } });

function chapters(fileSystem = new MemoryFileSystem()) {
  fileSystem.listsFolders = true;
  return host(fileSystem, 'a');
}

describe('listing every chapter', () => {
  it('lists every source\'s boards, newest first, each with its source, and counts a file that is not a board', async () => {
    const { fileSystem, store, clock } = chapters();
    const first = fileIdOf(await store.save({ board: of('Drafts/alice-1.md', 'board-1'), text: TEXT }));
    clock.at = SAVED_AT + 60_000;
    const second = fileIdOf(await store.save({ board: of('Drafts/alice-2.md', 'board-2'), text: TEXT }));
    fileSystem.files.set(path.join(BOARDS, path.dirname(second), '2026-10-01T00-00-00-000Z.board.json'), new TextEncoder().encode('not a board'));

    const listing = await store.listAll();

    expect(listing.entries.map((entry) => [entry.fileId, entry.source.displayPath, entry.savedAt])).toEqual([
      [second, 'Drafts/alice-2.md', SAVED_AT + 60_000],
      [first, 'Drafts/alice-1.md', SAVED_AT]
    ]);
    expect(listing.entries[0].source).toEqual({ kind: 'file', displayPath: 'Drafts/alice-2.md' });
    expect(listing).toMatchObject({ unreadable: 1, unreadableFolders: 0 });
  });

  it('keeps two chapters whose paths slug alike apart: each in its own folder, each row with its own source', async () => {
    const { store } = chapters();
    const upper = fileIdOf(await store.save({ board: of('Drafts/alice-1.md', 'board-1'), text: TEXT }));
    const spaced = fileIdOf(await store.save({ board: of('drafts/alice 1.md', 'board-2'), text: TEXT }));

    const listing = await store.listAll();

    expect(path.dirname(upper)).not.toBe(path.dirname(spaced));
    expect(path.dirname(upper).startsWith('drafts-alice-1-md-')).toBe(true);
    expect(path.dirname(spaced).startsWith('drafts-alice-1-md-')).toBe(true);
    expect(listing.entries.map((entry) => [entry.fileId, entry.source.displayPath]).sort()).toEqual([
      [upper, 'Drafts/alice-1.md'], [spaced, 'drafts/alice 1.md']
    ].sort());
  });

  it('counts a folder that cannot be read, and lists the rest', async () => {
    const { fileSystem, store } = chapters();
    const kept = fileIdOf(await store.save({ board: of('Drafts/alice-1.md', 'board-1'), text: TEXT }));
    const lost = fileIdOf(await store.save({ board: of('Drafts/alice-2.md', 'board-2'), text: TEXT }));
    const readDirectory = fileSystem.readDirectory.bind(fileSystem);
    jest.spyOn(fileSystem, 'readDirectory').mockImplementation(async (folder: string) => {
      if (folder === path.join(BOARDS, path.dirname(lost))) {
        throw new Error('EACCES: permission denied');
      }
      return readDirectory(folder);
    });

    const listing = await store.listAll();

    expect(listing.entries.map((entry) => entry.fileId)).toEqual([kept]);
    expect(listing).toMatchObject({ unreadable: 0, unreadableFolders: 1 });
  });

  it('counts the boards folder itself when it cannot be read; one not there yet is simply empty', async () => {
    const empty = chapters();
    expect(await empty.store.listAll()).toEqual({ entries: [], unreadable: 0, unreadableFolders: 0 });

    const { fileSystem, store } = chapters();
    await store.save({ board: of('Drafts/alice-1.md', 'board-1'), text: TEXT });
    jest.spyOn(fileSystem, 'readDirectory').mockRejectedValue(new Error('EIO: i/o error'));
    expect(await store.listAll()).toEqual({ entries: [], unreadable: 0, unreadableFolders: 1 });
  });

  it('settles each folder\'s claims as a source\'s listing does: an abandoned claim goes back, a live one stays hidden', async () => {
    const { fileSystem, store, clock } = chapters();
    const abandoned = fileIdOf(await store.save({ board: of('Drafts/alice-1.md', 'board-1'), text: TEXT }));
    const live = fileIdOf(await store.save({ board: of('Drafts/alice-2.md', 'board-2'), text: TEXT }));
    clock.at = PAST_LEASE;
    // Window b closed mid-rewrite of the first long ago, and is rewriting the second now.
    fileSystem.files.set(claimOf(abandoned, SAVED_AT, 'b1'), fileSystem.files.get(pathOf(abandoned)) as Uint8Array);
    fileSystem.files.delete(pathOf(abandoned));
    fileSystem.files.set(claimOf(live, PAST_LEASE, 'b2'), fileSystem.files.get(pathOf(live)) as Uint8Array);
    fileSystem.files.delete(pathOf(live));

    const listing = await store.listAll();

    expect(listing.entries.map((entry) => entry.fileId)).toEqual([abandoned]);
    expect(everyFile(fileSystem)).toEqual([abandoned, path.relative(BOARDS, claimOf(live, PAST_LEASE, 'b2'))].sort());
  });

  it('does not list a folder named by slug alone (before PR #163), nor a file moved into another source\'s folder', async () => {
    const { fileSystem, store } = chapters();
    const saved = fileIdOf(await store.save({ board: of('Drafts/alice-1.md', 'board-1'), text: TEXT }));
    const bytes = fileSystem.files.get(pathOf(saved)) as Uint8Array;
    fileSystem.files.set(path.join(BOARDS, 'drafts-alice-1-md', path.basename(saved)), bytes);
    const other = fileIdOf(await store.save({ board: of('Drafts/alice-2.md', 'board-2'), text: TEXT }));
    fileSystem.files.set(path.join(BOARDS, path.dirname(other), '2026-01-01T00-00-00-000Z.board.json'), bytes);

    expect((await store.listAll()).entries.map((entry) => entry.fileId).sort()).toEqual([saved, other].sort());
  });

  it('lists nothing for the session only, with no folder open or several', async () => {
    for (const folders of [[], [ROOT, '/second']]) {
      const fileSystem = new MemoryFileSystem();
      fileSystem.listsFolders = true;
      const workspace = createFakeWorkspace({ workspaceFolders: () => folders.map((folder) => ({ path: folder, name: path.basename(folder) })) });
      const store = new LightboxBoardStore(fileSystem, workspace, { appendLine: jest.fn() } as unknown as LogSink);
      expect(await store.listAll()).toEqual({ entries: [], unreadable: 0, unreadableFolders: 0 });
    }
  });
});

describe('a board file the writer picks', () => {
  it('locates one of the store\'s own by its id, and nothing else', async () => {
    const { store } = chapters();
    const saved = fileIdOf(await store.save({ board: of('Drafts/alice-1.md', 'board-1'), text: TEXT }));

    expect(store.locate(pathOf(saved))).toBe(saved);
    expect(store.locate(path.join(path.dirname(pathOf(saved)), 'chapter 6 copy.board.json'))).toBeUndefined();
    expect(store.locate(path.join(path.dirname(pathOf(saved)), `.${path.basename(saved)}.claim-${SAVED_AT}-b1`))).toBeUndefined();
    expect(store.locate(path.join(ROOT, 'exports', path.basename(saved)))).toBeUndefined();
    expect(store.locate('/elsewhere/prose-minion/boards/drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json')).toBeUndefined();
  });

  it('reads one outside the store as it is, and writes nothing', async () => {
    const { fileSystem, store } = chapters();
    const outside = '/elsewhere/Chapter 6.board.json';
    fileSystem.files.set(outside, new TextEncoder().encode(encodeLightboxBoardFile({ board: of('Drafts/alice-1.md', 'board-9'), text: TEXT, savedAt: new Date(SAVED_AT), name: 'Chapter 6 - draft' })));
    const before = [...fileSystem.files.keys()];

    const read = await store.readOutside(outside);

    expect(read).toMatchObject({ kind: 'board', file: { board: { boardId: 'board-9', name: 'Chapter 6 - draft' } }, dropped: 0 });
    expect([...fileSystem.files.keys()]).toEqual(before);
  });

  it('reads a malformed file as unreadable, and a missing one as missing, writing nothing', async () => {
    const { fileSystem, store } = chapters();
    fileSystem.files.set('/elsewhere/broken.board.json', new TextEncoder().encode('{"formatVersion": 1'));

    expect(await store.readOutside('/elsewhere/broken.board.json')).toMatchObject({ kind: 'unreadable' });
    expect(await store.readOutside('/elsewhere/gone.board.json')).toEqual({ kind: 'missing' });
    expect([...fileSystem.files.keys()]).toEqual(['/elsewhere/broken.board.json']);
  });

  it('logs a picked file\'s read error by its code, never the message that names its path (PR #167 N-03)', async () => {
    // A real file system's error: Node names the path in the message ("ENOTDIR: not a directory, stat '<path>'").
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lightbox-n03-'));
    try {
      const plain = path.join(directory, 'Chapter 6 notes.txt');
      await fs.writeFile(plain, 'not a folder');
      const picked = path.join(plain, 'Chapter 6 - draft.board.json');
      const real = {
        stat: async (filePath: string) => {
          const stat = await fs.stat(filePath);
          return { type: FileType.File, ctime: stat.ctimeMs, mtime: stat.mtimeMs, size: stat.size };
        },
        readFile: async (filePath: string) => new Uint8Array(await fs.readFile(filePath))
      } as unknown as FileSystem;
      const thrown = await real.stat(picked).catch((error: unknown) => error as NodeJS.ErrnoException);
      expect(thrown).toMatchObject({ code: 'ENOTDIR' });
      expect(String((thrown as Error).message)).toContain(picked);
      const lines: string[] = [];
      const log = { appendLine: (line: string) => { lines.push(line); }, show: jest.fn(), clear: jest.fn() } as unknown as LogSink;
      const store = new LightboxBoardStore(real, createFakeWorkspace({ workspaceFolders: () => [{ path: ROOT, name: 'workspace' }] }), log);

      expect(await store.readOutside(picked)).toMatchObject({ kind: 'unreadable' });

      expect(lines).toEqual(['[LightboxBoardStore] Could not read a board file outside the boards folder: (ENOTDIR)']);
      expect(lines.join('\n')).not.toContain(directory);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
