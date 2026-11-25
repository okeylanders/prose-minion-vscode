import {
  CoreServices,
  type WorkshopLightboxTray,
  workshopLightboxTray
} from '@prose-minion/core';

interface RoomEntry {
  readonly services: CoreServices;
  readonly ready: Promise<void>;
  attached: boolean;
  readonly ephemeral: boolean;
  closing?: Promise<void>;
  closedAt?: string;
}

interface RoomCheckpoint {
  roomId: string;
  title: string;
  updatedAt: string;
}

/** Window ownership of live rooms and of writes still owed by a closed panel. */
export class WorkshopRoomRegistry {
  private readonly rooms = new Map<string, RoomEntry>();
  private readonly trayListeners = new Set<() => void>();
  private trayUnsubscribe?: () => void;
  private focusedRoom?: string;
  private shuttingDown = false;
  private traySnapshot: ReturnType<WorkshopLightboxTray['read']> = [];

  constructor(
    private readonly build: (roomId: string) => CoreServices,
    private readonly readCheckpoints: () => Promise<RoomCheckpoint[]>
  ) {}

  async listRoomCheckpoints(): Promise<RoomCheckpoint[]> {
    const recovering = new Map<string, RoomCheckpoint>();
    for (const [roomId, room] of this.rooms) {
      if (!room.attached && room.closedAt) {
        // A failed first write, or a window without a workspace, can leave the only copy in memory.
        const { title } = room.services.workshopSessionPersistenceCoordinator.openRoomIdentity();
        recovering.set(roomId, { roomId, title, updatedAt: room.closedAt });
      }
    }
    let stored: RoomCheckpoint[];
    try {
      stored = await this.readCheckpoints();
    } catch (error) {
      // A file-system outage must not hide the only route back to unsaved, retained work.
      if (recovering.size === 0) {throw error;}
      stored = [];
    }
    const checkpoints = new Map(stored.map(entry => [entry.roomId, entry]));
    recovering.forEach((entry, id) => checkpoints.set(id, entry));
    return [...checkpoints.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  readonly tray: WorkshopLightboxTray = {
    read: () => this.traySnapshot,
    subscribe: listener => {
      this.trayListeners.add(listener);
      return () => { this.trayListeners.delete(listener); };
    }
  };

  acquire(roomId: string): { services: CoreServices; ready: Promise<void> } {
    let room = this.rooms.get(roomId);
    if (!room) {
      const services = this.build(roomId);
      const sessions = services.workshopSessionPersistenceCoordinator;
      const ephemeral = !sessions.availability().available;
      const ready = sessions.initialize().then(() => undefined, error => {
        // A failed hydration never saw a panel route. A fresh acquire may retry from disk.
        sessions.releaseNamedOwnership();
        this.rooms.delete(roomId);
        throw error;
      });
      room = { services, ready, attached: true, ephemeral };
      this.rooms.set(roomId, room);
    }
    room.attached = true;
    const ready = room.ready;
    return { services: room.services, ready: room.closing?.catch(() => ready) ?? ready };
  }

  /** Follow only the destination of external commands; never redirect an in-flight room operation. */
  focus(roomId: string | undefined): void {
    this.trayUnsubscribe?.();
    this.trayUnsubscribe = undefined;
    this.focusedRoom = roomId;
    const room = roomId && this.rooms.get(roomId);
    if (!room) {
      this.traySnapshot = [];
      this.trayListeners.forEach(listener => listener());
      return;
    }
    const tray = workshopLightboxTray(room.services.workshopSessionService);
    const refresh = () => {
      this.traySnapshot = tray.read();
      this.trayListeners.forEach(listener => listener());
    };
    this.trayUnsubscribe = tray.subscribe(refresh);
    refresh();
    // A newly attached room publishes its persisted tiles once hydration settles.
    void room.ready.then(() => { if (this.focusedRoom === roomId) {refresh();} }, () => {});
  }

  release(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {return Promise.resolve();}
    room.attached = false;
    room.closedAt = new Date().toISOString();
    room.services.workshopSessionService.invalidatePendingRoomReads();
    if (!room.closing) {
      room.closing = this.finishClose(roomId, room).finally(() => { room.closing = undefined; });
    }
    return room.closing;
  }

  private async finishClose(roomId: string, room: RoomEntry): Promise<void> {
    await room.ready;
    const { workshopSessionPersistenceCoordinator: sessions, projectMemory, workshopSessionService, assistantToolService } = room.services;
    // Await both owners even on failure; keep the full room and its named claim for retry.
    const settled = await Promise.allSettled([sessions.flushForClose(), projectMemory.shutDown()]);
    for (const result of settled) {
      if (result.status === 'rejected') {throw result.reason;}
    }
    // A panel reopened the slot during its final write. The same objects resume after this promise.
    if (room.attached) {return;}
    // No writer-selected project exists for a folderless or multi-root room. Only host shutdown
    // releases its retained conversations; closing the tab can always reopen this memory-only slot.
    if (room.ephemeral && !this.shuttingDown) {return;}
    sessions.releaseNamedOwnership();
    for (const id of workshopSessionService.clearAllConversations()) {
      assistantToolService.discardConversation(id);
    }
    if (this.focusedRoom === roomId) {this.focus(undefined);}
    this.rooms.delete(roomId);
  }

  async flush(): Promise<void> {
    this.shuttingDown = true;
    const settled = await Promise.allSettled(Array.from(this.rooms.keys(), id => this.release(id)));
    for (const result of settled) {
      if (result.status === 'rejected') {throw result.reason;}
    }
  }
}
