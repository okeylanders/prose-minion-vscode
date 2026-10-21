/**
 * The board's verified digest: what group F, the Opinion, reads (ADR
 * 2026-10-19 D7 addendum; Slice 4D). Pure: no host, no I/O.
 *
 * Built by the host from the board as it stands when F starts, never from
 * the chapter:
 * - the measured figures (the headline stats, every figure that stands
 *   out, the Sections lane's first `opinionSections` sections), then every
 *   **current** reading tile
 *   in board order, each under its host key, as `lightboxOpinionItems`
 *   renders it: its claim, its kind's fields, its host counts and up to
 *   `opinionQuotesPerItem` of its found quotes, numbered;
 * - a reading whose lens is stale or being read again is left out, and so
 *   is a spark and every withheld claim (withheld claims are not tiles);
 * - no paragraph text but the found quotes and counted terms, no context
 *   file, no path;
 * - bounded by `PROMPT_BUDGETS.lightbox.opinionDigestTokens`, in the
 *   engine's own estimated tokens, so the estimate can price F "up to" it.
 *   Readings past the bound are left out in board order, and the digest
 *   says how many, from which lenses.
 * Its `key` names the board, its text and every item it held by content
 * (`basis`): the same board measured again under another preset or
 * average, or a cited tile read again, is another key. The run records the
 * key it read; the call's reply is checked against these items only.
 */

import { createHash } from 'node:crypto';
import type { LightboxBoard, LightboxLensId } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIGHTBOX_LENSES, LIGHTBOX_TILE_LENS, lightboxLensLabel } from '@shared/constants/lightbox';
import {
  lightboxOpinionItems,
  lightboxOpinionItemText,
  type LightboxOpinionItem
} from '@shared/constants/lightboxOpinionItems';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import { lightboxGroupSentinels } from '@/infrastructure/lightbox/LightboxReadingWire';

/** Tokens kept back from the bound for the joins and the closing note, so the whole section stays within it. */
const NOTE_RESERVE_TOKENS = 160;

export interface LightboxOpinionDigest {
  boardId: string;
  contentHash: string;
  /** The board, its text and every item held, by content. */
  key: string;
  /** The board section of F's user message. */
  section: string;
  /** The items the call may cite, by key. */
  items: ReadonlyMap<string, LightboxOpinionItem>;
  /** Current reading tiles the digest holds. */
  readings: number;
  /** Current reading tiles left out to stay within the bound. */
  leftOut: number;
  /** The engine's estimate of `section`. */
  tokens: number;
}

/** The digest of `board` as it stands, within `bound` tokens. */
export function buildLightboxOpinionDigest(
  board: LightboxBoard,
  bound: number = PROMPT_BUDGETS.lightbox.opinionDigestTokens
): LightboxOpinionDigest {
  const all = lightboxOpinionItems(board);
  // A long book can hold many sections: the digest names the first `opinionSections`, and says so.
  const sections = all.filter((item) => item.key.startsWith('section:'));
  const measured = all.filter((item) => item.kind === 'measured' && !sections.includes(item))
    .concat(sections.slice(0, PROMPT_BUDGETS.lightbox.opinionSections));
  const sectionsLeft = sections.length - Math.min(sections.length, PROMPT_BUDGETS.lightbox.opinionSections);
  const readings = all.filter((item) => item.kind === 'tile');
  const current = readings.filter((item) => item.current);
  const notCurrent = lensesOf(board, readings.filter((item) => !item.current));

  const head = headSection(board);
  const blocks = [head, '## Measured', ...measured.map(lightboxOpinionItemText), '## Readings'];
  let used = estimateTextTokens(blocks.join('\n\n')) + NOTE_RESERVE_TOKENS;
  const held: LightboxOpinionItem[] = [];
  for (const item of current) {
    const cost = estimateTextTokens(lightboxOpinionItemText(item)) + 1;
    if (used + cost > bound) {
      break;
    }
    used += cost;
    held.push(item);
  }
  const render = (): string => [
    ...blocks,
    ...(held.length > 0 ? held.map(lightboxOpinionItemText) : ['No current reading is on the board.']),
    ...closingNote(board, notCurrent, current.slice(held.length), sectionsLeft)
  ].join('\n\n');
  let section = render();
  // The reserve covers the closing note; should it not, the last reading goes, until the whole fits.
  while (estimateTextTokens(section) > bound && held.length > 0) {
    held.pop();
    section = render();
  }
  const left = current.slice(held.length);
  const items = new Map([...measured, ...held].map((item) => [item.key, item]));
  return {
    boardId: board.boardId,
    contentHash: board.source.contentHash,
    key: createHash('sha256')
      .update(JSON.stringify([board.boardId, board.source.contentHash, [...items.values()].map((item) => [item.key, item.basis]), left.map((item) => item.key)]))
      .digest('hex'),
    section,
    items,
    readings: held.length,
    leftOut: left.length,
    tokens: estimateTextTokens(section)
  };
}

