/**
 * Every queued memory write keeps the project it was asked for (PR #202
 * F01, done once in the library's queue): a Save, an Edit, an Archive and a
 * Restore asked in project A, whose turn comes after the writer switched to
 * a copied project B holding the same id under the same file name, write
 * nothing in either. Behind the library's write queue and behind a held
 * store list, over the real library and store. *Alice*, made-up ids.
 */
import * as path from 'node:path';
import type { WorkshopMemoryDraft } from '@messages';
import { holdOnce, libraryHost, MEMORY, writerMemory } from './projectMemoryLibraryHost';

const B_MEMORY = path.join('/project-b', 'prose-minion', 'memory');
const draft: WorkshopMemoryDraft = {
  title: 'The door is locked', kind: 'canon', summary: 'Alice can’t open the little door.', body: '', supersedes: [], pinned: false
};

function copied(status: 'active' | 'archived') {
  const host = libraryHost();
  const fileA = host.put(writerMemory({ id: 'mem-000001', title: 'Alice keeps the key', status }), 'key-note.md');
  const fileB = path.join(B_MEMORY, 'key-note.md');
  const bytesA = host.fileSystem.files.get(fileA) as Uint8Array;
  host.fileSystem.files.set(fileB, new TextEncoder().encode(new TextDecoder().decode(bytesA).replace('Alice keeps the key', 'The Hatter keeps the key')));
  const before = new Map(host.fileSystem.files);
  const toB = () => { host.state.folders = [{ path: '/project-b', name: 'project-b' }]; };
  const untouched = () => {
    const memoryFiles = (files: Map<string, Uint8Array>) =>
      [...files.entries()].filter(([name]) => name.startsWith(MEMORY) || name.startsWith(B_MEMORY));
    expect(memoryFiles(host.fileSystem.files)).toEqual(memoryFiles(before));
  };
  return { host, toB, untouched };
}

type Host = ReturnType<typeof copied>['host'];
const WRITES: Array<[string, 'active' | 'archived', (host: Host) => Promise<{ kind: string; reason?: string }>]> = [
  ['Save', 'active', (host) => host.library.save(draft, { origin: 'writer', sourceTurns: [] })],
  ['Edit', 'active', (host) => host.library.edit('mem-000001', { ...draft, title: 'Alice keeps the brass key' })],
  ['Archive', 'active', (host) => host.library.forget('mem-000001')],
  ['Restore', 'archived', (host) => host.library.restore('mem-000001')]
];

describe('every queued memory write keeps the project it was asked for (PR #202 F01)', () => {
  it.each(WRITES)('%s behind another library write writes nothing after a switch to B', async (_name, status, write) => {
    const { host, toB, untouched } = copied(status);
    const hold = holdOnce(host.fileSystem as never, 'readDirectory', () => true);
    const earlier = host.library.remove('mem-0000ff');
    await hold.arrived;
    const writing = write(host);
    toB();
    hold.release();
    await earlier;

    expect(await writing).toEqual(expect.objectContaining({ kind: 'refused', reason: 'workspace-changed' }));
    untouched();
  });

  it.each(WRITES)('%s behind a held store list writes nothing after a switch to B', async (_name, status, write) => {
    const { host, toB, untouched } = copied(status);
    const hold = holdOnce(host.fileSystem as never, 'readDirectory', () => true);
    const listing = host.store.list();
    await hold.arrived;
    const writing = write(host);
    toB();
    hold.release();
    await listing;

    expect(await writing).toEqual(expect.objectContaining({ kind: 'refused', reason: 'workspace-changed' }));
    untouched();
  });

  it.each(WRITES)('%s with no switch still writes', async (_name, status, write) => {
    const { host } = copied(status);
    expect(await write(host)).toEqual(expect.objectContaining({ kind: 'written' }));
  });
});
