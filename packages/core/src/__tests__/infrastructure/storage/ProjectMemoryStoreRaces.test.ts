/**
 * ProjectMemoryStore across windows (Workshop Project Memory, Slice 1): two
 * stores on one workspace, as two VS Code windows are, each with its own
 * queue. A window is held mid-write at a file operation while the other
 * acts.
 *
 * - **Two windows saving at once lose nothing:** both new memories stand,
 *   even when both mint the same id, or one's final name is taken first.
 * - **Rewrites:** the second window to rewrite while the first holds its
 *   claim is told the memory is busy and writes nothing; one that read the
 *   memory before the other rewrote it reads it again, so the last to
 *   commit keeps both changes.
 * - **A delete racing a rewrite** never brings the memory back: a delete
 *   during a rewrite's claim is busy, and the rewrite commits; a rewrite
 *   whose file was deleted under it writes nothing.
 * - **Shutdown** waits for every owed write, and for one started while it
 *   waits.
 */
import * as path from 'node:path';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';
import {
  MEMORY,
  createdEntry,
  everyFile,
  memoryHost as host,
  text
} from '@/__tests__/infrastructure/storage/projectMemoryStoreHost';

/** Hold the first file operation `matches` picks until the gate opens; `reached` says it was reached. */
function holdOnce<K extends 'rename' | 'writeFile' | 'readFile' | 'readDirectory'>(
  fileSystem: MemoryFileSystem,
  method: K,
  matches: (firstPath: string) => boolean
) {
  const gate = deferred<void>();
  const reached = deferred<void>();
  const original = (fileSystem[method] as (...args: unknown[]) => Promise<unknown>).bind(fileSystem);
  let held = false;
  jest.spyOn(fileSystem, method).mockImplementation((async (...args: unknown[]) => {
    if (!held && matches(args[0] as string)) {
      held = true;
      reached.resolve();
      await gate.promise;
    }
    return original(...args);
  }) as never);
  return { open: () => gate.resolve(), reached: reached.promise };
}

describe('two windows saving at once lose nothing', () => {
  it('both new memories stand, each in its own file', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host({ fileSystem, prefix: 'a', mintMemoryId: () => 'aaaaaa' });
    const theirs = host({ fileSystem, prefix: 'b', mintMemoryId: () => 'bbbbbb' });
    const held = holdOnce(fileSystem, 'rename', (from) => from.includes('.tmp-a'));

    const saving = mine.store.create({ ...createdDraft, title: 'The Hatter keeps six o\'clock' });
    await held.reached;
    const theirsSaved = await createdEntry(theirs.store, { title: 'The Duchess sneezes' });
    held.open();

    expect(await saving).toMatchObject({ kind: 'created', entry: { memory: { id: 'mem-aaaaaa' } } });
    expect(theirsSaved.memory.id).toBe('mem-bbbbbb');
    const listing = await mine.store.list();
    expect(listing.kind === 'listed' && listing.memories.map((entry) => entry.memory.id)).toEqual(['mem-bbbbbb', 'mem-aaaaaa']);
    expect(everyFile(fileSystem)).toEqual(['the-duchess-sneezes-bbbbbb.md', 'the-hatter-keeps-six-oclock-aaaaaa.md']);
  });

  it('when both mint one id at once, the second to commit finds its name taken, mints another, and both stand', async () => {
    const fileSystem = new MemoryFileSystem();
    const mineIds = ['c0ffee', 'c0ffee'];
    const theirsIds = ['c0ffee', 'facade'];
    const mine = host({ fileSystem, prefix: 'a', mintMemoryId: () => mineIds.shift() ?? 'ffffff' });
    const theirs = host({ fileSystem, prefix: 'b', mintMemoryId: () => theirsIds.shift() ?? 'eeeeee' });
    // Both windows have listed the folder (empty) and staged: hold theirs at its rename while mine commits.
    const held = holdOnce(fileSystem, 'rename', (from) => from.includes('.tmp-b'));

    const theirsSaving = theirs.store.create({ ...createdDraft, title: 'Same title' });
    await held.reached;
    const mineSaved = await createdEntry(mine.store, { title: 'Same title' });
    held.open();

    expect(mineSaved.memory.id).toBe('mem-c0ffee');
    expect(await theirsSaving).toMatchObject({ kind: 'created', entry: { fileName: 'same-title-facade.md', memory: { id: 'mem-facade' } } });
    expect(everyFile(fileSystem)).toEqual(['same-title-c0ffee.md', 'same-title-facade.md']);
    expect(text(fileSystem.files.get(path.join(MEMORY, 'same-title-c0ffee.md')))).toMatch(/^id: mem-c0ffee$/m);
  });
});

