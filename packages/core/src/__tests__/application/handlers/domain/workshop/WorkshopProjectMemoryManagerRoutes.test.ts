/**
 * The memory manager's own routes through the real router, slice
 * composition and library (epic Slice 4b): the listing, Always load in full
 * (and its refusal past the budget), Delete (and the store's honest
 * answers), Open file by entry key only, and Open memory folder. None
 * changes the room: no receipt, no snapshot. *Alice*, made-up ids.
 */

import * as path from 'node:path';
import { MessageType } from '@messages';
import { projectMemoryBody } from '@shared/types/projectMemory';
import { MEMORY, writerMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

const BIG = 'word '.repeat(1_500);

describe('Workshop routes — the memory manager', () => {
  let harness: WorkshopRouteTestHarness;
  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const listings = () => harness.posted(MessageType.WORKSHOP_MEMORY_LISTING).map((entry) => entry.payload);
  const results = () => harness.posted(MessageType.WORKSHOP_MEMORY_MANAGER_RESULT).map((entry) => entry.payload);
  const receipts = () => harness.session.readRoomLedger().filter((turn) => turn.projectMemoryReceipt);
  const snapshots = () => harness.posted(MessageType.WORKSHOP_SESSION_STATE).length;
  const list = async (query = '') => {
    await route(MessageType.WORKSHOP_MEMORY_LIST, { requestId: `list-${listings().length}`, query });
    return listings()[listings().length - 1];
  };

  beforeEach(async () => {
    harness = createWorkshopRouteTestHarness();
    await harness.pin();
  });

  it('lists the folder, echoing the request id, with the estimate and residency', async () => {
    harness.memory.put(writerMemory({ id: 'mem-0000a1', pinned: true }));
    harness.memory.put(writerMemory({ id: 'mem-0000a2', title: 'Tea is at six' }));
    const listing = await list();
    expect(listing).toMatchObject({
      requestId: 'list-0',
      workspace: { kind: 'available' },
      saved: 2,
      estimate: { memories: 2, pinned: 1, pinnedLoaded: 1, catalogEntries: 1 }
    });
    expect(listing.memories.map((entry: { id: string; residency: string }) => [entry.id, entry.residency]).sort()).toEqual([
      ['mem-0000a1', 'full'], ['mem-0000a2', 'listed']
    ]);
    expect(JSON.stringify(listing)).not.toContain(MEMORY);
  });

  it('a listing request without its id or query is an error, not an answer', async () => {
    await route(MessageType.WORKSHOP_MEMORY_LIST, { query: '' });
    await route(MessageType.WORKSHOP_MEMORY_LIST, { requestId: 'r', query: 7 });
    expect(listings()).toEqual([]);
  });

  it('Always load in full: on, off, refused past the budget with its numbers; no receipt and no snapshot', async () => {
    harness.memory.put(writerMemory({ id: 'mem-000101', pinned: true, created: '2026-10-01T00:00:00Z', body: projectMemoryBody(BIG) }));
    harness.memory.put(writerMemory({ id: 'mem-000102', pinned: true, created: '2026-10-02T00:00:00Z', body: projectMemoryBody(BIG) }));
    harness.memory.put(writerMemory({ id: 'mem-000103', body: projectMemoryBody(BIG) }));
    const before = snapshots();

    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'a1', action: 'set-load-in-full', memoryId: 'mem-000103', loadInFull: true });
    expect(results()[0]).toMatchObject({
      requestId: 'a1',
      ok: false,
      error: 'Can’t load this one in full: memories loaded in full would pass their budget.',
      budget: { refused: true, budgetTokens: 5_000 }
    });
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'a2', action: 'set-load-in-full', memoryId: 'mem-000102', loadInFull: false });
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'a3', action: 'set-load-in-full', memoryId: 'mem-000103', loadInFull: true });
    expect(results().slice(1)).toEqual([{ requestId: 'a2', ok: true }, { requestId: 'a3', ok: true }]);
    const read = await harness.memory.store.read('mem-000103');
    expect(read.kind === 'memory' && read.entry.memory.pinned).toBe(true);

    expect(receipts()).toEqual([]);
    expect(snapshots()).toBe(before);
  });

  it('Always load in full of a memory that isn\'t there, or a malformed id, is refused', async () => {
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'm1', action: 'set-load-in-full', memoryId: 'mem-ffffff', loadInFull: true });
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'm2', action: 'set-load-in-full', memoryId: '../x', loadInFull: true });
    expect(results()).toEqual([
      { requestId: 'm1', ok: false, error: 'That memory is no longer in the folder.' },
      { requestId: 'm2', ok: false, error: 'That memory is no longer in the folder.' }
    ]);
  });

  it('Delete removes the file and revives what it superseded; deleting it again says it\'s gone', async () => {
    harness.memory.put(writerMemory({ id: 'mem-000201', title: 'Old tea time' }));
    const newer = harness.memory.put(writerMemory({ id: 'mem-000202', title: 'Tea is at six', supersedes: ['mem-000201'] }));
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'd1', action: 'delete', memoryId: 'mem-000202' });
    expect(results()[0]).toEqual({ requestId: 'd1', ok: true });
    expect(harness.memory.fileSystem.files.has(newer)).toBe(false);
    expect((await list()).memories).toEqual([expect.objectContaining({ id: 'mem-000201', superseded: false })]);
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'd2', action: 'delete', memoryId: 'mem-000202' });
    expect(results()[1]).toEqual({ requestId: 'd2', ok: false, error: 'That memory is no longer in the folder.' });
    expect(receipts()).toEqual([]);
  });

  it.each([
    ['changed', 'That memory’s file changed before it could be deleted, so nothing was deleted.'],
    ['busy', 'Another VS Code window is changing that memory. Try again when it’s done.']
  ] as const)('Delete says %s as it is', async (kind, words) => {
    harness.memory.put(writerMemory({ id: 'mem-000301' }));
    jest.spyOn(harness.memory.store, 'delete').mockResolvedValueOnce({ kind });
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'd', action: 'delete', memoryId: 'mem-000301' });
    expect(results()).toEqual([{ requestId: 'd', ok: false, error: words }]);
    expect([...harness.memory.fileSystem.files.keys()].some((file) => file.endsWith('0301-note.md'))).toBe(true);
  });

  it('Open file opens the listed row\'s own file, and refuses a stale or forged key without opening anything', async () => {
    const file = harness.memory.put(writerMemory({ id: 'mem-000401' }));
    const [entry] = (await list()).memories;
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'o1', action: 'open-file', entryKey: entry.entryKey });
    expect(harness.shell.openFileInEditor).toHaveBeenCalledWith(file);

    (harness.shell.openFileInEditor as jest.Mock).mockClear();
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'o2', action: 'open-file', entryKey: 'f'.repeat(32) });
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'o3', action: 'open-file', entryKey: path.join(MEMORY, '0401-note.md') });
    harness.memory.fileSystem.files.delete(file);
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'o4', action: 'open-file', entryKey: entry.entryKey });
    expect(harness.shell.openFileInEditor).not.toHaveBeenCalled();
    expect(results().slice(1).map((result) => [result.requestId, result.ok])).toEqual([['o2', false], ['o3', false], ['o4', false]]);
    expect(results()[0]).toEqual({ requestId: 'o1', ok: true });
  });

  it('Open memory folder makes it and reveals it; with no folder open it is refused', async () => {
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'f1', action: 'open-folder' });
    expect(harness.shell.revealFileInOS).toHaveBeenCalledWith(MEMORY);
    expect(results()[0]).toEqual({ requestId: 'f1', ok: true });

    harness.memory.state.folders = [];
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'f2', action: 'open-folder' });
    expect(results()[1]).toEqual({ requestId: 'f2', ok: false, error: 'Project memory isn’t available here.' });
  });

  it('works with memory off: the writer keeps access (D8)', async () => {
    harness.memory.state.mode = 'off';
    harness.memory.put(writerMemory({ id: 'mem-000501' }));
    expect((await list()).memories).toHaveLength(1);
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'x', action: 'delete', memoryId: 'mem-000501' });
    expect(results()[0]).toEqual({ requestId: 'x', ok: true });
  });

  it('an unavailable workspace lists its reason and refuses writes in the writer\'s words', async () => {
    harness.memory.state.folders = [{ path: '/a', name: 'a' }, { path: '/b', name: 'b' }];
    expect((await list()).workspace).toEqual({ kind: 'unavailable', reason: 'multi-root' });
    await route(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION, { requestId: 'u', action: 'set-load-in-full', memoryId: 'mem-000601', loadInFull: true });
    expect(results()[0]).toMatchObject({ ok: false, error: expect.stringContaining('several folders') });
  });
});
