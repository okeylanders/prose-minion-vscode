/**
 * Saved boards and reading tolerance (Slice 4H, epic decision 37): format 1
 * has not shipped, and its codec bounds no reading's text and no list's
 * length, so a board holding readings longer than their asks, and more
 * items than asked, saves and reads back whole; and both format-1 fixtures
 * still read, and write back, byte for byte. The board is the every-kind
 * board of ¶1–¶8 of "Alice's Adventures in Wonderland" (Lewis Carroll,
 * 1865, public domain), lengthened with sentences written for this test.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LightboxBoard, LightboxReadingTile } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  decodeLightboxBoardFile,
  encodeLightboxBoardFile,
  lightboxBoardOfFile,
  writeLightboxBoardFile
} from '@/infrastructure/storage/LightboxBoardCodec';
import { everyKindBoard } from '@/__tests__/infrastructure/lightbox/lightboxSavedBoardFixtures';

const B = PROMPT_BUDGETS.lightbox;
const SAVED_AT = new Date('2026-10-23T09:00:00.000Z');
const FIXTURES = path.resolve(__dirname, '../../fixtures');
const LONGER = ' The reading holds across the chapter, from its opening lines to its close.';

/** The longest a codec lets a field run: its ask times the safety ceiling's multiple. */
const atCeiling = (start: string, ask: number) => {
  let text = start;
  while (text.length + LONGER.length <= ask * B.safetyMultiple) {
    text += LONGER;
  }
  return text;
};

/** Every reading tile's claim and title past its ask, and each group's tiles doubled under new ids. */
function overrun(board: LightboxBoard): LightboxBoard {
  const longer = (tile: LightboxReadingTile): LightboxReadingTile => ({
    ...tile,
    title: atCeiling(tile.title, B.labelCharacters),
    claim: atCeiling(tile.claim, B.claimCharacters),
    friction: atCeiling(tile.friction, B.frictionCharacters),
    evidence: [...tile.evidence, ...tile.evidence, ...tile.evidence]
  });
  return {
    ...board,
    readings: board.readings.map((group) => ({
      ...group,
      tiles: [
        ...group.tiles.map(longer),
        // Extra items of kinds a list may hold more of than asked; the Opinion is one tile, and stays one.
        ...group.tiles.filter((tile) => tile.kind !== 'opinion').map((tile) => ({ ...longer(tile), id: `${tile.id}-more` }))
      ]
    }))
  };
}

describe('a saved board holding readings past their asks (Slice 4H)', () => {
  it('saves and reads back whole: every longer field and every extra item, nothing dropped', async () => {
    const { board, text } = await everyKindBoard();
    const long = overrun(board);
    const tiles = long.readings.flatMap((group) => group.tiles);
    expect(tiles.some((tile) => tile.claim.length > B.claimCharacters * 4)).toBe(true);
    expect(tiles.length).toBeGreaterThan(board.readings.flatMap((group) => group.tiles).length);

    const json = encodeLightboxBoardFile({ board: long, text, savedAt: SAVED_AT });
    const decoded = decodeLightboxBoardFile(json);
    if (decoded.kind !== 'board') {
      throw new Error(decoded.reason);
    }
    expect({ dropped: decoded.dropped, droppedAt: decoded.droppedAt }).toEqual({ dropped: 0, droppedAt: [] });
    const held = lightboxBoardOfFile(decoded.file);
    expect(held.kind === 'board' && held.board).toEqual(long);
    expect(held.kind === 'board' && encodeLightboxBoardFile({ board: held.board, text, savedAt: SAVED_AT })).toBe(json);
  });

  it.each(['board-v1.json', 'board-v1-named.json'])('still reads %s, written before, and writes it back byte for byte', (name) => {
    const json = fs.readFileSync(path.join(FIXTURES, name), 'utf8');
    const decoded = decodeLightboxBoardFile(json);
    if (decoded.kind !== 'board') {
      throw new Error(decoded.reason);
    }
    expect(decoded.dropped).toBe(0);
    expect(writeLightboxBoardFile(decoded.file)).toBe(json);
  });
});