describe('two windows rewriting one memory', () => {
  it('while the first holds its claim, the second is told busy and writes nothing; the first commits', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    const entry = await createdEntry(mine.store);
    const held = holdOnce(fileSystem, 'rename', (from) => from.includes('.tmp-a') && fileSystem.renameCalls.length > 1);

    const pinning = mine.store.replace(entry.memory.id, (memory) => ({ ...memory, pinned: true }));
    await held.reached;
    expect(await theirs.store.replace(entry.memory.id, (memory) => ({ ...memory, status: 'archived' }))).toEqual({ kind: 'busy' });
    held.open();

    expect(await pinning).toMatchObject({ kind: 'replaced', entry: { memory: { pinned: true, status: 'active' } } });
    expect(await theirs.store.read(entry.memory.id)).toMatchObject({ kind: 'memory', entry: { memory: { pinned: true, status: 'active' } } });
    expect(everyFile(fileSystem)).toEqual([entry.fileName]);
  });

  it('one that read the memory before the other rewrote it reads it again, so the last to commit keeps both changes', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    const entry = await createdEntry(mine.store);
    // Mine has read the file and staged its rewrite; hold it at the claim.
    const held = holdOnce(fileSystem, 'rename', (from) => from === path.join(MEMORY, entry.fileName) && fileSystem.renameCalls.length > 0);

    const pinning = mine.store.replace(entry.memory.id, (memory) => ({ ...memory, pinned: true }));
    await held.reached;
    // Theirs is held too (the gate is mine's): open it once theirs has committed.
    const archiving = theirs.store.replace(entry.memory.id, (memory) => ({ ...memory, status: 'archived' }));
    expect(await archiving).toMatchObject({ kind: 'replaced', entry: { memory: { status: 'archived', pinned: false } } });
    held.open();

    expect(await pinning).toMatchObject({ kind: 'replaced', entry: { memory: { status: 'archived', pinned: true } } });
    expect(everyFile(fileSystem)).toEqual([entry.fileName]);
  });
});

