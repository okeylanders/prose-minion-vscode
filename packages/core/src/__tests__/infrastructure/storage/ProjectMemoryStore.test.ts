/**
 * ProjectMemoryStore (Workshop Project Memory, Slice 1) on the memory file
 * system the Lightbox board store's tests use: where memory is kept, the
 * folder read whole with unreadable files named, ids resolved through the
 * listing, and each write's discipline (a new file staged and renamed
 * without overwriting; an edit rewritten in place under a claim; a delete
 * under a claim). Two-window races and the shutdown drain are in
 * `ProjectMemoryStoreRaces.test.ts`. *Alice*, with made-up ids.
 */
import * as path from 'node:path';
import { FileType } from '@/platform';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import { ProjectMemoryStore } from '@/infrastructure/storage/ProjectMemoryStore';
import { STORED_FILE_CLAIM_LEASE_MS } from '@/infrastructure/storage/StoredFileClaims';
import { supersededProjectMemoryIds } from '@shared/types/projectMemory';
import {
  DRAFT,
  MEMORY,
  NOW,
  claimOf,
  createdEntry,
  everyFile,
  memoryHost as host,
  text
} from '@/__tests__/infrastructure/storage/projectMemoryStoreHost';

describe('where memory is kept', () => {
  it('one workspace folder keeps it in prose-minion/memory; none, or several, keeps none, and says why', async () => {
    const one = host();
    expect(one.store.availability()).toEqual({
      available: true, rootPath: '/workspace', directory: MEMORY, displayPath: 'prose-minion/memory'
    });
    const fileSystem = new MemoryFileSystem();
    const none = new ProjectMemoryStore(fileSystem, createFakeWorkspace(), one.log);
    const several = new ProjectMemoryStore(fileSystem, createFakeWorkspace({
      workspaceFolders: () => [{ path: '/a', name: 'a' }, { path: '/b', name: 'b' }]
    }), one.log);
    expect(none.availability()).toEqual({ available: false, reason: 'no-workspace' });
    expect(several.availability()).toEqual({ available: false, reason: 'multi-root' });
    expect(await none.list()).toEqual({ kind: 'unavailable', reason: 'no-workspace' });
    expect(await several.create(DRAFT)).toEqual({ kind: 'unavailable', reason: 'multi-root' });
    expect(await none.read('mem-7f3c2a')).toEqual({ kind: 'unavailable', reason: 'no-workspace' });
    expect(fileSystem.files.size).toBe(0);
  });

  it('reads availability live, as the workspace changes', () => {
    const folders = [{ path: '/workspace', name: 'workspace' }];
    const store = new ProjectMemoryStore(new MemoryFileSystem(), createFakeWorkspace({ workspaceFolders: () => folders }), host().log);
    expect(store.availability().available).toBe(true);
    folders.push({ path: '/other', name: 'other' });
    expect(store.availability()).toEqual({ available: false, reason: 'multi-root' });
  });
});

