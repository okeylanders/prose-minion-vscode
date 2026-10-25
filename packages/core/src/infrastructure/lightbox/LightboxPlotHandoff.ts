/**
 * What group E's readings carry to the Workshop (ADR 2026-10-19 D11; Slice
 * 4C). Pure: no host, no I/O. Used by `LightboxTileHandoff`, which resolves
 * the tile by id on the host's current board, refuses a stale or re-reading
 * one, checks every quote again and bounds the item; this module says, per
 * kind, the order its quotes travel in, which of them it cannot travel
 * without, and its labeled points. A tile never carries the board or
 * another tile; the points it carries are host counts and host joins, plus
 * the reading's own labels.
 *
 * - **Template:** its freshness, always with "a reading, not a grade"; the
 *   basis line only when both of its halves are current
 *   (`lightboxFreshnessBasis`); its engagement per movement, by the host's
 *   numerals.
 * - **Template beat:** its stance.
 * - **Pressure thread:** where it is planted, builds and ends (resolved, or
 *   still open and carried out, dormant or not). Its plant travels first and
 *   its resolution second, so bounding never drops them, and the thread is
 *   refused rather than sent without either.
 * - **Artifact:** the host's mentions and first paragraph, its arc, and a
 *   kept "planted, unused".
 * - **Synopsis:** at least two of its quotes travel, or it is refused.
 * - **Movement** (one at a time, never the set): its range and place in the
 *   set, and its engagement while the template that reads it is current.
 *   Its boundary quote travels, or the movement is refused.
 */

import type {
  LightboxBoard,
  LightboxMovementTile,
  LightboxReadingTile,
  LightboxTemplateTile,
  WorkshopLightboxTilePoint
} from '@messages';
import {
  LIGHTBOX_ENGAGEMENT_LABELS,
  LIGHTBOX_FRESHNESS_LABEL,
  LIGHTBOX_FRESHNESS_LABELS,
  LIGHTBOX_TEMPLATE_STANCE_LABELS,
  LIGHTBOX_UNUSED_REACH,
  lightboxFreshnessBasis,
  lightboxMovementEngagement,
  lightboxMovementNumeral
} from '@shared/constants/lightboxPlot';
import { LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES } from '@/infrastructure/lightbox/LightboxPlotWire';

type Quote = { paragraph: number; text: string };
type Point = (label: string, text: string) => WorkshopLightboxTilePoint;

export const LIGHTBOX_PLOT_HANDOFF_REFUSALS = {
  threadAnchors: 'Its planted line or its resolution, as the chapter has it, cannot travel to the Workshop, so the thread was not brought. Nothing was cut.',
  synopsisQuotes: `Fewer than ${LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES} of its quotes can travel to the Workshop, so the synopsis was not brought. Nothing was cut.`,
  boundary: 'Its boundary quote, as the chapter has it, cannot travel to the Workshop, so the movement was not brought. Nothing was cut.'
} as const;

/** The order a thread's quotes travel in: its plant, its resolution, then its escalations. Undefined for other kinds. */
export function lightboxPlotTravelOrder(tile: LightboxReadingTile): readonly Quote[] | undefined {
  return tile.kind === 'pressure-thread'
    ? [tile.planted, ...(tile.resolution ? [tile.resolution] : []), ...tile.escalations]
    : undefined;
}

/** Why the bounded quotes cannot carry this tile (an anchor it cannot travel without), or undefined. */
export function lightboxPlotAnchorRefusal(tile: LightboxReadingTile, bounded: readonly Quote[]): string | undefined {
  const holds = (quote: Quote) => bounded.some((kept) => kept.paragraph === quote.paragraph && kept.text === quote.text);
  switch (tile.kind) {
    case 'pressure-thread':
      return holds(tile.planted) && (!tile.resolution || holds(tile.resolution))
        ? undefined
        : LIGHTBOX_PLOT_HANDOFF_REFUSALS.threadAnchors;
    case 'synopsis':
      return bounded.length >= LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES ? undefined : LIGHTBOX_PLOT_HANDOFF_REFUSALS.synopsisQuotes;
    case 'movement':
      return holds(tile.boundary) ? undefined : LIGHTBOX_PLOT_HANDOFF_REFUSALS.boundary;
    default:
      return undefined;
  }
}

