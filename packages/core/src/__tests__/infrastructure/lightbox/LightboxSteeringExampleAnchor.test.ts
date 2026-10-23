/**
 * A note's one example, held to its contract as the chapter has it (PR #160
 * F-02). The codec checks the reading's own pair; anchoring then shows the
 * chapter's text for its first part, which a soft line break and its
 * indent, a doubled space or a spaced dash can make longer, or the same as
 * the second part. That pair is held to a change between its parts again,
 * fresh, on carry and at Bring. Its length is an ask (Slice 4H): the board
 * shows it whole, and Bring clips the pair to one Workshop point, both
 * sides showing. Every line is a synthetic sentence written for these
 * tests.
 */
import type { LightboxBoard, LightboxReadingGroup, LightboxReadingTile, LightboxSteeringNoteTile } from '@messages';
import { WORKSHOP_LIGHTBOX_TILE_LIMITS } from '@messages';
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { anchorLightboxSteeringExample } from '@/infrastructure/lightbox/LightboxSteeringTiles';
import { prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { lightboxSteeringExamplePoint } from '@/infrastructure/lightbox/LightboxSteeringHandoff';
import { validateWorkshopLightboxTile } from '@/application/services/workshop/WorkshopLightboxTileAttachment';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { frame } from './lightboxReadingFixtures';

/** 56 characters and 8 words, within the asks; and 56 characters, 6 words. */
const BEFORE = 'She was waiting beside the window contemplating daylight';
const AFTER = 'Daylight brightened motionless drapes beside floorboards';
const ONE_LINE = [`${BEFORE}.`];
/** The same words with soft line breaks and their indents, as a wrapped Markdown paragraph holds them. */
const SOFT_WRAP = ['She was waiting beside\n    the window\n    contemplating daylight.'];
const NUDGE = 'An action for her may be worth a look, so the waiting moves.';

function readG(paragraphs: readonly string[], quote: string, example: { before: string; after: string }): LightboxReadingGroup {
  const response = frame('G', {
    version: 1,
    steering: {
      figures: [{
        stat: 'being-verbs', claim: 'A state holds the scene still.', evidence: [{ para: 1, quote }],
        notes: [{ para: 1, quote, stance: 'leans', why: 'A state stands where she could act.', nudge: NUDGE, example }]
      }],
      friction: 'One line is thin ground.'
    }
  });
  const decoded = decodeLightboxGroup(response, { group: 'G', lenses: ['steering'], columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `g${++id}`
  });
  return {
    group: 'G', status: 'ok', lenses: ['steering'], tiles: assembled.tiles, withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims, frictions: assembled.frictions, quoteChecks: assembled.quoteChecks
  };
}

const noteOf = (group: LightboxReadingGroup) =>
  group.tiles.find((tile): tile is LightboxSteeringNoteTile => tile.kind === 'steering-note') as LightboxSteeringNoteTile;
const shown = (group: LightboxReadingGroup) => {
  const note = noteOf(group);
  return { example: note.example, withheld: note.exampleWithheld, nudge: note.nudge };
};

/** The pair as the chapter has it, its first part in the chapter's own words. */
const asChapterHasIt = (before: string) => ({ before, after: AFTER });
const WRAPPED_BEFORE = 'She was waiting beside\n    the window\n    contemplating daylight';

describe('an anchored example keeps its contract as the chapter has it (PR #160 F-02; Slice 4H)', () => {
  it('shows a pair at the asks when the chapter has the words as the reading gave them', () => {
    expect(shown(readG(ONE_LINE, BEFORE, { before: BEFORE, after: AFTER })))
      .toEqual({ example: { before: BEFORE, after: AFTER }, withheld: undefined, nudge: NUDGE });
  });

  it('shows the chapter\'s own first part when its soft line breaks carry it past the ask', () => {
    expect(WRAPPED_BEFORE.length).toBeGreaterThan(56);
    expect(shown(readG(SOFT_WRAP, BEFORE, { before: BEFORE, after: AFTER })))
      .toEqual({ example: asChapterHasIt(WRAPPED_BEFORE), withheld: undefined, nudge: NUDGE });
  });

  it('shows it with a doubled space in the chapter, one character past the old bound', () => {
    const doubled = 'She was waiting beside the  window contemplating daylight';
    expect(shown(readG([`${doubled}.`], BEFORE, { before: BEFORE, after: AFTER })))
      .toEqual({ example: asChapterHasIt(doubled), withheld: undefined, nudge: NUDGE });
  });

  it('shows it when a spaced dash in the chapter carries its first part past the words asked', () => {
    const before = 'She was waiting—quiet beside the open dark window';
    expect(shown(readG(['She was waiting — quiet beside the open dark window.'], before, { before, after: 'She waited by the window' })))
      .toEqual({
        example: { before: 'She was waiting — quiet beside the open dark window', after: 'She waited by the window' },
        withheld: undefined,
        nudge: NUDGE
      });
  });

  it('reads a pair that differs only by a dash as no change, before and after anchoring', () => {
    const chapter = ['She was—quiet beside the window.'];
    expect(shown(readG(chapter, 'She was—quiet beside the window', { before: 'was-quiet', after: 'was—quiet' })).withheld)
      .toBe('Its example shows no change: its second part is its first again.');
    // The anchor holds the chapter's pair to the same rule, whatever reached it.
    expect(anchorLightboxSteeringExample(createLightboxQuoteVerifier(chapter), 'being-verbs',
      { paragraph: 1, text: 'She was—quiet beside the window' }, { before: 'was-quiet', after: 'was—quiet' })).toEqual({ fault: 'same' });
  });

  it('carries an example onto the changed text in the chapter\'s own words', () => {
    const read = readG(ONE_LINE, BEFORE, { before: BEFORE, after: AFTER });
    expect(shown(read).example).toEqual({ before: BEFORE, after: AFTER });
    const [carried] = carryLightboxReadings([read], { readAgainst: 'old', paragraphs: SOFT_WRAP, averageWordsPerSentence: 8 });
    expect(shown(carried)).toEqual({ example: asChapterHasIt(WRAPPED_BEFORE), withheld: undefined, nudge: NUDGE });
    expect(noteOf(carried).evidence[0].text).toBe(WRAPPED_BEFORE);
  });
});

describe('Bring carries the example in one Workshop point, clipped when longer (PR #160 F-02; Slice 4H)', () => {
  const boardOf = (group: LightboxReadingGroup): LightboxBoard => ({
    ...makeBoard(1),
    readings: LIGHTBOX_READING_GROUPS.map((id) => (id === 'G' ? group : emptyLightboxReadingGroup(id)))
  });
  const bring = (board: LightboxBoard, tile: LightboxReadingTile, paragraphs: readonly string[]) => {
    const prepared = prepareLightboxTileHandoff({ kind: 'tile', boardId: board.boardId, tileId: tile.id }, board, paragraphs);
    if (!prepared.ok) {
      throw new Error(prepared.reason);
    }
    return prepared.handoff.tile;
  };

  it('carries a pair that fits whole, 115 characters in one point', () => {
    const read = readG(ONE_LINE, BEFORE, { before: BEFORE, after: AFTER });
    const points = bring(boardOf(read), noteOf(read), ONE_LINE).points;
    expect(points[2]).toEqual({ label: 'One way it could go', text: `${BEFORE} → ${AFTER}` });
    expect(points[2].text).toHaveLength(115);
  });

  it('clips a pair longer than one point as the chapter has it, both sides showing, and keeps the note', () => {
    const read = readG(ONE_LINE, BEFORE, { before: BEFORE, after: AFTER });
    const sent = validateWorkshopLightboxTile(bring(boardOf(read), noteOf(read), SOFT_WRAP));
    const [stance, nudge, example] = sent.points;
    expect([stance, nudge]).toEqual([{ label: 'Stance', text: 'Leans · Being verbs' }, { label: 'Nudge', text: NUDGE }]);
    expect(example.label).toBe('One way it could go');
    expect(example.text).toBe(lightboxSteeringExamplePoint(asChapterHasIt(WRAPPED_BEFORE)));
    expect(example.text.length).toBeLessThanOrEqual(WORKSHOP_LIGHTBOX_TILE_LIMITS.pointCharacters);
    const [before, after] = example.text.split(' → ');
    expect(before.endsWith('…')).toBe(true);
    expect(WRAPPED_BEFORE.startsWith(before.slice(0, -1))).toBe(true);
    expect(after).toBe(AFTER);
    expect(sent.quotes).toEqual([{ paragraph: 1, text: WRAPPED_BEFORE }]);
  });

  it('clips a pair whose asks run past one point on the board as written, both parts clipped where each runs long', () => {
    const before = 'x'.repeat(72);
    const after = 'y'.repeat(72);
    const text = lightboxSteeringExamplePoint({ before, after });
    expect(text).toHaveLength(WORKSHOP_LIGHTBOX_TILE_LIMITS.pointCharacters);
    expect(text).toBe(`${'x'.repeat(57)}… → ${'y'.repeat(58)}…`);
  });
});
