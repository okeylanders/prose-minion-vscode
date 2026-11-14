/**
 * When two message attachments are the same source (PR #151 F-01). Pure.
 *
 * A pending attachment may wait above the composer once. Which attachments
 * count as one depends on what they are:
 * - a Lightbox tile is its board and tile ids (`lightboxTile`), durable on
 *   the attachment, its sent reference and its persisted pending copy alike;
 * - the editor's selection (Selected Text, ADR 2026-11-14 D13) is its
 *   snapshot id (`selectedText`), durable the same way: one selection has one
 *   id, so the same selection cannot wait twice;
 * - a configured resource is its group and path;
 * - any other file is its host-private source key (`sourceUri`), when it has
 *   one. A file restaged by Rewind has lost that key (it never leaves the
 *   host), which is the files' long-standing behavior and is kept.
 *
 * Staging, Rewind's restage and checkpoint hydration all ask this one
 * question, so a whole-room operation cannot put a tile above the composer
 * twice. A tile's source key is a function of its ids, so it is rebuilt
 * wherever a tile is restaged from its reference.
 */

import type {
  ConfiguredResourceRef,
  WorkshopLightboxTileAttachmentMeta,
  WorkshopSelectedTextAttachmentMeta
} from '@messages';

/** The duplicate-guard key's scheme: never a path, never shown. */
const LIGHTBOX_TILE_SOURCE_SCHEME = 'lightbox-tile:';
const SELECTED_TEXT_SOURCE_SCHEME = 'selected-text:';

/** What identifies an attachment's source, on a staged input, a pending copy or a sent reference. */
export interface WorkshopMessageAttachmentSource {
  sourceUri?: string;
  configuredResource?: ConfiguredResourceRef;
  lightboxTile?: Pick<WorkshopLightboxTileAttachmentMeta, 'boardId' | 'tileId'>;
  selectedText?: Pick<WorkshopSelectedTextAttachmentMeta, 'snapshotId'>;
}

/** The host-private duplicate key of a Selected Text attachment: its snapshot id. */
export function workshopSelectedTextSourceKey(selection: Pick<WorkshopSelectedTextAttachmentMeta, 'snapshotId'>): string {
  return `${SELECTED_TEXT_SOURCE_SCHEME}${selection.snapshotId}`;
}

/** The host-private duplicate key of a tile: its board and its id. */
export function workshopLightboxTileSourceKey(tile: Pick<WorkshopLightboxTileAttachmentMeta, 'boardId' | 'tileId'>): string {
  return `${LIGHTBOX_TILE_SOURCE_SCHEME}${tile.boardId}:${tile.tileId}`;
}

/** Whether `candidate` is the same source as `existing`, so it may not wait beside it. */
export function sameWorkshopMessageAttachmentSource(
  candidate: WorkshopMessageAttachmentSource,
  existing: WorkshopMessageAttachmentSource
): boolean {
  if (candidate.lightboxTile || existing.lightboxTile) {
    return candidate.lightboxTile !== undefined
      && existing.lightboxTile !== undefined
      && candidate.lightboxTile.boardId === existing.lightboxTile.boardId
      && candidate.lightboxTile.tileId === existing.lightboxTile.tileId;
  }
  if (candidate.selectedText || existing.selectedText) {
    return candidate.selectedText !== undefined
      && existing.selectedText !== undefined
      && candidate.selectedText.snapshotId === existing.selectedText.snapshotId;
  }
  if (candidate.sourceUri !== undefined && existing.sourceUri === candidate.sourceUri) {
    return true;
  }
  return candidate.configuredResource !== undefined
    && existing.configuredResource?.group === candidate.configuredResource.group
    && existing.configuredResource?.path === candidate.configuredResource.path;
}

/**
 * An attachment restaged from its reference, with a tile's source key rebuilt
 * from its ids and a selection's from its snapshot id; anything else as it is.
 */
export function withWorkshopMessageAttachmentSourceKey<T extends WorkshopMessageAttachmentSource>(attachment: T): T {
  if (attachment.lightboxTile) {
    return { ...attachment, sourceUri: workshopLightboxTileSourceKey(attachment.lightboxTile) };
  }
  return attachment.selectedText
    ? { ...attachment, sourceUri: workshopSelectedTextSourceKey(attachment.selectedText) }
    : attachment;
}

/**
 * A development checkpoint's pending list with each Lightbox tile once (its
 * first copy) and every tile keyed, and what that changed. Before PR #151
 * F-01 a rewind could restage a tile beside a copy already waiting, without
 * its key; hydration repairs such a checkpoint (`WorkshopSessionCheckpointNormalization`).
 * Files and configured resources are left exactly as they are.
 */
export function repairPendingLightboxTiles<T extends WorkshopMessageAttachmentSource>(
  pending: readonly T[]
): { pending: T[]; droppedDuplicates: boolean; restoredKeys: boolean } {
  const kept: T[] = [];
  let droppedDuplicates = false;
  let restoredKeys = false;
  for (const attachment of pending) {
    if (!attachment.lightboxTile) {
      kept.push(attachment);
      continue;
    }
    if (kept.some((existing) => sameWorkshopMessageAttachmentSource(attachment, existing))) {
      droppedDuplicates = true;
      continue;
    }
    const keyed = withWorkshopMessageAttachmentSourceKey(attachment);
    restoredKeys ||= keyed.sourceUri !== attachment.sourceUri;
    kept.push(keyed);
  }
  return { pending: kept, droppedDuplicates, restoredKeys };
}
