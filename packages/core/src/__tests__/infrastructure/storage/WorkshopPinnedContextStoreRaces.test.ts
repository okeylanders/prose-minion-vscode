/**
 * WorkshopPinnedContextStore across windows and workspaces (Workshop Pinned
 * Context, Slice 1; ADR 2026-11-04 D5). Two stores on one folder are two
 * VS Code windows, each with its own queue; one is held mid-write at a
 * file operation while the other acts.
 *
 * - **A stale revision is refused, and the first write stands,** whether
 *   the second window's write starts after the first commits or races it
 *   to the new file's name.
 * - **A rewrite's live claim** makes the other window's write busy.
 * - **A write belongs to the workspace it was asked in:** one whose turn,
 *   or commit, comes under another folder is withdrawn as `unavailable`,
 *   and neither folder's file changes, even though the new folder has a
 *   list of its own.
 *
 * *Alice*, with made-up paths.
 */
import * as path from 'node:path';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import {
  WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION as ABSENT,
  workshopPinnedContextRevisionOf
} from '@/infrastructure/storage/WorkshopPinnedContextStore';
import {
  FILE,
  FOLDER,
  OTHER_FILE,
  OTHER_ROOT,
  bytesOf,
  everyFile,
  holdOnce,
  list,
  pin,
  pinnedHost as host,
  text
} from '@/__tests__/infrastructure/storage/workshopPinnedContextStoreHost';

