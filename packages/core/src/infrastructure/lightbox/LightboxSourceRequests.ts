/**
 * The writer's source requests (PR #148 F-01), one set per extension
 * session, held by `LightboxService`. A request takes a ticket when the
 * writer's choice becomes concrete, before anything is awaited; the newest
 * supersedes every earlier one at once, and only it may adopt a board or
 * publish a refusal.
 *
 * Only shutdown ends them (`end`, PR #183 F-03): no ticket taken before or
 * after is current again, so a source still being read or measured adopts
 * nothing and starts no save the host would not wait for. A tab's close
 * never ends them, so a request that outlives its tab lands in the next.
 */

/** One source request; compared by identity, so it cannot be forged. */
export interface LightboxSourceTicket {
  /** Ascending per extension session; for logs. */
  readonly sequence: number;
}

export class LightboxSourceRequests {
  /** The writer's latest request; only it may adopt or refuse. */
  private current?: LightboxSourceTicket;
  private count = 0;
  private ended = false;

  /** A new request's ticket; it supersedes every earlier one, unless requests have ended. */
  begin(): LightboxSourceTicket {
    const ticket: LightboxSourceTicket = { sequence: ++this.count };
    if (!this.ended) {
      this.current = ticket;
    }
    return ticket;
  }

  /** Whether `ticket` is still the writer's latest request. */
  isCurrent(ticket: LightboxSourceTicket): boolean {
    return ticket === this.current;
  }

  /** Whether any request was made this session. */
  any(): boolean {
    return this.count > 0;
  }

  /** Shutdown: no ticket, taken before or after, is current again. */
  end(): void {
    this.ended = true;
    this.current = undefined;
  }
}
