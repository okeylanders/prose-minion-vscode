/** The registry coordinates asynchronous panel lifetimes independently of VS Code. */
import type { CoreServices } from '@prose-minion/core';
import { WorkshopRoomRegistry } from '../../application/WorkshopRoomRegistry';

jest.mock('@prose-minion/core', () => ({
  workshopLightboxTray: jest.requireActual('@/application/services/workshop/WorkshopLightboxTray').workshopLightboxTray
}));

function held() {
  let release!: () => void;
  let refuse!: (error: Error) => void;
  const promise = new Promise<void>((resolve, reject) => { release = resolve; refuse = reject; });
  return { promise, release, refuse };
}

function room(id: string) {
  const initialize = jest.fn(async () => {});
  const flushForClose = jest.fn(async () => {});
  const releaseNamedOwnership = jest.fn();
  const invalidatePendingRoomReads = jest.fn();
  const discardConversation = jest.fn();
  const memoryDrain = jest.fn(async () => {});
  const unsubscribe = jest.fn();
  const services = {
    workshopSessionPersistenceCoordinator: {
      initialize, flushForClose, releaseNamedOwnership,
      availability: () => ({ available: true }),
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
  return { services, initialize, flushForClose, releaseNamedOwnership, invalidatePendingRoomReads, discardConversation, memoryDrain, unsubscribe };
}

describe('Workshop room registry', () => {
  it('quiesces immediately on close, waits for hydration, and reuses its graph if reopened during the flush', async () => {
    const first = room('A');
    const hydration = held();
    const writing = held();
    const started = held();
    first.initialize.mockReturnValue(hydration.promise);
    first.flushForClose.mockImplementationOnce(() => { started.release(); return writing.promise; });
    const build = jest.fn(() => first.services);
    const rooms = new WorkshopRoomRegistry(build, async () => []);
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

  it('drains every room even when one fails, and makes the failed first write recoverable', async () => {
    const a = room('A');
    const b = room('B');
    a.flushForClose.mockRejectedValueOnce(new Error('disk unavailable'));
    const writing = held();
    b.flushForClose.mockReturnValue(writing.promise);
    const rooms = new WorkshopRoomRegistry(id => id === 'A' ? a.services : b.services, async () => []);
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

  it('can retry a failed hydration and keeps a later room out of the failed release', async () => {
    const first = room('A1');
    const second = room('A2');
    const hydration = held();
    first.initialize.mockReturnValue(hydration.promise);
    const build = jest.fn().mockReturnValueOnce(first.services).mockReturnValueOnce(second.services);
    const rooms = new WorkshopRoomRegistry(build, async () => []);
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

  it('switches Lightbox tray subscriptions on focus and empties the tray after the final close', async () => {
    const a = room('A');
    const b = room('B');
    const rooms = new WorkshopRoomRegistry(id => id === 'A' ? a.services : b.services, async () => []);
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