/** F's task: what to return, and how to cite. */
export function buildLightboxOpinionTaskSection(): string {
  const { start, end } = lightboxGroupSentinels('F');
  return [
    '# Task',
    '',
    'Read group F, the Opinion, and only that: weigh the board above.',
    `Return one frame between ${start} and ${end}. Its JSON has "version": 1 and exactly this lens key: "opinion".`,
    'Cite board items only by the keys in square brackets above, and a tile\'s quote only by its number there (q0 is 0).'
  ].join('\n');
}

/** F's whole user message: the digest, then the task. */
export function buildLightboxOpinionUserMessage(digest: Pick<LightboxOpinionDigest, 'section'>): string {
  return `${digest.section}\n\n${buildLightboxOpinionTaskSection()}`;
}

function headSection(board: LightboxBoard): string {
  const paragraphs = board.source.paragraphCount;
  return [
    '# The board',
    '',
    `The Lightbox board of one chapter (${paragraphs.toLocaleString('en-US')} ${paragraphs === 1 ? 'paragraph' : 'paragraphs'}), as code ` +
      'checked it. Each item stands under its key in square brackets: the measured figures, then each current reading. ' +
      'Every quote below was found by code in the paragraph it names; every count was made by code. The chapter itself is not here.'
  ].join('\n');
}

/** What the digest leaves out and why: lenses not current, and readings past the bound. */
function closingNote(
  board: LightboxBoard,
  notCurrent: readonly string[],
  left: readonly LightboxOpinionItem[],
  sectionsLeft: number
): string[] {
  const lines: string[] = [];
  if (sectionsLeft > 0) {
    lines.push(`- Sections past the first ${PROMPT_BUDGETS.lightbox.opinionSections}: ${sectionsLeft.toLocaleString('en-US')} more.`);
  }
  if (notCurrent.length > 0) {
    lines.push(`- Left out as not current (read against an earlier text, or being read again): ${notCurrent.join(', ')}.`);
  }
  if (left.length > 0) {
    lines.push(`- Left out to keep the digest within its bound: ${left.length.toLocaleString('en-US')} ` +
      `${left.length === 1 ? 'reading' : 'readings'}, from ${lensesOf(board, left).join(', ')}.`);
  }
  return lines.length > 0 ? ['## Not in this digest', lines.join('\n')] : [];
}

/** The lenses `items` come from, in rail order, by name. */
function lensesOf(board: LightboxBoard, items: readonly LightboxOpinionItem[]): string[] {
  const keys = new Set(items.map((item) => item.key));
  const lenses = new Set<LightboxLensId>();
  for (const tile of board.readings.flatMap((group) => group.tiles)) {
    if (keys.has(tile.id)) {
      lenses.add(LIGHTBOX_TILE_LENS[tile.kind]);
    }
  }
  return LIGHTBOX_LENSES.filter((lens) => lenses.has(lens.id)).map((lens) => lightboxLensLabel(lens.id));
}
