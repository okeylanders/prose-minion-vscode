/**
 * The Lightbox's tray, read from the Workshop (ADR 2026-10-19 D11; Lightbox
 * Slice 4): the Lightbox tiles waiting above the Workshop composer in the
 * current room.
 *
 * It reads the shared session's pending message attachments, so it counts
 * only what the Workshop staged, never what was merely asked for. A tile
 * leaves when the writer sends it with a message or removes it there, and
 * when the room is replaced (new, open, rewind, branch); closing the
 * Workshop tab keeps it, since pending attachments are session state. The
 * Lightbox never changes it, and sees ids and labels only.
 */

import type { LightboxWorkshopTrayTile } from '@messages';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';

export type WorkshopLightboxTraySessionPort = Pick<
  WorkshopSessionService,
  'collectMessageAttachments' | 'addPendingMessageAttachmentsListener'
>;

export interface WorkshopLightboxTray {
  read(): LightboxWorkshopTrayTile[];
  /** Returns the unsubscribe closure its caller must own. */
  subscribe(listener: () => void): () => void;
}

export function workshopLightboxTray(session: WorkshopLightboxTraySessionPort): WorkshopLightboxTray {
  return {
    read: () => session.collectMessageAttachments().flatMap((attachment) => attachment.lightboxTile
      ? [{ boardId: attachment.lightboxTile.boardId, tileId: attachment.lightboxTile.tileId, label: attachment.label }]
      : []),
    subscribe: (listener) => session.addPendingMessageAttachmentsListener(listener)
  };
}
