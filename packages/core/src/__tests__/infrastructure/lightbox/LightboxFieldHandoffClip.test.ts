/**
 * Build as a lens (Slice 3) and reading tolerance (Slice 4H): a borrowed
 * field's name and governing metaphor are asks on the board, shown whole,
 * and the Lexical Gravity seed's own bounds clip them with an ellipsis when
 * the field travels; a counted term too long for the seed is left out, as
 * before, since a cut term is no longer the chapter's word. The board reads
 * ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public domain).
 */
import type { LightboxBoard, LightboxGravityFieldTile } from '@messages';
import { LEXICAL_GRAVITY_BUILD_SEED_LIMITS } from '@messages';
import { LIGHTBOX_ELLIPSIS, clipLightboxText } from '@shared/constants/lightboxClip';
import { prepareLightboxHandoff } from '@/infrastructure/lightbox/LightboxHandoff';
import { readWorkedExample } from './lightboxReadingFixtures';
import { makeReadBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

const LIMITS = LEXICAL_GRAVITY_BUILD_SEED_LIMITS;
const ALICE = readWorkedExample('A').paragraphs;

describe('a borrowed field longer than a Build lens seed (Slice 4H)', () => {
  it('travels with its name and metaphor clipped to the seed\'s bounds, an ellipsis marking each cut', () => {
    const board = makeReadBoard();
    const field = board.readings.flatMap((group) => group.tiles).find((tile): tile is LightboxGravityFieldTile => tile.kind === 'gravity-field')!;
    const title = `${field.title}: the long descent through cupboards, shelves, maps and pictures`;
    const metaphor = `${field.metaphor} The fall becomes a slow survey of a house turned on its side, shelf by shelf, until the bottom.`;
    expect(title.length).toBeGreaterThan(LIMITS.fieldCharacters);
    expect(metaphor.length).toBeGreaterThan(LIMITS.metaphorCharacters);
    const long: LightboxBoard = {
      ...board,
      readings: board.readings.map((group) => ({
        ...group,
        tiles: group.tiles.map((tile) => (tile.id === field.id ? { ...field, title, metaphor } : tile))
      }))
    };
    const prepared = prepareLightboxHandoff({ kind: 'lexical-gravity-seed', boardId: long.boardId, fieldId: field.id }, long, ALICE);
    if (!prepared.ok) {
      throw new Error(prepared.reason);
    }
    expect(prepared.handoff.seed.field).toBe(clipLightboxText(title, LIMITS.fieldCharacters));
    expect(prepared.handoff.seed.metaphor).toBe(clipLightboxText(metaphor, LIMITS.metaphorCharacters));
    expect(prepared.handoff.seed.field.endsWith(LIGHTBOX_ELLIPSIS)).toBe(true);
    expect(prepared.handoff.seed.metaphor.endsWith(LIGHTBOX_ELLIPSIS)).toBe(true);
  });
});
