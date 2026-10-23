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
 *   another preset or average, a section moved (its `basis` differs);
 * - its citations were made under another basis rule than this build's
 *   (`board.rules.opinionBasis`; Slice 5A). A board saved by a build with
 *   another rule still opens whole: a saved board only ever loses standing,
 *   never the board (the writer-data rule, epic decision 32). Its bases are
 *   then not compared, since the two rules' bases never match.
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
import {
  lightboxOpinionItemMap,
  lightboxOpinionItems,
  type LightboxOpinionBoard,
  type LightboxOpinionItem
} from '@shared/constants/lightboxOpinionItems';
import { LIGHTBOX_OPINION_BASIS_RULE_ID } from '@shared/constants/lightboxOpinionBasis';

/**
 * Host words: nothing on the board is read and current, so group F has
 * nothing to weigh and nothing is sent (Slice 4D). The Opinion's Analyze
 * says so instead of running (Slice 4I).
 */
export const LIGHTBOX_OPINION_NOTHING_TO_WEIGH =
  'Nothing on the board is read and current, so the Opinion has nothing to weigh. Analyze another call first, then the Opinion.';

/**
 * Why the Opinion cannot be read on this board now, or `undefined` when it
 * can: the reason when no reading tile the digest would hold is current
 * (`lightboxOpinionItems`' own rule: a tile of a chapter group, not a spark,
 * whose lens is neither stale nor being read again). The host reads it
 * before a press of group F alone, and the webview before drawing the
 * Opinion's Analyze (Slice 4I); the call's own check, when it opens on the
 * digest, stays the last word (`LightboxOpinionCall`).
 */
export function lightboxOpinionNothingToWeigh(board: Pick<LightboxOpinionBoard, 'readings'>): string | undefined {
  const current = lightboxOpinionItems({ readings: board.readings }).some((item) => item.kind === 'tile' && item.current);
  return current ? undefined : LIGHTBOX_OPINION_NOTHING_TO_WEIGH;
}

/** Host words for an Opinion cited under another basis rule: its standing note, and why Bring is refused. */
export const LIGHTBOX_OPINION_EARLIER_RULE = 'Saved under an earlier citation rule; read the Opinion again to bring it current.';

/**
 * An observation's key: `O` and a number from 1, unique in its block. The
 * prompt asks for `O1` to `O6`; more observations than asked are read and
 * shown (Slice 4H), so the grammar takes up to `O99`, far past the safety
 * ceiling's count of observations. The codec, the Opinion's text rules and
 * the webview's item refs all read this one pattern.
 */
export const LIGHTBOX_OPINION_OBSERVATION_ID = /^O[1-9]\d?$/;

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
  /** Its citations were made under another basis rule than this build's: stale, and its bases not compared. */
  earlierRule: boolean;
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
  const earlierRule = board.rules !== undefined && board.rules.opinionBasis !== LIGHTBOX_OPINION_BASIS_RULE_ID;
  // Under another rule every basis differs, so none is compared: the rule alone makes it stale.
  const changed = earlierRule ? [] : tile.observations
    .filter((observation) => observation.cites.some((cite) => {
      const now = items.get(cite.item);
      return !now || !now.current || now.basis !== cite.basis;
    }))
    .map((observation) => observation.id);
  const stale = earlierRule || readEarlier || changed.length > 0;
  const note = earlierRule
    ? LIGHTBOX_OPINION_EARLIER_RULE
    : readEarlier
      ? 'Read against an earlier version of this chapter, and on the readings of that version. Re-analyze the Opinion to weigh the board as it stands.'
      : changed.length > 0
        ? `Something it cites changed since it was read (${changed.join(', ')}): a tile was read again or withheld, a lens went stale, ` +
          'or a figure was measured again. Re-analyze the Opinion to weigh the board as it stands.'
        : undefined;
  return { stale, readEarlier, reading, earlierRule, changed, ...(note ? { note } : {}) };
}