describe('the folder, read whole', () => {
  it('a folder that is not there holds nothing; one that cannot be read is unknown, never empty', async () => {
    const { fileSystem, store, lines } = host();
    expect(await store.list()).toEqual({ kind: 'listed', memories: [], unreadable: [], conflicts: [], busy: [] });
    fileSystem.files.set(path.join(MEMORY, 'x.md'), new Uint8Array());
    jest.spyOn(fileSystem, 'readDirectory').mockRejectedValue(new Error('EACCES: permission denied'));
    expect(await store.list()).toEqual({ kind: 'unknown' });
    expect(await store.read('mem-7f3c2a')).toEqual({ kind: 'unknown' });
    expect(await store.create(DRAFT)).toEqual({ kind: 'failed' });
    expect(lines).toContain('[ProjectMemoryStore] The memory folder could not be read.');
  });

  it('lists every *.md but INDEX.md, skipping hidden files, other files and folders', async () => {
    const { fileSystem, store } = host();
    const entry = await createdEntry(store);
    fileSystem.files.set(path.join(MEMORY, 'INDEX.md'), new TextEncoder().encode('# Generated'));
    fileSystem.files.set(path.join(MEMORY, 'notes.txt'), new TextEncoder().encode('not a memory'));
    fileSystem.files.set(path.join(MEMORY, `.${entry.fileName}.tmp-elsewhere`), new TextEncoder().encode('staged'));
    const directory = jest.spyOn(fileSystem, 'readDirectory');
    directory.mockImplementationOnce(async (folder) => [
      ...(await MemoryFileSystem.prototype.readDirectory.call(fileSystem, folder)),
      ['drafts.md', FileType.Directory]
    ]);

    const listing = await store.list();
    expect(listing).toEqual({ kind: 'listed', memories: [entry], unreadable: [], conflicts: [], busy: [] });
  });

  it('names every file that does not read, with its reason, and never fails the folder over one', async () => {
    const { fileSystem, store } = host();
    const entry = await createdEntry(store);
    const valid = text(fileSystem.files.get(path.join(MEMORY, entry.fileName)));
    const put = (name: string, value: string | Uint8Array) =>
      fileSystem.files.set(path.join(MEMORY, name), typeof value === 'string' ? new TextEncoder().encode(value) : value);
    put('a-no-frontmatter.md', 'Just a note.');
    put('b-unknown-kind.md', valid.replace('kind: canon', 'kind: rumor'));
    put('c-too-large.md', `${valid}${'a'.repeat(256 * 1024)}`);
    put('d-not-text.md', new Uint8Array([0xff, 0xfe, 0x00]));
    put('e-copy.md', valid.replace(/^id: .*$/m, 'id: mem-0d0d0d'));
    put('f-copy-again.md', valid.replace(/^id: .*$/m, 'id: mem-0d0d0d'));

    expect(await store.list()).toEqual({
      kind: 'listed',
      memories: [entry],
      unreadable: [
        { fileName: 'a-no-frontmatter.md', reason: 'no-frontmatter' },
        { fileName: 'b-unknown-kind.md', reason: 'invalid-value', key: 'kind' },
        { fileName: 'c-too-large.md', reason: 'too-large' },
        { fileName: 'd-not-text.md', reason: 'not-text' }
      ],
      // A copied file: both copies listed together, neither a memory.
      conflicts: [{ id: 'mem-0d0d0d', fileNames: ['e-copy.md', 'f-copy-again.md'] }],
      busy: []
    });
    // Neither copy is read, rewritten or deleted, and no new memory takes the id.
    expect(await store.read('mem-0d0d0d')).toEqual({ kind: 'conflict' });
    expect(await store.replace('mem-0d0d0d', (memory) => ({ ...memory, pinned: true }))).toEqual({ kind: 'conflict' });
    expect(await store.delete('mem-0d0d0d')).toEqual({ kind: 'conflict' });
    expect(everyFile(fileSystem)).toEqual(['a-no-frontmatter.md', 'b-unknown-kind.md', 'c-too-large.md', 'd-not-text.md', 'e-copy.md', entry.fileName, 'f-copy-again.md'].sort());
  });
});

describe('ids, never paths', () => {
  it('reads a memory by the id its file holds, whatever the file is called', async () => {
    const { fileSystem, store } = host();
    const entry = await createdEntry(store);
    await fileSystem.rename(path.join(MEMORY, entry.fileName), path.join(MEMORY, 'watch.md'));
    expect(await store.read(entry.memory.id)).toEqual({ kind: 'memory', entry: { ...entry, fileName: 'watch.md' } });
  });

  it('an id no file holds is missing, and an id shaped like a path reads nothing', async () => {
    const { fileSystem, store } = host();
    await createdEntry(store);
    fileSystem.files.set('/workspace/secret.md', new TextEncoder().encode('outside'));
    const reads = fileSystem.readFileCalls.length;
    expect(await store.read('mem-000000')).toEqual({ kind: 'missing' });
    expect(await store.read('../secret')).toEqual({ kind: 'missing' });
    expect(await store.delete('../secret')).toEqual({ kind: 'missing' });
    expect(fileSystem.readFileCalls.slice(reads).every((file) => path.dirname(file) === MEMORY)).toBe(true);
    expect(fileSystem.files.has('/workspace/secret.md')).toBe(true);
  });
});

