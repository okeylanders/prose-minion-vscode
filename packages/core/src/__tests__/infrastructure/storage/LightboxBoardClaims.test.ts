/**
 * Claims on saved boards' files (PR #164 F-01, F-02; `LightboxBoardClaims`):
 * what a rewrite in place, and a delete, hold while they write, and what
 * becomes of a claim another window finds.
 *
 * - **Live or abandoned, by age.** A claim younger than the lease is never
 *   touched by another window: the file is busy, for a listing, a read, a
 *   rewrite and a delete. A claim left by a window that closed mid-rewrite
 *   is put back once older than the lease, when the folder is next listed or
 *   the file next read (the newest, when there are several); one left beside
 *   a committed rewrite is removed, never put back.
 * - **A delete is never undone** (the review's two sequences): a listing in
 *   another window never steals a live claim, so a delete there is busy
 *   while a rewrite is pending, and the rewrite commits; a delete claims the
 *   file and retires every earlier version a rewrite left beside it, young
 *   or old, so nothing comes back after it.
 * - **Controls:** a rewrite that cleaned up, then a delete; a board left
 *   mid-rewrite deleted whole; a commit that fails puts the original back; a
 *   claim held past the lease and put back by another window blocks the
 *   pending commit; one put back while its bytes were checked is read again.
 *
 * The board is the production service's measure of ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain), with every reading kind.
 * Names are made up.
 */
import * as path from 'node:path';
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

const NAME = '3.2.1 - after the cut - model B';

let BOARD: LightboxBoard;
let TEXT: string;

beforeAll(async () => {
  ({ board: BOARD, text: TEXT } = await everyKindBoard());
});

describe('claims: live or abandoned, by age (PR #164 F-01, F-02)', () => {
  it('a claim older than the lease, left mid-rewrite, is put back under its saved name when the folder is next listed', async () => {
    const { fileSystem, store, lines } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT, name: NAME }));
    // A window closed between its claim and its commit, more than the lease ago.
    await fileSystem.rename(pathOf(fileId), claimOf(fileId, SAVED_AT - LIGHTBOX_BOARD_CLAIM_LEASE_MS - 1, 'gone1'));

    expect((await store.list(BOARD.source)).entries.map((entry) => [entry.fileId, entry.name])).toEqual([[fileId, NAME]]);
    expect(everyFile(fileSystem)).toEqual([fileId]);
    expect(lines).toContain(`[LightboxBoardStore] Put back ${path.basename(fileId)}, left mid-rewrite.`);
  });

  it('a read that finds the file gone puts back an abandoned claim and reads it', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT, name: NAME }));
    await fileSystem.rename(pathOf(fileId), claimOf(fileId, SAVED_AT - LIGHTBOX_BOARD_CLAIM_LEASE_MS - 1, 'gone1'));

    expect(await store.read(fileId)).toMatchObject({ kind: 'board', fileId, file: { board: { name: NAME } } });
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });

  it('of several abandoned claims of one file, the newest goes back and the older are removed', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT, name: NAME }));
    const older = claimOf(fileId, SAVED_AT - 3 * LIGHTBOX_BOARD_CLAIM_LEASE_MS, 'old1');
    fileSystem.files.set(older, new TextEncoder().encode('an earlier version'));
    await fileSystem.rename(pathOf(fileId), claimOf(fileId, SAVED_AT - 2 * LIGHTBOX_BOARD_CLAIM_LEASE_MS, 'new1'));

    expect((await store.list(BOARD.source)).entries.map((entry) => entry.name)).toEqual([NAME]);
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });

  it('a claim younger than the lease is live: never put back or listed, and the file is busy for a read, a rewrite and a delete', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    const claim = claimOf(fileId, SAVED_AT, 'live1');
    await fileSystem.rename(pathOf(fileId), claim);

    expect(await store.list(BOARD.source)).toEqual({ entries: [], unreadable: 0 });
    expect(await store.read(fileId)).toEqual({ kind: 'busy' });
    expect(await store.replace({ fileId }, named(NAME), { renames: true })).toEqual({ kind: 'busy' });
    expect(await store.delete(fileId)).toEqual({ kind: 'busy' });
    expect([...fileSystem.files.keys()]).toEqual([claim]);
  });

  it('beside its standing file, an abandoned claim is a rewrite\'s leftover: removed, never put back; a live one is left to its writer', async () => {
    const { fileSystem, store, lines } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT, name: NAME }));
    const leftover = claimOf(fileId, SAVED_AT - LIGHTBOX_BOARD_CLAIM_LEASE_MS - 1, 'old1');
    const live = claimOf(fileId, SAVED_AT, 'live1');
    fileSystem.files.set(leftover, new TextEncoder().encode('an earlier version'));
    fileSystem.files.set(live, new TextEncoder().encode('a version a writer still holds'));

    expect((await store.list(BOARD.source)).entries.map((entry) => [entry.fileId, entry.name])).toEqual([[fileId, NAME]]);
    expect([...fileSystem.files.keys()].sort()).toEqual([live, pathOf(fileId)].sort());
    expect(read(fileSystem, fileId).board.name).toBe(NAME);
    expect(lines).toContain(`[LightboxBoardStore] Removed an earlier version of ${path.basename(fileId)}, left by a rewrite.`);
  });

  it('control: a claim with no time in its name is not a claim this store reads, and is left alone', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    const odd = path.join(path.dirname(pathOf(fileId)), `.${path.basename(fileId)}.claim-old`);
    fileSystem.files.set(odd, new TextEncoder().encode('old'));

    expect(await store.list(BOARD.source)).toEqual({ entries: [expect.objectContaining({ fileId })], unreadable: 0 });
    expect(fileSystem.files.has(odd)).toBe(true);
  });
});

