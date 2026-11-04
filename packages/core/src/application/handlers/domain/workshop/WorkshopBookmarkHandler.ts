import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { workshopTurnPreview } from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopRenameBookmarkMessage,
  WorkshopRenameBookmarkResultMessage,
  WorkshopRenameBookmarkResultPayload,
  WorkshopRequestTurnPreviewMessage,
  WorkshopSetTurnBookmarkMessage,
  WorkshopTurnPreviewMessage,
  WorkshopTurnPreviewPayload
} from '@messages';
import type {
  WorkshopMutationRouteRegistrar,
  WorkshopRoomEffects
} from '@handlers/domain/workshop/WorkshopRouteContracts';

type WorkshopBookmarkEffects = Pick<
  WorkshopRoomEffects,
  'postSessionState' | 'markDirty' | 'reportError'
>;

/**
 * The one persistence fact the preview needs: whether a room replacement is
 * in flight, and a way to wait it out without joining it.
 */
export interface WorkshopTurnPreviewGate {
  isSessionOperationPending(): boolean;
  waitForSessionOperations(): Promise<void>;
}

/** The longest request id a reply echoes; a webview mints short ones. */
const REQUEST_ID_CHARACTERS = 128;
const UNKNOWN_TURN = 'That message is no longer in this session.';
const ROOM_CHANGED = 'The room changed before this message could be shown.';
const NOTHING_TO_SHOW = 'That message has nothing to show.';

/**
 * Owns the Workshop bookmark routes (ADR 2026-11-03 D5, D6): set or clear a
 * bookmark on a turn, and rename one, both room mutations behind the shared
 * session-operation gate like the task list's; and the read-only turn
 * preview that opens a bookmark, a to-do's source or a read-in card outside
 * the snapshot's window.
 *
 * A rename names its request, and the host answers it, accepted or refused
 * (the gate's refusal included), so the webview keeps the writer's draft
 * until it knows (PR #189 F-01).
 *
 * The preview is a read, so it registers directly, never behind the mutation
 * gate. It waits out every room replacement queued while it waits (as
 * transcript export does), then answers only from the room the request was
 * made in (PR #189 F-02): it reads the full ledger (`readRoomLedger()`), and
 * sends the turn only through the transcript projection
 * (`workshopTurnPreview`).
 *
 * Logs name ids and outcomes only: never a label, never turn content.
 */
