import { randomUUID } from 'crypto';
import {
  MessageType, PRIMARY_WORKSHOP_ROOM_ID, type UnsavedWorkshopSessionRow,
  type UnsavedWorkshopSessionsRequest, type UnsavedWorkshopSessionsResultPayload
} from '@prose-minion/core';
import { WorkshopRoomPresenceBusyError, WorkshopRoomPresenceUnavailableError } from '../WorkshopRoomPresence';

export interface WorkshopUnsavedRoomStore {
  listUnsavedRooms(): Promise<{
    roomId: string; observation: string; title: string; preview: string; updatedAt: string; canDelete: boolean;
  }[]>;
  openUnsavedRoom(roomId: string, observation: string, stillClosed: () => boolean): Promise<string>;
  deleteUnsavedRoom(roomId: string, observation: string, stillClosed: () => boolean): Promise<void>;
}

interface Ticket {
  token: string;
  roomId: string;
  observation: string;
  workspace: string;
  canDelete: boolean;
}

type Result = Omit<UnsavedWorkshopSessionsResultPayload, 'requestId'>;

const CHANGED = 'This session changed or reopened. Review the refreshed list and try again.';
const RESTORING = 'VS Code is restoring Workshop tabs. Visit those tabs, then refresh this list.';

/** Sidebar row tokens bind an operation to the workspace and closed checkpoint seen by the writer. */
export class WorkshopUnsavedSessions {
  private tickets = new Map<string, Ticket>();
  private queue = Promise.resolve();

  constructor(
    private readonly rooms: WorkshopUnsavedRoomStore,
    private readonly workspace: () => string,
    private readonly nativeRoomsKnown: () => boolean,
    private readonly isClosed: (roomId: string) => boolean,
    private readonly open: (roomId: string) => Promise<void>
  ) {}

  invalidate(roomId: string): void {
    for (const ticket of this.tickets.values()) {
      if (ticket.roomId === roomId) { this.tickets.delete(ticket.token); }
    }
  }

  handle(request: UnsavedWorkshopSessionsRequest): Promise<Result> {
    const workspace = this.workspace();
    const result = this.queue.then(() => this.run(request, workspace));
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async run(request: UnsavedWorkshopSessionsRequest, workspace: string): Promise<Result> {
    let error: string | undefined;
    if (request.type !== MessageType.LIST_UNSAVED_WORKSHOP_SESSIONS) {
      const ticket = this.tickets.get(request.payload.token);
      const stillClosed = () => !!ticket && this.tickets.get(ticket.token) === ticket
        && this.workspace() === ticket.workspace && this.nativeRoomsKnown() && this.isClosed(ticket.roomId);
      if (!ticket || ticket.workspace !== workspace || !stillClosed()) {
        error = CHANGED;
      } else {
        try {
          if (request.type === MessageType.OPEN_UNSAVED_WORKSHOP_SESSION) {
            const roomId = await this.rooms.openUnsavedRoom(ticket.roomId, ticket.observation, stillClosed);
            if (stillClosed() && this.isClosed(roomId)) { await this.open(roomId); }
            else { error = CHANGED; }
          } else if (request.type === MessageType.DELETE_UNSAVED_WORKSHOP_SESSION && ticket.canDelete) {
            await this.rooms.deleteUnsavedRoom(ticket.roomId, ticket.observation, stillClosed);
            this.invalidate(ticket.roomId);
          } else {
            error = 'This session cannot be deleted.';
          }
        } catch (cause) {
          if (cause instanceof WorkshopRoomPresenceBusyError || cause instanceof WorkshopRoomPresenceUnavailableError) {
            error = cause.message;
          } else {
            error = request.type === MessageType.DELETE_UNSAVED_WORKSHOP_SESSION
              ? 'The session could not be deleted. Review the refreshed list before trying again.'
              : 'The session could not be opened. Review the refreshed list before trying again.';
          }
        }
      }
    }
    return this.list(error);
  }

  private async list(error?: string): Promise<Result> {
    const workspace = this.workspace();
    try {
      if (this.nativeRoomsKnown()) {
        const stored = await this.rooms.listUnsavedRooms();
        if (this.workspace() === workspace && this.nativeRoomsKnown()) {
          const prior = new Map([...this.tickets.values()].map(ticket => [ticket.roomId, ticket]));
          const next = new Map<string, Ticket>();
          const rows: UnsavedWorkshopSessionRow[] = [];
          for (const { roomId, observation, title, preview, updatedAt, canDelete } of stored) {
            if (roomId === PRIMARY_WORKSHOP_ROOM_ID || !this.isClosed(roomId)) { continue; }
            const existing = prior.get(roomId);
            const ticket = existing?.workspace === workspace && existing.observation === observation && existing.canDelete === canDelete
              ? existing : { token: randomUUID(), roomId, observation, workspace, canDelete };
            next.set(ticket.token, ticket);
            rows.push({ token: ticket.token, title, preview, updatedAt, canDelete });
          }
          this.tickets = next;
          return { rows, ...(error ? { error } : {}) };
        }
      }
      const reason = this.workspace() === workspace ? RESTORING : CHANGED;
      error = error && error !== reason ? `${error} ${reason}` : reason;
    } catch (cause) {
      error = cause instanceof WorkshopRoomPresenceUnavailableError
        ? cause.message : error ?? 'Unsaved sessions could not be listed. Refresh to try again.';
    }
    this.tickets.clear();
    return { rows: [], error };
  }
}
