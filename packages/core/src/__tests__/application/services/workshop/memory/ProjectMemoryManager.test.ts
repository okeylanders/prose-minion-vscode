/**
 * The folder as the Memory tab and the manager draw it (epic Slice 4b): over
 * a real ProjectMemoryStore on the memory file system, the listing's
 * standing, estimate, residency, sources and entry keys; Open file by key
 * only; the folder made on Open memory folder; and the manager's two writes
 * (Always load in full, Delete). *Alice*, made-up ids.
 */
import * as path from 'node:path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { projectMemoryBody } from '@shared/types/projectMemory';
import { renderProjectMemoryFrame } from '@/application/services/workshop/memory/ProjectMemoryCatalogFrame';
import { listProjectMemories } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import { ProjectMemoryManager, type ProjectMemoryManagerStorePort } from '@/application/services/workshop/memory/ProjectMemoryManager';
import { ProjectMemoryWrites, type ProjectMemoryWriteStorePort } from '@/application/services/workshop/memory/ProjectMemoryWrites';
import { libraryHost, MEMORY, memory, SOURCE_SESSION, writerMemory } from './projectMemoryLibraryHost';

// Under the codec's 8,000-character note, and big enough that two load in full and a third doesn't.
const BIG = 'word '.repeat(1_500);

describe('ProjectMemoryManager listing', () => {
  it('lists every memory with its standing, origin and source, and the frame renderer\'s estimate and residency', async () => {
    const host = libraryHost({
      positions: (sessionId) => sessionId === SOURCE_SESSION
        ? { kind: 'positions', sessionId, title: 'Tea-party pacing', positions: [] }
        : { kind: 'unknown-session' }
    });
    host.put(memory({ id: 'mem-0000a1', pinned: true, created: '2026-10-01T00:00:00Z', body: projectMemoryBody(BIG) }));
    host.put(memory({ id: 'mem-0000a2', pinned: true, created: '2026-10-02T00:00:00Z', body: projectMemoryBody(BIG) }));
    host.put(memory({ id: 'mem-0000a3', pinned: true, created: '2026-10-03T00:00:00Z', body: projectMemoryBody(BIG), sourceSession: 'gone-session' }));
    host.put(writerMemory({ id: 'mem-0000b1', title: 'Old tea time' }));
    host.put(writerMemory({ id: 'mem-0000b2', title: 'Tea is at six', supersedes: ['mem-0000b1'] }));

    const listing = await host.library.managerListing('');
    const read = await host.store.list();
    const listed = listProjectMemories(read.kind === 'listed' ? read.memories : []);
    const frame = renderProjectMemoryFrame({ memories: listed, unreadable: 0, conflicts: 0 }, { builtOn: '2026-11-04' });

    expect(listing.workspace).toEqual({ kind: 'available' });
    expect(listing.saved).toBe(5);
    expect(listing.estimate).toEqual(frame?.estimate);
    expect(listing.estimate).toMatchObject({ pinned: 3, pinnedLoaded: 2, pinnedOver: true });
    const byId = new Map(listing.memories.map((entry) => [entry.id, entry]));
    expect(['mem-0000a1', 'mem-0000a2', 'mem-0000a3'].map((id) => [byId.get(id)?.fullLoad, byId.get(id)?.residency])).toEqual([
      ['loaded', 'full'], ['loaded', 'full'], ['doesnt-fit', 'listed']
    ]);
    expect(byId.get('mem-0000a1')).toMatchObject({ origin: 'proposed', proposedByLabel: 'Cliff', source: { kind: 'session', title: 'Tea-party pacing' } });
    expect(byId.get('mem-0000a3')?.source).toEqual({ kind: 'unnamed' });
    expect(byId.get('mem-0000b2')).toMatchObject({ source: { kind: 'none' }, fullLoad: null, residency: 'listed' });
    expect(byId.get('mem-0000b1')).toMatchObject({ superseded: true, supersededBy: ['mem-0000b2'] });
    expect(byId.get('mem-0000b1')?.residency).toBeUndefined();
    // Every row's key is its own.
    expect(new Set(listing.memories.map((entry) => entry.entryKey)).size).toBe(5);
  });

  it('a list over its budget: residency says which entries are searchable only', async () => {
    const host = libraryHost();
    for (let index = 0; index < PROMPT_BUDGETS.workshopProjectMemory.catalogEntries + 3; index += 1) {
      host.put(writerMemory({ id: `mem-${(0x100 + index).toString(16).padStart(6, '0')}`, title: `Alice note ${index}` }));
    }
    const listing = await host.library.managerListing('');
    const counts = { listed: 0, searchable: 0 };
    for (const entry of listing.memories) {
      counts[entry.residency as 'listed' | 'searchable'] += 1;
    }
    expect(counts).toEqual({ listed: listing.estimate?.catalogEntries, searchable: 3 });
  });

  it('narrows the rows by the host\'s search over titles, summaries and notes; files needing attention stay', async () => {
    const host = libraryHost();
    host.put(writerMemory({ id: 'mem-0000c1', title: 'The Duchess sneezes', summary: 'Pepper in the kitchen.' }));
    host.put(writerMemory({ id: 'mem-0000c2', title: 'Tea is at six', body: projectMemoryBody('The March Hare keeps the clock.') }));
    host.putText('broken-0000c3.md', 'no frontmatter here');
    expect((await host.library.managerListing('hare')).memories.map((entry) => entry.id)).toEqual(['mem-0000c2']);
    const sneeze = await host.library.managerListing('pepper');
    expect(sneeze.memories.map((entry) => entry.id)).toEqual(['mem-0000c1']);
    expect(sneeze.unreadable).toEqual([expect.objectContaining({ fileName: 'broken-0000c3.md', reason: 'no-frontmatter' })]);
    expect(sneeze.saved).toBe(2);
  });

  it('reads with memory off, and says why where the workspace holds no memory', async () => {
    const off = libraryHost({ mode: 'off' });
    off.put(writerMemory());
    expect((await off.library.managerListing('')).memories).toHaveLength(1);
    expect((await libraryHost({ folders: [] }).library.managerListing('')).workspace).toEqual({ kind: 'unavailable', reason: 'no-workspace' });
    const two = libraryHost({ folders: [{ path: '/a', name: 'a' }, { path: '/b', name: 'b' }] });
    expect((await two.library.managerListing('')).workspace).toEqual({ kind: 'unavailable', reason: 'multi-root' });
    const changed = libraryHost({ scope: { available: false, reason: 'workspace-changed' } as never });
    expect((await changed.library.managerListing('')).workspace).toEqual({ kind: 'unknown' });
  });
});

