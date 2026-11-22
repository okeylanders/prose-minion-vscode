/**
 * The one passage search a Workshop window runs, by operation (ADR
 * 2026-11-20 D20; PR #296 re-review). The route owner
 * (`WorkshopPassageSearchHandler`) holds one.
 *
 * - **An operation is minted when a Run takes the slot:** its own id, the
 *   card, the request, and the room it began in (revision and open-room
 *   instance). Nothing else names it.
 * - **The slot is released by identity only.** An operation clears the slot
 *   only while it still holds it, so an old Run's late plan, refusal,
 *   failure or completion can never erase a newer search.
 * - **A replacement frees the slot at once.** The coordinator's announcement
 *   aborts the search and releases it then, not when its async work
 *   settles, so the new room's cards can be priced, run and cancelled at
 *   once. A search whose room moved with no announcement is treated the
 *   same when it is next looked at.
 * - **A Stop belongs to its operation** (PR #296 combined re-review).
 *   `stop` aborts the search and records that the writer's Stop was
 *   acknowledged for that operation alone. The handler never delivers a
 *   stopped operation's result on its own, whatever the result says; it
 *   waits for the writer's Send. Another operation's Stop never counts.
 * - **Closing the window ends every operation.** After `close`, no
 *   operation owns anything, and none can take the slot.
 *
 * Names no route and posts nothing.
 */

import type { WorkshopPassageSearchProgress } from '@messages';

/** The room an operation runs in: the aggregate's revision and the coordinator's open-room instance. */
export interface WorkshopPassageSearchRunRoom {
  readRoomRevision(): number;
  openRoomInstance(): number;
}

export interface WorkshopPassageSearchOperation {
  /** Minted when the Run took the slot; never reused in this window. */
  readonly id: number;
  readonly turnId: string;
  readonly requestId: string;
  readonly roomRevision: number;
  readonly roomInstance: number;
  readonly controller: AbortController;
  progress?: WorkshopPassageSearchProgress;
}

export class WorkshopPassageSearchRunSlot {
  private current: WorkshopPassageSearchOperation | undefined;
  private minted = 0;
  private closed = false;
  /** The operations whose Stop was acknowledged, by identity; nothing else is ever added. */
  private readonly stopped = new WeakSet<WorkshopPassageSearchOperation>();

  constructor(private readonly room: WorkshopPassageSearchRunRoom) {}

  /** Take the slot for a Run in the room open now; undefined once the window closed. */
  take(turnId: string, requestId: string): WorkshopPassageSearchOperation | undefined {
    if (this.closed) {
      return undefined;
    }
    this.minted += 1;
    this.current = {
      id: this.minted,
      turnId,
      requestId,
      roomRevision: this.room.readRoomRevision(),
      roomInstance: this.room.openRoomInstance(),
      controller: new AbortController()
    };
    return this.current;
  }

  /** The search running in the room open now, if any; one whose room moved is stopped and let go first. */
  live(): WorkshopPassageSearchOperation | undefined {
    const operation = this.current;
    if (operation && !this.inRoomNow(operation)) {
      this.end(operation);
      return undefined;
    }
    return operation;
  }

  /** Whether `operation` still holds the slot, in the room it began in, with the window open. */
  owns(operation: WorkshopPassageSearchOperation): boolean {
    return !this.closed && this.current === operation && this.inRoomNow(operation);
  }

  /** Let go of the slot if `operation` still holds it; an older operation releases nothing. */
  release(operation: WorkshopPassageSearchOperation): void {
    if (this.current === operation) {
      this.current = undefined;
    }
  }

  /** The writer's Stop, acknowledged for `operation` alone: its search is aborted, and its result is never sent by the host. */
  stop(operation: WorkshopPassageSearchOperation): void {
    this.stopped.add(operation);
    operation.controller.abort();
  }

  /** Whether the writer's Stop was acknowledged for this very operation; a replacement or a close is not a Stop. */
  stopAcknowledged(operation: WorkshopPassageSearchOperation): boolean {
    return this.stopped.has(operation);
  }

  /** The room was replaced: the search running stops and its slot is free now. Returns what was stopped. */
  replaced(): WorkshopPassageSearchOperation | undefined {
    const operation = this.current;
    if (operation) {
      this.end(operation);
    }
    return operation;
  }

  /** The window is closing: the search stops, the slot is let go, and no operation owns anything again. */
  close(): void {
    this.closed = true;
    this.replaced();
  }

  isClosed(): boolean {
    return this.closed;
  }

  private inRoomNow(operation: WorkshopPassageSearchOperation): boolean {
    return operation.roomRevision === this.room.readRoomRevision() && operation.roomInstance === this.room.openRoomInstance();
  }

  private end(operation: WorkshopPassageSearchOperation): void {
    operation.controller.abort();
    this.release(operation);
  }
}