describe('a delete is never undone (PR #164 F-01)', () => {
  it('a listing in another window never steals a live claim: a delete there is busy, and the pending rewrite commits', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host(fileSystem, 'a');
    const theirs = host(fileSystem, 'b');
    const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT }));
    // Hold this window's rename at its last step: the staged bytes taking the saved name.
    const gate = deferred<void>();
    const reached = deferred<void>();
    const rename = fileSystem.rename.bind(fileSystem);
    jest.spyOn(fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      if (fromPath.includes('.tmp-a')) {
        reached.resolve();
        await gate.promise;
      }
      return rename(fromPath, toPath, options);
    });

    const renaming = mine.store.replace({ fileId }, named(NAME), { renames: true });
    await reached.promise;
    // The other window lists the source, then deletes the board it had listed before.
    expect((await theirs.store.list(BOARD.source)).entries).toEqual([]);
    expect(await theirs.store.delete(fileId)).toEqual({ kind: 'busy' });
    gate.resolve();

    expect(await renaming).toEqual({ kind: 'replaced', fileId });
    // No delete was reported, so none is undone: the board stands, renamed, alone.
    expect((await theirs.store.list(BOARD.source)).entries.map((entry) => [entry.fileId, entry.name])).toEqual([[fileId, NAME]]);
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });

  it('a rewrite whose claim clean-up failed leaves its earlier version beside the file; a delete in a fresh window retires it, and nothing comes back', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host(fileSystem, 'a');
    const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT, name: 'Original' }));
    const remove = fileSystem.delete.bind(fileSystem);
    const failing = jest.spyOn(fileSystem, 'delete').mockImplementation(async (filePath) => {
      if (claimBy('a')(filePath)) {
        throw new Error(`EBUSY: ${filePath}`);
      }
      return remove(filePath);
    });
    expect(await mine.store.replace({ fileId }, named('Renamed'), { renames: true })).toEqual({ kind: 'replaced', fileId });
    failing.mockRestore();
    expect(read(fileSystem, fileId).board.name).toBe('Renamed');
    expect(everyFile(fileSystem)).toEqual([fileId, path.join(path.dirname(fileId), `.${path.basename(fileId)}.claim-${SAVED_AT}-a3`)].sort());

    const fresh = host(fileSystem, 'c', [], { at: PAST_LEASE });
    expect(await fresh.store.delete(fileId)).toEqual({ kind: 'deleted' });

    expect(await fresh.store.list(BOARD.source)).toEqual({ entries: [], unreadable: 0 });
    expect(await fresh.store.read(fileId)).toEqual({ kind: 'missing' });
    expect(everyFile(fileSystem)).toEqual([]);
  });

  it('the same leftover, retired by a delete at once, while it is still young', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host(fileSystem, 'a');
    const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT, name: 'Original' }));
    const remove = fileSystem.delete.bind(fileSystem);
    const failing = jest.spyOn(fileSystem, 'delete').mockImplementation(async (filePath) => {
      if (claimBy('a')(filePath)) {
        throw new Error(`EBUSY: ${filePath}`);
      }
      return remove(filePath);
    });
    await mine.store.replace({ fileId }, named('Renamed'), { renames: true });
    failing.mockRestore();

    const theirs = host(fileSystem, 'b');
    expect(await theirs.store.delete(fileId)).toEqual({ kind: 'deleted' });
    // Long after, no listing or read brings either version back.
    const later = host(fileSystem, 'c', [], { at: PAST_LEASE });
    expect(await later.store.list(BOARD.source)).toEqual({ entries: [], unreadable: 0 });
    expect(await later.store.read(fileId)).toEqual({ kind: 'missing' });
    expect(everyFile(fileSystem)).toEqual([]);
  });

  it('control: a rewrite that cleaned up, then a delete: nothing comes back', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT, name: 'Original' }));
    await store.replace({ fileId }, named('Renamed'), { renames: true });
    expect(everyFile(fileSystem)).toEqual([fileId]);

    expect(await store.delete(fileId)).toEqual({ kind: 'deleted' });
    const later = host(fileSystem, 'c', [], { at: PAST_LEASE });
    expect(await later.store.list(BOARD.source)).toEqual({ entries: [], unreadable: 0 });
    expect(everyFile(fileSystem)).toEqual([]);
  });

  it('control: a delete of a board left mid-rewrite puts it back, then deletes it whole', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT }));
    await fileSystem.rename(pathOf(fileId), claimOf(fileId, SAVED_AT - LIGHTBOX_BOARD_CLAIM_LEASE_MS - 1, 'gone1'));

    expect(await store.delete(fileId)).toEqual({ kind: 'deleted' });
    expect(everyFile(fileSystem)).toEqual([]);
  });

  it('control: a commit that fails puts the original back as it was', async () => {
    const { fileSystem, store } = host();
    const fileId = fileIdOf(await store.save({ board: BOARD, text: TEXT, name: 'Original' }));
    const bytes = text(fileSystem.files.get(pathOf(fileId)));
    const rename = fileSystem.rename.bind(fileSystem);
    jest.spyOn(fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      if (fromPath.includes('.tmp-')) {
        throw new Error(`EIO: ${toPath}`);
      }
      return rename(fromPath, toPath, options);
    });

    expect(await store.replace({ fileId }, named('Renamed'), { renames: true })).toEqual({ kind: 'failed' });
    expect(text(fileSystem.files.get(pathOf(fileId)))).toBe(bytes);
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });

  it('control: a claim held past the lease and put back by another window blocks the pending commit, and the board stands as it was', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host(fileSystem, 'a');
    const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT, name: 'Original' }));
    const bytes = text(fileSystem.files.get(pathOf(fileId)));
    const gate = deferred<void>();
    const reached = deferred<void>();
    const rename = fileSystem.rename.bind(fileSystem);
    jest.spyOn(fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      if (fromPath.includes('.tmp-a')) {
        reached.resolve();
        await gate.promise;
      }
      return rename(fromPath, toPath, options);
    });

    const renaming = mine.store.replace({ fileId }, named('Renamed'), { renames: true });
    await reached.promise;
    // This window stalled past the lease: another window's listing takes its claim for abandoned, and puts the board back.
    const theirs = host(fileSystem, 'b', [], { at: PAST_LEASE });
    expect((await theirs.store.list(BOARD.source)).entries.map((entry) => entry.name)).toEqual(['Original']);
    gate.resolve();

    expect(await renaming).toEqual({ kind: 'failed' });
    expect(text(fileSystem.files.get(pathOf(fileId)))).toBe(bytes);
    expect(everyFile(fileSystem)).toEqual([fileId]);
  });

  it('control: a claim put back while its bytes were checked: the rewrite reads the file again, and commits over only what it read', async () => {
    const fileSystem = new MemoryFileSystem();
    const lines: string[] = [];
    const mine = host(fileSystem, 'a', lines);
    const fileId = fileIdOf(await mine.store.save({ board: BOARD, text: TEXT, name: 'Original' }));
    const gate = deferred<void>();
    const reached = deferred<void>();
    const readFile = fileSystem.readFile.bind(fileSystem);
    let held = false;
    jest.spyOn(fileSystem, 'readFile').mockImplementation(async (filePath) => {
      if (claimBy('a')(filePath) && !held) {
        held = true;
        reached.resolve();
        await gate.promise;
      }
      return readFile(filePath);
    });

    const renaming = mine.store.replace({ fileId }, named('Renamed'), { renames: true });
    await reached.promise;
    const theirs = host(fileSystem, 'b', [], { at: PAST_LEASE });
    expect((await theirs.store.list(BOARD.source)).entries.map((entry) => entry.name)).toEqual(['Original']);
    gate.resolve();

    expect(await renaming).toEqual({ kind: 'replaced', fileId });
    expect(read(fileSystem, fileId).board.name).toBe('Renamed');
    expect(everyFile(fileSystem)).toEqual([fileId]);
    expect(lines.join('\n')).not.toMatch(/could not be put back/);
  });
});
