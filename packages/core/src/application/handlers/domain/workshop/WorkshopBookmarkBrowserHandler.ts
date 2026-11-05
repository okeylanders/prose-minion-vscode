/**
 * The Bookmarks screen's routes (ADR 2026-11-05 D8): three reads, never a
 * mutation, so none registers behind the session-operation gate.
 *
 * - `WORKSHOP_REQUEST_BOOKMARK_PAGE`: one page of saved sessions'
 *   bookmarks, through the recall service's paged read (PR #214 F-02). One
 *   page is in flight per webview: a newer request, or
 *   `WORKSHOP_CANCEL_BOOKMARK_PAGE`, aborts it, and an aborted page answers
 *   nothing (the webview stopped waiting for it).
 * - `WORKSHOP_REQUEST_LIVE_BOOKMARKS`: every bookmark in the open room,
 *   from its full ledger (PR #214 F-03). The screen is the writer's own
 *   view, so it shows them all.
 * - `WORKSHOP_REQUEST_SAVED_TURN_PREVIEW`: one saved turn, projected.
 *
 * The page and the live rows answer only for the room the request names
 * (`roomRevision`): each waits out every room replacement first, as the
 * room's own turn preview does, and the page checks the room again once
 * read. Every request echoes its webview-minted id.
 *
 * Reads go through the recall service alone, which never initializes or
 * flushes; this handler never constructs it. Logs name ids, counts and
 * outcomes, never a title, label or message.
 */

import type { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type { WorkshopRecallUnavailableReason } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import { workshopTurnPreviewOfEntry } from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import {
  workshopBookmarkBrowserPage,
  workshopBookmarkBrowserRow
} from '@handlers/domain/workshop/WorkshopBookmarkBrowserRows';
import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopBookmarkPageMessage,
  WorkshopBookmarkPagePayload,
  WorkshopCancelBookmarkPageMessage,
  WorkshopLiveBookmarksMessage,
  WorkshopLiveBookmarksPayload,
  WorkshopRequestBookmarkPageMessage,
  WorkshopRequestLiveBookmarksMessage,
  WorkshopRequestSavedTurnPreviewMessage,
  WorkshopSavedTurnPreviewMessage,
  WorkshopSavedTurnPreviewPayload
} from '@messages';

/** What the screen reads: the recall service's three writer-facing seams. */
export type WorkshopBookmarkBrowserPort = Pick<
  WorkshopTranscriptRecallService,
  'bookmarkPage' | 'liveRoomBookmarks' | 'savedTurn'
>;

/** The one persistence fact these reads need: a room replacement in flight, and a way to wait it out. */
export interface WorkshopBookmarkBrowserGate {
  isSessionOperationPending(): boolean;
  waitForSessionOperations(): Promise<void>;
}

/** The one room fact these reads need: which room is open now. */
export interface WorkshopBookmarkBrowserRoom {
  readRoomRevision(): number;
}

/** The longest request id a reply echoes; a webview mints short ones. */
const REQUEST_ID_CHARACTERS = 128;
/** A cursor is the store's, echoed back; anything longer was never one. */
const CURSOR_CHARACTERS = 512;
const ID_CHARACTERS = 256;
const ROOM_CHANGED = 'The room changed before the bookmarks could be shown.';
const NO_LIVE_ROOM = 'This room’s bookmarks can’t be read just now.';
const MALFORMED = 'That request could not be read.';
const UNKNOWN_SESSION = 'That saved session is no longer there.';
const UNREADABLE_SESSION = 'That saved session couldn’t be read.';
const UNKNOWN_TURN = 'That message is no longer in its saved session.';
const LIVE_SESSION = 'That session is the one open now: its messages are in the thread.';

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the reasons' kebab-case words. */
const UNAVAILABLE: Readonly<Record<WorkshopRecallUnavailableReason, string>> = {
  'no-workspace': 'Saved sessions need an open folder. Open a single folder to browse their bookmarks.',
  'multi-root': 'Saved sessions need a single-folder workspace. Open one folder to browse their bookmarks.',
  'workspace-changed': 'The workspace changed while the bookmarks were read. Try again.',
  'not-ready': 'The room changed while the bookmarks were read. Try again.'
};
/* eslint-enable @typescript-eslint/naming-convention */

export class WorkshopBookmarkBrowserHandler {
  /** The page being read for this webview, if any. */
  private inFlight?: { requestId: string; controller: AbortController };

