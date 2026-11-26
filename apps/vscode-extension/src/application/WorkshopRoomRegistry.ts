import { randomUUID } from 'node:crypto';
import { WorkshopRoomPresence, WorkshopRoomPresenceBusyError } from './WorkshopRoomPresence';
import {
  CoreServices,
  isWorkshopRoomId,
  PRIMARY_WORKSHOP_ROOM_ID,
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
  readonly workspaceRoot?: string;
  presence?: { dispose(): void };
  trimming?: boolean;
  closing?: Promise<WorkshopRoomCloseDestination | void>;
  closedAt?: string;
  closeFailed?: boolean;
  unsavedInMemory?: boolean;
}

type RoomCheckpointStore = Pick<WorkshopSessionStore,
  'availability' | 'listRoomCheckpoints' | 'recoverRollingRoom' | 'listUnsavedRooms' | 'roomCheckpointStatus' | 'deleteUnsavedRoom'
>;
type RoomCheckpoint = Awaited<ReturnType<RoomCheckpointStore['listRoomCheckpoints']>>[number];

/** Host-only observations. Native and webview clients act on the closed room they actually saw. */
export interface WorkshopUnsavedSessionEntry {
  roomId: string;
  title: string;
  updatedAt: string;
  preview: string;
  observation: string;
  recoveryToken?: string;
  canDelete: boolean;
}

interface ClosedRoomObservation {
  readonly row: WorkshopUnsavedSessionEntry;
  readonly workspaceKey: string;
  readonly memory?: RoomEntry;
  readonly diskRevision?: string;
  readonly workspaceRoot?: string;
}

const secondaryRoom = (id: string) => id !== PRIMARY_WORKSHOP_ROOM_ID && isWorkshopRoomId(id);
const workspaceKey = (location: ReturnType<RoomCheckpointStore['availability']>) =>
  location.available ? 'folder:' + location.rootPath : location.reason;
const staleRoom = () => new Error('This Workshop room changed or reopened. Refresh Unsaved Sessions.');

/** Window ownership of live rooms and of writes still owed by a closed panel. */
export class WorkshopRoomRegistry {
  private readonly recentlyClosed = new Map<string, { workspaceRoot: string; at: string }>();
  private readonly observations = new Map<string, ClosedRoomObservation>();
  private readonly rooms = new Map<string, RoomEntry>();
  private readonly trayListeners = new Set<() => void>();
  private trayUnsubscribe?: () => void;
  private focusedRoom?: string;
  private shuttingDown = false;
  private traySnapshot: ReturnType<WorkshopLightboxTray['read']> = [];

  constructor(
    private readonly build: (roomId: string) => CoreServices,
    private readonly store: RoomCheckpointStore,
    private readonly presence: Pick<WorkshopRoomPresence, 'enter' | 'beginDelete' | 'isOpen'>,
    private readonly log: { appendLine(message: string): void }
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

  /** Open panels and unhydrated native editors are excluded again by the host at delivery. */
  async listUnsavedRooms(): Promise<WorkshopUnsavedSessionEntry[]> {
    const location = this.store.availability();
    const root = location.available ? location.rootPath : undefined;
    const scope = workspaceKey(location);
    const memory: WorkshopUnsavedSessionEntry[] = [];
    for (const [roomId, room] of this.rooms) {
      if (!secondaryRoom(roomId) || room.attached || room.closing || !room.closedAt) { continue; }
      const sessions = room.services.workshopSessionPersistenceCoordinator;
      // A failed drain can leave the only surviving copy in memory. Do not erase or hide it
      // on the strength of an older file or an inconclusive inspection.
      if ((!room.unsavedInMemory && !room.closeFailed) || (room.workspaceRoot && room.workspaceRoot !== root)) { continue; }
      const { title, namedSessionId } = sessions.openRoomIdentity();
      const prior = this.observations.get(roomId);
      const row = {
        roomId, title, updatedAt: room.closedAt, preview: sessions.unsavedRoomPreview(),
        observation: prior?.memory === room && prior.workspaceKey === scope ? prior.row.observation : randomUUID(),
        canDelete: room.ephemeral && !room.closeFailed && !namedSessionId
      };
      this.observations.set(roomId, { row, memory: room, workspaceRoot: root, workspaceKey: scope });
      memory.push(row);
    }
    let stored: Awaited<ReturnType<RoomCheckpointStore['listUnsavedRooms']>>;
    try {
      stored = await this.store.listUnsavedRooms();
    } catch (error) {
      if (memory.length === 0) { throw error; }
      stored = [];
    }
    const afterRead = this.store.availability();
    if (scope !== workspaceKey(afterRead)) { throw staleRoom(); }
    const rows = memory.filter(row => this.isCurrentObservation(row.roomId, row.observation));
    for (const entry of stored) {
      if ((!entry.revision && !entry.recoveryToken) || !root || !secondaryRoom(entry.roomId)
        || this.rooms.has(entry.roomId) || this.presence.isOpen(root, entry.roomId)) { continue; }
      const prior = this.observations.get(entry.roomId);
      const observation = prior?.workspaceKey === scope && prior.diskRevision === entry.revision && prior.row.recoveryToken === entry.recoveryToken
        ? prior.row.observation : randomUUID();
      const recent = this.recentlyClosed.get(entry.roomId);
      const updatedAt = recent?.workspaceRoot === root && recent.at > entry.updatedAt ? recent.at : entry.updatedAt;
      const row = {
        roomId: entry.roomId, title: entry.title, updatedAt, preview: entry.preview,
        recoveryToken: entry.recoveryToken, observation, canDelete: !!entry.revision && !entry.recoveryToken
      };
      this.observations.set(entry.roomId, { row, diskRevision: entry.revision, workspaceRoot: root, workspaceKey: scope });
      rows.push(row);
    }
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.roomId.localeCompare(b.roomId));
  }

