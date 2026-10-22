/**
 * The Spark lane's "Not for me" (ADR 2026-10-19 D7; Slice 4). Pure: no host,
 * no I/O.
 *
 * **The host owns dismissal.** A spark set aside is marked on the board's own
 * tile (`LightboxSparkTile.dismissedOrder`), in the retained board the
 * service keeps per source, so a hidden tab, a reloaded webview, or a switch
 * to another source and back all find it still set aside; and the mark is
 * saved with its board. From Slice 5A.1 (epic decision 35) it is saved at
 * once: the file that holds the board takes the board's marks in place
 * (`carryLightboxSparkMarks`), and a board no file holds yet takes them with
 * its next save. The webview keeps no dismissal state of its own: it asks,
 * and shows what the board says.
 *
 * - The order is the board's own: one more than the highest order on it, so
 *   Undo can bring back the latest first, from any webview, after a reload.
 * - Only a spark on the board can be set aside or brought back. A withheld
 *   spark has no tile, and a full run of its group clears the group first,
 *   so a dismissal of a spark a run has replaced is refused, not misapplied.
 * - **Stale boards.** Setting a spark aside is the writer's preference, not a
 *   claim, so it is allowed on a stale board, and a stale carry keeps the
 *   mark (the tile keeps its id and its words). A carried spark the gates
 *   withhold has no tile and so no mark. A fresh reading of the Spark lens
 *   draws new sparks with new ids, none set aside.
 */

import type { LightboxReadingGroup, LightboxReadingTile, LightboxSparkTile } from '@messages';

/** Writer-facing refusals. */
export const LIGHTBOX_SPARK_LANE_REFUSALS = {
  unknown: 'That is not a spark the Lightbox can set aside or bring back.',
  boardChanged: 'The board changed. Set sparks aside on the board on screen.',
  notOnBoard: 'That spark is not on the board: it was withheld, or the Spark lens was read again since.'
} as const;

export type LightboxSparkDismissal =
  | { ok: true; changed: boolean; readings: LightboxReadingGroup[] }
  | { ok: false; reason: string };

/** The request as the webview sent it, or undefined when the host does not understand it. */
export function parseLightboxSparkDismissal(
  payload: unknown
): { boardId: string; tileId: string; dismissed: boolean } | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const { boardId, tileId, dismissed } = payload as Record<string, unknown>;
  return typeof boardId === 'string' && boardId.length > 0 && typeof tileId === 'string' && tileId.length > 0
    && typeof dismissed === 'boolean'
    ? { boardId, tileId, dismissed }
    : undefined;
}

/** Set the spark aside (or bring it back) on these readings; unchanged when it already is. */
export function setLightboxSparkDismissed(
  readings: readonly LightboxReadingGroup[],
  tileId: string,
  dismissed: boolean
): LightboxSparkDismissal {
  const spark = readings.flatMap((group) => group.tiles).find((tile): tile is LightboxSparkTile =>
    tile.id === tileId && tile.kind === 'spark');
  if (!spark) {
    return { ok: false, reason: LIGHTBOX_SPARK_LANE_REFUSALS.notOnBoard };
  }
  if ((spark.dismissedOrder !== undefined) === dismissed) {
    return { ok: true, changed: false, readings: [...readings] };
  }
  const order = dismissed ? highestOrder(readings) + 1 : undefined;
  const mark = (tile: LightboxReadingTile): LightboxReadingTile => {
    if (tile.id !== tileId || tile.kind !== 'spark') {
      return tile;
    }
    const { dismissedOrder: _previous, ...rest } = tile;
    return order === undefined ? rest : { ...rest, dismissedOrder: order };
  };
  return {
    ok: true,
    changed: true,
    readings: readings.map((group) =>
      group.tiles.some((tile) => tile.id === tileId) ? { ...group, tiles: group.tiles.map(mark) } : group)
  };
}

/**
 * The board's set-aside marks carried onto `saved`, the readings of the file
 * that holds it (Slice 5A.1): each spark the file holds takes the mark the
 * same spark has on the board, its order included. A spark the file does not
 * hold is left for the board's next save. Undefined when nothing changes.
 */
export function carryLightboxSparkMarks(
  saved: readonly LightboxReadingGroup[],
  board: readonly LightboxReadingGroup[]
): LightboxReadingGroup[] | undefined {
  const marks = new Map(board.flatMap((group) => group.tiles)
    .flatMap((tile) => (tile.kind === 'spark' ? [[tile.id, tile.dismissedOrder] as const] : [])));
  let changed = false;
  const mark = (tile: LightboxReadingTile): LightboxReadingTile => {
    if (tile.kind !== 'spark' || !marks.has(tile.id) || marks.get(tile.id) === tile.dismissedOrder) {
      return tile;
    }
    changed = true;
    const { dismissedOrder: _previous, ...rest } = tile;
    const order = marks.get(tile.id);
    return order === undefined ? rest : { ...rest, dismissedOrder: order };
  };
  const readings = saved.map((group) => ({ ...group, tiles: group.tiles.map(mark) }));
  return changed ? readings : undefined;
}

function highestOrder(readings: readonly LightboxReadingGroup[]): number {
  let highest = 0;
  for (const group of readings) {
    for (const tile of group.tiles) {
      if (tile.kind === 'spark' && tile.dismissedOrder !== undefined && tile.dismissedOrder > highest) {
        highest = tile.dismissedOrder;
      }
    }
  }
  return highest;
}
