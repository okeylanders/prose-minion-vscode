/**
 * The manager's answers belong to the root that produced them (PR #202 F02):
 * a scope withdrawn, or a root moved, while a listing names its sessions,
 * while the folder is made, or while a queued read waits its turn, gives
 * nothing of the old root to the webview or the shell. Over the real
 * library and store on the memory file system. *Alice*, made-up ids.
 */
import * as path from 'node:path';
import type { WorkshopRecallPositions } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import { holdOnce, libraryHost, memory, writerMemory } from './projectMemoryLibraryHost';

const OTHER = '/other-root';

function moveRoot(host: ReturnType<typeof libraryHost>, withdrawScope: boolean): void {
  if (withdrawScope) {
    host.state.scope = { available: false, reason: 'workspace-changed' } as never;
  }
  host.state.folders = [{ path: OTHER, name: 'other' }];
}

describe('The manager and the root that produced its answer (PR #202 F02)', () => {
  it.each([true, false])('a root moved while source sessions are named lists nothing of the old root (scope withdrawn: %s)', async (withdrawScope) => {
    const host = libraryHost();
    host.put(memory({ id: 'mem-00e001' }));
    let release: () => void = () => undefined;
    let arrived: () => void = () => undefined;
    const reached = new Promise<void>((resolve) => { arrived = resolve; });
    host.positionsOf.mockImplementationOnce(async (sessionId: string): Promise<WorkshopRecallPositions> => {
      arrived();
      await new Promise<void>((resolve) => { release = resolve; });
      return { kind: 'positions', sessionId, title: 'The Hatter’s private tea', positions: [1] } as WorkshopRecallPositions;
    });

    const listing = host.library.managerListing('');
    await reached;
    moveRoot(host, withdrawScope);
    release();

    const answer = await listing;
    expect(answer.workspace).not.toEqual({ kind: 'available' });
    expect(answer.memories).toEqual([]);
    expect(JSON.stringify(answer)).not.toContain('Hatter');
  });

  it.each([true, false])('a root moved while the folder is made hands the shell nothing (scope withdrawn: %s)', async (withdrawScope) => {
    const host = libraryHost();
    const hold = holdOnce(host.fileSystem as never, 'createDirectory', () => true);

    const folder = host.library.memoryFolder();
    await hold.arrived;
    moveRoot(host, withdrawScope);
    hold.release();

    expect(await folder).toEqual({ kind: 'refused', reason: 'unavailable' });
  });

  it('a key resolved by a queued read after the root moved opens nothing, even where the new root has the same file name', async () => {
    const host = libraryHost();
    host.put(writerMemory({ id: 'mem-00e002' }), 'tea-note.md');
    const [entry] = (await host.library.managerListing('')).memories;
    // The new root has a file of the same name, holding another memory.
    host.fileSystem.files.set(path.join(OTHER, 'prose-minion', 'memory', 'tea-note.md'),
      host.fileSystem.files.get(path.join('/workspace', 'prose-minion', 'memory', 'tea-note.md')) as Uint8Array);
    const hold = holdOnce(host.fileSystem as never, 'readDirectory', () => true);
    const blocking = host.library.remove('mem-00e0ff');
    await hold.arrived;

    const file = host.library.managerFile(entry.entryKey);
    moveRoot(host, false);
    hold.release();
    await blocking;

    expect(await file).toEqual({ kind: 'refused', reason: 'unknown' });
  });
});
