/**
 * Delete honours the workspace at its commit point (PR #202 F01): a scope
 * withdrawn while the store reads the folder, or while it reads the claimed
 * bytes, stops the delete before anything is removed, and the file is put
 * back under its own name. Over the real library and store on the memory
 * file system. *Alice*, made-up ids.
 */
import * as path from 'node:path';
import { holdOnce, libraryHost, MEMORY, writerMemory } from './projectMemoryLibraryHost';

function withdraw(host: ReturnType<typeof libraryHost>): void {
  host.state.scope = { available: false, reason: 'workspace-changed' } as never;
  host.state.folders = [{ path: '/other-root', name: 'other' }];
}

describe('Delete and the workspace at its commit point (PR #202 F01)', () => {
  it('a scope withdrawn while the folder is read deletes nothing', async () => {
    const host = libraryHost();
    const file = host.put(writerMemory({ id: 'mem-00d001' }));
    const hold = holdOnce(host.fileSystem as never, 'readDirectory', () => true);

    const removing = host.library.remove('mem-00d001');
    await hold.arrived;
    withdraw(host);
    hold.release();

    expect(await removing).toEqual({ kind: 'refused', reason: 'workspace-changed' });
    expect(host.fileSystem.files.has(file)).toBe(true);
    expect([...host.fileSystem.files.keys()].filter((name) => name.includes('.claim-'))).toEqual([]);
  });

  it('a scope withdrawn while the claimed bytes are read deletes nothing, and the file is put back under its name', async () => {
    const host = libraryHost();
    const file = host.put(writerMemory({ id: 'mem-00d002' }));
    const hold = holdOnce(host.fileSystem as never, 'readFile', (filePath: string) => path.basename(filePath).includes('.claim-'));

    const removing = host.library.remove('mem-00d002');
    await hold.arrived;
    withdraw(host);
    hold.release();

    expect(await removing).toEqual({ kind: 'refused', reason: 'workspace-changed' });
    expect(host.fileSystem.files.has(file)).toBe(true);
    expect([...host.fileSystem.files.keys()].filter((name) => name.startsWith(MEMORY) && name.includes('.claim-'))).toEqual([]);
  });

  it('a scope withdrawn while leftovers are retired deletes nothing', async () => {
    const host = libraryHost();
    const file = host.put(writerMemory({ id: 'mem-00d004' }));
    const claimed = () => [...host.fileSystem.files.keys()].some((name) => name.includes('.claim-'));
    const hold = holdOnce(host.fileSystem as never, 'readDirectory', () => claimed());

    const removing = host.library.remove('mem-00d004');
    await hold.arrived;
    withdraw(host);
    hold.release();

    expect(await removing).toEqual({ kind: 'refused', reason: 'workspace-changed' });
    expect(host.fileSystem.files.has(file)).toBe(true);
    expect(claimed()).toBe(false);
  });

  it('a delete the scope holds through still deletes, and its other guarantees stand', async () => {
    const host = libraryHost();
    const file = host.put(writerMemory({ id: 'mem-00d003' }));
    expect(await host.library.remove('mem-00d003')).toEqual({ kind: 'deleted' });
    expect(host.fileSystem.files.has(file)).toBe(false);
  });

  describe('a delete keeps the project it was asked for while it waits (PR #202 F01 re-review)', () => {
    const B_MEMORY = path.join('/project-b', 'prose-minion', 'memory');
    /** Root A and a copied project B, with the same id under the same file name. */
    function copied() {
      const host = libraryHost();
      const fileA = host.put(writerMemory({ id: 'mem-000001', title: 'Alice keeps the key' }), 'key-note.md');
      const fileB = path.join(B_MEMORY, 'key-note.md');
      host.fileSystem.files.set(fileB, new TextEncoder().encode(
        new TextDecoder().decode(host.fileSystem.files.get(fileA)).replace('Alice keeps the key', 'The Hatter keeps the key')
      ));
      const toB = () => { host.state.folders = [{ path: '/project-b', name: 'project-b' }]; };
      return { host, fileA, fileB, toB };
    }

    it('behind a queued list, a switch to B deletes neither project’s file', async () => {
      const { host, fileA, fileB, toB } = copied();
      const hold = holdOnce(host.fileSystem as never, 'readDirectory', () => true);
      const listing = host.store.list();
      await hold.arrived;
      const deleteSpy = jest.spyOn(host.store, 'delete');
      const removing = host.library.remove('mem-000001');
      await Promise.resolve();
      expect(deleteSpy).toHaveBeenCalled();
      toB();
      hold.release();
      await listing;

      expect(await removing).toEqual({ kind: 'refused', reason: 'workspace-changed' });
      expect(host.fileSystem.files.has(fileA)).toBe(true);
      expect(host.fileSystem.files.has(fileB)).toBe(true);
    });

    it('behind the library’s write queue, a switch to B deletes neither project’s file', async () => {
      const { host, fileA, fileB, toB } = copied();
      const hold = holdOnce(host.fileSystem as never, 'readDirectory', () => true);
      const earlier = host.library.remove('mem-0000ff');
      await hold.arrived;
      const removing = host.library.remove('mem-000001');
      toB();
      hold.release();
      await earlier;

      expect(await removing).toEqual({ kind: 'refused', reason: 'workspace-changed' });
      expect(host.fileSystem.files.has(fileA)).toBe(true);
      expect(host.fileSystem.files.has(fileB)).toBe(true);
    });
  });

  describe('Always load in full keeps the project it was asked for while it waits (PR #202 F01, third round)', () => {
    const B_MEMORY = path.join('/project-b', 'prose-minion', 'memory');
    function copied() {
      const host = libraryHost();
      const fileA = host.put(writerMemory({ id: 'mem-000001', title: 'Alice keeps the key' }), 'key-note.md');
      const fileB = path.join(B_MEMORY, 'key-note.md');
      const bytesA = host.fileSystem.files.get(fileA) as Uint8Array;
      host.fileSystem.files.set(fileB, new TextEncoder().encode(new TextDecoder().decode(bytesA).replace('Alice keeps the key', 'The Hatter keeps the key')));
      const bytesB = host.fileSystem.files.get(fileB) as Uint8Array;
      const toB = () => { host.state.folders = [{ path: '/project-b', name: 'project-b' }]; };
      const untouched = () => {
        expect(host.fileSystem.files.get(fileA)).toEqual(bytesA);
        expect(host.fileSystem.files.get(fileB)).toEqual(bytesB);
      };
      return { host, toB, untouched };
    }

    it('behind a held store list, a switch to B pins neither project’s note', async () => {
      const { host, toB, untouched } = copied();
      const hold = holdOnce(host.fileSystem as never, 'readDirectory', () => true);
      const listing = host.store.list();
      await hold.arrived;
      const pinning = host.library.setLoadInFull('mem-000001', true);
      toB();
      hold.release();
      await listing;

      expect(await pinning).toEqual(expect.objectContaining({ kind: 'refused', reason: 'workspace-changed' }));
      untouched();
    });

    it('behind another library write, a switch to B pins neither project’s note', async () => {
      const { host, toB, untouched } = copied();
      const hold = holdOnce(host.fileSystem as never, 'readDirectory', () => true);
      const earlier = host.library.remove('mem-0000ff');
      await hold.arrived;
      const pinning = host.library.setLoadInFull('mem-000001', true);
      toB();
      hold.release();
      await earlier;

      expect(await pinning).toEqual(expect.objectContaining({ kind: 'refused', reason: 'workspace-changed' }));
      untouched();
    });

    it('with no switch, it still pins A’s note', async () => {
      const { host } = copied();
      expect(await host.library.setLoadInFull('mem-000001', true)).toEqual(expect.objectContaining({ kind: 'written' }));
    });
  });
});

