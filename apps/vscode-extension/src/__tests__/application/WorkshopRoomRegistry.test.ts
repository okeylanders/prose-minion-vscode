/** The registry coordinates asynchronous panel lifetimes independently of VS Code. */
import type { CoreServices, WorkshopRoomCloseDestination } from '@prose-minion/core';
import { WorkshopRoomRegistry } from '../../application/WorkshopRoomRegistry';

jest.mock('@prose-minion/core', () => ({
  ...jest.requireActual('@/application/services/workshop/WorkshopRoomSlot'),
  workshopLightboxTray: jest.requireActual('@/application/services/workshop/WorkshopLightboxTray').workshopLightboxTray
}));

function held() {
  let release!: () => void;
  let refuse!: (error: Error) => void;
  const promise = new Promise<void>((resolve, reject) => { release = resolve; refuse = reject; });
  return { promise, release, refuse };
}

function room(id: string, unavailable?: 'no-workspace' | 'multi-root') {
  const initialize = jest.fn(async () => {});
  const flushForClose = jest.fn(async (): Promise<WorkshopRoomCloseDestination | void> => {});
  const releaseNamedOwnership = jest.fn();
  const invalidatePendingRoomReads = jest.fn();
  const discardConversation = jest.fn();
  const memoryDrain = jest.fn(async () => {});
  const unsubscribe = jest.fn();
  const syncWriterProfile = jest.fn(async () => {});
  const unsavedRoomStatus = jest.fn(async (): Promise<'unsaved' | 'empty' | 'saved'> => 'unsaved');
  const unsavedRoomPreview = jest.fn(() => 'The rabbit glanced at his watch.');
  const services = {
    workshopConversationSettingsService: { syncWriterProfile },
    workshopSessionPersistenceCoordinator: {
      initialize, flushForClose, releaseNamedOwnership, unsavedRoomStatus, unsavedRoomPreview,
      availability: () => unavailable ? { available: false, reason: unavailable } : { available: true, rootPath: '/Book' },
      openRoomIdentity: () => ({ title: id })
    },
    workshopSessionService: {
      invalidatePendingRoomReads,
      clearAllConversations: () => [id],
      collectMessageAttachments: () => [{ lightboxTile: { boardId: 'board', tileId: id }, label: id }],
      addPendingMessageAttachmentsListener: () => unsubscribe
    },
    assistantToolService: { discardConversation },
    projectMemory: { shutDown: memoryDrain }
  } as unknown as CoreServices;
  return { services, unsavedRoomStatus, syncWriterProfile, initialize, flushForClose, releaseNamedOwnership, invalidatePendingRoomReads, discardConversation, memoryDrain, unsubscribe };
}

function checkpointStore() {
  return {
    listRoomCheckpoints: jest.fn(async (): Promise<Array<{ roomId: string; title: string; updatedAt: string; recoveryToken?: string }>> => []),
    recoverRollingRoom: jest.fn(async () => 'new-copy'),
    availability: jest.fn(() => ({ available: true as const, rootPath: '/Book', sessionsDirectory: '/Book/sessions', currentPath: '/Book/current.json' })),
    listUnsavedRooms: jest.fn(async (): Promise<Array<{ roomId: string; title: string; updatedAt: string; preview: string; revision: string; recoveryToken?: string }>> => []),
    roomCheckpointStatus: jest.fn(async (): Promise<{status: 'empty' | 'saved' | 'unsaved'; revision: string} | undefined> => undefined),
    deleteUnsavedRoom: jest.fn(async (_id: string, _revision: string, _stillClosed: () => boolean, _expectedStatus?: 'empty' | 'saved') => {})

  };
}

const presence = {
  enter: jest.fn(() => ({ dispose() {} })),
  beginDelete: jest.fn(() => ({ dispose() {} })),
  isOpen: jest.fn(() => false)
};
const log = { appendLine: jest.fn() };
const registry = (build: (id: string) => CoreServices, store: ReturnType<typeof checkpointStore>) =>
  new WorkshopRoomRegistry(build, store, presence, log);

