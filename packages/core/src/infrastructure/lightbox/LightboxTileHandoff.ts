/**
 * What a reading tile hands to the Workshop (ADR 2026-10-19 D11; Slice 4).
 * Pure: no host, no I/O.
 *
 * The webview names a tile by its id on the board it shows. Everything that
 * leaves is resolved and checked here, against the host's current board and
 * its text:
 * - the tile must be a reading on that board; a withheld claim has no tile,
 *   and a measured item is not a reading, so neither can be named;
 * - a tile read against an earlier version of the text (stale, D4), one whose
 *   lens is being read again, and a spark the writer set aside are refused;
 * - every quote is checked once more against the current paragraphs, and
 *   only quotes found again travel, as the chapter has them; a tile none of
 *   whose quotes is found, or a said/meant pair whose said line is gone, is
 *   refused;
 * - a said/meant pair travels with its said line first or not at all: the
 *   line is checked after every bound, so a line the verifier found longer
 *   than a Workshop quote (a hard-wrapped speech grows by its indentation)
 *   refuses the pair rather than sending its meaning without its speech
 *   (PR #151 F-02);
 * - a handoff sample (Slice 4B) is found again as a pair of adjacent
 *   sentences and travels with both, in order, or not at all; two sentences
 *   with the same words are two roles, never one quote (PR #155 F-02);
 * - a numbers reading travels only while its figure stands out on the board,
 *   and its quotes are checked again with that figure's instance filter
 *   (F-01); a familiar phrase travels only while a quote holds a whole
 *   occurrence of the phrase in the chapter (F-03);
 * - group E's kinds (Slice 4C, `LightboxPlotHandoff`) travel with their
 *   anchors or not at all: a thread with its plant and its resolution, a
 *   synopsis with two quotes, a movement with its boundary; the freshness
 *   reading with its label, and its basis only when both halves are current;
 * - the Opinion (Slice 4D, `LightboxOpinionHandoff`) travels as the one
 *   view the writer names, only while it stands on the board as it is: its
 *   headline, body and Why points, and the quotes its observations cite,
 *   found again;
 * - the item carries the claim (with a story's stances, a pair's speaker,
 *   or a craft tile's own host counts, as labeled points) and those quotes:
 *   never the board or any other tile; and it is bounded by
 *   `WORKSHOP_LIGHTBOX_TILE_LIMITS`, a quote longer than its bound dropped
 *   rather than cut, so every quote stays verbatim.
 * The Workshop decides what to do with it: a pending attachment above its
 * composer, sent only when the writer sends.
 */

