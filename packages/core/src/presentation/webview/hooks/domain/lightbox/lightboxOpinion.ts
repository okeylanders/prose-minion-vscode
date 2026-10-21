/**
 * The Opinion as the webview draws it (ADR 2026-10-19 D7 addendum; Slice
 * 4D). Pure: no React, no transport.
 *
 * Everything here selects and words what the host decided, on the board on
 * screen: which views stood and which were withheld (and why), the
 * observations they share and what each cites, and the Opinion's standing
 * (`lightboxOpinionStanding`), checked against this board's own tiles and
 * figures, never against old ids. The writer's chosen view is a webview
 * preference (`useLightboxOpinionView`); with none, the tile opens on
 * Neutral, or on the first view that stood when Neutral was withheld.
 * Hovering an observation lights the paragraphs its cited items touch.
 */

import type {
  LightboxBoard,
  LightboxOpinionTile,
  LightboxOpinionView,
  LightboxOpinionViewId,
  LightboxOpinionWeight,
  LightboxVerifiedQuote
} from '@messages';
import {
  LIGHTBOX_OPINION_VIEWS,
  LIGHTBOX_OPINION_VIEW_LABELS,
  LIGHTBOX_OPINION_WEIGHT_LABELS,
  lightboxOpinionDefaultView,
  lightboxOpinionStanding,
  lightboxOpinionView,
  type LightboxOpinionStanding
} from '@shared/constants/lightboxOpinion';
import { lightboxOpinionItemMap } from '@shared/constants/lightboxOpinionItems';

export interface LightboxOpinionTab {
  view: LightboxOpinionViewId;
  label: string;
  sub: string;
  pressed: boolean;
  /** The view was withheld; its tab says so and shows the reason. */
  withheld: boolean;
}

export interface LightboxOpinionWhyRow {
  weight: LightboxOpinionWeight;
  weightLabel: string;
  text: string;
  /** "O1 · O4". */
  observations: string;
}

export interface LightboxOpinionCiteRow {
  label: string;
  quote?: LightboxVerifiedQuote;
  /** The item is no longer on the board as it was read: gone, stale, being read again or changed. */
  changed: boolean;
}

export interface LightboxOpinionObservationRow {
  id: string;
  text: string;
  cites: LightboxOpinionCiteRow[];
  /** Something it cites changed since the Opinion read it. */
  changed: boolean;
  /** The shown view weighs it. */
  weighed: boolean;
}

export interface LightboxOpinionTileView {
  tile: LightboxOpinionTile;
  standing: LightboxOpinionStanding;
  tabs: LightboxOpinionTab[];
  /** The view on show, and its content when it stood. */
  shown: LightboxOpinionViewId;
  view?: LightboxOpinionView;
  /** Why the view on show was withheld. */
  withheldReason?: string;
  why: LightboxOpinionWhyRow[];
  observations: LightboxOpinionObservationRow[];
  withheldObservations: Array<{ id: string; reason: string }>;
  /** What the Opinion read, in host words. */
  digestNote: string;
}