describe('ProjectMemoryManager entry keys and Open file', () => {
  it('opens each row\'s own file by key, each conflicting copy included; a forged or stale key opens nothing', async () => {
    const host = libraryHost();
    const own = host.put(writerMemory({ id: 'mem-0000d1' }));
    const copyA = host.put(writerMemory({ id: 'mem-0000d2' }), 'copy-a-0000d2.md');
    const copyB = host.put(writerMemory({ id: 'mem-0000d2' }), 'copy-b-0000d2.md');
    host.putText('no-id-0000d3.md', '---\ntitle: Alice\n---\n');
    const listing = await host.library.managerListing('');
    expect(listing.conflicts).toHaveLength(1);
    const [keyA, keyB] = listing.conflicts[0].files.map((file) => file.entryKey);
    expect(keyA).not.toBe(keyB);

    expect(await host.library.managerFile(listing.memories[0].entryKey)).toEqual({ kind: 'file', path: own });
    expect(await host.library.managerFile(keyA)).toEqual({ kind: 'file', path: copyA });
    expect(await host.library.managerFile(keyB)).toEqual({ kind: 'file', path: copyB });
    expect(await host.library.managerFile(listing.unreadable[0].entryKey)).toEqual({ kind: 'file', path: path.join(MEMORY, 'no-id-0000d3.md') });

    expect(await host.library.managerFile('0'.repeat(32))).toEqual({ kind: 'refused', reason: 'stale' });
    expect(await host.library.managerFile('../../etc/passwd')).toEqual({ kind: 'refused', reason: 'stale' });
    host.fileSystem.files.delete(own);
    expect(await host.library.managerFile(listing.memories[0].entryKey)).toEqual({ kind: 'refused', reason: 'stale' });
  });

  it('a key from another workspace opens nothing', async () => {
    const first = libraryHost();
    first.put(writerMemory({ id: 'mem-0000e1' }));
    const key = (await first.library.managerListing('')).memories[0].entryKey;
    const second = libraryHost({ folders: [{ path: '/elsewhere', name: 'elsewhere' }] });
    second.fileSystem.files.set(path.join('/elsewhere', 'prose-minion', 'memory', 'e1-note.md'), first.fileSystem.files.get(path.join(MEMORY, 'e1-note.md')) as Uint8Array);
    expect(await second.library.managerFile(key)).toEqual({ kind: 'refused', reason: 'stale' });
  });

  it('a set-aside copy and the standing file beside it never share a key, and the copy has no file to open', async () => {
    const host = libraryHost();
    const standing = writerMemory({ id: 'mem-0000f1' });
    const store: ProjectMemoryManagerStorePort = {
      availability: () => host.store.availability(),
      ensureFolder: () => host.store.ensureFolder(),
      list: async () => ({
        kind: 'listed',
        memories: [{ fileName: 'cat-0000f1.md', memory: standing }],
        unreadable: [{ fileName: 'cat-0000f1.md', reason: 'set-aside' }],
        conflicts: []
      })
    };
    const manager = new ProjectMemoryManager(store, () => undefined, { positionsOf: host.positionsOf }, () => new Date('2026-11-04T00:00:00Z'), host.log);
    const listing = await manager.listing('');
    const memoryKey = listing.memories[0].entryKey;
    const asideKey = listing.unreadable[0].entryKey;
    expect(memoryKey).not.toBe(asideKey);
    expect(await manager.fileOf(memoryKey)).toEqual({ kind: 'file', path: path.join(MEMORY, 'cat-0000f1.md') });
    expect(await manager.fileOf(asideKey)).toEqual({ kind: 'refused', reason: 'set-aside' });
  });

  it('Open memory folder makes the folder when it isn\'t there yet', async () => {
    const host = libraryHost();
    const made = jest.spyOn(host.fileSystem, 'createDirectory');
    expect(await host.library.memoryFolder()).toEqual({ kind: 'folder', path: MEMORY });
    expect(made).toHaveBeenCalledWith(MEMORY);
    expect(await libraryHost({ folders: [] }).library.memoryFolder()).toEqual({ kind: 'refused', reason: 'unavailable' });
  });

  it('logs no title, summary, body or path', async () => {
    const host = libraryHost();
    host.put(writerMemory({ id: 'mem-0000a9', title: 'QQX-TITLE', summary: 'QQX-SUMMARY', body: projectMemoryBody('QQX-BODY') }));
    const listing = await host.library.managerListing('QQX');
    await host.library.managerFile(listing.memories[0].entryKey);
    await host.library.managerFile('f'.repeat(32));
    expect(host.lines.join('\n')).not.toMatch(/QQX|\/workspace/);
  });
});

