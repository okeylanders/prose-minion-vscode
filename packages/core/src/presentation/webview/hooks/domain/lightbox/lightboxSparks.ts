/**
 * The Spark lane, as the webview draws it (ADR 2026-10-19 D7; Slice 4).
 * Pure: no React, no transport.
 *
 * The host's board decides which sparks are set aside (each carries its
 * `dismissedOrder`); this only sorts them for the lane: the sparks on show in
 * reading order, and those set aside latest first, so Undo brings back the
 * latest. A spark set aside is not a board item: it is not drawn, lit, pinned
 * or offered as touching a paragraph until it is brought back.
 */

import type { LightboxBoard, LightboxReadingTile, LightboxSparkTile } from '@messages';
import { lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';

export interface LightboxSparkLaneView {
  /** In reading order. */
  shown: LightboxSparkTile[];
  /** Latest set aside first. */
  setAside: LightboxSparkTile[];
}

export function lightboxSparkLane(board: LightboxBoard): LightboxSparkLaneView {
  const sparks = lightboxTilesOfKind(board, 'spark');
  return {
    shown: sparks.filter((spark) => spark.dismissedOrder === undefined),
    setAside: sparks
      .filter((spark) => spark.dismissedOrder !== undefined)
      .sort((a, b) => (b.dismissedOrder ?? 0) - (a.dismissedOrder ?? 0))
  };
}

/** Whether the tile is a spark the writer set aside. */
export function lightboxIsSetAside(tile: LightboxReadingTile): boolean {
  return tile.kind === 'spark' && tile.dismissedOrder !== undefined;
}