describe('a new memory', () => {
  it('mints its id and times, names its file by slug and id, stages it hidden, and renames it without overwriting', async () => {
    const { fileSystem, store, lines } = host();
    const created = await store.create(DRAFT);

    expect(created).toEqual({
      kind: 'created',
      entry: {
        fileName: 'the-rabbits-watch-runs-backward-7f3c2a.md',
        memory: { ...DRAFT, id: 'mem-7f3c2a', created: NOW, updated: NOW }
      }
    });
    expect(fileSystem.renameCalls).toEqual([{
      fromPath: path.join(MEMORY, '.the-rabbits-watch-runs-backward-7f3c2a.md.tmp-s1'),
      toPath: path.join(MEMORY, 'the-rabbits-watch-runs-backward-7f3c2a.md'),
      overwrite: false
    }]);
    expect(everyFile(fileSystem)).toEqual(['the-rabbits-watch-runs-backward-7f3c2a.md']);
    expect(lines).toEqual(['[ProjectMemoryStore] Saved mem-7f3c2a.']);
  });

  it('never takes an id the folder holds', async () => {
    const ids = ['7f3c2a', '7f3c2a', '1a9e04'];
    const { store } = host({ mintMemoryId: () => ids.shift() ?? 'ffffff' });
    await createdEntry(store);
    expect((await createdEntry(store, { title: 'Structure before line edits' })).memory.id).toBe('mem-1a9e04');
  });

  it('a draft that would not read back as format 1 writes nothing', async () => {
    const { fileSystem, store, lines } = host();
    expect(await store.create({ ...DRAFT, title: 'a'.repeat(121) })).toEqual({ kind: 'invalid', reason: 'too-long', key: 'title' });
    expect(await store.create({ ...DRAFT, summary: 'Two\nlines' })).toMatchObject({ kind: 'invalid' });
    expect(await store.create({ ...DRAFT, origin: 'proposed', proposedBy: undefined }))
      .toEqual({ kind: 'invalid', reason: 'proposal-without-provenance', key: 'proposed-by' });
    expect(fileSystem.files.size).toBe(0);
    expect(lines.join('\n')).not.toMatch(/rabbit|aaaa/i);
  });

  it('carries no field a caller added beyond the draft', async () => {
    const { store } = host();
    const sneaky = { ...DRAFT, id: 'mem-badbad', created: '2001-01-01T00:00:00Z', path: '../x' };
    const entry = await createdEntry(store, sneaky);
    expect(entry.memory).toEqual({ ...DRAFT, id: 'mem-7f3c2a', created: NOW, updated: NOW });
  });

  it('the commit point can withdraw it; nothing stays behind', async () => {
    const { fileSystem, store } = host();
    expect(await store.create(DRAFT, { beforeCommit: () => false })).toEqual({ kind: 'withdrawn' });
    expect(fileSystem.files.size).toBe(0);
  });

  it('a staging write that fails leaves nothing, and says so without the memory\'s text', async () => {
    const { fileSystem, store, lines } = host();
    jest.spyOn(fileSystem, 'writeFile').mockRejectedValueOnce(new Error('ENOSPC: no space left'));
    expect(await store.create(DRAFT)).toEqual({ kind: 'failed' });
    expect(fileSystem.files.size).toBe(0);
    expect(lines).toEqual(['[ProjectMemoryStore] Could not stage a new memory: ENOSPC']);
  });
});