  async openUnsavedRoom(roomId: string, observation: string, stillClosed = () => true): Promise<string> {
    const seen = this.requireObservation(roomId, observation, stillClosed);
    if (seen.memory) { return roomId; }
    const stored = (await this.store.listUnsavedRooms()).find(entry => entry.roomId === roomId);
    this.requireObservation(roomId, observation, stillClosed);
    if (this.presence.isOpen(seen.workspaceRoot!, roomId) || !stored || stored.revision !== seen.diskRevision || stored.recoveryToken !== seen.row.recoveryToken) {
      throw staleRoom();
    }
    return stored.recoveryToken
      ? this.store.recoverRollingRoom(roomId, stored.recoveryToken, () =>
        this.isCurrentObservation(roomId, observation) && stillClosed() && !this.presence.isOpen(seen.workspaceRoot!, roomId))
      : roomId;
  }

  async deleteUnsavedRoom(roomId: string, observation: string, stillClosed = () => true): Promise<void> {
    const seen = this.requireObservation(roomId, observation, stillClosed);
    if (!seen.row.canDelete) { throw new Error('Reopen this room to recover its work before deleting it.'); }
    if (seen.memory) {
      // Memory-only rooms have no checkpoint. Never follow their former project's slot or named association.
      this.forgetRoom(roomId, seen.memory);
    } else if (seen.diskRevision) {
      const deletion = this.presence.beginDelete(seen.workspaceRoot!, roomId);
      try {
        await this.store.deleteUnsavedRoom(roomId, seen.diskRevision,
          () => this.isCurrentObservation(roomId, observation) && stillClosed());
        this.recentlyClosed.delete(roomId);
      } finally {
        deletion.dispose();
      }
    }
    if (this.observations.get(roomId) === seen) { this.observations.delete(roomId); }
  }

  private isCurrentObservation(roomId: string, observation: string): boolean {
    const seen = this.observations.get(roomId);
    const room = this.rooms.get(roomId);
    const current = this.store.availability();
    return seen?.workspaceKey === workspaceKey(current)
      && secondaryRoom(roomId) && !!seen && seen.row.observation === observation && seen.memory === room
      && !room?.attached && !room?.closing && !this.shuttingDown;
  }

