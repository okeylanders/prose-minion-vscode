/**
 * A Lightbox tile brought to the Workshop (ADR 2026-10-19 D11; Lightbox
 * Slice 4): the Workshop side of the `lightbox-tile` seed.
 *
 * 1. **Offer** (`WORKSHOP_STAGE_LIGHTBOX_TILE`, direct). Only the panel
 *    provider sends it, through this panel's own MessageHandler, once its
 *    seed delivery is ready. The tile is checked here (exact keys, bounds),
 *    held under its delivery id, and the webview is told one is waiting
 *    (`WORKSHOP_LIGHTBOX_TILE_OFFERED`). Nothing is staged yet: the webview
 *    claims it first, and the provider grants the claim only while the
 *    delivery is still current. A newer offer replaces a held one, as the
 *    provider replaces an unclaimed seed.
 * 2. **Accept** (`WORKSHOP_ACCEPT_LIGHTBOX_TILE`, a mutation behind the
 *    session-operation gate). After a grant the webview asks for the held
 *    tile by delivery id. It is staged as a pending message attachment,
 *    above the composer, or refused: `busy` while a response runs or the
 *    session is being saved or replaced, `full` when the next message
 *    already carries as many attachments as one may, `duplicate` when that
 *    tile already waits there. Either way the handler answers
 *    (`WORKSHOP_LIGHTBOX_TILE_STAGED`), since a grant cannot be revoked and
 *    the webview must answer the provider.
 *
 * Staged, the tile is ordinary session state: persisted, removable, sent
 * only with the writer's next message. Staging opens no sheet and never
 * touches the composer's draft, so it is safe while a Workshop overlay is
 * open. Logs name ids and counts, never the tile's words.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopMutationRouteRegistrar } from '@handlers/domain/workshop/WorkshopRouteContracts';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  validateWorkshopLightboxTile,
  workshopLightboxTileAttachmentInput
} from '@/application/services/workshop/WorkshopLightboxTileAttachment';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopAcceptLightboxTileMessage,
  WorkshopLightboxTile,
  WorkshopLightboxTileOfferedMessage,
  WorkshopLightboxTileStagedMessage,
  WorkshopLightboxTileStagedPayload,
  WorkshopSeedRefusal,
  WorkshopStageLightboxTileMessage
} from '@messages';

const SOURCE = 'extension.workshop.lightbox-tile';

/** The longest delivery id the panel provider mints, with room to spare. */
const MAX_DELIVERY_ID = 80;

export type WorkshopLightboxTileSessionPort = Pick<WorkshopSessionService, 'addMessageAttachment'>;

export interface WorkshopLightboxTileEffects {
  postSessionState: () => void;
  markDirty: (reason: string) => void;
  isRoomRunActive: () => boolean;
}

export class WorkshopLightboxTileHandler {
  /** The one tile offered and not yet accepted. */
  private held?: { deliveryId: string; tile: WorkshopLightboxTile };

  constructor(
    private readonly session: WorkshopLightboxTileSessionPort,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly effects: WorkshopLightboxTileEffects
  ) {}

  registerRoutes(router: MessageRouter, registerMutation: WorkshopMutationRouteRegistrar): void {
    // Direct: holding an offer changes no session state.
    router.register(MessageType.WORKSHOP_STAGE_LIGHTBOX_TILE, this.handleOffer.bind(this));
    registerMutation(
      MessageType.WORKSHOP_ACCEPT_LIGHTBOX_TILE,
      this.handleAccept.bind(this),
      undefined,
      (_reason: string, message: WorkshopAcceptLightboxTileMessage) => {
        this.outputChannel.appendLine('[WorkshopLightboxTileHandler] Tile refused: a session operation is pending');
        this.answer(this.deliveryIdOf(message), { staged: false, reason: 'busy' });
      }
    );
  }

  dispose(): void {
    this.held = undefined;
  }

  async handleOffer(message: WorkshopStageLightboxTileMessage): Promise<void> {
    const deliveryId = message.payload?.deliveryId;
    let tile: WorkshopLightboxTile;
    try {
      if (typeof deliveryId !== 'string' || deliveryId.length === 0 || deliveryId.length > MAX_DELIVERY_ID) {
        throw new Error('seed delivery id must be a string of at most 80 characters');
      }
      tile = validateWorkshopLightboxTile(message.payload?.tile);
      workshopLightboxTileAttachmentInput(tile);
    } catch (error) {
      // Shape errors name fields and bounds, never the tile's text. The offer
      // is dropped unclaimed; the provider settles it at its deadline.
      const detail = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[WorkshopLightboxTileHandler] Tile offer refused: ${detail}`);
      return;
    }
    this.held = { deliveryId, tile };
    this.outputChannel.appendLine(
      `[WorkshopLightboxTileHandler] Tile offered from the Lightbox: ${tile.quotes.length} quotes, ${tile.points.length} points`
    );
    await this.postMessage({
      type: MessageType.WORKSHOP_LIGHTBOX_TILE_OFFERED,
      source: SOURCE,
      payload: { deliveryId },
      timestamp: Date.now()
    } satisfies WorkshopLightboxTileOfferedMessage);
  }

  async handleAccept(message: WorkshopAcceptLightboxTileMessage): Promise<void> {
    const deliveryId = this.deliveryIdOf(message);
    const held = this.held;
    if (!held || held.deliveryId !== deliveryId) {
      // Nothing held under that id (a newer offer replaced it, or the room was disposed): stage nothing, say so.
      this.outputChannel.appendLine('[WorkshopLightboxTileHandler] Tile refused: no tile is held for that delivery');
      this.answer(deliveryId, { staged: false, reason: 'busy' });
      return;
    }
    this.held = undefined;
    if (this.effects.isRoomRunActive()) {
      this.outputChannel.appendLine('[WorkshopLightboxTileHandler] Tile refused: a response is running');
      this.answer(deliveryId, { staged: false, reason: 'busy' });
      return;
    }
    const result = this.session.addMessageAttachment(workshopLightboxTileAttachmentInput(held.tile));
    if (!result.ok) {
      const reason: WorkshopSeedRefusal = result.reason === 'duplicate' ? 'duplicate' : 'full';
      this.outputChannel.appendLine(`[WorkshopLightboxTileHandler] Tile refused: ${reason}`);
      this.answer(deliveryId, { staged: false, reason });
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopLightboxTileHandler] Tile staged above the composer (${result.attachment.id}, ${result.attachment.words} words)`
    );
    this.effects.markDirty('lightbox tile staged');
    this.effects.postSessionState();
    this.answer(deliveryId, { staged: true, attachmentId: result.attachment.id });
  }

  private deliveryIdOf(message: WorkshopAcceptLightboxTileMessage): string {
    const deliveryId = message.payload?.deliveryId;
    return typeof deliveryId === 'string' ? deliveryId.slice(0, MAX_DELIVERY_ID) : '';
  }

  private answer(
    deliveryId: string,
    outcome: { staged: true; attachmentId: string } | { staged: false; reason: WorkshopSeedRefusal }
  ): void {
    const payload: WorkshopLightboxTileStagedPayload = { deliveryId, ...outcome };
    void this.postMessage({
      type: MessageType.WORKSHOP_LIGHTBOX_TILE_STAGED,
      source: SOURCE,
      payload,
      timestamp: Date.now()
    } satisfies WorkshopLightboxTileStagedMessage);
  }
}