/** A group E tile's labeled points; undefined for any other kind. */
export function lightboxPlotPoints(
  tile: LightboxReadingTile,
  board: LightboxBoard,
  point: Point
): WorkshopLightboxTilePoint[] | undefined {
  const movements = board.readings.flatMap((group) => group.tiles)
    .filter((candidate): candidate is LightboxMovementTile => candidate.kind === 'movement');
  switch (tile.kind) {
    case 'template':
      return templatePoints(tile, board, movements, point);
    case 'template-beat':
      return [point('Stance', LIGHTBOX_TEMPLATE_STANCE_LABELS[tile.stance])];
    case 'pressure-thread': {
      const ends = tile.resolution
        ? `Resolved in ¶${tile.resolution.paragraph}`
        : `Still open, carried out of the chapter${tile.dormant ? ` · dormant since ¶${tile.planted.paragraph}` : ''}`;
      return [
        point('Planted', `¶${tile.planted.paragraph}`),
        ...(tile.escalations.length > 0 ? [point('Builds', tile.escalations.map((quote) => `¶${quote.paragraph}`).join(', '))] : []),
        point('Ends', ends)
      ];
    }
    case 'artifact':
      return [
        point('Counted', `×${tile.mentions} · first ¶${tile.firstParagraph}, counted by code`),
        point('Arc', tile.claim),
        ...(tile.plantedUnused ? [point('Unused', `Planted, unused: every mention within ${LIGHTBOX_UNUSED_REACH} ¶ of its first`)] : [])
      ];
    case 'synopsis':
      return [];
    case 'movement': {
      const template = templateOf(board);
      const level = template && !lensStale(board, 'template') ? lightboxMovementEngagement(template, tile.id) : undefined;
      return [
        point('Range', `¶${tile.from}–¶${tile.to} · movement ${lightboxMovementNumeral(tile.ordinal)} of ${movements.length}`),
        ...(level ? [point('Engagement', `${LIGHTBOX_ENGAGEMENT_LABELS[level]} · a reading of pull, not tension`)] : [])
      ];
    }
    default:
      return undefined;
  }
}

function templatePoints(
  tile: LightboxTemplateTile,
  board: LightboxBoard,
  movements: readonly LightboxMovementTile[],
  point: Point
): WorkshopLightboxTilePoint[] {
  const basis = lightboxFreshnessBasis(board.readings);
  const engagement = tile.engagement
    .map((mark) => {
      const movement = movements.find((candidate) => candidate.id === mark.movementId);
      return movement ? `${lightboxMovementNumeral(movement.ordinal)} ${LIGHTBOX_ENGAGEMENT_LABELS[mark.level].toLowerCase()}` : undefined;
    })
    .filter((entry): entry is string => entry !== undefined);
  return [
    point('Freshness', `${LIGHTBOX_FRESHNESS_LABELS[tile.freshness.level]} · ${LIGHTBOX_FRESHNESS_LABEL.toLowerCase()}`),
    // The basis travels only when both halves are on the board and current.
    ...(basis.status === 'current' ? [point('Basis', basis.line)] : []),
    ...(engagement.length > 0 ? [point('Engagement', engagement.join(' · '))] : [])
  ];
}

function templateOf(board: LightboxBoard): LightboxTemplateTile | undefined {
  return board.readings.flatMap((group) => group.tiles)
    .find((candidate): candidate is LightboxTemplateTile => candidate.kind === 'template');
}

function lensStale(board: LightboxBoard, lens: LightboxReadingTile['lens']): boolean {
  return board.readings.some((group) => group.staleLenses?.some((mark) => mark.lens === lens) ?? false);
}