describe('the manager\'s writes', () => {
  it('Always load in full changes only pinned, leaves updated alone, and is refused past the budget', async () => {
    const host = libraryHost();
    host.put(writerMemory({ id: 'mem-000101', pinned: true, created: '2026-10-01T00:00:00Z', body: projectMemoryBody(BIG) }));
    host.put(writerMemory({ id: 'mem-000102', pinned: true, created: '2026-10-02T00:00:00Z', body: projectMemoryBody(BIG) }));
    host.put(writerMemory({ id: 'mem-000103', body: projectMemoryBody(BIG) }));
    const before = (await host.library.editData('mem-000103'));

    const refused = await host.library.setLoadInFull('mem-000103', true);
    expect(refused).toMatchObject({ kind: 'refused', reason: 'pinned-budget', budget: { refused: true, budgetTokens: 5_000 } });

    expect(await host.library.setLoadInFull('mem-000102', false)).toMatchObject({ kind: 'written', changedMeaning: false, memory: { pinned: false } });
    const on = await host.library.setLoadInFull('mem-000103', true);
    expect(on).toMatchObject({ kind: 'written', memory: { pinned: true } });
    const after = await host.library.editData('mem-000103');
    expect(after.kind === 'memory' && before.kind === 'memory' && { ...after.memory, pinned: false }).toEqual(before.kind === 'memory' && before.memory);
    expect(await host.library.setLoadInFull('mem-ffffff', true)).toEqual({ kind: 'refused', reason: 'missing' });
  });

  it('Delete removes the file, and a memory it superseded is in effect again (N-01)', async () => {
    const host = libraryHost();
    host.put(writerMemory({ id: 'mem-000201', title: 'Old tea time' }));
    const newer = host.put(writerMemory({ id: 'mem-000202', title: 'Tea is at six', supersedes: ['mem-000201'] }));
    expect(await host.library.remove('mem-000202')).toEqual({ kind: 'deleted' });
    expect(host.fileSystem.files.has(newer)).toBe(false);
    const listing = await host.library.managerListing('');
    expect(listing.memories).toEqual([expect.objectContaining({ id: 'mem-000201', superseded: false, residency: 'listed' })]);
    expect(await host.library.remove('mem-000202')).toEqual({ kind: 'refused', reason: 'missing' });
  });

  it.each(['changed', 'busy', 'conflict'] as const)('Delete answers %s honestly, from the store', async (kind) => {
    const host = libraryHost();
    const store = { ...host.store, delete: jest.fn(async () => ({ kind })) } as unknown as ProjectMemoryWriteStorePort;
    const writes = new ProjectMemoryWrites(store, () => undefined, () => new Date(), host.log);
    expect(await writes.remove('mem-000301')).toEqual({ kind: 'refused', reason: kind });
  });

  it('Delete is refused where the workspace holds no memory', async () => {
    expect(await libraryHost({ folders: [] }).library.remove('mem-000401')).toEqual({ kind: 'refused', reason: 'no-workspace' });
  });
});