describe('two windows on one list', () => {
  it('refuses the second window\'s stale revision, and the first write stands', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    expect(await mine.store.read()).toEqual({ state: 'absent', revision: ABSENT });
    expect(await theirs.store.read()).toEqual({ state: 'absent', revision: ABSENT });

    expect(await mine.store.update(ABSENT, pin('Characters/alice.md'))).toMatchObject({ ok: true });
    const answer = await theirs.store.update(ABSENT, pin('Characters/the-hatter.md'));

    expect(answer).toMatchObject({ ok: false, reason: 'changed', current: { state: 'ok', list: list('Characters/alice.md') } });
    expect(text(fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/alice.md'))));
  });

  it('refuses the window that loses the race to the new file\'s name, never writing over the winner', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    // Mine has read the folder (no file) and staged; hold it at the rename that would commit.
    const held = holdOnce(fileSystem, 'rename', (from) => from.includes('.tmp-a'));

    const saving = mine.store.update(ABSENT, pin('Characters/alice.md'));
    await held.reached;
    expect(await theirs.store.update(ABSENT, pin('Characters/the-hatter.md'))).toMatchObject({ ok: true });
    held.open();

    expect(await saving).toMatchObject({ ok: false, reason: 'changed', current: { state: 'ok', list: list('Characters/the-hatter.md') } });
    expect(text(fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/the-hatter.md'))));
    expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
  });

  it('refuses a rewrite whose file another window rewrote after it was read', async () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    // Mine has read the list at `revision` and staged its rewrite; hold it before it claims the file.
    const held = holdOnce(fileSystem, 'rename', (from) => from === FILE);

    const saving = mine.store.update(revision, pin('Characters/the-hatter.md'));
    await held.reached;
    // Theirs claims first (the held rename is mine; theirs passes through), and commits.
    expect(await theirs.store.update(revision, pin('Places/the tea party.md'))).toMatchObject({ ok: true });
    held.open();

    expect(await saving).toMatchObject({ ok: false, reason: 'changed', current: { state: 'ok', list: list('Characters/alice.md', 'Places/the tea party.md') } });
    expect(text(fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/alice.md', 'Places/the tea party.md'))));
    expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
  });

  it('answers busy while the other window holds the file under its claim, then that write commits', async () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    // Mine has claimed the file and staged its rewrite; hold it at the rename that commits.
    const held = holdOnce(fileSystem, 'rename', (from) => from.includes('.tmp-a'));

    const saving = mine.store.update(revision, pin('Characters/the-hatter.md'));
    await held.reached;
    expect(await theirs.store.read()).toEqual({ state: 'busy' });
    expect(await theirs.store.update(revision, pin('Places/the tea party.md'))).toEqual({ ok: false, reason: 'busy' });
    held.open();

    expect(await saving).toMatchObject({ ok: true, list: list('Characters/alice.md', 'Characters/the-hatter.md') });
    expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
  });
});

describe('a write belongs to the workspace it was asked in', () => {
  /** A file system holding a list in each folder; the window opens on the first. */
  function twoWorkspaces() {
    const fileSystem = new MemoryFileSystem();
    fileSystem.files.set(FILE, bytesOf(list('Characters/alice.md')));
    fileSystem.files.set(OTHER_FILE, bytesOf(list('Characters/alice.md')));
    const window = host({ fileSystem });
    const revision = workshopPinnedContextRevisionOf(bytesOf(list('Characters/alice.md')));
    const moveToOther = () => window.folders.splice(0, window.folders.length, { path: OTHER_ROOT, name: 'other' });
    const unchanged = () => {
      expect(text(fileSystem.files.get(FILE))).toBe(text(bytesOf(list('Characters/alice.md'))));
      expect(text(fileSystem.files.get(OTHER_FILE))).toBe(text(bytesOf(list('Characters/alice.md'))));
      expect(everyFile(fileSystem)).toEqual(['pinned-context.json']);
      expect(everyFile(fileSystem, path.dirname(OTHER_FILE))).toEqual(['pinned-context.json']);
    };
    return { fileSystem, window, revision, moveToOther, unchanged };
  }

  it('withdraws a write whose turn comes under another workspace, though both lists are at its revision', async () => {
    const { window, revision, moveToOther, unchanged } = twoWorkspaces();
    // An earlier write holds the queue at its read, so the next one waits for its turn.
    const held = holdOnce(window.fileSystem, 'readDirectory', (folder) => folder === FOLDER);
    const earlier = window.store.read();
    await held.reached;
    const writing = window.store.update(revision, pin('Characters/the-hatter.md'));
    moveToOther();
    held.open();

    await earlier;
    expect(await writing).toEqual({ ok: false, reason: 'unavailable' });
    unchanged();
  });

  it('withdraws a rewrite whose commit comes under another workspace, and puts its claim back', async () => {
    const { fileSystem, window, revision, moveToOther, unchanged } = twoWorkspaces();
    // Held after the file is claimed, while the claimed bytes are checked: the commit point is next.
    const held = holdOnce(fileSystem, 'readFile', (file) => /\.claim-\d{13}-/.test(file));
    const writing = window.store.update(revision, pin('Characters/the-hatter.md'));
    await held.reached;
    moveToOther();
    held.open();

    expect(await writing).toEqual({ ok: false, reason: 'unavailable' });
    unchanged();
  });

  it('withdraws a first write whose commit comes under another workspace, leaving no file in either', async () => {
    const fileSystem = new MemoryFileSystem();
    const window = host({ fileSystem });
    const held = holdOnce(fileSystem, 'writeFile', (file) => file.includes('.tmp-'));
    const writing = window.store.update(ABSENT, pin('Characters/alice.md'));
    await held.reached;
    window.folders.splice(0, 1, { path: OTHER_ROOT, name: 'other' });
    held.open();

    expect(await writing).toEqual({ ok: false, reason: 'unavailable' });
    expect(fileSystem.files.size).toBe(0);
  });

  it('withdraws a write asked with no workspace, even once one opens', async () => {
    const window = host({ folders: [] });
    const writing = window.store.update(ABSENT, pin('Characters/alice.md'));
    window.folders.push({ path: '/workspace', name: 'workspace' });
    expect(await writing).toEqual({ ok: false, reason: 'unavailable' });
    expect(window.fileSystem.files.size).toBe(0);
  });
});
