/**
 * What the Opinion carries to the Workshop (ADR 2026-10-19 D11, D7
 * addendum; Slice 4D). Pure: no host, no I/O. Used by
 * `LightboxTileHandoff`, which has already resolved the tile by id on the
 * host's current board and refused it stale (its lens read against an
 * earlier text) or being read again.
 *
 * **The decision: the view on screen can be brought, by name, and nothing
 * else of the Opinion.** The webview names the tile and the view (ids
 * only); the host resolves both and builds the item:
 * - the view must be one that stands; a withheld view brings nothing;
 * - the Opinion must stand on the board as it is (`lightboxOpinionStanding`):
 *   one whose cited items changed since it was read is refused, as a stale
 *   tile is;
 * - the view's headline is the item's title and its body the claim; its
 *   first three Why points travel as points, each its weight and its text.
 *   Their asks run past the Workshop's bounds (Slice 4H), so each is
 *   clipped to its Workshop bound with an ellipsis, never withheld;
 * - its quotes are the ones its Why points' observations cite, in that
 *   order, each found again in the current chapter as any tile's are, and
 *   bounded like any tile's (the first four, each clipped to a Workshop
 *   quote). A view whose observations cite no quote still in the chapter is
 *   refused: a Workshop tile always carries one;
 * - never the other views, the observations' words, the digest or the
 *   board.
 */

import {
  WORKSHOP_LIGHTBOX_TILE_LIMITS,
  type LightboxBoard,
  type LightboxOpinionTile,
  type LightboxOpinionViewId,
  type WorkshopLightboxTile,
  type WorkshopLightboxTileQuote
} from '@messages';
import {
  LIGHTBOX_OPINION_VIEW_LABELS,
  LIGHTBOX_OPINION_WEIGHT_LABELS,
  lightboxOpinionDefaultView,
  LIGHTBOX_OPINION_EARLIER_RULE,
  lightboxOpinionStanding,
  lightboxOpinionView
} from '@shared/constants/lightboxOpinion';
import { lightboxLensLabel } from '@shared/constants/lightbox';
import { clipLightboxText } from '@shared/constants/lightboxClip';
import type { LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';

const LIMITS = WORKSHOP_LIGHTBOX_TILE_LIMITS;

export const LIGHTBOX_OPINION_HANDOFF_REFUSALS = {
  changed: 'Something this Opinion cites changed since it was read. Re-read the Opinion, then bring it.',
  withheld: 'That view was withheld, so there is nothing of it to bring.',
  quotesGone: 'None of the quotes this view\'s observations cite is still in the chapter, so it was not brought.'
} as const;

export type LightboxOpinionHandoffPreparation =
  | { ok: true; tile: WorkshopLightboxTile; quotesChecked: number; quotesFound: number }
  | { ok: false; reason: string };

/** The view named (or the tile's default) as a Workshop item, from `board` and its current text. */
export function prepareLightboxOpinionHandoff(
  request: { boardId: string; view?: LightboxOpinionViewId },
  tile: LightboxOpinionTile,
  board: LightboxBoard,
  verifier: LightboxQuoteVerifier
): LightboxOpinionHandoffPreparation {
  const named = request.view ?? lightboxOpinionDefaultView(tile);
  const view = lightboxOpinionView(tile, named);
  if (!view) {
    return { ok: false, reason: LIGHTBOX_OPINION_HANDOFF_REFUSALS.withheld };
  }
  const standing = lightboxOpinionStanding(tile, board);
  if (standing.stale) {
    // Cited under another basis rule (Slice 5A): the standing's own reason, as the tile says it.
    return { ok: false, reason: standing.earlierRule ? LIGHTBOX_OPINION_EARLIER_RULE : LIGHTBOX_OPINION_HANDOFF_REFUSALS.changed };
  }
  const cited = view.why.flatMap((point) => point.observations)
    .flatMap((id) => tile.observations.find((observation) => observation.id === id)?.cites ?? [])
    .flatMap((cite) => (cite.quote ? [cite.quote] : []));
  const quotes: WorkshopLightboxTileQuote[] = [];
  for (const quote of cited) {
    const verdict = verifier.verify(quote.paragraph, quote.text);
    if (verdict.found && !quotes.some((kept) => kept.paragraph === verdict.paragraph && kept.text === verdict.text)) {
      quotes.push({ paragraph: verdict.paragraph, text: verdict.text });
    }
  }
  const bounded = quotes.slice(0, LIMITS.quotes).map((quote) => ({ ...quote, text: clipLightboxText(quote.text, LIMITS.quoteCharacters) }));
  if (bounded.length === 0) {
    return { ok: false, reason: LIGHTBOX_OPINION_HANDOFF_REFUSALS.quotesGone };
  }
  const label = LIGHTBOX_OPINION_VIEW_LABELS[view.view].label;
  return {
    ok: true,
    tile: {
      origin: 'lightbox',
      boardId: request.boardId.slice(0, LIMITS.idCharacters),
      tileId: tile.id.slice(0, LIMITS.idCharacters),
      kindLabel: `Opinion · ${label} view`.slice(0, LIMITS.labelCharacters),
      lensLabel: lightboxLensLabel(tile.lens).slice(0, LIMITS.labelCharacters),
      title: clipLightboxText(view.headline, LIMITS.titleCharacters),
      claim: clipLightboxText(view.body, LIMITS.claimCharacters),
      points: view.why.slice(0, LIMITS.points).map((point) => ({
        label: LIGHTBOX_OPINION_WEIGHT_LABELS[point.weight].slice(0, LIMITS.pointLabelCharacters),
        text: clipLightboxText(point.text, LIMITS.pointCharacters)
      })),
      quotes: bounded,
      sourceLabel: board.source.displayPath.slice(0, LIMITS.sourceLabelCharacters)
    },
    quotesChecked: cited.length,
    quotesFound: quotes.length
  };
}
