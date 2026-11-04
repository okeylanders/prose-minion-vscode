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
});