describe('a delete racing a rewrite', () => {
  it('a delete while a rewrite holds its claim is busy, and the rewrite commits: nothing is undone', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    const entry = await createdEntry(mine.store);
    const held = holdOnce(fileSystem, 'rename', (from) => from.includes('.tmp-a') && fileSystem.renameCalls.length > 1);

    const editing = mine.store.replace(entry.memory.id, (memory) => ({ ...memory, summary: 'It runs backward, and the Hatter knows why.' }));
    await held.reached;
    expect(await theirs.store.delete(entry.memory.id)).toEqual({ kind: 'busy' });
    held.open();

    expect(await editing).toMatchObject({ kind: 'replaced' });
    expect(everyFile(fileSystem)).toEqual([entry.fileName]);
  });

  it('a rewrite whose file another window deleted under it writes nothing, and the memory stays deleted', async () => {
    const fileSystem = new MemoryFileSystem();
    const mine = host({ fileSystem, prefix: 'a' });
    const theirs = host({ fileSystem, prefix: 'b' });
    const entry = await createdEntry(mine.store);
    // Mine has read the file; hold it as it stages its rewrite.
    const held = holdOnce(fileSystem, 'writeFile', (filePath) => filePath.includes('.tmp-a'));

    const pinning = mine.store.replace(entry.memory.id, (memory) => ({ ...memory, pinned: true }));
    await held.reached;
    expect(await theirs.store.delete(entry.memory.id)).toEqual({ kind: 'deleted' });
    held.open();

    expect(await pinning).toEqual({ kind: 'missing' });
    expect(everyFile(fileSystem)).toEqual([]);
    expect(await mine.store.list()).toEqual({ kind: 'listed', memories: [], unreadable: [], conflicts: [] });
  });

  it('a rewrite queued after a delete in the same window finds the memory missing', async () => {
    const { store, fileSystem } = host();
    const entry = await createdEntry(store);
    const [deleted, pinned] = await Promise.all([
      store.delete(entry.memory.id),
      store.replace(entry.memory.id, (memory) => ({ ...memory, pinned: true }))
    ]);
    expect([deleted, pinned]).toEqual([{ kind: 'deleted' }, { kind: 'missing' }]);
    expect(everyFile(fileSystem)).toEqual([]);
  });
});

describe('a delete deletes only the memory it was asked to (PR #194 F-02)', () => {
  /** Just before the delete claims the file, put `bytes` at its path, as another window's edit or a hand edit would. */
  function substituteBeforeClaim(fileSystem: MemoryFileSystem, filePath: string, bytes: Uint8Array) {
    const rename = fileSystem.rename.bind(fileSystem);
    jest.spyOn(fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      if (fromPath === filePath && toPath.includes('.claim-')) {
        fileSystem.files.set(filePath, bytes);
      }
      return rename(fromPath, toPath, options);
    });
  }

  it('a different memory put at the path is put back, never deleted', async () => {
    const { fileSystem, store } = host();
    const entry = await createdEntry(store);
    const filePath = path.join(MEMORY, entry.fileName);
    const other = new TextEncoder().encode(text(fileSystem.files.get(filePath)).replace(/^id: .*$/m, 'id: mem-abcdef'));
    substituteBeforeClaim(fileSystem, filePath, other);

    expect(await store.delete(entry.memory.id)).toEqual({ kind: 'changed' });
    expect(everyFile(fileSystem)).toEqual([entry.fileName]);
    expect(text(fileSystem.files.get(filePath))).toMatch(/^id: mem-abcdef$/m);
  });

  it('bytes that no longer read are put back, never deleted', async () => {
    const { fileSystem, store } = host();
    const entry = await createdEntry(store);
    const filePath = path.join(MEMORY, entry.fileName);
    substituteBeforeClaim(fileSystem, filePath, new TextEncoder().encode('A note the writer half-typed.'));

    expect(await store.delete(entry.memory.id)).toEqual({ kind: 'changed' });
    expect(everyFile(fileSystem)).toEqual([entry.fileName]);
    expect(text(fileSystem.files.get(filePath))).toBe('A note the writer half-typed.');
  });

  it('a newer version of the same memory is still the memory asked for, and is deleted', async () => {
    const { fileSystem, store } = host();
    const entry = await createdEntry(store);
    const filePath = path.join(MEMORY, entry.fileName);
    substituteBeforeClaim(fileSystem, filePath, new TextEncoder().encode(text(fileSystem.files.get(filePath)).replace('pinned: false', 'pinned: true')));

    expect(await store.delete(entry.memory.id)).toEqual({ kind: 'deleted' });
    expect(everyFile(fileSystem)).toEqual([]);
  });
});

