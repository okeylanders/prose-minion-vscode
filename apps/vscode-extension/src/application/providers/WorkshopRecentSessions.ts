import { randomUUID } from 'crypto';
import {
  MessageType, type RecentWorkshopSessionsRequest, type RecentWorkshopSessionsResultPayload,
  type WorkshopSessionStore
} from '@prose-minion/core';

type Result = Omit<RecentWorkshopSessionsResultPayload, 'requestId'>;

/** Named-session tickets are valid only in the workspace that supplied the row. */
export class WorkshopRecentSessions {
  private scope?: string;
  private tickets = new Map<string, string>();
  private queue = Promise.resolve();

  constructor(
    private readonly store: Pick<WorkshopSessionStore, 'availability' | 'listRecentNamed'>,
    private readonly open: (sessionId: string, currentWorkspace: () => boolean) => Promise<string | undefined>
  ) {}

  private root(): string | undefined {
    const location = this.store.availability();
    return location.available ? location.rootPath : undefined;
  }

  handle(request: RecentWorkshopSessionsRequest): Promise<Result> {
    const root = this.root();
    const result = this.queue.then(() => this.run(request, root));
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async run(request: RecentWorkshopSessionsRequest, root: string | undefined): Promise<Result> {
    let error: string | undefined;
    const changed = 'The saved session list changed. Refresh it and choose the session again.';
    const currentWorkspace = () => !!root && this.root() === root;
    if (request.type === MessageType.OPEN_RECENT_WORKSHOP_SESSION) {
      const id = this.tickets.get(request.payload.token);
      if (!id || this.scope !== root || !currentWorkspace()) {
        error = changed;
      } else {
        try {
          error = await this.open(id, currentWorkspace);
          if (!error) { return { rows: [] }; }
        } catch {
          error = 'The saved session could not be opened. Refresh to try again.';
        }
      }
    }

    const scope = this.root();
    try {
      const sessions = await this.store.listRecentNamed();
      if (scope !== this.root()) { return { rows: [], error: changed }; }
      const prior = this.scope === scope ? new Map([...this.tickets].map(([token, id]) => [id, token])) : new Map<string, string>();
      this.scope = scope;
      this.tickets.clear();
      const rows = sessions.map(({ sessionId, title, updatedAt }) => {
        const token = prior.get(sessionId) ?? randomUUID();
        this.tickets.set(token, sessionId);
        return { token, title, updatedAt };
      });
      return { rows, ...(error ? { error } : {}) };
    } catch {
      this.tickets.clear();
      return { rows: [], error: error ?? 'Recent saved sessions could not be listed. Refresh to try again.' };
    }
  }
}
