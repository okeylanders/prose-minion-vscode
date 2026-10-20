/**
 * A Lightbox tile as a Workshop message attachment (ADR 2026-10-19 D11;
 * Lightbox Slice 4). Pure.
 *
 * The Lightbox's host builds the tile from its current board, with quotes it
 * found again in the chapter. The Workshop trusts no other tab's shape, so
 * the tile is checked again here on arrival: exact keys, every bound in
 * `WORKSHOP_LIGHTBOX_TILE_LIMITS`, at least one quote, and a said/meant
 * pair led by its said line, the only quote that may be marked said (PR #151
 * F-02): its meaning never arrives without the speech it reads. It is then rendered
 * here into a one-shot attachment the writer sends with a message or
 * removes. The attachment carries the claim, its labeled points and its
 * quotes, nothing else; its thread-artifact frame is kind `lightbox-tile`,
 * whose preamble says the claim is a model's reading, and the frame
 * neutralizes its body like any other.
 *
 * Its identity is the board and tile ids, so the same tile cannot wait
 * twice above the composer, through staging, Rewind or any whole-room
 * operation (`WorkshopMessageAttachmentIdentity`, PR #151 F-01); the same
 * reading from a re-read board is a new tile, with new ids.
 */

import {
  WORKSHOP_LIGHTBOX_TILE_LIMITS,
  type WorkshopLightboxTile,
  type WorkshopLightboxTilePoint,
  type WorkshopLightboxTileQuote
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIGHTBOX_TILE_KIND_LABELS } from '@shared/constants/lightbox';
import { countWords } from '@/utils/textUtils';
import {
  boundedArrayAt,
  boundedStringAt,
  exactObject,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import type { WorkshopMessageAttachmentInput } from '@/application/services/workshop/WorkshopSessionRecords';
import { workshopLightboxTileSourceKey } from '@/application/services/workshop/WorkshopMessageAttachmentIdentity';

const LIMITS = WORKSHOP_LIGHTBOX_TILE_LIMITS;

/** A tile exactly as the contract allows it, trimmed; throws naming the field that is wrong, never its text. */
export function validateWorkshopLightboxTile(value: unknown): WorkshopLightboxTile {
  const tile = exactObject(value, 'tile', [
    'origin', 'boardId', 'tileId', 'kindLabel', 'lensLabel', 'title', 'claim', 'points', 'quotes', 'sourceLabel'
  ]);
  if (tile.origin !== 'lightbox') {
    shapeError('tile.origin', '"lightbox"');
  }
  const text = (field: string, maximum: number, allowBlank = false): string => {
    boundedStringAt(tile[field], `tile.${field}`, maximum, allowBlank);
    return (tile[field] as string).trim();
  };
  boundedArrayAt(tile.points, 'tile.points', 0, LIMITS.points, 'points');
  const points = tile.points.map((entry, index): WorkshopLightboxTilePoint => {
    const path = `tile.points[${index}]`;
    const point = exactObject(entry, path, ['label', 'text']);
    boundedStringAt(point.label, `${path}.label`, LIMITS.pointLabelCharacters, false);
    boundedStringAt(point.text, `${path}.text`, LIMITS.pointCharacters, false);
    return { label: (point.label as string).trim(), text: (point.text as string).trim() };
  });
  boundedArrayAt(tile.quotes, 'tile.quotes', 1, LIMITS.quotes, 'quotes');
  const quotes = tile.quotes.map((entry, index): WorkshopLightboxTileQuote => {
    const path = `tile.quotes[${index}]`;
    const quote = exactObject(entry, path, ['paragraph', 'text'], ['said']);
    if (!Number.isSafeInteger(quote.paragraph) || (quote.paragraph as number) < 1) {
      shapeError(`${path}.paragraph`, 'a whole number from 1');
    }
    // A quote travels verbatim, as the chapter has it: bounded, never trimmed.
    boundedStringAt(quote.text, `${path}.text`, LIMITS.quoteCharacters, false);
    if (quote.said !== undefined && quote.said !== true) {
      shapeError(`${path}.said`, 'true when present');
    }
    return {
      paragraph: quote.paragraph as number,
      text: quote.text as string,
      ...(quote.said === true ? { said: true as const } : {})
    };
  });
  const pair = typeof tile.kindLabel === 'string' && tile.kindLabel.trim() === LIGHTBOX_TILE_KIND_LABELS.subtext;
  if (pair && quotes[0].said !== true) {
    shapeError('tile.quotes[0].said', 'true: a said/meant pair leads with its said line');
  }
  quotes.forEach((quote, index) => {
    if (quote.said && (!pair || index > 0)) {
      shapeError(`tile.quotes[${index}].said`, 'absent: only a said/meant pair\'s first quote is its said line');
    }
  });
  return {
    origin: 'lightbox',
    boardId: text('boardId', LIMITS.idCharacters),
    tileId: text('tileId', LIMITS.idCharacters),
    kindLabel: text('kindLabel', LIMITS.labelCharacters),
    lensLabel: text('lensLabel', LIMITS.labelCharacters),
    title: text('title', LIMITS.titleCharacters),
    claim: text('claim', LIMITS.claimCharacters),
    points,
    quotes,
    sourceLabel: text('sourceLabel', LIMITS.sourceLabelCharacters, true)
  };
}

/** The pill's label, and the frame's name: what kind of reading, and its title. */
export function workshopLightboxTileLabel(tile: Pick<WorkshopLightboxTile, 'kindLabel' | 'title'>): string {
  return `Lightbox ${tile.kindLabel}: ${tile.title}`.slice(0, LIMITS.attachmentLabelCharacters).trim();
}

/** The attachment's body: the claim, its points, its quotes. The frame adds its name, source and trust line. */
export function renderWorkshopLightboxTile(tile: WorkshopLightboxTile): string {
  const quote = (entry: WorkshopLightboxTileQuote): string =>
    `- ¶${entry.paragraph}${entry.said ? ' (said)' : ''}: “${entry.text}”`;
  return [
    `Reading: ${tile.kindLabel}, from the ${tile.lensLabel} lens`,
    `Title: ${tile.title}`,
    `Claim: ${tile.claim}`,
    ...tile.points.map((point) => `${point.label}: ${point.text}`),
    'Quotes, as the chapter has them:',
    ...tile.quotes.map(quote)
  ].join('\n');
}

/**
 * The pending attachment a tile becomes. Its words are counted, and the tile
 * limits keep them far inside `PROMPT_BUDGETS.workshopThreadArtifacts`, so
 * nothing is cut; a tile over that budget would be refused, not truncated.
 */
export function workshopLightboxTileAttachmentInput(tile: WorkshopLightboxTile): WorkshopMessageAttachmentInput {
  const content = renderWorkshopLightboxTile(tile);
  const words = countWords(content);
  if (words > PROMPT_BUDGETS.workshopThreadArtifacts.words) {
    throw new Error(`tile is ${words} words; a message attachment carries at most ${PROMPT_BUDGETS.workshopThreadArtifacts.words}`);
  }
  return {
    label: workshopLightboxTileLabel(tile),
    words,
    ...(tile.sourceLabel ? { relativePath: tile.sourceLabel } : {}),
    content,
    sourceUri: workshopLightboxTileSourceKey(tile),
    lightboxTile: {
      boardId: tile.boardId,
      tileId: tile.tileId,
      kindLabel: tile.kindLabel,
      quotes: tile.quotes.length,
      sourceLabel: tile.sourceLabel
    }
  };
}
