/**
 * A Lightbox reading brought to the Workshop (ADR 2026-10-19 D11; Slice 4).
 *
 * The Lightbox's host resolves a tile on its current board, checks its quotes
 * again against the chapter, and hands the Workshop this bounded item: the
 * claim and its verified quotes, never the board. The Workshop panel's
 * provider offers it through the claim-before-open seed delivery
 * (`seedDelivery.ts`), kind `lightbox-tile`:
 *
 * 1. host to host: `WORKSHOP_STAGE_LIGHTBOX_TILE` through the panel's own
 *    MessageHandler; the Workshop's handler checks the item, holds it, and
 *    tells its webview a tile is waiting (`WORKSHOP_LIGHTBOX_TILE_OFFERED`);
 * 2. the webview claims it; the provider grants the claim only while that
 *    delivery is still current;
 * 3. after a grant the webview accepts it (`WORKSHOP_ACCEPT_LIGHTBOX_TILE`),
 *    and the handler stages it as a pending message attachment, above the
 *    composer, or refuses it (`WORKSHOP_LIGHTBOX_TILE_STAGED`);
 * 4. the webview answers the provider: staged, or why not.
 *
 * Staged, the tile is ordinary session state: a one-shot attachment the
 * writer sends with a message or removes, in a `lightbox-tile`
 * thread-artifact frame. Nothing reaches a model until the writer sends.
 */

import { MessageEnvelope, MessageType } from '../base';
import type { WorkshopSeedRefusal } from './seedDelivery';

/** One quote as code found it in the chapter, in the paragraph named. */
export interface WorkshopLightboxTileQuote {
  /** 1-based. */
  paragraph: number;
  text: string;
  /** A subtext pair's said line. */
  said?: true;
}

/** A point the claim makes in its own right: a lineage story's stance, labeled. */
export interface WorkshopLightboxTilePoint {
  label: string;
  text: string;
}

/** The item a tile handoff carries; built by the Lightbox host, checked again on arrival. */
export interface WorkshopLightboxTile {
  origin: 'lightbox';
  /** Host-minted ids of the board and the tile: what makes a staged tile "already staged". */
  boardId: string;
  tileId: string;
  /** What kind of reading it is ("Motif", "Adjacent story"), as the Lightbox names it. */
  kindLabel: string;
  /** The lens ("Theme & motif"). */
  lensLabel: string;
  title: string;
  /** The reading's claim: a model's, which the frame says. */
  claim: string;
  points: WorkshopLightboxTilePoint[];
  /** At least one, each found again in the chapter when the tile was brought. */
  quotes: WorkshopLightboxTileQuote[];
  /** The chapter the reading was made of (its display path). */
  sourceLabel: string;
}

/** The bounds a tile item is held to, on both sides. */
export const WORKSHOP_LIGHTBOX_TILE_LIMITS = {
  idCharacters: 120,
  labelCharacters: 60,
  titleCharacters: 120,
  claimCharacters: 320,
  points: 3,
  pointLabelCharacters: 20,
  pointCharacters: 120,
  quotes: 4,
  quoteCharacters: 240,
  sourceLabelCharacters: 500,
  /** The attachment pill's label. */
  attachmentLabelCharacters: 120
} as const;

/**
 * What a staged tile shows on its pill and its sent turn: display-safe, no
 * claim text. Its ids say which tile it is, for the Lightbox's tray.
 */
export interface WorkshopLightboxTileAttachmentMeta {
  boardId: string;
  tileId: string;
  kindLabel: string;
  /** Quotes it carries, all found in the chapter. */
  quotes: number;
  sourceLabel: string;
}

/** Host to host: the panel provider's synthetic offer. Never posted by a webview. */
export interface WorkshopStageLightboxTilePayload {
  tile: WorkshopLightboxTile;
  /** The provider's, one per offer: the claim, the accept and the answer name it. */
  deliveryId: string;
}

export interface WorkshopStageLightboxTileMessage extends MessageEnvelope<WorkshopStageLightboxTilePayload> {
  type: MessageType.WORKSHOP_STAGE_LIGHTBOX_TILE;
}

/** Handler to its webview: a tile is waiting; claim it before anything is staged. */
export interface WorkshopLightboxTileOfferedPayload {
  deliveryId: string;
}

export interface WorkshopLightboxTileOfferedMessage extends MessageEnvelope<WorkshopLightboxTileOfferedPayload> {
  type: MessageType.WORKSHOP_LIGHTBOX_TILE_OFFERED;
}

/**
 * Webview to its handler, after a granted claim: stage the tile held for this
 * delivery. The panel provider lets it through only while that delivery is
 * granted to `receiver` (PR #151 F-06).
 */
export interface WorkshopAcceptLightboxTilePayload {
  deliveryId: string;
  /** The webview realm that holds the grant (`WORKSHOP_SEED_RECEIVER`). */
  receiver: string;
}

export interface WorkshopAcceptLightboxTileMessage extends MessageEnvelope<WorkshopAcceptLightboxTilePayload> {
  type: MessageType.WORKSHOP_ACCEPT_LIGHTBOX_TILE;
}

/** Handler to its webview: the tile is above the composer, or why not; the webview answers the provider with it. */
export type WorkshopLightboxTileStagedPayload =
  | { deliveryId: string; staged: true; attachmentId: string }
  | { deliveryId: string; staged: false; reason: WorkshopSeedRefusal };

export interface WorkshopLightboxTileStagedMessage extends MessageEnvelope<WorkshopLightboxTileStagedPayload> {
  type: MessageType.WORKSHOP_LIGHTBOX_TILE_STAGED;
}
