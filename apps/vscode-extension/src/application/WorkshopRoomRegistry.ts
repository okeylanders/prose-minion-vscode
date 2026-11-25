import {
  CoreServices,
  type WorkshopLightboxTray,
  type WorkshopRoomCloseDestination,
  type WorkshopSessionStore,
  workshopLightboxTray
} from '@prose-minion/core';

interface RoomEntry {
  readonly services: CoreServices;
  readonly hydrated: Promise<void>;
  ready: Promise<void>;
  attached: boolean;
  readonly ephemeral: boolean;
  closing?: Promise<WorkshopRoomCloseDestination | void>;
  closedAt?: string;
}

type RoomCheckpointStore = Pick<WorkshopSessionStore, 'listRoomCheckpoints' | 'recoverRollingRoom'>;
type RoomCheckpoint = Awaited<ReturnType<RoomCheckpointStore['listRoomCheckpoints']>>[number];

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
    private readonly store: RoomCheckpointStore
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
      stored = await this.store.listRoomCheckpoints();
    } catch (error) {
      // A file-system outage must not hide the only route back to unsaved, retained work.
      if (recovering.size === 0) {throw error;}
      stored = [];
    }
    const checkpoints = new Map(stored.map(entry => [entry.roomId, entry]));
    recovering.forEach((entry, id) => checkpoints.set(id, entry));
    return [...checkpoints.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  recoverRollingRoom(roomId: string, recoveryToken: string): Promise<string> {
    // A newer in-memory room that appeared while the picker was open takes precedence over its file.
    return this.rooms.has(roomId) ? Promise.resolve(roomId) : this.store.recoverRollingRoom(roomId, recoveryToken);
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
      const hydrated = sessions.initialize().then(() => undefined, error => {
        // A failed hydration never saw a panel route. A fresh acquire may retry from disk.
        sessions.releaseNamedOwnership();
        this.rooms.delete(roomId);
        throw error;
      });
      room = { services, hydrated, ready: hydrated, attached: false, ephemeral };
      this.rooms.set(roomId, room);
    }
    if (!room.attached) {
      const attaching = room;
      const start = room.closing?.then(() => undefined, () => attaching.hydrated) ?? room.hydrated;
      room.ready = start.then(() => {
        if (attaching.attached) {
          return attaching.services.workshopConversationSettingsService.syncWriterProfile();
        }
      });
    }
    room.attached = true;
    return { services: room.services, ready: room.ready };
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

  release(roomId: string): Promise<WorkshopRoomCloseDestination | void> {
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

  private async finishClose(roomId: string, room: RoomEntry): Promise<WorkshopRoomCloseDestination | void> {
    // Capture this attachment before a reopen can queue behind our close. An unavailable
    // prompt engine blocks model delivery, but cannot take away the room's checkpoint.
    const attachment = room.ready;
    await room.hydrated;
    await attachment.catch(() => undefined);
    const { workshopSessionPersistenceCoordinator: sessions, projectMemory, workshopSessionService, assistantToolService } = room.services;
    // Await both owners even on failure; keep the full room and its named claim for retry.
    const [checkpoint, memories] = await Promise.allSettled([sessions.flushForClose(), projectMemory.shutDown()]);
    if (checkpoint.status === 'rejected') {
      throw checkpoint.reason;
    }
    if (memories.status === 'rejected') {
      throw memories.reason;
    }
    // A closing tab may have preserved the latest manuscript under a different named identity.
    // Only an interactive close can invite the writer to open the verified destination.
    const destination = this.shuttingDown ? undefined : checkpoint.value;
    // A panel reopened the slot during its final write. The same objects resume after this promise.
    if (room.attached) {
      return destination;
    }
    // No writer-selected project exists for a folderless or multi-root room. Only host shutdown
    // releases its retained conversations; closing the tab can always reopen this memory-only slot.
    if (room.ephemeral && !this.shuttingDown) {return;}
    sessions.releaseNamedOwnership();
    for (const id of workshopSessionService.clearAllConversations()) {
      assistantToolService.discardConversation(id);
    }
    if (this.focusedRoom === roomId) {this.focus(undefined);}
    this.rooms.delete(roomId);
    return destination;
  }

  async flush(): Promise<void> {
    this.shuttingDown = true;
    const settled = await Promise.allSettled(Array.from(this.rooms.keys(), id => this.release(id)));
    for (const result of settled) {
      if (result.status === 'rejected') {throw result.reason;}
    }
  }
}