describe('a rewrite in place', () => {
  it('rewrites the file that holds the id, under a claim, and leaves no claim or staging behind', async () => {
    const { fileSystem, store, lines } = host();
    const entry = await createdEntry(store);
    const pinned = await store.replace(entry.memory.id, (memory) => ({ ...memory, pinned: true, updated: '2026-11-04T10:00:00Z' }));

    expect(pinned).toEqual({ kind: 'replaced', entry: { fileName: entry.fileName, memory: { ...entry.memory, pinned: true, updated: '2026-11-04T10:00:00Z' } } });
    expect(await store.read(entry.memory.id)).toEqual({ kind: 'memory', entry: (pinned as { entry: unknown }).entry });
    expect(everyFile(fileSystem)).toEqual([entry.fileName]);
    expect(fileSystem.renameCalls.slice(1).map(({ toPath, overwrite }) => [path.basename(toPath).replace(/claim-\d{13}/, 'claim-T'), overwrite])).toEqual([
      [`.${entry.fileName}.claim-T-s3`, false],
      [entry.fileName, false]
    ]);
    expect(lines).toContain('[ProjectMemoryStore] Rewrote mem-7f3c2a in place.');
  });

  it('archives and edits a title in place, never renaming the file; an update that changes nothing writes nothing', async () => {
    const { fileSystem, store } = host();
    const old = await createdEntry(store);
    expect(await store.replace(old.memory.id, (memory) => ({ ...memory, status: 'archived' }))).toMatchObject({ kind: 'replaced' });
    expect(await store.replace(old.memory.id, (memory) => ({ ...memory, title: 'The watch runs forward after all' })))
      .toMatchObject({ kind: 'replaced', entry: { fileName: old.fileName, memory: { title: 'The watch runs forward after all' } } });
    expect(everyFile(fileSystem)).toEqual([old.fileName]);

    const renames = fileSystem.renameCalls.length;
    expect(await store.replace(old.memory.id, (memory) => ({ ...memory }))).toMatchObject({ kind: 'unchanged' });
    expect(await store.replace(old.memory.id, () => undefined)).toMatchObject({ kind: 'unchanged' });
    expect(fileSystem.renameCalls.length).toBe(renames);
  });

  it('keeps a hand-edited body byte for byte, CRLF and all, and writes the frontmatter LF', async () => {
    const { fileSystem, store } = host();
    const entry = await createdEntry(store);
    const filePath = path.join(MEMORY, entry.fileName);
    const body = '\r\nSettled at the tea party.  \r\n\r\n\r\n- Edited in VS Code.\r\n';
    const [frontmatter] = text(fileSystem.files.get(filePath)).split('\n---\n');
    fileSystem.files.set(filePath, new TextEncoder().encode(`${frontmatter.replace(/\n/g, '\r\n')}\r\n---\r\n${body}`));

    expect(await store.replace(entry.memory.id, (memory) => ({ ...memory, pinned: true }))).toMatchObject({ kind: 'replaced', entry: { memory: { body } } });
    const written = text(fileSystem.files.get(filePath));
    expect(written.endsWith(`\n---\n${body}`)).toBe(true);
    expect(written.slice(0, written.length - body.length)).not.toMatch(/\r/);
  });

  it('never changes a memory\'s id or creation time, and never writes what would not read back', async () => {
    const { fileSystem, store } = host();
    const entry = await createdEntry(store);
    const before = text(fileSystem.files.get(path.join(MEMORY, entry.fileName)));
    expect(await store.replace(entry.memory.id, (memory) => ({ ...memory, id: 'mem-000001' }))).toEqual({ kind: 'invalid', reason: 'identity-changed' });
    expect(await store.replace(entry.memory.id, (memory) => ({ ...memory, created: '2026-01-01T00:00:00Z' }))).toEqual({ kind: 'invalid', reason: 'identity-changed' });
    expect(await store.replace(entry.memory.id, (memory) => ({ ...memory, updated: '2020-01-01T00:00:00Z' })))
      .toEqual({ kind: 'invalid', reason: 'updated-before-created', key: 'updated' });
    expect(text(fileSystem.files.get(path.join(MEMORY, entry.fileName)))).toBe(before);
  });

  it('the commit point can withdraw it: the file is as it was, and its claim is given back', async () => {
    const { fileSystem, store } = host();
    const entry = await createdEntry(store);
    const before = text(fileSystem.files.get(path.join(MEMORY, entry.fileName)));
    expect(await store.replace(entry.memory.id, (memory) => ({ ...memory, pinned: true }), { beforeCommit: () => false })).toEqual({ kind: 'withdrawn' });
    expect(everyFile(fileSystem)).toEqual([entry.fileName]);
    expect(text(fileSystem.files.get(path.join(MEMORY, entry.fileName)))).toBe(before);
  });
});

