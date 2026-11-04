import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { MessageRouter } from '@handlers/MessageRouter';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopRenameBookmarkMessage,
  WorkshopSetTurnBookmarkMessage
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
 * Owns the Workshop bookmark routes (ADR 2026-11-03 D5): set or clear a
 * bookmark on a turn, and rename one. Both are room mutations behind the
 * shared session-operation gate, like the task list's.
 *
 * Logs name ids and outcomes only: never a label, never turn content.
 */
export class WorkshopBookmarkHandler {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly outputChannel: LogSink,
    private readonly effects: WorkshopBookmarkEffects
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
