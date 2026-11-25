/** The same named checkpoint has one live writer in this window (ADR 2026-11-25 D4). */
export class WorkshopSessionOwnedError extends Error {
  constructor(readonly roomId: string) {
    super('This saved session is open in another Workshop tab.');
    this.name = 'WorkshopSessionOwnedError';
  }
}

export class WorkshopNamedSessionOwners {
  private readonly rooms = new Map<string, { workspace: string; sessionId: string }>();
  private pending: Promise<void> = Promise.resolve();

  /** Serialize ownership changes and external writes through their disk commit or rollback. */
  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.pending.then(work);
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }

  owner(workspace: string, sessionId: string): string | undefined {
    for (const [roomId, owned] of this.rooms) {
      if (owned.workspace === workspace && owned.sessionId === sessionId) {
        return roomId;
      }
    }
    return undefined;
  }

  update(roomId: string, workspace: string | undefined, sessionId: string | undefined): void {
    if (workspace && sessionId) {
      this.rooms.set(roomId, { workspace, sessionId });
    } else {
      this.rooms.delete(roomId);
    }
  }
}
