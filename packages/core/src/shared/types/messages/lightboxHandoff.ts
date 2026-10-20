/**
 * Lightbox handoffs to the Workshop (ADR 2026-10-19 D11; Slices 3 and 4).
 *
 * The Lightbox never changes the Workshop's state. It asks its own host to
 * hand something over (`LIGHTBOX_HAND_OFF`, naming an item on the board it
 * shows, by id only); the host resolves the item on the current board,
 * refuses a stale board or a withheld item, re-checks the quotes against the
 * current text and builds a bounded handoff itself. The composition root
 * passes it to the Workshop panel, which routes it through the Workshop's
 * own message path. The Workshop decides what arrives:
 * - a borrowed field (Slice 3): Lexical Gravity's Build lens, prefilled, and
 *   nothing built until the writer presses Build;
 * - a reading tile (Slice 4): a pending attachment above the composer, its
 *   claim and verified quotes only, and nothing sent until the writer sends.
 *
 * The tray (`LIGHTBOX_WORKSHOP_TRAY`) is what the Workshop holds: the
 * Lightbox tiles waiting above its composer, each staged only on the
 * Workshop's own confirmation.
 */

import { MessageEnvelope, MessageType } from './base';
import type { WorkshopLexicalGravityBuildSeed } from './workshop/lexicalGravity';
import type { WorkshopLightboxTile } from './workshop/lightboxTiles';
import type { WorkshopSeedFailure, WorkshopSeedOutcome } from './workshop/seedDelivery';

/** What the Lightbox can hand over: a borrowed field as a lens to build (Slice 3), or a reading tile (Slice 4). */
export type LightboxHandOffKind = 'lexical-gravity-seed' | 'tile';

/** The webview names an item on the board it shows, by id; everything else is resolved by the host. */
export type LightboxHandOffPayload =
  | {
      kind: 'lexical-gravity-seed';
      boardId: string;
      /** The host-minted id of the gravity-field tile. */
      fieldId: string;
    }
  | {
      kind: 'tile';
      boardId: string;
      /** The host-minted id of a reading tile. */
      tileId: string;
    };

export interface LightboxHandOffMessage extends MessageEnvelope<LightboxHandOffPayload> {
  type: MessageType.LIGHTBOX_HAND_OFF;
}

export type LightboxHandOffResultPayload = LightboxHandOffPayload & {
  ok: boolean;
  /** Writer-facing: where it went, or why it did not. */
  message: string;
};

export interface LightboxHandOffResultMessage extends MessageEnvelope<LightboxHandOffResultPayload> {
  type: MessageType.LIGHTBOX_HAND_OFF_RESULT;
}

/**
 * What the host gives the composition root (`uiActions.handOffToWorkshop`).
 * Built host-side from the current board: verified quotes, counted terms.
 */
export type LightboxWorkshopHandoff =
  | { kind: 'lexical-gravity-seed'; seed: WorkshopLexicalGravityBuildSeed }
  | { kind: 'tile'; tile: WorkshopLightboxTile };

/**
 * Why a handoff did not open in the Workshop: the Workshop's seed-delivery
 * failure (`seedDelivery.ts`; PR #150 F-03).
 */
export type LightboxWorkshopHandoffRefusal = WorkshopSeedFailure;

/**
 * What the composition root learns from the Workshop: opened (for a tile,
 * staged) by a visible Workshop that claimed the seed, or why not.
 */
export type LightboxWorkshopHandoffOutcome = WorkshopSeedOutcome;

/** One Lightbox tile waiting above the Workshop composer. */
export interface LightboxWorkshopTrayTile {
  boardId: string;
  tileId: string;
  /** The pill's label in the Workshop. */
  label: string;
}

/**
 * The tiles bound for the Workshop: Lightbox tiles waiting above its
 * composer in the current room, whichever board they came from. A tile
 * leaves when the writer sends it or removes it there, or the room is
 * replaced; closing the Workshop tab keeps them, since they are session state.
 */
export interface LightboxWorkshopTrayPayload {
  tiles: LightboxWorkshopTrayTile[];
}

export interface LightboxWorkshopTrayMessage extends MessageEnvelope<LightboxWorkshopTrayPayload> {
  type: MessageType.LIGHTBOX_WORKSHOP_TRAY;
}

/** The tray's "Open Workshop →". Zero payload. */
export interface LightboxOpenWorkshopMessage extends MessageEnvelope<Record<string, never>> {
  type: MessageType.LIGHTBOX_OPEN_WORKSHOP;
}