describe('Workshop room registry', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it('quiesces immediately on close, waits for hydration, and reuses its graph if reopened during the flush', async () => {
    const first = room('A');
    const hydration = held();
    const writing = held();
    const started = held();
    first.initialize.mockReturnValue(hydration.promise);
    first.flushForClose.mockImplementationOnce(() => { started.release(); return writing.promise; });
    const build = jest.fn(() => first.services);
    const rooms = registry(build, checkpointStore());
    const original = rooms.acquire('A');
    const closing = rooms.release('A');
    expect(first.invalidatePendingRoomReads).toHaveBeenCalledTimes(1);
    expect(first.flushForClose).not.toHaveBeenCalled();
    hydration.release();
    await started.promise;
    const reopened = rooms.acquire('A');
    expect(reopened.services).toBe(original.services);
    expect(first.releaseNamedOwnership).not.toHaveBeenCalled();
    writing.release();
    await Promise.all([closing, reopened.ready]);
    expect(first.discardConversation).not.toHaveBeenCalled();
    expect(build).toHaveBeenCalledTimes(1);
    await rooms.release('A');
    expect(first.discardConversation).toHaveBeenCalledWith('A');
    expect(first.releaseNamedOwnership).toHaveBeenCalledTimes(1);
  });

  it('waits for the current writer profile on first open and before resuming a retained closed room', async () => {
    const a = room('A', 'no-workspace');
    const rooms = registry(() => a.services, checkpointStore());
    await rooms.acquire('A').ready;
    expect(a.syncWriterProfile).toHaveBeenCalledTimes(1);
    await rooms.release('A');

    const replacing = held();
    const started = held();
    a.syncWriterProfile.mockImplementationOnce(() => { started.release(); return replacing.promise; });
    const resumed = jest.fn();
    const reopened = rooms.acquire('A').ready.then(resumed);
    await started.promise;
    expect(resumed).not.toHaveBeenCalled();
    replacing.release();
    await reopened;
    expect(resumed).toHaveBeenCalledTimes(1);
    expect(a.initialize).toHaveBeenCalledTimes(1);
  });

  it('drains every room even when one fails, and makes the failed first write recoverable', async () => {
    const a = room('A');
    const b = room('B');
    a.flushForClose.mockRejectedValueOnce(new Error('disk unavailable'));
    const writing = held();
    b.flushForClose.mockReturnValue(writing.promise);
    const rooms = registry(id => id === 'A' ? a.services : b.services, checkpointStore());
    await Promise.all([rooms.acquire('A').ready, rooms.acquire('B').ready]);
    const completed = jest.fn();
    const shutdown = rooms.flush().catch(completed);
    await Promise.resolve();
    expect(completed).not.toHaveBeenCalled();
    writing.release();
    await shutdown;
    expect(completed).toHaveBeenCalledWith(new Error('disk unavailable'));
    expect(b.releaseNamedOwnership).toHaveBeenCalledTimes(1);
    expect(a.releaseNamedOwnership).not.toHaveBeenCalled();
    expect(a.memoryDrain).toHaveBeenCalledTimes(1);
    expect(await rooms.listRoomCheckpoints()).toEqual([{ roomId: 'A', title: 'A', updatedAt: expect.any(String) }]);
    expect(rooms.acquire('A').services).toBe(a.services);
    await rooms.release('A');
    expect(a.releaseNamedOwnership).toHaveBeenCalledTimes(1);
  });

  it('returns the verified alternate named session after releasing the disputed slot, and suppresses the offer during shutdown', async () => {
    const a = room('A');
    const destination = { kind: 'preserved-session', sessionId: 'local-copy-id', title: 'Local copy' } as const;
    a.flushForClose.mockResolvedValue(destination);
    const rooms = registry(() => a.services, checkpointStore());
    await rooms.acquire('A').ready;
    await expect(rooms.release('A')).resolves.toEqual(destination);
    expect(a.releaseNamedOwnership).toHaveBeenCalledTimes(1);
    expect(await rooms.listRoomCheckpoints()).toEqual([]);

    await rooms.acquire('A').ready;
    const closing = rooms.release('A');
    await rooms.flush();
    await expect(closing).resolves.toBeUndefined();
    expect(a.releaseNamedOwnership).toHaveBeenCalledTimes(2);
  });

  it('preserves the stale-claim token for disk recovery and prefers a retained room with newer work', async () => {
    const a = room('newer local manuscript');
    const store = checkpointStore();
    const stale = { roomId: 'A', title: 'older disk copy', updatedAt: 'yesterday', recoveryToken: 'observed-claim' };
    store.listRoomCheckpoints.mockResolvedValue([stale]);
    const rooms = registry(() => a.services, store);
    expect(await rooms.listRoomCheckpoints()).toEqual([stale]);
    await expect(rooms.recoverRollingRoom('A', 'observed-claim')).resolves.toBe('new-copy');
    expect(store.recoverRollingRoom).toHaveBeenCalledWith('A', 'observed-claim');

    await rooms.acquire('A').ready;
    a.flushForClose.mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(rooms.release('A')).rejects.toThrow('disk unavailable');
    expect(await rooms.listRoomCheckpoints()).toEqual([{ roomId: 'A', title: 'newer local manuscript', updatedAt: expect.any(String) }]);
    await expect(rooms.recoverRollingRoom('A', 'observed-claim')).resolves.toBe('A');
    expect(store.recoverRollingRoom).toHaveBeenCalledTimes(1);
  });

  it('can retry a failed hydration and keeps a later room out of the failed release', async () => {
    const first = room('A1');
    const second = room('A2');
    const hydration = held();
    first.initialize.mockReturnValue(hydration.promise);
    const build = jest.fn().mockReturnValueOnce(first.services).mockReturnValueOnce(second.services);
    const rooms = registry(build, checkpointStore());
    const failed = rooms.acquire('A');
    const closing = rooms.release('A');
    hydration.refuse(new Error('restore failed'));
    await expect(failed.ready).rejects.toThrow('restore failed');
    const reopened = rooms.acquire('A');
    await expect(closing).rejects.toThrow('restore failed');
    await reopened.ready;
    expect(first.releaseNamedOwnership).toHaveBeenCalledTimes(1);
    expect(second.releaseNamedOwnership).not.toHaveBeenCalled();
    expect(reopened.services).toBe(second.services);
  });

  it.each(['no-workspace', 'multi-root'] as const)('keeps a closed %s room in memory until host shutdown', async reason => {
    const a = room('Chapter', reason);
    const b = room('Series bible', reason);
    const build = jest.fn((id: string) => id === 'A' ? a.services : b.services);
    const rooms = registry(build, checkpointStore());
    await Promise.all([rooms.acquire('A').ready, rooms.acquire('B').ready]);
    await Promise.all([rooms.release('A'), rooms.release('B')]);
    expect(a.discardConversation).not.toHaveBeenCalled();
    expect(b.discardConversation).not.toHaveBeenCalled();
    const choices = await rooms.listRoomCheckpoints();
    expect(choices).toHaveLength(2);
    expect(choices).toEqual(expect.arrayContaining([
      { roomId: 'A', title: 'Chapter', updatedAt: expect.any(String) },
      { roomId: 'B', title: 'Series bible', updatedAt: expect.any(String) }
    ]));
    expect(rooms.acquire('B').services).toBe(b.services);
    expect(rooms.acquire('A').services).toBe(a.services);
    expect(build).toHaveBeenCalledTimes(2);
    await rooms.flush();
    expect(a.discardConversation).toHaveBeenCalledWith('Chapter');
    expect(b.discardConversation).toHaveBeenCalledWith('Series bible');
    expect(await rooms.listRoomCheckpoints()).toEqual([]);
  });

  describe('Unsaved Sessions', () => {
    const id = '2b990e12-cd10-437c-b7f9-1acc761ef290';
    const disk = { roomId: id, title: 'The door', updatedAt: '2026-11-26', preview: 'A sharp knock.', revision: 'exact-checkpoint' };

    it.each(['empty', 'saved'] as const)('prunes only a verified %s secondary on normal close', async status => {
      const a = room('The door');
      const store = checkpointStore();
      a.unsavedRoomStatus.mockResolvedValue(status);
      store.roomCheckpointStatus.mockResolvedValue({ status, revision: disk.revision });
      const rooms = registry(() => a.services, store);
      await rooms.acquire(id).ready;
      await rooms.release(id);
      expect(store.deleteUnsavedRoom).toHaveBeenCalledWith(id, disk.revision, expect.any(Function), status);
      await rooms.acquire('legacy').ready;
      await rooms.release('legacy');
      expect(store.deleteUnsavedRoom).toHaveBeenCalledTimes(1);
      await rooms.acquire(id).ready;
      await rooms.flush();
      expect(store.deleteUnsavedRoom).toHaveBeenCalledTimes(1);
    });

    it('drops an empty memory-only secondary and deletes a meaningful one without touching a project file', async () => {
      const a = room('The door', 'no-workspace');
      const store = checkpointStore();
      const rooms = registry(() => a.services, store);
      a.unsavedRoomStatus.mockResolvedValueOnce('empty');
      await rooms.acquire(id).ready;
      await rooms.release(id);
      expect(await rooms.listUnsavedRooms()).toEqual([]);
      await rooms.acquire(id).ready;
      await rooms.release(id);
      const [row] = await rooms.listUnsavedRooms();
      expect(row).toMatchObject({roomId: id, title: 'The door', preview: 'The rabbit glanced at his watch.', canDelete: true});
      await rooms.deleteUnsavedRoom(id, row.observation);
      expect(await rooms.listUnsavedRooms()).toEqual([]);
      expect(store.deleteUnsavedRoom).not.toHaveBeenCalled();
      await expect(rooms.openUnsavedRoom(id, row.observation)).rejects.toThrow();
    });

    it('rechecks closed/open state at deletion and rejects a prior observation after a room opens and closes again', async () => {
      const a = room('The door');
      const store = checkpointStore();
      store.listUnsavedRooms.mockResolvedValue([disk]);
      const rooms = registry(() => a.services, store);
      const [row] = await rooms.listUnsavedRooms();
      const gate = held();
      store.deleteUnsavedRoom.mockImplementation(async (_id, _revision, closed) => {
        await gate.promise;
        if (!closed()) { throw new Error('Room reopened'); }
      });
      const deleting = rooms.deleteUnsavedRoom(id, row.observation);
      await rooms.acquire(id).ready;
      expect(await rooms.listUnsavedRooms()).toEqual([]);
      gate.release();
      await expect(deleting).rejects.toThrow();
      await rooms.release(id);
      await expect(rooms.openUnsavedRoom(id, row.observation)).rejects.toThrow();
      const [fresh] = await rooms.listUnsavedRooms();
      expect(fresh.observation).not.toBe(row.observation);
      store.listUnsavedRooms.mockResolvedValue([{ ...disk, revision: 'newer-bytes' }]);
      await expect(rooms.openUnsavedRoom(id, fresh.observation)).rejects.toThrow();
      await expect(rooms.deleteUnsavedRoom('legacy', fresh.observation)).rejects.toThrow();
    });

    it('orders by a room’s recent close without creating or rewriting a checkpoint', async () => {
      const other = '86277e56-f92e-48ef-9ab7-8778933b3848';
      const a = room('The door');
      const store = checkpointStore();
      store.listUnsavedRooms.mockResolvedValue([
        { ...disk, updatedAt: '2000-01-01T12:00:00Z' },
        { ...disk, roomId: other, updatedAt: '2010-01-01T12:00:00Z' }
      ]);
      const rooms = registry(() => a.services, store);
      expect((await rooms.listUnsavedRooms()).map(row => row.roomId)).toEqual([other, id]);
      await rooms.acquire(id).ready;
      await rooms.release(id);
      const [latest] = await rooms.listUnsavedRooms();
      expect(latest.roomId).toBe(id);
      expect(latest.updatedAt > '2010-01-01').toBe(true);
      expect(store.deleteUnsavedRoom).not.toHaveBeenCalled();
    });

    it('preserves a verified redundant file while an unresolved native editor or another host may own it', async () => {
      const a = room('The door');
      const store = checkpointStore();
      a.unsavedRoomStatus.mockResolvedValue('saved');
      store.roomCheckpointStatus.mockResolvedValue({ status: 'saved', revision: disk.revision });
      const rooms = registry(() => a.services, store);
      await rooms.acquire(id).ready;
      await rooms.release(id, () => false);
      expect(store.deleteUnsavedRoom).not.toHaveBeenCalled();
      store.listUnsavedRooms.mockResolvedValue([disk]);
      presence.isOpen.mockReturnValueOnce(true);
      expect(await rooms.listUnsavedRooms()).toEqual([]);
    });

    it('holds failed-close memory ahead of an older checkpoint and refuses to erase it', async () => {
      const a = room('Local work');
      const store = checkpointStore();
      store.listUnsavedRooms.mockResolvedValue([disk]);
      const rooms = registry(() => a.services, store);
      await rooms.acquire(id).ready;
      a.flushForClose.mockRejectedValueOnce(new Error('disk full'));
      await expect(rooms.release(id)).rejects.toThrow('disk full');
      const [row] = await rooms.listUnsavedRooms();
      expect(row).toMatchObject({ title: 'Local work', canDelete: false });
      await expect(rooms.deleteUnsavedRoom(id, row.observation)).rejects.toThrow();
      expect(await rooms.openUnsavedRoom(id, row.observation)).toBe(id);
      expect(store.deleteUnsavedRoom).not.toHaveBeenCalled();
    });

    it('offers stale-claim recovery without deletion authority and leaves unreadable checkpoints in the recovery picker', async () => {
      const store = checkpointStore();
      store.listUnsavedRooms.mockResolvedValue([{ ...disk, recoveryToken: 'stale-claim' }]);
      const rooms = registry(() => room('A').services, store);
      const [recovery] = await rooms.listUnsavedRooms();
      expect(recovery.canDelete).toBe(false);
      await expect(rooms.deleteUnsavedRoom(id, recovery.observation)).rejects.toThrow();
      expect(await rooms.openUnsavedRoom(id, recovery.observation)).toBe('new-copy');
      store.listUnsavedRooms.mockResolvedValue([{ ...disk, revision: '' }]);
      expect(await rooms.listUnsavedRooms()).toEqual([]);
      await expect(rooms.openUnsavedRoom(id, recovery.observation)).rejects.toThrow();
    });
  });

  it('switches Lightbox tray subscriptions on focus and empties the tray after the final close', async () => {
    const a = room('A');
    const b = room('B');
    const rooms = registry(id => id === 'A' ? a.services : b.services, checkpointStore());
    await Promise.all([rooms.acquire('A').ready, rooms.acquire('B').ready]);
    const changes = jest.fn();
    rooms.tray.subscribe(changes);
    rooms.focus('A');
    expect(rooms.tray.read()[0].label).toBe('A');
    rooms.focus('B');
    expect(a.unsubscribe).toHaveBeenCalledTimes(1);
    expect(rooms.tray.read()[0].label).toBe('B');
    await rooms.release('B');
    expect(b.unsubscribe).toHaveBeenCalledTimes(1);
    expect(rooms.tray.read()).toEqual([]);
    expect(changes).toHaveBeenCalled();
  });
});
