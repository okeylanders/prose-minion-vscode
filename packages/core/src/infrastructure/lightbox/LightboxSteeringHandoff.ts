/**
 * What craft steering's readings carry to the Workshop (ADR 2026-10-19 D11,
 * D7 second addendum; Slice 4F). Pure: no host, no I/O. Used by
 * `LightboxTileHandoff`, which resolves the tile by id on the host's current
 * board, refuses a stale or re-reading one, checks every quote again and
 * bounds the item; this module says how a steering quote is checked again
 * and what the item's points are.
 *
 * - **Quotes** travel only while the figure's own detector still finds an
 *   instance in them (`verifyLightboxPatternInstance`), as they were kept.
 *   A note with its one quote gone is refused.
 * - **A figure's reading** carries the host's counts as points: the total
 *   and rate with narration and dialogue, the constructions, and the
 *   instances in runs of short sentences, with the run's stated threshold.
 * - **Dialogue is voice** (epic decision 26): the note's instance is placed
 *   again on its quote as it travels. In dialogue the note carries its
 *   stance and the host's "In dialogue" line, and no nudge or example.
 * - **A note** carries its stance (with its figure), its nudge, and its one
 *   example labelled "One way it could go", as `before → after`. The example
 *   travels only while its `before` still lies in the note's re-checked
 *   quote holding the instance, and the pair as the chapter has it keeps the
 *   example's bounds (`anchorLightboxSteeringExample`), so it always fits
 *   its point whole: nothing is ever clipped (PR #160 F-02). When it does
 *   not, the item says the example was withheld and why, in host words. It
 *   is a point, never a quote: the Workshop never sees it as the chapter's
 *   text.
 * The why is the item's claim. Nothing else of the board travels.
 */

import type { LightboxBoard, LightboxReadingTile, WorkshopLightboxTilePoint } from '@messages';
import { LIGHTBOX_NUMBER_STAT_LABELS } from '@shared/constants/lightbox';
import {
  LIGHTBOX_STEERING_EXAMPLE_LABEL,
  LIGHTBOX_STEERING_STANCE_LABELS,
  LIGHTBOX_STEERING_VOICE_LABEL,
  lightboxSteeringConstructionLine,
  lightboxSteeringCountLines,
  lightboxSteeringExampleText,
  lightboxSteeringFigure
} from '@shared/constants/lightboxSteering';
import type { LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { verifyLightboxPatternInstance } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { anchorLightboxSteeringExample, type LightboxSteeringAnchorFault } from '@/infrastructure/lightbox/LightboxSteeringTiles';
import { holdLightboxSteeringVoice, lightboxSteeringInstanceVoice } from '@/infrastructure/lightbox/LightboxSteeringVoice';

type Quote = { paragraph: number; text: string };

/** Why a note's example did not travel, in one Workshop point (at most 120 characters each). */
export const LIGHTBOX_STEERING_EXAMPLE_BRING_REASONS: Readonly<Record<LightboxSteeringAnchorFault, string>> = {
  unanchored: 'Not brought: its first part no longer stands whole in the note\'s quote, holding the instance.',
  voice: 'Not brought: its first part holds an instance only in dialogue, the character\'s voice.',
  long: 'Not brought: its first part, as the chapter has it, runs past the words or characters an example may have.',
  same: 'Not brought: as the chapter has it, its first part reads as its second.',
  fit: 'Not brought: as the chapter has it, the pair does not fit one Workshop point.'
};
/** The point's label when a note's example did not travel. */
export const LIGHTBOX_STEERING_EXAMPLE_WITHHELD_LABEL = 'Example withheld';
type Point = (label: string, text: string) => WorkshopLightboxTilePoint;

/** A steering tile's quote as it stands now, holding an instance of its figure; undefined when it does not, or for another kind. */
export function lightboxSteeringQuoteAgain(
  tile: LightboxReadingTile,
  verifier: LightboxQuoteVerifier,
  quote: Quote
): Quote | null | undefined {
  if (tile.kind !== 'steering-reading' && tile.kind !== 'steering-note') {
    return undefined;
  }
  const verdict = verifyLightboxPatternInstance(verifier, tile.stat, quote.paragraph, quote.text);
  return verdict.found ? { paragraph: verdict.paragraph, text: verdict.text } : null;
}

/** A steering tile's points on `board`, with its example anchored in `quotes` (as they travel); undefined for another kind. */
export function lightboxSteeringPoints(
  tile: LightboxReadingTile,
  board: LightboxBoard,
  verifier: LightboxQuoteVerifier,
  quotes: readonly Quote[],
  point: Point
): WorkshopLightboxTilePoint[] | undefined {
  if (tile.kind === 'steering-reading') {
    const figure = lightboxSteeringFigure(board.measured.steering.figures, tile.stat);
    if (!figure) {
      return [];
    }
    const [counts] = lightboxSteeringCountLines(figure);
    const constructions = lightboxSteeringConstructionLine(figure);
    const runs = board.measured.steering.shortRun;
    return [
      point('Figure', counts),
      ...(constructions ? [point('By construction', constructions)] : []),
      point('Short runs', `${figure.inShortRuns.toLocaleString('en-US')} in runs of ${runs.sentences} or more sentences of ${runs.maxWords} words or fewer`)
    ];
  }
  if (tile.kind !== 'steering-note') {
    return undefined;
  }
  // Dialogue is voice (epic decision 26), checked again on the quote as it travels: no nudge or example goes there.
  const voice = lightboxSteeringInstanceVoice(verifier, tile.stat, quotes[0]);
  const held = holdLightboxSteeringVoice(tile, voice, 'carried');
  const anchored = held.example && quotes[0] ? anchorLightboxSteeringExample(verifier, tile.stat, quotes[0], held.example) : undefined;
  return [
    point('Stance', `${LIGHTBOX_STEERING_STANCE_LABELS[tile.stance]} · ${LIGHTBOX_NUMBER_STAT_LABELS[tile.stat]}`),
    ...(voice === 'dialogue' && held.voice ? [point(LIGHTBOX_STEERING_VOICE_LABEL, held.voice)] : []),
    ...(held.nudge ? [point('Nudge', held.nudge)] : []),
    ...(anchored === undefined ? [] : 'example' in anchored
      ? [point(LIGHTBOX_STEERING_EXAMPLE_LABEL, lightboxSteeringExampleText(anchored.example))]
      : [point(LIGHTBOX_STEERING_EXAMPLE_WITHHELD_LABEL, LIGHTBOX_STEERING_EXAMPLE_BRING_REASONS[anchored.fault])])
  ];
}