  private requireObservation(roomId: string, observation: string, stillClosed: () => boolean): ClosedRoomObservation {
    if (!this.isCurrentObservation(roomId, observation) || !stillClosed()) { throw staleRoom(); }
    return this.observations.get(roomId)!;
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
    this.observations.delete(roomId);
    let room = this.rooms.get(roomId);
    if (!room) {
      const services = this.build(roomId);
      const sessions = services.workshopSessionPersistenceCoordinator;
      const location = sessions.availability();
      const ephemeral = !location.available;
      const workspaceRoot = location.available && secondaryRoom(roomId) ? location.rootPath : undefined;
      const presence = workspaceRoot ? this.presence.enter(workspaceRoot, roomId) : undefined;
      const hydrated = sessions.initialize().then(() => undefined, error => {
        // A failed hydration never saw a panel route. A fresh acquire may retry from disk.
        presence?.dispose();
        sessions.releaseNamedOwnership();
        this.rooms.delete(roomId);
        throw error;
      });
      room = { services, hydrated, ready: hydrated, attached: false, ephemeral, workspaceRoot, presence };
      this.rooms.set(roomId, room);
    }
    if (!room.attached) {
      const attaching = room;
      if (attaching.workspaceRoot && !attaching.presence && !attaching.trimming) {
        attaching.presence = this.presence.enter(attaching.workspaceRoot, roomId);
      }
      const start = room.closing?.then(() => undefined, () => attaching.hydrated) ?? room.hydrated;
      room.ready = start.then(() => {
        if (attaching.attached) {
          // A reopen during our guarded cleanup resumes behind that deletion's final check.
          if (attaching.workspaceRoot && !attaching.presence) {
            attaching.presence = this.presence.enter(attaching.workspaceRoot, roomId);
          }
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

  release(roomId: string, canTrim = () => true): Promise<WorkshopRoomCloseDestination | void> {
    const room = this.rooms.get(roomId);
    if (!room) {return Promise.resolve();}
    this.observations.delete(roomId);
    room.attached = false;
    room.closedAt = new Date().toISOString();
    room.services.workshopSessionService.invalidatePendingRoomReads();
    if (!room.closing) {
      room.closing = this.finishClose(roomId, room, canTrim).catch(error => {
        room.closeFailed = true;
        throw error;
      }).finally(() => { room.closing = undefined; });
    }
    return room.closing;
  }

  private async finishClose(roomId: string, room: RoomEntry, canTrim: () => boolean): Promise<WorkshopRoomCloseDestination | void> {
    // Capture this attachment before a reopen can queue behind our close. An unavailable
    // prompt engine blocks model delivery, but cannot take away the room's checkpoint.
    const attachment = room.ready;
    await room.hydrated;
    await attachment.catch(() => undefined);
    const { workshopSessionPersistenceCoordinator: sessions, projectMemory } = room.services;
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
    room.closeFailed = false;
    if (!this.shuttingDown && room.workspaceRoot && room.closedAt) {
      this.recentlyClosed.set(roomId, { workspaceRoot: room.workspaceRoot, at: room.closedAt });
    }
    if (!this.shuttingDown && !destination) {
      if (!secondaryRoom(roomId)) {
        if (room.ephemeral) { return; }
      } else {
        try {
          const status = await sessions.unsavedRoomStatus();
          if (room.attached) { return; }
          if (room.ephemeral) {
            room.unsavedInMemory = status === 'unsaved';
            if (room.unsavedInMemory || !canTrim()) { return; }
          } else if (status !== 'unsaved') {
            await this.trimCheckpoint(roomId, room, status, canTrim);
          }
        } catch (error) {
          this.log.appendLine(`[Workshop] Preserved a room with uncertain save status: ${String(error)}`);
          if (room.ephemeral) {
            room.closeFailed = true;
            return;
          }
        }
      }
    }
    if (!room.attached) { this.forgetRoom(roomId, room); }
    return destination;
  }

  private async trimCheckpoint(roomId: string, room: RoomEntry, status: 'empty' | 'saved', canTrim: () => boolean): Promise<void> {
    const root = room.workspaceRoot;
    const stillClosed = () => {
      const location = this.store.availability();
      return !!root && location.available && location.rootPath === root && !room.attached
        && !this.shuttingDown && this.rooms.get(roomId) === room && canTrim();
    };
    if (!root || !stillClosed()) { return; }
    try {
      const snapshot = await this.store.roomCheckpointStatus(roomId);
      if (!stillClosed() || snapshot?.status !== status) { return; }
      room.trimming = true;
      room.presence?.dispose();
      room.presence = undefined;
      const deletion = this.presence.beginDelete(root, roomId);
      try {
        await this.store.deleteUnsavedRoom(roomId, snapshot.revision, stillClosed, status);
        this.recentlyClosed.delete(roomId);
      } finally {
        deletion.dispose();
      }
    } catch (error) {
      // A sibling host, changed bytes, or inconclusive provenance preserves the checkpoint.
      if (!(error instanceof WorkshopRoomPresenceBusyError)) {
        this.log.appendLine(`[Workshop] Preserved a closed checkpoint after its cleanup check: ${String(error)}`);
      }
    } finally {
      room.trimming = false;
    }
  }

  private forgetRoom(roomId: string, room: RoomEntry): void {
    const { workshopSessionPersistenceCoordinator, workshopSessionService, assistantToolService } = room.services;
    room.presence?.dispose();
    workshopSessionPersistenceCoordinator.releaseNamedOwnership();
    for (const id of workshopSessionService.clearAllConversations()) {
      assistantToolService.discardConversation(id);
    }
    if (this.focusedRoom === roomId) { this.focus(undefined); }
    this.observations.delete(roomId);
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