  constructor(
    private readonly recall: WorkshopBookmarkBrowserPort,
    private readonly room: WorkshopBookmarkBrowserRoom,
    private readonly gate: WorkshopBookmarkBrowserGate,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly reportError: (message: string) => void
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE, this.handleRequestPage.bind(this));
    router.register(MessageType.WORKSHOP_CANCEL_BOOKMARK_PAGE, this.handleCancelPage.bind(this));
    router.register(MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS, this.handleRequestLive.bind(this));
    router.register(MessageType.WORKSHOP_REQUEST_SAVED_TURN_PREVIEW, this.handleRequestSavedTurn.bind(this));
  }

  /** Stop any page still being read (the webview is going). */
  dispose(): void {
    this.inFlight?.controller.abort();
    this.inFlight = undefined;
  }

  async handleRequestPage(message: WorkshopRequestBookmarkPageMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (requestId === undefined) {
      this.reportError('A bookmarks page must carry its request id');
      return;
    }
    const roomRevision = revisionOf(payload);
    const after = payload?.after;
    if (after !== undefined && (typeof after !== 'string' || after.length === 0 || after.length > CURSOR_CHARACTERS)) {
      this.postPage({ requestId, roomRevision, error: MALFORMED }, 'refused', 'malformed');
      return;
    }
    // A newer page supersedes the one being read.
    this.inFlight?.controller.abort();
    const controller = new AbortController();
    this.inFlight = { requestId, controller };
    try {
      if (!(await this.sameRoom(roomRevision))) {
        this.postPage({ requestId, roomRevision, error: ROOM_CHANGED }, 'refused', 'room-changed');
        return;
      }
      const result = await this.recall.bookmarkPage(after !== undefined ? { after } : {}, controller.signal);
      if (controller.signal.aborted) {
        this.log(`Bookmarks page cancelled (requestId=${requestId})`);
        return;
      }
      if (this.room.readRoomRevision() !== roomRevision) {
        this.postPage({ requestId, roomRevision, error: ROOM_CHANGED }, 'refused', 'room-changed');
        return;
      }
      if (!result.available) {
        this.postPage({ requestId, roomRevision, error: UNAVAILABLE[result.reason] }, 'refused', result.reason);
        return;
      }
      this.postPage({ requestId, roomRevision, page: workshopBookmarkBrowserPage(result) }, 'sent');
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        this.log(`Bookmarks page cancelled (requestId=${requestId})`);
        return;
      }
      this.log(`Bookmarks page failed (requestId=${requestId}): ${error instanceof Error ? error.name : 'error'}`);
      this.postPage({ requestId, roomRevision, error: 'The saved sessions couldn’t be read just now.' }, 'refused', 'error');
    } finally {
      if (this.inFlight?.controller === controller) {
        this.inFlight = undefined;
      }
    }
  }

  async handleCancelPage(message: WorkshopCancelBookmarkPageMessage): Promise<void> {
    const requestId = requestIdOf(message.payload);
    if (requestId !== undefined && this.inFlight?.requestId === requestId) {
      this.inFlight.controller.abort();
    }
  }

  async handleRequestLive(message: WorkshopRequestLiveBookmarksMessage): Promise<void> {
    const requestId = requestIdOf(message.payload);
    if (requestId === undefined) {
      this.reportError('A request for the room’s bookmarks must carry its request id');
      return;
    }
    const roomRevision = revisionOf(message.payload);
    if (!(await this.sameRoom(roomRevision))) {
      this.postLive({ requestId, roomRevision, error: ROOM_CHANGED }, 'refused', 'room-changed');
      return;
    }
    // Read with nothing awaited since the room was checked: these are that room's rows.
    const read = this.recall.liveRoomBookmarks();
    if (!read) {
      this.postLive({ requestId, roomRevision, error: NO_LIVE_ROOM }, 'refused', 'no-live-port');
      return;
    }
    this.postLive({ requestId, roomRevision, bookmarks: read.bookmarks.map(workshopBookmarkBrowserRow) }, 'sent');
  }

  async handleRequestSavedTurn(message: WorkshopRequestSavedTurnPreviewMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (requestId === undefined) {
      this.reportError('A saved turn preview must carry its request id');
      return;
    }
    const sessionId = idOf(payload?.sessionId);
    const turnId = idOf(payload?.turnId);
    if (sessionId === undefined || turnId === undefined) {
      this.postSavedTurn({ requestId, sessionId: sessionId ?? '', turnId: turnId ?? '', error: MALFORMED }, 'refused', 'malformed');
      return;
    }
    const answer = { requestId, sessionId, turnId };
    let result: Awaited<ReturnType<WorkshopBookmarkBrowserPort['savedTurn']>>;
    try {
      result = await this.recall.savedTurn(sessionId, turnId);
    } catch (error) {
      this.log(`Saved turn preview failed (requestId=${requestId}): ${error instanceof Error ? error.name : 'error'}`);
      this.postSavedTurn({ ...answer, error: UNREADABLE_SESSION }, 'refused', 'error');
      return;
    }
    if ('available' in result) {
      this.postSavedTurn({ ...answer, error: UNAVAILABLE[result.reason] }, 'refused', result.reason);
      return;
    }
    switch (result.kind) {
      case 'turn':
        this.postSavedTurn({ ...answer, turn: workshopTurnPreviewOfEntry(result.entry) }, 'sent');
        return;
      case 'live-session':
        this.postSavedTurn({ ...answer, error: LIVE_SESSION }, 'refused', result.kind);
        return;
      case 'unknown-session':
        this.postSavedTurn({ ...answer, error: UNKNOWN_SESSION }, 'refused', result.kind);
        return;
      case 'unreadable':
        this.postSavedTurn({ ...answer, error: UNREADABLE_SESSION }, 'refused', result.kind);
        return;
      case 'unknown-turn':
        this.postSavedTurn({ ...answer, error: UNKNOWN_TURN }, 'refused', result.kind);
        return;
      default: {
        const unreachable: never = result;
        return unreachable;
      }
    }
  }

  /** Wait out every room replacement (one queued meanwhile included), then ask whether the room is still `roomRevision`. */
  private async sameRoom(roomRevision: number): Promise<boolean> {
    while (this.gate.isSessionOperationPending()) {
      await this.gate.waitForSessionOperations();
    }
    return this.room.readRoomRevision() === roomRevision;
  }

  private postPage(payload: WorkshopBookmarkPagePayload, outcome: 'sent' | 'refused', reason?: string): void {
    const counts = payload.page
      ? `, read=${payload.page.read}, unreadable=${payload.page.unreadable}, remaining=${payload.page.remaining}`
      : '';
    this.log(`Bookmarks page ${outcome} (requestId=${payload.requestId}${counts}${reason ? `, reason=${reason}` : ''})`);
    const reply: WorkshopBookmarkPageMessage = {
      type: MessageType.WORKSHOP_BOOKMARK_PAGE,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  private postLive(payload: WorkshopLiveBookmarksPayload, outcome: 'sent' | 'refused', reason?: string): void {
    this.log(`Live bookmarks ${outcome} (requestId=${payload.requestId}${
      payload.bookmarks ? `, count=${payload.bookmarks.length}` : ''}${reason ? `, reason=${reason}` : ''})`);
    const reply: WorkshopLiveBookmarksMessage = {
      type: MessageType.WORKSHOP_LIVE_BOOKMARKS,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  private postSavedTurn(payload: WorkshopSavedTurnPreviewPayload, outcome: 'sent' | 'refused', reason?: string): void {
    this.log(`Saved turn preview ${outcome} (sessionId=${payload.sessionId || 'none'}, turnId=${payload.turnId || 'none'}${
      reason ? `, reason=${reason}` : ''})`);
    const reply: WorkshopSavedTurnPreviewMessage = {
      type: MessageType.WORKSHOP_SAVED_TURN_PREVIEW,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`[WorkshopBookmarkBrowserHandler] ${line}`);
  }
}

/** A request id a reply can echo: a non-empty string of bounded length. */
function requestIdOf(payload: { requestId?: unknown } | undefined): string | undefined {
  const requestId = payload?.requestId;
  return typeof requestId === 'string' && requestId.length > 0 && requestId.length <= REQUEST_ID_CHARACTERS
    ? requestId
    : undefined;
}

function revisionOf(payload: { roomRevision?: unknown } | undefined): number {
  const revision = payload?.roomRevision;
  return typeof revision === 'number' && Number.isSafeInteger(revision) ? revision : -1;
}

function idOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= ID_CHARACTERS ? value : undefined;
}
