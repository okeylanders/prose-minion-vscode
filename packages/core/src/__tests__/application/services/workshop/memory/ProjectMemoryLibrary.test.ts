/**
 * The project-memory library (ADR 2026-11-04 D5, D8, D10): access read live
 * on every call, the accepted workspace checked before and after each
 * listing, the frame's estimate for the writer's tab, and logs that carry
 * no memory text. *Alice*, with made-up ids.
 */
import { libraryHost, memory, writerMemory, allLines } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { projectMemoryBody } from '@shared/types/projectMemory';

describe('ProjectMemoryLibrary', () => {
  it('reads the mode on every call: off, then on, then off again', async () => {
    const host = libraryHost({ mode: 'off' });
    host.put(memory());
    expect(await host.library.frame()).toEqual({ kind: 'closed', reason: 'off' });
    expect(host.library.teachesGrammar()).toBe(false);
    host.state.mode = 'auto';
    expect((await host.library.frame()).kind).toBe('frame');
    expect(host.library.access()).toEqual({ open: true, mode: 'auto' });
    host.state.mode = 'off';
    expect(await host.library.catalog()).toEqual({ kind: 'closed', reason: 'off' });
  });

  it('refuses a call whose workspace changed while it listed, and returns nothing it read', async () => {
    const host = libraryHost();
    host.put(memory());
    const list = host.store.list.bind(host.store);
    jest.spyOn(host.store, 'list').mockImplementation(async () => {
      const listing = await list();
      host.state.scope = { available: false, reason: 'workspace-changed' };
      return listing;
    });
    expect(await host.library.catalog()).toEqual({ kind: 'closed', reason: 'workspace-changed' });
  });

  it('teaches no grammar in a workspace with no folder, several, or a changed root (D8)', () => {
    expect(libraryHost({ folders: [] }).library.teachesGrammar()).toBe(false);
    expect(libraryHost({ folders: [{ path: '/a', name: 'a' }, { path: '/b', name: 'b' }] }).library.teachesGrammar()).toBe(false);
    expect(libraryHost({ scope: { available: false, reason: 'workspace-changed' } }).library.teachesGrammar()).toBe(false);
    expect(libraryHost().library.teachesGrammar()).toBe(true);
  });

  it('teaches the grammar while a room hydrates, but refuses its calls until it is ready', async () => {
    const host = libraryHost({ scope: { available: false, reason: 'not-ready' } });
    host.put(memory());
    expect(host.library.teachesGrammar()).toBe(true);
    expect(await host.library.read(['mem-7f3c2a'])).toEqual({ kind: 'closed', reason: 'not-ready' });
  });

  it('estimates the frame from the same renderer with memory off, and refuses only an unavailable workspace', async () => {
    const host = libraryHost({ mode: 'off' });
    host.put(writerMemory({ pinned: true, body: projectMemoryBody('Structure before line edits.') }));
    host.put(writerMemory({ id: 'mem-1a9e04' }));
    const estimate = await host.library.estimateProjectMemoryFrame();
    expect(estimate).toMatchObject({ kind: 'estimate', memories: 2, pinned: 1, pinnedLoaded: 1, pinnedOver: false });
    host.state.mode = 'ask';
    const frame = await host.library.frame();
    const { kind: _kind, ...figures } = estimate as Extract<typeof estimate, { kind: 'estimate' }>;
    expect(frame.kind === 'frame' && frame.frame.estimate).toEqual(figures);
    host.state.folders = [];
    expect(await host.library.estimateProjectMemoryFrame()).toEqual({ kind: 'closed', reason: 'no-workspace' });
  });

  it('logs ids, counts and reasons, never a title, summary or body (D9)', async () => {
    const host = libraryHost();
    host.put(memory({ title: 'SENTINEL-TITLE', summary: 'SENTINEL-SUMMARY', body: projectMemoryBody('SENTINEL-BODY') }));
    await host.library.frame();
    await host.library.catalog();
    await host.library.search('SENTINEL');
    await host.library.read(['mem-7f3c2a']);
    expect(allLines(host.lines)).not.toMatch(/SENTINEL-(TITLE|SUMMARY|BODY)/);
    expect(allLines(host.lines)).toContain('[ProjectMemoryLibrary] read named=1 read=1');
  });
});
