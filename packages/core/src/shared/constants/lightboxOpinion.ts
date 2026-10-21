/**
 * The Opinion's shared tables and its standing (ADR 2026-10-19 D7
 * addendum; Slice 4D). Pure: no host, no I/O. Shared by the host (Bring,
 * the landing log) and the renderer (the tile, the inspector), so both say
 * the same thing from the same board.
 *
 * **Standing.** The Opinion is the one tile that reads other tiles, so it
 * is stale when anything it cites is no longer what it read, decided only
 * from the board as it stands, never from old ids:
 * - its own lens was read against an earlier text (the carry marks it, as
 *   every carried lens);
 * - a tile it cites is gone (re-read: new ids; withheld; a lens turned off
 *   and read again), stale, or being read again;
 * - an item it cites says something else now: a figure measured again under
 *   another preset or average, a section moved (its `basis` differs).
 * An uncited change leaves it current. Nothing else on the board reads the
 * Opinion, so ignoring it changes nothing.
 */

import type {
  LightboxBoard,
  LightboxOpinionTile,
  LightboxOpinionView,
  LightboxOpinionViewId,
  LightboxOpinionWeight
} from '@messages';
import { LIGHTBOX_BOARD_GROUP } from '@shared/constants/lightbox';
import { lightboxOpinionItemMap, type LightboxOpinionBoard, type LightboxOpinionItem } from '@shared/constants/lightboxOpinionItems';

/** The tabs, in order. */
export const LIGHTBOX_OPINION_VIEWS: readonly LightboxOpinionViewId[] = ['enthusiastic', 'neutral', 'blunt'];

/** The view shown first (epic decision 15). */
export const LIGHTBOX_OPINION_DEFAULT_VIEW: LightboxOpinionViewId = 'neutral';

export const LIGHTBOX_OPINION_VIEW_LABELS: Readonly<Record<LightboxOpinionViewId, { label: string; sub: string }>> = {
  enthusiastic: { label: 'Enthusiastic', sub: 'what is working' },
  neutral: { label: 'Neutral', sub: 'weighed evenly' },
  blunt: { label: 'Blunt', sub: 'what costs the most' }
};

export const LIGHTBOX_OPINION_WEIGHTS: readonly LightboxOpinionWeight[] = ['strength', 'even', 'concern'];

export const LIGHTBOX_OPINION_WEIGHT_LABELS: Readonly<Record<LightboxOpinionWeight, string>> = {
  strength: 'Strength',
  even: 'Even',
  concern: 'Concern'
};

/** The chip the tile wears beside its register (ADR D7 addendum). */
export const LIGHTBOX_OPINION_CHIP = 'The one evaluative tile';

/** What the tile always says about itself, under its views. */
export const LIGHTBOX_OPINION_RULE =
  'Same facts, three temperaments. Each view may weigh only the observations below, and code withholds a view that cites anything else.';

export function isLightboxOpinionView(value: unknown): value is LightboxOpinionViewId {
  return typeof value === 'string' && (LIGHTBOX_OPINION_VIEWS as readonly string[]).includes(value);
}

/** The view a tile opens on: Neutral when it stands, else the first view that does. */
export function lightboxOpinionDefaultView(tile: Pick<LightboxOpinionTile, 'views'>): LightboxOpinionViewId {
  return tile.views.some((view) => view.view === LIGHTBOX_OPINION_DEFAULT_VIEW)
    ? LIGHTBOX_OPINION_DEFAULT_VIEW
    : tile.views[0]?.view ?? LIGHTBOX_OPINION_DEFAULT_VIEW;
}

export function lightboxOpinionView(
  tile: Pick<LightboxOpinionTile, 'views'>,
  view: LightboxOpinionViewId
): LightboxOpinionView | undefined {
  return tile.views.find((candidate) => candidate.view === view);
}

/** The board's Opinion tile, if one is drawn. */
export function lightboxOpinionTile(board: Pick<LightboxBoard, 'readings'>): LightboxOpinionTile | undefined {
  return board.readings
    .find((group) => group.group === LIGHTBOX_BOARD_GROUP)
    ?.tiles.find((tile): tile is LightboxOpinionTile => tile.kind === 'opinion');
}

export interface LightboxOpinionStanding {
  /** Read against an earlier text, or something it cites changed since: not current. */
  stale: boolean;
  /** Its own lens was read against an earlier version of the text (D4). */
  readEarlier: boolean;
  /** The Opinion is being read again now. */
  reading: boolean;
  /** Observations whose cited items are gone, stale, being read again or changed, by id. */
  changed: string[];
  /** Host words: why it is stale, for the tile, the inspector and Bring. */
  note?: string;
}

/**
 * Whether the Opinion still stands on the board as it is (see the module
 * note). `items` may be passed when the caller has built them already.
 */
export function lightboxOpinionStanding(
  tile: Pick<LightboxOpinionTile, 'observations'>,
  board: LightboxOpinionBoard,
  items: ReadonlyMap<string, LightboxOpinionItem> = lightboxOpinionItemMap(board)
): LightboxOpinionStanding {
  const group = board.readings.find((candidate) => candidate.group === LIGHTBOX_BOARD_GROUP);
  const readEarlier = group?.staleLenses?.some((mark) => mark.lens === 'opinion') ?? false;
  const reading = group?.status === 'running' && (group.pending?.includes('opinion') ?? false);
  const changed = tile.observations
    .filter((observation) => observation.cites.some((cite) => {
      const now = items.get(cite.item);
      return !now || !now.current || now.basis !== cite.basis;
    }))
    .map((observation) => observation.id);
  const stale = readEarlier || changed.length > 0;
  const note = readEarlier
    ? 'Read against an earlier version of this chapter, and on the readings of that version. Re-read the Opinion to weigh the board as it stands.'
    : changed.length > 0
      ? `Something it cites changed since it was read (${changed.join(', ')}): a tile was read again or withheld, a lens went stale, ` +
        'or a figure was measured again. Re-read the Opinion to weigh the board as it stands.'
      : undefined;
  return { stale, readEarlier, reading, changed, ...(note ? { note } : {}) };
}
