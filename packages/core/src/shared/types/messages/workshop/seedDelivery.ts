/**
 * Seed delivery: something handed over from another tab opens in the
 * Workshop only while the panel that accepted it still wants it (PR #150
 * F-03; ADR 2026-10-19 D11).
 *
 * The host offers a seed to one Workshop panel and routes it through that
 * panel's own message path with a delivery id. The webview never opens a
 * seed on arrival. It claims it (`WORKSHOP_SEED_CLAIM`), and the panel
 * provider grants the claim only while that delivery is still the one it is
 * waiting on for that panel (`WORKSHOP_SEED_CLAIM_RESULT`). A seed that
 * timed out, was replaced or lost its panel is denied and dropped, so it can
 * never open late, even when its message was already on its way. After a
 * grant the webview opens the seed, or refuses it as `busy` because a sheet
 * the writer is using is open, and answers (`WORKSHOP_SEED_ANSWER`); the
 * answer settles the handoff the sender is waiting on.
 *
 * Each webview realm announces itself (`WORKSHOP_SEED_RECEIVER`) once its
 * listeners are attached, and names its receiver id in every claim and
 * answer (PR #150 F-08). A seed is sent only after an announcement, and a
 * new receiver on the same panel releases whatever was granted to the old
 * one, as `reset`, so a webview reloaded mid-handoff never strands the
 * queue. A grant is the commit point; the 20-second deadline covers
 * unclaimed seeds only, and a granted seed waits for an answer, the panel
 * closing, or a receiver reset.
 *
 * Every kind of seed runs the same protocol. Slice 3 has one kind, a Build
 * lens subject handed over from the Lightbox; Slice 4 adds a Lightbox tile,
 * staged above the composer (`lightboxTiles.ts`). A new kind joins
 * `WorkshopSeedKind`.
 */

import { MessageEnvelope, MessageType } from '../base';

/** What a seed opens in the Workshop. */
export type WorkshopSeedKind = 'lexical-gravity-build' | 'lightbox-tile';

/**
 * Why the Workshop did not open a granted seed:
 * - `busy`: a sheet the writer is using is open (Build lens), or the room is
 *   busy: a response is running, or the session is being saved or replaced
 *   (a staged tile);
 * - `full`: the next message already carries as many attachments as one may;
 * - `duplicate`: that tile is already waiting above the composer.
 */
export type WorkshopSeedRefusal = 'busy' | 'full' | 'duplicate';

/**
 * Why the provider denied a claim: the seed timed out, a newer one replaced
 * it, its panel closed, its receiver was replaced (`reset`), or the provider
 * does not know the delivery.
 */
export type WorkshopSeedClaimDenial = 'timeout' | 'replaced' | 'closed' | 'reset' | 'unknown';

/**
 * Why a seed did not open, as the sender learns it:
 * - `unavailable`: no Workshop panel could take it;
 * - `busy`, `full`, `duplicate`: the Workshop refused it (`WorkshopSeedRefusal`);
 * - `closed`: the panel closed before it opened the seed;
 * - `replaced`: a newer seed replaced it before it was claimed;
 * - `timeout`: the Workshop did not claim it in time;
 * - `reset`: the Workshop's webview was replaced (reloaded) after it was
 *   granted, before it answered (PR #150 F-08).
 */
export type WorkshopSeedFailure = 'unavailable' | WorkshopSeedRefusal | 'closed' | 'replaced' | 'timeout' | 'reset';

/** What the sender learns: a visible Workshop opened the seed, or why not. */
export type WorkshopSeedOutcome =
  | { opened: true }
  | { opened: false; reason: WorkshopSeedFailure };

/** A webview realm's id: minted when its Workshop mounts, at most 80 characters. */
export interface WorkshopSeedReceiverPayload {
  receiver: string;
}

/** Webview to its panel provider, once its listeners are attached: I am this panel's receiver now. Never reaches a domain handler. */
export interface WorkshopSeedReceiverMessage extends MessageEnvelope<WorkshopSeedReceiverPayload> {
  type: MessageType.WORKSHOP_SEED_RECEIVER;
}

export interface WorkshopSeedClaimPayload {
  kind: WorkshopSeedKind;
  deliveryId: string;
  /** The receiver claiming it. */
  receiver: string;
}

/** Webview to its panel provider: may I open this seed? Never reaches a domain handler. */
export interface WorkshopSeedClaimMessage extends MessageEnvelope<WorkshopSeedClaimPayload> {
  type: MessageType.WORKSHOP_SEED_CLAIM;
}

export type WorkshopSeedClaimResultPayload =
  | { kind: WorkshopSeedKind; deliveryId: string; granted: true }
  | { kind: WorkshopSeedKind; deliveryId: string; granted: false; reason: WorkshopSeedClaimDenial };

/** Panel provider to its webview: open the seed, or drop it without touching anything. */
export interface WorkshopSeedClaimResultMessage extends MessageEnvelope<WorkshopSeedClaimResultPayload> {
  type: MessageType.WORKSHOP_SEED_CLAIM_RESULT;
}

/** The webview's answer to a granted seed, by delivery id. */
export type WorkshopSeedAnswer =
  | { deliveryId: string; opened: true }
  | { deliveryId: string; opened: false; reason: WorkshopSeedRefusal };

export type WorkshopSeedAnswerPayload = WorkshopSeedAnswer & { kind: WorkshopSeedKind; receiver: string };

/** Webview to its panel provider: the granted seed opened, or not and why. Never reaches a domain handler. */
export interface WorkshopSeedAnswerMessage extends MessageEnvelope<WorkshopSeedAnswerPayload> {
  type: MessageType.WORKSHOP_SEED_ANSWER;
}