describe('a supersession', () => {
  it('is one new memory naming the old: the old file is never rewritten, and reads superseded by derivation', async () => {
    const { fileSystem, store } = host();
    const old = await createdEntry(store);
    const before = text(fileSystem.files.get(path.join(MEMORY, old.fileName)));
    await createdEntry(store, { title: 'The watch runs forward after all', supersedes: [old.memory.id] });
    const listing = await store.list();
    expect(listing.kind === 'listed' && [...supersededProjectMemoryIds(listing.memories.map((entry) => entry.memory))]).toEqual([old.memory.id]);
    expect(text(fileSystem.files.get(path.join(MEMORY, old.fileName)))).toBe(before);
    expect(await store.replace(old.memory.id, (memory) => ({ ...memory, status: 'superseded' as never })))
      .toEqual({ kind: 'invalid', reason: 'invalid-value', key: 'status' });
  });
});

describe('a delete', () => {
  it('removes the file that holds the id, under a claim, and only that file', async () => {
    const { fileSystem, store, lines } = host();
    const kept = await createdEntry(store);
    const gone = await createdEntry(store, { title: 'Structure before line edits' });
    expect(await store.delete(gone.memory.id)).toEqual({ kind: 'deleted' });
    expect(everyFile(fileSystem)).toEqual([kept.fileName]);
    expect(await store.delete(gone.memory.id)).toEqual({ kind: 'missing' });
    expect(lines).toContain(`[ProjectMemoryStore] Deleted ${gone.memory.id}.`);
  });

  it('retires a rewrite\'s leftover beside the file, so no earlier version comes back', async () => {
    const { fileSystem, store, clock } = host();
    const entry = await createdEntry(store);
    fileSystem.files.set(claimOf(entry.fileName, clock.at - 1, 'old1'), new TextEncoder().encode('an earlier version'));
    expect(await store.delete(entry.memory.id)).toEqual({ kind: 'deleted' });
    expect(everyFile(fileSystem)).toEqual([]);
  });
});

