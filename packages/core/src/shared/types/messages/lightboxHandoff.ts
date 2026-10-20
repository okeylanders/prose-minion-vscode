/**
 * Lightbox handoffs to the Workshop (ADR 2026-10-19 D11; Slice 3).
 *
 * The Lightbox never changes the Workshop's state. It asks its own host to
 * hand something over (`LIGHTBOX_HAND_OFF`, naming a tile on the board it
 * shows); the host resolves the tile on the current board, refuses a stale
 * board or a withheld field, re-checks the quotes against the current text
 * and builds a bounded handoff from counted facts. The composition root
 * passes it to the Workshop panel, which routes it through the Workshop's
 * own message path. The Workshop decides what arrives: for a borrowed field,
 * Lexical Gravity's Build lens, prefilled, and nothing built until the
 * writer presses Build.
 */

import { MessageEnvelope, MessageType } from './base';
import type { WorkshopLexicalGravityBuildSeed } from './workshop/lexicalGravity';
import type { WorkshopSeedFailure, WorkshopSeedOutcome } from './workshop/seedDelivery';

/** What the Lightbox can hand over. Slice 3: a borrowed field, as a lens to build. */
export type LightboxHandOffKind = 'lexical-gravity-seed';

/** The webview names a tile on the board it shows; everything else is resolved by the host. */
export interface LightboxHandOffPayload {
  kind: LightboxHandOffKind;
  boardId: string;
  /** The host-minted id of the gravity-field tile. */
  fieldId: string;
}

export interface LightboxHandOffMessage extends MessageEnvelope<LightboxHandOffPayload> {
  type: MessageType.LIGHTBOX_HAND_OFF;
}

export interface LightboxHandOffResultPayload extends LightboxHandOffPayload {
  ok: boolean;
  /** Writer-facing: where it went, or why it did not. */
  message: string;
}

export interface LightboxHandOffResultMessage extends MessageEnvelope<LightboxHandOffResultPayload> {
  type: MessageType.LIGHTBOX_HAND_OFF_RESULT;
}

/**
 * What the host gives the composition root (`uiActions.handOffToWorkshop`).
 * Built host-side from the current board: verified quotes, counted terms.
 */
export type LightboxWorkshopHandoff = {
  kind: 'lexical-gravity-seed';
  seed: WorkshopLexicalGravityBuildSeed;
};

/**
 * Why a handoff did not open in the Workshop: the Workshop's seed-delivery
 * failure (`seedDelivery.ts`; PR #150 F-03).
 */
export type LightboxWorkshopHandoffRefusal = WorkshopSeedFailure;

/**
 * What the composition root learns from the Workshop: opened by a visible
 * Workshop that claimed the seed, or why not.
 */
export type LightboxWorkshopHandoffOutcome = WorkshopSeedOutcome;
