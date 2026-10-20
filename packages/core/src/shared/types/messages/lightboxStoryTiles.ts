/**
 * Lightbox lineage, subtext and Spark readings (ADR 2026-10-19 D3, D7;
 * Slice 4): what lies under and around the prose.
 *
 * **Lineage.** Adjacent myths and stories, each marked against quoted
 * evidence with how the chapter stands to it: it matches, departs from or
 * subverts the story. A stance outside those three withholds the item. The
 * reading also says which stories it checked and set aside, and why (kept
 * with the lens's friction, `LightboxLensFriction.setAside`), and finding no
 * echo is an honest result.
 *
 * **Subtext.** Said and meant pairs. The *said* side is a quote the host
 * found in the paragraph named and found inside quoted dialogue there
 * (`findDialogueSpans`); the *meant* side is the tile's `claim`, a reading
 * the board labels as one.
 *
 * **Spark.** Open doors: offers phrased as questions, never instructions.
 * Each stands on terms the host counted in the chapter and on quotes it
 * found, so every spark has counted support and paragraph addresses. Sparks
 * are drawn in a lane of their own, and the writer can set one aside ("Not
 * for me") and bring it back.
 *
 * Every tile here is a reading tile: host-minted ids and paragraphs, quotes
 * the host found, and a friction (`lightboxReadings.ts`).
 */

import { MessageEnvelope, MessageType } from './base';
import type { LightboxReadingTileBase, LightboxVerifiedQuote } from './lightboxReadings';

/** How the chapter stands to an adjacent story. */
export type LightboxLineageStance = 'matches' | 'departs' | 'subverts';

/** One way the chapter stands to the story, in a line. Each stance appears at most once per story. */
export interface LightboxLineageStanceNote {
  stance: LightboxLineageStance;
  note: string;
}

export interface LightboxLineageTile extends LightboxReadingTileBase {
  kind: 'lineage';
  /** Where the story comes from ("Greek myth", "1 Samuel 3"), as the reading names it. */
  source: string;
  /** One to three stances, each different, in the order the reading gave them. */
  stances: LightboxLineageStanceNote[];
}

/** A story the lineage reading checked and set aside, with its reason. */
export interface LightboxLineageSetAside {
  title: string;
  reason: string;
}

/**
 * A said/meant pair. `claim` is the meant side, a reading; `said` is the
 * line as the chapter has it, found inside dialogue in its paragraph, and is
 * also the first entry of `evidence`.
 */
export interface LightboxSubtextTile extends LightboxReadingTileBase {
  kind: 'subtext';
  /** Who says it, as the chapter names them. */
  speaker: string;
  said: LightboxVerifiedQuote;
}

/**
 * An open door: `claim` is the question the reading offers. `title` is its
 * short label. Its counted support is the host's count of the terms it
 * names; at least one of them is in the chapter.
 */
export interface LightboxSparkTile extends LightboxReadingTileBase {
  kind: 'spark';
  /**
   * Set when the writer said "Not for me": the host's ascending order of
   * dismissals on this board, so Undo brings back the latest first. The
   * spark stays on the board (a stale carry keeps it), drawn as set aside.
   */
  dismissedOrder?: number;
}

/**
 * "Not for me", and its Undo: set a spark on the board on screen aside, or
 * bring it back. The host marks the board's own tile and answers with the
 * board; the webview keeps no dismissal state of its own.
 */
export interface LightboxSetSparkDismissedPayload {
  boardId: string;
  tileId: string;
  dismissed: boolean;
}

export interface LightboxSetSparkDismissedMessage extends MessageEnvelope<LightboxSetSparkDismissedPayload> {
  type: MessageType.LIGHTBOX_SET_SPARK_DISMISSED;
}