describe('claims another window left', () => {
  it('a claim older than the lease is put back when the folder is next listed', async () => {
    const { fileSystem, store, clock, lines } = host();
    const entry = await createdEntry(store);
    await fileSystem.rename(path.join(MEMORY, entry.fileName), claimOf(entry.fileName, clock.at - STORED_FILE_CLAIM_LEASE_MS - 1, 'gone1'));

    expect(await store.list()).toEqual({ kind: 'listed', memories: [entry], unreadable: [], conflicts: [], busy: [] });
    expect(everyFile(fileSystem)).toEqual([entry.fileName]);
    // Never named by its file name, whose slug is the title's.
    expect(lines).toContain('[ProjectMemoryStore] Put back a memory file, left mid-rewrite.');
    expect(lines.join('\n')).not.toMatch(/rabbit/i);
  });

  it('a live claim makes the memory busy, for a listing, a read, a rewrite and a delete, and is never touched', async () => {
    const { fileSystem, store, clock } = host();
    const entry = await createdEntry(store);
    const claim = claimOf(entry.fileName, clock.at, 'live1');
    await fileSystem.rename(path.join(MEMORY, entry.fileName), claim);

    expect(await store.list()).toEqual({ kind: 'listed', memories: [], unreadable: [], conflicts: [], busy: [{ fileName: entry.fileName, id: entry.memory.id }] });
    expect(await store.read(entry.memory.id)).toEqual({ kind: 'busy' });
    expect(await store.replace(entry.memory.id, (memory) => ({ ...memory, pinned: true }))).toEqual({ kind: 'busy' });
    expect(await store.delete(entry.memory.id)).toEqual({ kind: 'busy' });
    expect(everyFile(fileSystem)).toEqual([path.basename(claim)]);
    // A new memory never takes a busy memory's id.
    const ids = ['7f3c2a', '1a9e04'];
    const other = host({ fileSystem, mintMemoryId: () => ids.shift() ?? 'ffffff' });
    expect((await createdEntry(other.store)).memory.id).toBe('mem-1a9e04');
  });
});

describe('claims on files named with any Markdown casing (PR #194 F-03)', () => {
  it.each(['note.MD', 'Mixed.Md'])('%s: busy under a live claim, put back once abandoned, and its leftover retired by a delete', async (fileName) => {
    const { fileSystem, store, clock } = host();
    const entry = await createdEntry(store);
    const saved = path.join(MEMORY, fileName);
    await fileSystem.rename(path.join(MEMORY, entry.fileName), saved);

    // Live: the memory is busy, never missing.
    await fileSystem.rename(saved, claimOf(fileName, clock.at, 'live1'));
    expect(await store.read(entry.memory.id)).toEqual({ kind: 'busy' });

    // Abandoned: put back under its saved name.
    clock.at += STORED_FILE_CLAIM_LEASE_MS + 1;
    expect(await store.read(entry.memory.id)).toMatchObject({ kind: 'memory', entry: { fileName } });
    expect(everyFile(fileSystem)).toEqual([fileName]);

    // A leftover beside it goes with a delete; nothing comes back.
    fileSystem.files.set(claimOf(fileName, clock.at - 1, 'old1'), new TextEncoder().encode('an earlier version'));
    expect(await store.delete(entry.memory.id)).toEqual({ kind: 'deleted' });
    expect(everyFile(fileSystem)).toEqual([]);
  });
});