export class WorkshopBookmarkHandler {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly outputChannel: LogSink,
    private readonly effects: WorkshopBookmarkEffects,
    private readonly postMessage: MessageTransport,
    private readonly previewGate: WorkshopTurnPreviewGate
  ) {}

  registerRoutes(
    router: MessageRouter,
    registerMutation: WorkshopMutationRouteRegistrar
  ): void {
    registerMutation(
      MessageType.WORKSHOP_SET_TURN_BOOKMARK,
      this.handleSetTurnBookmark.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_RENAME_BOOKMARK,
      this.handleRenameBookmark.bind(this),
      undefined,
      (reason, message: WorkshopRenameBookmarkMessage) => this.refuseRenameUnderGate(reason, message)
    );
    router.register(
      MessageType.WORKSHOP_REQUEST_TURN_PREVIEW,
      this.handleRequestTurnPreview.bind(this)
    );
  }

  async handleRequestTurnPreview(message: WorkshopRequestTurnPreviewMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (requestId === undefined) {
      // With no id to echo, no sheet could take the answer.
      this.effects.reportError('A turn preview must carry its request id');
      return;
    }
    const roomRevision = Number.isSafeInteger(payload.roomRevision) ? payload.roomRevision : -1;
    if (typeof payload.turnId !== 'string' || payload.turnId.length === 0) {
      this.postPreview({ requestId, turnId: '', roomRevision, error: UNKNOWN_TURN }, 'refused', 'malformed');
      return;
    }
    const turnId = payload.turnId;
    // A room mid-swap is neither the old room nor the new one. Wait out every
    // replacement, including one queued while an earlier one ran, never just
    // the queue as it stood when this request arrived.
    while (this.previewGate.isSessionOperationPending()) {
      await this.previewGate.waitForSessionOperations();
    }
    // The room may have been replaced before the request even arrived: the
    // request's own room is the one it may be answered from.
    if (this.session.readRoomRevision() !== roomRevision) {
      this.postPreview({ requestId, turnId, roomRevision, error: ROOM_CHANGED }, 'refused', 'room-changed');
      return;
    }
    const turn = this.session.readRoomLedger().find((candidate) => candidate.id === turnId);
    if (!turn) {
      this.postPreview({ requestId, turnId, roomRevision, error: UNKNOWN_TURN }, 'refused', 'unknown-turn');
      return;
    }
    const preview = workshopTurnPreview(turn);
    if (!preview) {
      this.postPreview({ requestId, turnId, roomRevision, error: NOTHING_TO_SHOW }, 'refused', 'not-in-transcript');
      return;
    }
    this.postPreview({ requestId, turnId, roomRevision, turn: preview }, 'sent');
  }

  private postPreview(
    payload: WorkshopTurnPreviewPayload,
    outcome: 'sent' | 'refused',
    reason?: string
  ): void {
    this.outputChannel.appendLine(
      `[WorkshopBookmarkHandler] Turn preview ${outcome} (turnId=${payload.turnId || 'none'}${
        reason ? `, reason=${reason}` : ''
      })`
    );
    const reply: WorkshopTurnPreviewMessage = {
      type: MessageType.WORKSHOP_TURN_PREVIEW,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  async handleSetTurnBookmark(message: WorkshopSetTurnBookmarkMessage): Promise<void> {
    const payload = message.payload;
    if (
      typeof payload?.turnId !== 'string'
      || payload.turnId.length === 0
      || typeof payload.bookmarked !== 'boolean'
    ) {
      this.effects.reportError('A bookmark change must name a turn and whether to set it');
      return;
    }
    this.apply(
      payload.bookmarked ? 'set' : 'clear',
      `turnId=${payload.turnId}`,
      message.source,
      () => this.session.setTurnBookmark(payload.turnId, payload.bookmarked)
    );
  }

  async handleRenameBookmark(message: WorkshopRenameBookmarkMessage): Promise<void> {
    const payload = message.payload;
    const requestId = requestIdOf(payload);
    if (
      requestId === undefined
      || typeof payload.bookmarkId !== 'string'
      || payload.bookmarkId.length === 0
      || (payload.label !== null && typeof payload.label !== 'string')
    ) {
      this.effects.reportError('A bookmark rename must carry its request id, a bookmark and a label or null');
      return;
    }
    const target = `bookmarkId=${payload.bookmarkId}, label=${payload.label === null ? 'default' : 'named'}`;
    const result = this.apply(
      'rename',
      target,
      message.source,
      () => this.session.renameBookmark(payload.bookmarkId, payload.label),
      // The field shows the refusal beside the writer's draft.
      'field'
    );
    this.postRenameResult(
      result.ok
        ? { requestId, bookmarkId: payload.bookmarkId, accepted: true }
        : { requestId, bookmarkId: payload.bookmarkId, accepted: false, error: result.message }
    );
  }

  /** The session-operation gate refused a rename before it ran: answer it, so the draft stays. */
  private refuseRenameUnderGate(reason: string, message: WorkshopRenameBookmarkMessage): void {
    const requestId = requestIdOf(message.payload);
    const bookmarkId = typeof message.payload?.bookmarkId === 'string' ? message.payload.bookmarkId : '';
    this.outputChannel.appendLine(
      `[WorkshopBookmarkHandler] Bookmark rename refused (bookmarkId=${bookmarkId || 'none'}, reason=session-operation)`
    );
    if (requestId === undefined) {
      this.effects.reportError(reason);
      return;
    }
    this.postRenameResult({ requestId, bookmarkId, accepted: false, error: reason });
  }

  private postRenameResult(payload: WorkshopRenameBookmarkResultPayload): void {
    const reply: WorkshopRenameBookmarkResultMessage = {
      type: MessageType.WORKSHOP_RENAME_BOOKMARK_RESULT,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  private apply(
    action: 'set' | 'clear' | 'rename',
    target: string,
    source: string,
    change: () => 'set' | 'cleared' | 'unchanged',
    refusalShownIn: 'banner' | 'field' = 'banner'
  ): { ok: true } | { ok: false; message: string } {
    try {
      const outcome = change();
      this.outputChannel.appendLine(
        `[WorkshopBookmarkHandler] Bookmark ${action} ${outcome} (${target}, source=${source})`
      );
      if (outcome !== 'unchanged') {
        this.effects.markDirty('bookmark committed');
      }
      this.effects.postSessionState();
      return { ok: true };
    } catch (error) {
      const reason = (error as { reason?: unknown })?.reason;
      this.outputChannel.appendLine(
        `[WorkshopBookmarkHandler] Bookmark ${action} refused (${target}, reason=${
          typeof reason === 'string' ? reason : 'error'
        }, source=${source})`
      );
      const message = error instanceof Error ? error.message : 'Could not update the bookmark';
      if (refusalShownIn === 'banner') {
        this.effects.reportError(message);
      }
      return { ok: false, message };
    }
  }
}

/** A request id a reply can echo: a non-empty string of bounded length. */
function requestIdOf(payload: { requestId?: unknown } | undefined): string | undefined {
  const requestId = payload?.requestId;
  return typeof requestId === 'string' && requestId.length > 0 && requestId.length <= REQUEST_ID_CHARACTERS
    ? requestId
    : undefined;
}
