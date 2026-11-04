/**
 * What a read says about a superseded note (ADR 2026-11-04 D4; PR #197 F-02,
 * N-02): it names its direct superseders, and names a note as the one in
 * effect only when that note is. An archived successor, or one superseded in
 * turn, is never called the note in effect, and an edge the cycle rule
 * ignores is never named. Through the real library and store. *Alice*, with
 * made-up ids.
 */
import { libraryHost, writerMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { renderWorkshopProjectMemoryRead } from '@/application/services/workshop/memory/WorkshopProjectMemoryRenderer';
import { listProjectMemories } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';

async function readOf(host: ReturnType<typeof libraryHost>, id: string): Promise<string> {
  const result = await host.library.read([id]);
  if (result.kind !== 'read') {
    throw new Error(`expected a read, got ${result.kind}`);
  }
  return renderWorkshopProjectMemoryRead(result.items).content;
}

describe('a superseded note, read', () => {
  it('names an active successor as the note in effect', async () => {
    const host = libraryHost();
    host.put(writerMemory({ id: 'mem-00000a' }));
    host.put(writerMemory({ id: 'mem-00000b', supersedes: ['mem-00000a'] }));
    expect(await readOf(host, 'mem-00000a')).toContain('superseded by: mem-00000b; mem-00000b is the note in effect now.');
  });

  it('never calls an archived successor the note in effect, and keeps the old note superseded', async () => {
    const host = libraryHost();
    host.put(writerMemory({ id: 'mem-00000a' }));
    host.put(writerMemory({ id: 'mem-00000b', supersedes: ['mem-00000a'], status: 'archived' }));
    const text = await readOf(host, 'mem-00000a');
    expect(text).toContain('Note mem-00000a · canon · superseded');
    expect(text).toContain('superseded by: mem-00000b; nothing that replaces it is in effect now.');
    expect(text).not.toContain('is the note in effect');
  });

  it('follows a chain to the note in effect at its end', async () => {
    const host = libraryHost();
    host.put(writerMemory({ id: 'mem-00000a' }));
    host.put(writerMemory({ id: 'mem-00000b', supersedes: ['mem-00000a'] }));
    host.put(writerMemory({ id: 'mem-00000c', supersedes: ['mem-00000b'] }));
    const text = await readOf(host, 'mem-00000a');
    expect(text).toContain('superseded by: mem-00000b; mem-00000c is the note in effect now.');
    expect(text).not.toContain('mem-00000b is the note in effect');
  });

  it('names only the edges standing counts: a cycle\'s edge is ignored (N-02)', () => {
    const listed = listProjectMemories([
      { memory: writerMemory({ id: 'mem-00000a', supersedes: ['mem-00000b'] }) },
      { memory: writerMemory({ id: 'mem-00000b', supersedes: ['mem-00000a'] }) },
      { memory: writerMemory({ id: 'mem-00000c', supersedes: ['mem-00000a'] }) }
    ]);
    const a = listed.find(({ memory }) => memory.id === 'mem-00000a')!;
    expect(a.superseded).toBe(true);
    expect(a.supersededBy).toEqual(['mem-00000c']);
    expect(listed.find(({ memory }) => memory.id === 'mem-00000b')!.superseded).toBe(false);
  });
});