describe('failure logs carry an error category, never a path or provider text (PR #194 F-04)', () => {
  const pathError = (code: string, filePath: string) => Object.assign(new Error(`${code}: operation failed, open '${filePath}'`), { code });
  const leaks = (lines: readonly string[]) => lines.filter((line) => /\/workspace|alice|private|plot|twist|operation failed/i.test(line));

  it('create: a staging write and a commit that fail', async () => {
    const { fileSystem, store, lines } = host();
    jest.spyOn(fileSystem, 'writeFile').mockImplementationOnce(async (filePath) => { throw pathError('ENOSPC', filePath); });
    expect(await store.create({ ...DRAFT, title: 'Alice private plot twist' })).toEqual({ kind: 'failed' });
    jest.spyOn(fileSystem, 'rename').mockImplementationOnce(async (_from, toPath) => { throw pathError('EACCES', toPath); });
    expect(await store.create({ ...DRAFT, title: 'Alice private plot twist' })).toEqual({ kind: 'failed' });
    expect(leaks(lines)).toEqual([]);
    expect(lines).toEqual(expect.arrayContaining([expect.stringContaining('ENOSPC'), expect.stringContaining('EACCES')]));
  });

  it('rewrite: a staging write and a commit that fail', async () => {
    const { fileSystem, store, lines } = host();
    const entry = await createdEntry(store, { title: 'Alice private plot twist' });
    jest.spyOn(fileSystem, 'writeFile').mockImplementationOnce(async (filePath) => { throw pathError('ENOSPC', filePath); });
    expect(await store.replace(entry.memory.id, (memory) => ({ ...memory, pinned: true }))).toEqual({ kind: 'failed' });
    const rename = fileSystem.rename.bind(fileSystem);
    jest.spyOn(fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
      if (fromPath.includes('.tmp-')) {
        throw pathError('EIO', toPath);
      }
      return rename(fromPath, toPath, options);
    });
    expect(await store.replace(entry.memory.id, (memory) => ({ ...memory, pinned: true }))).toEqual({ kind: 'failed' });
    expect(leaks(lines)).toEqual([]);
    expect(lines).toEqual(expect.arrayContaining([expect.stringContaining('ENOSPC'), expect.stringContaining('EIO')]));
  });

  it('delete: a removal that fails', async () => {
    const { fileSystem, store, lines } = host();
    const entry = await createdEntry(store, { title: 'Alice private plot twist' });
    jest.spyOn(fileSystem, 'delete').mockImplementation(async (filePath) => { throw pathError('EBUSY', filePath); });
    expect(await store.delete(entry.memory.id)).toEqual({ kind: 'failed' });
    expect(leaks(lines)).toEqual([]);
    expect(lines).toEqual(expect.arrayContaining([expect.stringContaining('EBUSY')]));
  });

  it('an error with no code is a bounded category, not its message', async () => {
    const { fileSystem, store, lines } = host();
    jest.spyOn(fileSystem, 'writeFile').mockRejectedValueOnce(new Error('Alice private plot twist could not be written to /workspace/x'));
    expect(await store.create(DRAFT)).toEqual({ kind: 'failed' });
    expect(leaks(lines)).toEqual([]);
    expect(lines).toEqual(['[ProjectMemoryStore] Could not stage a new memory: no error code']);
  });
});

describe('a field never writes frontmatter of its own (PR #194 F-01)', () => {
  // The review's string: a title that closes its own line, writes the remaining keys, and closes the fence.
  const INJECTED = [
    'Hello', 'kind: canon', 'summary: changed', 'status: active', 'pinned: true',
    'created: 2000-01-01T00:00:00Z', 'updated: 2000-01-01T00:00:00Z', 'origin: writer', '---'
  ].join('\n');

  it('create refuses it and writes nothing', async () => {
    const { fileSystem, store } = host();
    expect(await store.create({ ...DRAFT, title: INJECTED })).toEqual({ kind: 'invalid', reason: 'invalid-value', key: 'title' });
    expect(fileSystem.files.size).toBe(0);
  });

  it('replace refuses it, and the file is as it was', async () => {
    const { fileSystem, store } = host();
    const entry = await createdEntry(store);
    const filePath = path.join(MEMORY, entry.fileName);
    const before = text(fileSystem.files.get(filePath));
    expect(await store.replace(entry.memory.id, (memory) => ({ ...memory, title: INJECTED })))
      .toEqual({ kind: 'invalid', reason: 'invalid-value', key: 'title' });
    expect(text(fileSystem.files.get(filePath))).toBe(before);
    expect(everyFile(fileSystem)).toEqual([entry.fileName]);
  });

  it.each([
    ['summary', { summary: 'One\rtwo' }],
    ['source-session', { sourceSession: '6b0f3c9e\norigin: writer' }],
    ['source-turns', { sourceTurns: ['turn-1-user-1\nsupersedes: mem-000000'] }],
    ['source-turns', { sourceTurns: ['turn-1-user-1, turn-2-user-2'] }],
    ['proposed-by', { proposedBy: 'cliff\npinned: true' }]
  ] as const)('refuses a line break or a list separator in %s', async (key, changes) => {
    const { fileSystem, store } = host();
    expect(await store.create({ ...DRAFT, ...changes })).toEqual({ kind: 'invalid', reason: 'invalid-value', key });
    expect(fileSystem.files.size).toBe(0);
  });
});