describe('a refused delete never loses the bytes it claimed, even when its saved name is taken (PR #194 F-02, re-review)', () => {
  /** The review's steps: `claimed` put at the path just before the claim, then `occupant` at the path just after it. */
  function claimThenOccupy(fileSystem: MemoryFileSystem, filePath: string, claimed: Uint8Array, occupant: Uint8Array) {
    const rename = fileSystem.rename.bind(fileSystem);
    jest.spyOn(fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      const claiming = fromPath === filePath && toPath.includes('.claim-');
      if (claiming) {
        fileSystem.files.set(filePath, claimed);
      }
      await rename(fromPath, toPath, options);
      if (claiming) {
        fileSystem.files.set(filePath, occupant);
      }
    });
  }
  const withId = (bytes: Uint8Array | undefined, id: string) => new TextEncoder().encode(text(bytes).replace(/^id: .*$/m, `id: ${id}`));

  it('another memory it claimed lands under a free name, and a lease-settling listing 31 seconds on keeps both', async () => {
    const { fileSystem, store, clock } = host();
    const entry = await createdEntry(store);
    const filePath = path.join(MEMORY, entry.fileName);
    const original = fileSystem.files.get(filePath);
    claimThenOccupy(fileSystem, filePath, withId(original, 'mem-abcdef'), withId(original, 'mem-fedcba'));

    expect(await store.delete(entry.memory.id)).toEqual({ kind: 'changed' });
    clock.at += 31_000;
    const listing = await store.list();
    expect(listing.kind === 'listed' && listing.memories.map((memory) => memory.memory.id).sort()).toEqual(['mem-abcdef', 'mem-fedcba']);
    expect(everyFile(fileSystem).filter((name) => name.includes('.claim-'))).toEqual([]);
  });

  it('unreadable bytes it claimed land under a free name, and survive a lease-settling listing beside the occupant', async () => {
    const { fileSystem, store, clock } = host();
    const entry = await createdEntry(store);
    const filePath = path.join(MEMORY, entry.fileName);
    const original = fileSystem.files.get(filePath);
    claimThenOccupy(fileSystem, filePath, new TextEncoder().encode('A note the writer half-typed.'), withId(original, 'mem-fedcba'));

    expect(await store.delete(entry.memory.id)).toEqual({ kind: 'changed' });
    clock.at += 31_000;
    const listing = await store.list();
    expect(listing).toMatchObject({
      kind: 'listed',
      memories: [{ memory: { id: 'mem-fedcba' } }],
      unreadable: [{ reason: 'no-frontmatter' }]
    });
    expect([...fileSystem.files.values()].map((bytes) => text(bytes))).toContain('A note the writer half-typed.');
  });
});

describe('shutdown drains owed writes', () => {
  it('waits for a write in flight, and for one started while it waits', async () => {
    const { fileSystem, store } = host();
    const held = holdOnce(fileSystem, 'writeFile', (filePath) => filePath.includes('.tmp-'));
    const first = store.create(createdDraft);
    await held.reached;

    let drained = false;
    const shutting = store.shutDown().then(() => {
      drained = true;
    });
    const second = store.create({ ...createdDraft, title: 'Structure before line edits' });
    await Promise.resolve();
    expect(drained).toBe(false);
    held.open();
    await shutting;

    expect(drained).toBe(true);
    // Both settled before shutdown resolved.
    expect(fileSystem.files.size).toBe(2);
    expect(await first).toMatchObject({ kind: 'created' });
    expect(await second).toMatchObject({ kind: 'created' });
  });

  it('resolves at once with nothing owed, and settles a write that failed', async () => {
    const { fileSystem, store } = host();
    await store.shutDown();
    jest.spyOn(fileSystem, 'createDirectory').mockRejectedValueOnce(new Error('EROFS'));
    const failing = store.create(createdDraft);
    await store.shutDown();
    expect(await failing).toEqual({ kind: 'failed' });
  });
});

const createdDraft = {
  title: 'The Rabbit\'s watch runs backward',
  kind: 'canon' as const,
  summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
  status: 'active' as const,
  pinned: false,
  origin: 'writer' as const,
  sourceTurns: [],
  supersedes: [],
  body: ''
};
