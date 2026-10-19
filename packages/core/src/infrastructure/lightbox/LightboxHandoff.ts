/**
 * What the Lightbox may hand to the Workshop (ADR 2026-10-19 D11; Slice 3).
 * Pure: no host, no I/O.
 *
 * The webview only names a tile on the board it shows. Everything that
 * leaves is resolved and checked here, against the host's current board and
 * its text:
 * - the tile must be a borrowed field on that board; a withheld field has no
 *   tile, so it cannot be named;
 * - a field read against an earlier version of the text (stale, D4), or one
 *   being read again, is refused;
 * - its quotes are checked once more against the current paragraphs, and a
 *   field none of whose quotes still stands is refused;
 * - its terms are counted again, and only terms found travel, most frequent
 *   first, within the seed's bounds.
 * The handoff is a Lexical Gravity Build lens seed: the field's name, its
 * governing metaphor and its counted terms. The Workshop decides what to do
 * with it, and nothing is built until the writer presses Build there.
 */

import {
  LEXICAL_GRAVITY_BUILD_SEED_LIMITS,
  type LightboxBoard,
  type LightboxGravityFieldTile,
  type LightboxHandOffPayload,
  type LightboxReadingGroup,
  type LightboxWorkshopHandoff,
  type WorkshopLexicalGravityBuildSeedTerm
} from '@messages';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';

/** The one handoff Slice 3 offers: a borrowed field, as a Build lens seed. */
export const LIGHTBOX_SEED_HAND_OFF_KIND: LightboxHandOffPayload['kind'] = 'lexical-gravity-seed';
const SEED_KIND = LIGHTBOX_SEED_HAND_OFF_KIND;

/** Writer-facing refusals, in the order they are checked. */
export const LIGHTBOX_HANDOFF_REFUSALS = {
  unknown: 'That is not something the Lightbox can hand to the Workshop.',
  busy: 'A field is already on its way to the Workshop. Wait for it, then try again.',
  boardChanged: 'The board changed. Build from the board on screen.',
  fileChanged: 'The chapter changed on disk since this board was read. Re-read the file, then read the lens again before building it.',
  fileUnreadable: 'The chapter could not be read to check it, so nothing was handed over.',
  notOnBoard: 'That field is not on the board: it was withheld, or the lens was read again since.',
  notAField: 'Only a borrowed field can be built as a lens.',
  stale: 'This field was read against an earlier version of the chapter. Read the lens again, then build it.',
  reading: 'This lens is being read again. Wait for it to land, then build it.',
  quotesGone: 'None of this field\'s quotes is still in the chapter, so it was not handed over.',
  noWorkshop: 'The Workshop is not available from here.',
  workshopRefused: 'The Workshop could not be opened.'
} as const;

/** The request as the webview sent it, or undefined when it is not one the host understands. */
export function parseLightboxHandOffRequest(payload: unknown): LightboxHandOffPayload | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const { kind, boardId, fieldId } = payload as Record<string, unknown>;
  return kind === SEED_KIND && typeof boardId === 'string' && boardId.length > 0 && typeof fieldId === 'string' && fieldId.length > 0
    ? { kind: SEED_KIND, boardId, fieldId }
    : undefined;
}

export type LightboxHandoffPreparation =
  | { ok: true; handoff: LightboxWorkshopHandoff; quotesChecked: number; quotesFound: number }
  | { ok: false; reason: string };

/** Resolve, check and bound the field the request names, on `board` with its current text. */
export function prepareLightboxHandoff(
  request: LightboxHandOffPayload,
  board: LightboxBoard,
  paragraphTexts: readonly string[]
): LightboxHandoffPreparation {
  const located = locate(board, request.fieldId);
  if (!located) {
    return { ok: false, reason: LIGHTBOX_HANDOFF_REFUSALS.notOnBoard };
  }
  const { group, tile } = located;
  if (tile.kind !== 'gravity-field') {
    return { ok: false, reason: LIGHTBOX_HANDOFF_REFUSALS.notAField };
  }
  if (group.staleLenses?.some((mark) => mark.lens === tile.lens)) {
    return { ok: false, reason: LIGHTBOX_HANDOFF_REFUSALS.stale };
  }
  if (group.status === 'running' && group.pending?.includes(tile.lens)) {
    return { ok: false, reason: LIGHTBOX_HANDOFF_REFUSALS.reading };
  }
  const verifier = createLightboxQuoteVerifier(paragraphTexts);
  const quotesFound = tile.evidence.filter((quote) => verifier.verify(quote.paragraph, quote.text).found).length;
  if (quotesFound === 0) {
    return { ok: false, reason: LIGHTBOX_HANDOFF_REFUSALS.quotesGone };
  }
  return {
    ok: true,
    handoff: { kind: SEED_KIND, seed: seedOf(tile, board, paragraphTexts) },
    quotesChecked: tile.evidence.length,
    quotesFound
  };
}

/** Said to the writer when the Workshop accepted the field. */
export function lightboxHandoffSentMessage(handoff: LightboxWorkshopHandoff): string {
  return `Sent “${handoff.seed.field}” to Build lens in the Workshop’s Lexical Gravity. ` +
    'Nothing is built until you press Build there.';
}

function locate(board: LightboxBoard, tileId: string): { group: LightboxReadingGroup; tile: LightboxReadingGroup['tiles'][number] } | undefined {
  for (const group of board.readings) {
    const tile = group.tiles.find((candidate) => candidate.id === tileId);
    if (tile) {
      return { group, tile };
    }
  }
  return undefined;
}

function seedOf(tile: LightboxGravityFieldTile, board: LightboxBoard, paragraphTexts: readonly string[]): LightboxWorkshopHandoff['seed'] {
  const limits = LEXICAL_GRAVITY_BUILD_SEED_LIMITS;
  const counter = createLightboxTermCounter(paragraphTexts);
  const terms: WorkshopLexicalGravityBuildSeedTerm[] = tile.support
    .map((term) => counter.count(term.term))
    .filter((term) => term.count > 0 && term.term.length <= limits.termCharacters)
    .map((term, order) => ({ term: term.term, count: term.count, order }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, limits.terms)
    .map(({ term, count }) => ({ term, count }));
  return {
    origin: 'lightbox',
    field: tile.title.slice(0, limits.fieldCharacters),
    metaphor: tile.metaphor.slice(0, limits.metaphorCharacters),
    terms,
    sourceLabel: board.source.displayPath.slice(0, limits.sourceLabelCharacters)
  };
}
