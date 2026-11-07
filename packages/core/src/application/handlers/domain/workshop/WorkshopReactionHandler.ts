import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopHideTurnReactionMessage,
  WorkshopSetTurnReactionMessage,
  WorkshopTurnReactionAuthor
} from '@messages';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import { isWorkshopReactionId, workshopReactionAuthorKey } from '@shared/constants/workshopReactions';
import type {
  WorkshopMutationRouteRegistrar,
  WorkshopRoomEffects
} from '@handlers/domain/workshop/WorkshopRouteContracts';

type WorkshopReactionEffects = Pick<
  WorkshopRoomEffects,
  'postSessionState' | 'markDirty' | 'reportError'
> & {
  /**
   * True while a response or the context wizard runs: the webview's
   * `roomMutationLocked`, checked again here (PR #245 M2), so a post that
   * raced the lock never lands mid-run, where Slice 2's delivery reads them.
   */
  isRoomBusy: () => boolean;
};

const ROOM_BUSY = 'Wait for the room to finish before reacting.';

/**
 * Owns the Workshop reaction routes (ADR 2026-11-07 D2, D8): add or remove
 * one of the writer's reactions on a persona reply, and Hide a persona's
 * reaction (Q6), which removes it. Both are room mutations behind the shared
 * session-operation gate, like the bookmark routes.
 *
 * The webview posts ids only; the session's ledger decides what may be
 * reacted to. No reaction starts a model call: this handler reaches the
 * session's reaction ledger and the room's snapshot, nothing else.
 *
 * Logs name ids, authors and outcomes only: never turn content.
 */
export class WorkshopReactionHandler {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly outputChannel: LogSink,
    private readonly effects: WorkshopReactionEffects
  ) {}

  registerRoutes(registerMutation: WorkshopMutationRouteRegistrar): void {
    registerMutation(MessageType.WORKSHOP_SET_TURN_REACTION, this.handleSetTurnReaction.bind(this));
    registerMutation(MessageType.WORKSHOP_HIDE_TURN_REACTION, this.handleHideTurnReaction.bind(this));
  }

  async handleSetTurnReaction(message: WorkshopSetTurnReactionMessage): Promise<void> {
    const payload = message.payload;
    if (
      typeof payload?.turnId !== 'string'
      || payload.turnId.length === 0
      || !isWorkshopReactionId(payload.reaction)
      || typeof payload.reacted !== 'boolean'
    ) {
      this.effects.reportError('A reaction change must name a turn, a known reaction and whether to add it');
      return;
    }
    this.apply(
      payload.reacted ? 'add' : 'remove',
      `turnId=${payload.turnId}, reaction=${payload.reaction}, author=writer`,
      message.source,
      () => this.session.setWriterReaction(payload.turnId, payload.reaction, payload.reacted)
    );
  }

  async handleHideTurnReaction(message: WorkshopHideTurnReactionMessage): Promise<void> {
    const payload = message.payload;
    const author = personaAuthorOf(payload?.author);
    if (
      typeof payload?.turnId !== 'string'
      || payload.turnId.length === 0
      || !isWorkshopReactionId(payload.reaction)
      || !author
    ) {
      this.effects.reportError('Hiding a reaction must name a turn, a known reaction and the persona who gave it');
      return;
    }
    this.apply(
      'hide',
      `turnId=${payload.turnId}, reaction=${payload.reaction}, author=${workshopReactionAuthorKey(author)}`,
      message.source,
      () => this.session.removeReaction({ turnId: payload.turnId, reaction: payload.reaction, author })
    );
  }

  private apply(
    action: 'add' | 'remove' | 'hide',
    target: string,
    source: string,
    change: () => 'added' | 'removed' | 'unchanged'
  ): void {
    if (this.effects.isRoomBusy()) {
      this.outputChannel.appendLine(
        `[WorkshopReactionHandler] Reaction ${action} refused (${target}, reason=run-active, source=${source})`
      );
      this.effects.reportError(ROOM_BUSY);
      return;
    }
    try {
      const outcome = change();
      this.outputChannel.appendLine(
        `[WorkshopReactionHandler] Reaction ${action} ${outcome} (${target}, source=${source})`
      );
      if (outcome !== 'unchanged') {
        this.effects.markDirty('reaction committed');
      }
      this.effects.postSessionState();
    } catch (error) {
      const reason = (error as { reason?: unknown })?.reason;
      this.outputChannel.appendLine(
        `[WorkshopReactionHandler] Reaction ${action} refused (${target}, reason=${
          typeof reason === 'string' ? reason : 'error'
        }, source=${source})`
      );
      this.effects.reportError(error instanceof Error ? error.message : 'Could not update the reaction');
    }
  }
}

/** A persona author exactly as the wire may carry one, or undefined. */
function personaAuthorOf(value: unknown): Exclude<WorkshopTurnReactionAuthor, { kind: 'writer' }> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const author = value as { kind?: unknown; personaId?: unknown };
  if (author.kind === 'host') {
    return { kind: 'host' };
  }
  return author.kind === 'personaGuest' && isWorkshopPersonaId(author.personaId)
    ? { kind: 'personaGuest', personaId: author.personaId }
    : undefined;
}