/** The tile's view model on `board`, showing `chosen` when the writer picked one. */
export function lightboxOpinionTileView(
  board: LightboxBoard,
  tile: LightboxOpinionTile,
  chosen?: LightboxOpinionViewId
): LightboxOpinionTileView {
  const items = lightboxOpinionItemMap(board);
  const standing = lightboxOpinionStanding(tile, board, items);
  const shown = chosen ?? lightboxOpinionDefaultView(tile);
  const view = lightboxOpinionView(tile, shown);
  const weighed = new Set(view?.why.flatMap((point) => point.observations) ?? []);
  return {
    tile,
    standing,
    tabs: LIGHTBOX_OPINION_VIEWS.map((id) => ({
      view: id,
      ...LIGHTBOX_OPINION_VIEW_LABELS[id],
      pressed: id === shown,
      withheld: !lightboxOpinionView(tile, id)
    })),
    shown,
    ...(view ? { view } : {}),
    ...(!view ? { withheldReason: tile.withheldViews.find((entry) => entry.view === shown)?.reason ?? 'This view was not drawn.' } : {}),
    why: (view?.why ?? []).map((point) => ({
      weight: point.weight,
      weightLabel: LIGHTBOX_OPINION_WEIGHT_LABELS[point.weight],
      text: point.text,
      observations: point.observations.join(' · ')
    })),
    observations: tile.observations.map((observation) => ({
      id: observation.id,
      text: observation.text,
      cites: observation.cites.map((cite) => {
        const now = items.get(cite.item);
        return { label: cite.label, ...(cite.quote ? { quote: cite.quote } : {}), changed: !now || !now.current || now.basis !== cite.basis };
      }),
      changed: standing.changed.includes(observation.id),
      weighed: weighed.has(observation.id)
    })),
    withheldObservations: tile.withheldObservations,
    digestNote: `Read ${tile.digest.items.toLocaleString('en-US')} board ${tile.digest.items === 1 ? 'item' : 'items'}` +
      (tile.digest.leftOut > 0 ? `; ${tile.digest.leftOut.toLocaleString('en-US')} left out for length` : '') + '.'
  };
}

/** An observation as a board item: what hovering or pinning it lights, or undefined when the board no longer has it. */
export function lightboxObservationItem(board: LightboxBoard, tileId: string, id: string):
  { tile: LightboxOpinionTile; text: string; paragraphs: number[]; cites: string[] } | undefined {
  const tile = board.readings.flatMap((group) => group.tiles)
    .find((candidate): candidate is LightboxOpinionTile => candidate.kind === 'opinion' && candidate.id === tileId);
  const observation = tile?.observations.find((candidate) => candidate.id === id);
  return tile && observation
    ? { tile, text: observation.text, paragraphs: [...observation.paragraphs], cites: observation.cites.map((cite) => cite.label) }
    : undefined;
}

/**
 * Why the view on show cannot be brought, where the host would refuse it:
 * stale, withheld, or citing no quote. Undefined when it can be.
 */
export function lightboxOpinionBringBlock(
  board: LightboxBoard,
  tile: LightboxOpinionTile,
  shown: LightboxOpinionViewId
): string | undefined {
  const view = lightboxOpinionView(tile, shown);
  if (!view) {
    return 'This view was withheld, so there is nothing of it to bring.';
  }
  if (lightboxOpinionStanding(tile, board).stale) {
    return 'Something this Opinion cites changed since it was read. Re-read the Opinion before bringing it.';
  }
  const quotes = view.why.flatMap((point) => point.observations)
    .flatMap((id) => tile.observations.find((observation) => observation.id === id)?.cites ?? [])
    .filter((cite) => cite.quote);
  return quotes.length === 0 ? 'Its observations cite no quote, and a Workshop tile carries at least one.' : undefined;
}

/** The inspector's lines for a pinned Opinion. */
export function lightboxOpinionDetails(tile: LightboxOpinionTile): Array<{ label: string; value: string }> {
  return [
    { label: 'The one evaluative tile', value: 'The board’s only reading allowed to weigh the work; nothing else on the board reads it' },
    { label: 'Views', value: `${tile.views.length} of 3 stand` + (tile.withheldViews.length > 0 ? `; withheld: ${tile.withheldViews.map((entry) => LIGHTBOX_OPINION_VIEW_LABELS[entry.view].label).join(', ')}` : '') },
    { label: 'Observations', value: `${tile.observations.length} drawn` + (tile.withheldObservations.length > 0 ? `, ${tile.withheldObservations.length} withheld` : '') + ', each citing the board' },
    { label: 'Read', value: `The board's checked digest, never the chapter: ${tile.digest.items} items${tile.digest.leftOut > 0 ? `, ${tile.digest.leftOut} left out for length` : ''}` }
  ];
}
