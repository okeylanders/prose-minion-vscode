import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { workshopTurnPreview } from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopRenameBookmarkMessage,
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

/** The longest request id the preview echoes; a webview mints short ones. */
const PREVIEW_REQUEST_ID_CHARACTERS = 128;
const UNKNOWN_TURN = 'That message is no longer in this session.';
const NOTHING_TO_SHOW = 'That message has nothing to show.';

/**
 * Owns the Workshop bookmark routes (ADR 2026-11-03 D5, D6): set or clear a
 * bookmark on a turn, and rename one, both room mutations behind the shared
 * session-operation gate like the task list's; and the read-only turn
 * preview that opens a bookmark, a to-do's source or a read-in card outside
 * the snapshot's window.
 *
 * The preview is a read, so it registers directly, never behind the mutation
 * gate. It waits out a room replacement (as transcript export does), reads
 * the full ledger (`readRoomLedger()`), and sends the turn only through the
 * transcript projection (`workshopTurnPreview`).
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
      this.handleRenameBookmark.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_REQUEST_TURN_PREVIEW,
      this.handleRequestTurnPreview.bind(this)
    );
  }

  async handleRequestTurnPreview(message: WorkshopRequestTurnPreviewMessage): Promise<void> {
    const payload = message.payload;
    const requestId = payload?.requestId;
    if (
      typeof requestId !== 'string'
      || requestId.length === 0
      || requestId.length > PREVIEW_REQUEST_ID_CHARACTERS
    ) {
      // With no id to echo, no sheet could take the answer.
      this.effects.reportError('A turn preview must carry its request id');
      return;
    }
    if (typeof payload.turnId !== 'string' || payload.turnId.length === 0) {
      this.postPreview({ requestId, turnId: '', error: UNKNOWN_TURN }, 'refused', 'malformed');
      return;
    }
    const turnId = payload.turnId;
    if (this.previewGate.isSessionOperationPending()) {
      // A room mid-swap is neither the old room nor the new one.
      await this.previewGate.waitForSessionOperations();
    }
    const turn = this.session.readRoomLedger().find((candidate) => candidate.id === turnId);
    if (!turn) {
      this.postPreview({ requestId, turnId, error: UNKNOWN_TURN }, 'refused', 'unknown-turn');
      return;
    }
    const preview = workshopTurnPreview(turn);
    if (!preview) {
      this.postPreview({ requestId, turnId, error: NOTHING_TO_SHOW }, 'refused', 'not-in-transcript');
      return;
    }
    this.postPreview({ requestId, turnId, turn: preview }, 'sent');
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
    if (
      typeof payload?.bookmarkId !== 'string'
      || payload.bookmarkId.length === 0
      || (payload.label !== null && typeof payload.label !== 'string')
    ) {
      this.effects.reportError('A bookmark rename must name a bookmark and a label or null');
      return;
    }
    this.apply(
      'rename',
      `bookmarkId=${payload.bookmarkId}, label=${payload.label === null ? 'default' : 'named'}`,
      message.source,
      () => this.session.renameBookmark(payload.bookmarkId, payload.label)
    );
  }

  private apply(
    action: 'set' | 'clear' | 'rename',
    target: string,
    source: string,
    change: () => 'set' | 'cleared' | 'unchanged'
  ): void {
    try {
      const outcome = change();
      this.outputChannel.appendLine(
        `[WorkshopBookmarkHandler] Bookmark ${action} ${outcome} (${target}, source=${source})`
      );
      if (outcome !== 'unchanged') {
        this.effects.markDirty('bookmark committed');
      }
      this.effects.postSessionState();
    } catch (error) {
      const reason = (error as { reason?: unknown })?.reason;
      this.outputChannel.appendLine(
        `[WorkshopBookmarkHandler] Bookmark ${action} refused (${target}, reason=${
          typeof reason === 'string' ? reason : 'error'
        }, source=${source})`
      );
      this.effects.reportError(
        error instanceof Error ? error.message : 'Could not update the bookmark'
      );
    }
  }
}