import {
  WORKSHOP_LIGHTBOX_TILE_LIMITS,
  type LightboxBoard,
  type LightboxHandOffPayload,
  type LightboxNumberRow,
  type LightboxReadingTile,
  type LightboxWorkshopHandoff,
  type WorkshopLightboxTile,
  type WorkshopLightboxTilePoint,
  type WorkshopLightboxTileQuote,
  type WorkshopSeedFailure
} from '@messages';
import {
  LIGHTBOX_ENDING_LABELS,
  LIGHTBOX_FAMILIAR_KIND_LABELS,
  LIGHTBOX_HANDOFF_EFFECT_LABELS,
  LIGHTBOX_LINEAGE_STANCE_LABELS,
  LIGHTBOX_NUMBER_USAGE_LABELS,
  LIGHTBOX_STOCK_TIER_LABELS,
  LIGHTBOX_TILE_KIND_LABELS,
  formatLightboxFigure,
  lightboxLensLabel
} from '@shared/constants/lightbox';
import { createLightboxQuoteVerifier, type LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { findLightboxSentencePair } from '@/infrastructure/lightbox/LightboxSentencePairs';
import { lightboxPhraseHeld } from '@/infrastructure/lightbox/LightboxTermCounts';
import { locateLightboxTile } from '@/infrastructure/lightbox/LightboxHandoff';
import { lightboxStandoutRows, verifyLightboxInstance } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { LIGHTBOX_STOCK_TIERS } from '@/infrastructure/lightbox/LightboxReadingWire';
import { lightboxPlotAnchorRefusal, lightboxPlotPoints, lightboxPlotTravelOrder } from '@/infrastructure/lightbox/LightboxPlotHandoff';
import { prepareLightboxOpinionHandoff } from '@/infrastructure/lightbox/LightboxOpinionHandoff';

const LIMITS = WORKSHOP_LIGHTBOX_TILE_LIMITS;

export type LightboxTileHandOffRequest = Extract<LightboxHandOffPayload, { kind: 'tile' }>;
export type LightboxTileWorkshopHandoff = Extract<LightboxWorkshopHandoff, { kind: 'tile' }>;

/** Writer-facing refusals, in the order they are checked. */
export const LIGHTBOX_TILE_HANDOFF_REFUSALS = {
  busy: 'A tile is already on its way to the Workshop. Wait for it, then try again.',
  boardChanged: 'The board changed. Bring a tile from the board on screen.',
  notOnBoard: 'That tile is not on the board: it was withheld, or its lens was read again since.',
  stale: 'This tile was read against an earlier version of the chapter. Re-read it, then bring it.',
  reading: 'This lens is being read again. Wait for it to land, then bring it.',
  setAside: 'You set this spark aside. Bring it back first.',
  saidGone: 'Its said line is no longer in the chapter, so it was not brought.',
  saidTooLong: 'Its said line, as the chapter has it, is longer than a Workshop quote can carry, so the pair was not brought. Nothing was cut.',
  quotesGone: 'None of this tile\'s quotes is still in the chapter, so it was not brought.',
  handoffIncomplete: 'Its two sentences, as the chapter has them, cannot both travel to the Workshop, so the handoff was not brought. Nothing was cut.',
  notStandout: 'The figure this reading reads does not stand out on this board, so it was not brought. Re-read the numbers.',
  phraseGone: 'None of its quotes holds the phrase it names, as the chapter has it, so it was not brought.',
  fileChanged: 'The chapter changed on disk since this board was read. Re-read the file, then the lens, before bringing it.'
} as const;

/** Why the Workshop did not stage a tile, in the writer's words. */
export const LIGHTBOX_TILE_WORKSHOP_REFUSALS: Readonly<Record<WorkshopSeedFailure, string>> = {
  unavailable: 'The Workshop could not be opened.',
  busy: 'The Workshop is busy: a response is running, or the session is being saved or replaced. Bring the tile again when it finishes.',
  full: 'The next Workshop message already carries as many attachments as one can. Send it, or remove one there, then bring the tile again.',
  duplicate: 'That tile is already waiting above the Workshop composer.',
  closed: 'The Workshop closed before it staged the tile.',
  replaced: 'Another tile went to the Workshop before this one was staged.',
  timeout: 'The Workshop did not confirm it staged the tile. Open the Workshop to check; nothing was sent.',
  reset: 'The Workshop reloaded before it confirmed the tile. Open the Workshop to check; nothing was sent.'
};

export type LightboxTileHandoffPreparation =
  | { ok: true; handoff: LightboxTileWorkshopHandoff; quotesChecked: number; quotesFound: number }
  | { ok: false; reason: string };

/** Resolve, check and bound the tile the request names, on `board` with its current text. */
export function prepareLightboxTileHandoff(
  request: LightboxTileHandOffRequest,
  board: LightboxBoard,
  paragraphTexts: readonly string[]
): LightboxTileHandoffPreparation {
  const refuse = (reason: string): LightboxTileHandoffPreparation => ({ ok: false, reason });
  const located = locateLightboxTile(board, request.tileId);
  if (!located) {
    return refuse(LIGHTBOX_TILE_HANDOFF_REFUSALS.notOnBoard);
  }
  const { group, tile } = located;
  if (group.staleLenses?.some((mark) => mark.lens === tile.lens)) {
    return refuse(LIGHTBOX_TILE_HANDOFF_REFUSALS.stale);
  }
  if (group.status === 'running' && group.pending?.includes(tile.lens)) {
    return refuse(LIGHTBOX_TILE_HANDOFF_REFUSALS.reading);
  }
  if (tile.kind === 'spark' && tile.dismissedOrder !== undefined) {
    return refuse(LIGHTBOX_TILE_HANDOFF_REFUSALS.setAside);
  }
  const verifier = createLightboxQuoteVerifier(paragraphTexts);
  if (tile.kind === 'opinion') {
    const opinion = prepareLightboxOpinionHandoff(request, tile, board, verifier);
    return opinion.ok
      ? { ok: true, handoff: { kind: 'tile', tile: opinion.tile }, quotesChecked: opinion.quotesChecked, quotesFound: opinion.quotesFound }
      : opinion;
  }
  const said = tile.kind === 'subtext' ? foundAgain(verifier, tile.said) : undefined;
  if (tile.kind === 'subtext' && !said) {
    return refuse(LIGHTBOX_TILE_HANDOFF_REFUSALS.saidGone);
  }
  const standout = tile.kind === 'number-usage' ? lightboxStandoutRows(board.measured.numbers.rows).get(tile.stat) : undefined;
  // Fail closed: a numbers reading is only ever of a figure that stands out now (PR #155 F-01).
  if (tile.kind === 'number-usage' && !standout) {
    return refuse(LIGHTBOX_TILE_HANDOFF_REFUSALS.notStandout);
  }
  if (tile.kind === 'handoff') {
    return handoffOf(request, tile, board, verifier);
  }
  const quotes: WorkshopLightboxTileQuote[] = said ? [{ ...said, said: true }] : [];
  for (const quote of travelOrder(tile)) {
    const found = standout ? foundWithInstance(verifier, standout, quote) : foundAgain(verifier, quote);
    if (found && !quotes.some((kept) => kept.paragraph === found.paragraph && kept.text === found.text)) {
      quotes.push(found);
    }
  }
  const quotesFound = quotes.length;
  const bounded = quotes.filter((quote) => quote.text.length <= LIMITS.quoteCharacters).slice(0, LIMITS.quotes);
  // A pair's said line is its anchor: checked after every bound, never dropped or cut to fit.
  if (said && bounded[0]?.said !== true) {
    return refuse(LIGHTBOX_TILE_HANDOFF_REFUSALS.saidTooLong);
  }
  // A thread with its plant and resolution, a synopsis with two quotes, a movement with its boundary (Slice 4C).
  const anchors = lightboxPlotAnchorRefusal(tile, bounded);
  if (anchors) {
    return refuse(anchors);
  }
  if (bounded.length === 0) {
    return refuse(LIGHTBOX_TILE_HANDOFF_REFUSALS.quotesGone);
  }
  // The witness rule the gate holds a familiar phrase to: a quote holding a whole occurrence (PR #155 F-03).
  if (tile.kind === 'familiar-phrase' && !lightboxPhraseHeld(verifier, bounded, tile.phrase)) {
    return refuse(LIGHTBOX_TILE_HANDOFF_REFUSALS.phraseGone);
  }
  return {
    ok: true,
    handoff: { kind: 'tile', tile: tileOf(request, tile, bounded, board) },
    quotesChecked: tile.evidence.length,
    quotesFound
  };
}

/** Said to the writer when a visible Workshop staged the tile. */
export function lightboxTileStagedMessage(handoff: LightboxTileWorkshopHandoff): string {
  return `Staged “${handoff.tile.title}” above the Workshop composer. Nothing is sent until you send it there, ` +
    'and you can remove it there.';
}

/** The order a tile's quotes travel in: a tier mix leads with one beat of each tier, signature first. */
function travelOrder(tile: LightboxReadingTile): ReadonlyArray<{ paragraph: number; text: string }> {
  const plot = lightboxPlotTravelOrder(tile);
  if (plot) {
    return plot;
  }
  if (tile.kind !== 'stock-tiers') {
    return tile.evidence;
  }
  const leads = [...LIGHTBOX_STOCK_TIERS].reverse()
    .map((tier) => tile.beats.find((beat) => beat.tier === tier))
    .filter((beat): beat is (typeof tile.beats)[number] => beat !== undefined);
  return [...leads, ...tile.beats.filter((beat) => !leads.includes(beat))].map((beat) => beat.quote);
}

/**
 * A handoff is its two sentences, in order: found again as adjacent sentences
 * of one paragraph, each within the Workshop's quote bound, or refused, never
 * halved. Both roles travel even when their words are the same (PR #155 F-02).
 */
function handoffOf(
  request: LightboxTileHandOffRequest,
  tile: Extract<LightboxReadingTile, { kind: 'handoff' }>,
  board: LightboxBoard,
  verifier: LightboxQuoteVerifier
): LightboxTileHandoffPreparation {
  const verdict = findLightboxSentencePair(verifier, tile.from, tile.to);
  const pair = verdict.ok ? [verdict.pair.from, verdict.pair.to].map(({ paragraph, text }) => ({ paragraph, text })) : [];
  if (pair.length !== 2 || pair.some((quote) => quote.text.length > LIMITS.quoteCharacters)) {
    return { ok: false, reason: LIGHTBOX_TILE_HANDOFF_REFUSALS.handoffIncomplete };
  }
  return {
    ok: true,
    handoff: { kind: 'tile', tile: tileOf(request, tile, pair, board) },
    quotesChecked: 2,
    quotesFound: 2
  };
}

/** A numbers reading's quote as it stands now, holding an instance of its figure, or undefined. */
function foundWithInstance(
  verifier: LightboxQuoteVerifier,
  row: LightboxNumberRow,
  quote: { paragraph: number; text: string }
): WorkshopLightboxTileQuote | undefined {
  const verdict = verifyLightboxInstance(verifier, row, quote.paragraph, quote.text);
  return verdict.found ? { paragraph: verdict.paragraph, text: verdict.text } : undefined;
}

/** The quote as it stands in the current chapter, or undefined when it is gone. */
function foundAgain(
  verifier: LightboxQuoteVerifier,
  quote: { paragraph: number; text: string }
): WorkshopLightboxTileQuote | undefined {
  const verdict = verifier.verify(quote.paragraph, quote.text);
  return verdict.found ? { paragraph: verdict.paragraph, text: verdict.text } : undefined;
}

function tileOf(
  request: LightboxTileHandOffRequest,
  tile: LightboxReadingTile,
  quotes: WorkshopLightboxTileQuote[],
  board: LightboxBoard
): WorkshopLightboxTile {
  return {
    origin: 'lightbox',
    boardId: request.boardId.slice(0, LIMITS.idCharacters),
    tileId: tile.id.slice(0, LIMITS.idCharacters),
    kindLabel: LIGHTBOX_TILE_KIND_LABELS[tile.kind].slice(0, LIMITS.labelCharacters),
    lensLabel: lightboxLensLabel(tile.lens).slice(0, LIMITS.labelCharacters),
    title: tile.title.slice(0, LIMITS.titleCharacters).trim(),
    claim: tile.claim.slice(0, LIMITS.claimCharacters).trim(),
    points: pointsOf(tile, board),
    quotes,
    sourceLabel: board.source.displayPath.slice(0, LIMITS.sourceLabelCharacters)
  };
}

/** What a claim says in its own right: a story's stances, who says a line, or a craft tile's own counts and fields. */
function pointsOf(tile: LightboxReadingTile, board: LightboxBoard): WorkshopLightboxTilePoint[] {
  const point = (label: string, text: string): WorkshopLightboxTilePoint => ({
    label: label.slice(0, LIMITS.pointLabelCharacters),
    text: text.slice(0, LIMITS.pointCharacters).trim()
  });
  switch (tile.kind) {
    case 'lineage':
      return tile.stances.slice(0, LIMITS.points).map((row) => point(LIGHTBOX_LINEAGE_STANCE_LABELS[row.stance], row.note));
    case 'subtext':
      return [point('Speaker', tile.speaker)];
    case 'stock-tiers':
      return [
        point('Tiers', LIGHTBOX_STOCK_TIERS.map((tier) => `${LIGHTBOX_STOCK_TIER_LABELS[tier]} ${tile.tiers[tier]}`).join(' · ')),
        point('Classified', `${tile.classified} beats the reading classified, counted by code`)
      ];
    case 'familiar-phrase': {
      const counted = tile.support[0];
      return [
        point('Kind', LIGHTBOX_FAMILIAR_KIND_LABELS[tile.familiar]),
        ...(counted ? [point('Counted', `×${counted.count} · ${counted.paragraphs.slice(0, 12).map((index) => `¶${index}`).join(' ')}`)] : [])
      ];
    }
    case 'echo':
      return [
        point('Sounds like', tile.reminiscentOf),
        point('Accuracy', 'The quote is checked against the chapter; the resemblance is not.')
      ];
    case 'rhythm-endings':
      return [point('Endings', (['lands', 'holds', 'opens'] as const)
        .map((ending) => `${LIGHTBOX_ENDING_LABELS[ending]} ${tile.endings.filter((value) => value === ending).length}`)
        .join(' · '))];
    case 'handoff':
      return [
        point('Carried', tile.carried),
        point('Changes', tile.claim),
        point('Effect', LIGHTBOX_HANDOFF_EFFECT_LABELS[tile.effect])
      ];
    case 'number-usage': {
      const row = board.measured.numbers.rows.find((candidate) => candidate.stat === tile.stat);
      const figure = row
        ? `${row.label}: ${formatLightboxFigure(row.value)} ${row.unit}` +
          (row.writer ? `; your average ${formatLightboxFigure(row.writer.average)}` : '') +
          (row.range && (row.range.min !== undefined || row.range.max !== undefined)
            ? `; preset ${row.range.min ?? ''}–${row.range.max ?? ''}`
            : '')
        : tile.title;
      return [point('Figure', figure), point('Reads as', LIGHTBOX_NUMBER_USAGE_LABELS[tile.usage].replace(/^Reads as /, ''))];
    }
    default:
      return lightboxPlotPoints(tile, board, point) ?? [];
  }
}
