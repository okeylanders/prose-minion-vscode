/**
 * A tile's id is identity, never evidence (PR #157 F-01). The host mints
 * reading ids from the run token, `lbt-<first 8 characters of a UUID>-<group>-<n>`,
 * so an id can hold any run of digits. The Opinion may state only figures
 * the items it cites show; digits inside an item's key, or the q0, q1, …
 * numbers the digest gives its quotes, show nothing and authorize nothing.
 *
 * Each case is read twice, on boards that differ only in the run prefix of
 * their ids: `87654321` (digits) and `abcdefab` (the id-only control). Fresh
 * through the production codec, digest and gates; carried onto changed
 * text; and through the selected-view Bring preparer. Displayed counts,
 * measured figures and paragraph numbers stay allowed on both. The board
 * reads ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public domain),
 * with groups A–E read from their worked examples.
 */
import type { LightboxBoard, LightboxOpinionTile } from '@messages';
import { lightboxOpinionItemMap } from '@shared/constants/lightboxOpinionItems';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { LIGHTBOX_OPINION_GATE_REASONS } from '@/infrastructure/lightbox/LightboxOpinionGates';
import { LIGHTBOX_OPINION_HANDOFF_REFUSALS } from '@/infrastructure/lightbox/LightboxOpinionHandoff';
import { LIGHTBOX_OPINION_PHRASING_REASONS } from '@/infrastructure/lightbox/LightboxOpinionPhrasing';
import { prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { boardWithNumbers } from './lightboxCraftFixtures';
import {
  ALICE,
  OPINION_EXAMPLE_LENSES_OFF,
  OPINION_EXAMPLE_PREFIX,
  itemKey,
  opinionBody,
  readChapterGroups,
  readOpinion,
  withOpinion,
  type OpinionBody
} from './lightboxOpinionFixtures';

const DIGITS = '87654321';
const LETTERS = 'abcdefab';
const PREFIXES = [[DIGITS], [LETTERS]] as const;
/** A count no item shows: its digits stand only in the digit board's ids. */
const INVENTED = `The image appears ${DIGITS} times in the passage.`;
const FIGURE = LIGHTBOX_OPINION_PHRASING_REASONS.figure('This observation');
/** ¶1–¶7, a new paragraph, then the old ¶8 as ¶9. */
const INSERTED = [...ALICE.slice(0, 7), 'She fell on and on, and the shelves went by.', ALICE[7]];

const boards = new Map<string, LightboxBoard>();
beforeAll(async () => {
  const measured = await boardWithNumbers(ALICE);
  for (const [prefix] of PREFIXES) {
    boards.set(prefix, readChapterGroups(measured, ALICE, OPINION_EXAMPLE_LENSES_OFF, prefix));
  }
});
const boardOf = (prefix: string): LightboxBoard => boards.get(prefix) as LightboxBoard;

/** The worked example's Opinion, its citations moved onto the ids of `prefix`'s board. */
function exampleOn(prefix: string): OpinionBody {
  return JSON.parse(JSON.stringify(opinionBody()).split(`lbt-${OPINION_EXAMPLE_PREFIX}-`).join(`lbt-${prefix}-`)) as OpinionBody;
}

/** The example with O1 citing the headline's first quote, in `text`, and Neutral, which weighs O1, saying `neutral`. */
function withO1(prefix: string, text: string, neutral?: string): OpinionBody {
  const body = exampleOn(prefix);
  body.observations[0] = { id: 'O1', text, cites: [{ tile: `lbt-${prefix}-A-1`, quote: 0 }] };
  if (neutral) {
    body.views.neutral.body = neutral;
  }
  return body;
}

const read = (prefix: string, body: OpinionBody) => readOpinion(boardOf(prefix), body, `lbt-${prefix}-F-1`);
const o1Reason = (tile: LightboxOpinionTile | undefined) => tile?.withheldObservations.find((entry) => entry.id === 'O1')?.reason;

describe('a tile id is identity, never evidence (PR #157 F-01)', () => {
  it('gives every item the same figures whatever digits its key holds, and none from its key or quote numbers', () => {
    const digits = lightboxOpinionItemMap(boardOf(DIGITS));
    const letters = lightboxOpinionItemMap(boardOf(LETTERS));
    expect(digits.size).toBe(letters.size);
    for (const [key, item] of digits) {
      const twin = letters.get(key.split(DIGITS).join(LETTERS));
      expect([key, [...item.figures].sort()]).toEqual([key, [...(twin?.figures ?? [])].sort()]);
      expect(item.figures.has(DIGITS)).toBe(false);
    }
    // Literal values, read off the board's data (PR #157 recheck: never derived from the lines under test).
    // The headline counts rabbit ×4 (¶3, ¶4), rabbit-hole ×3 (¶1, ¶4, ¶6), fall ×1 (¶8), and quotes ¶4 and ¶6:
    // none of its key's 8, 7, 6, 5, 4, 3, 2, 1 nor its quotes' q0 and q1 counts for itself.
    for (const [prefix, items] of [[DIGITS, digits], [LETTERS, letters]] as const) {
      expect([prefix, [...(items.get(`lbt-${prefix}-A-1`)?.figures ?? [])].sort()]).toEqual([prefix, ['1', '3', '4', '6', '8']]);
    }
  });

  it.each(PREFIXES)('keeps displayed counts, measured figures and paragraph numbers allowed (ids %s)', (prefix) => {
    // The worked example states 31.8, 14.3, 12.2, 30, ¶5 and ¶7, each shown by what it cites.
    const example = read(prefix, exampleOn(prefix));
    expect([example.tile?.observations.length, example.tile?.views.length]).toEqual([6, 3]);
    // The watch's host counts: mentioned twice, first in ¶4.
    const body = exampleOn(prefix);
    body.observations[3] = { id: 'O4', text: 'The watch is mentioned 2 times, first in ¶4.', cites: [{ tile: itemKey(boardOf(prefix), 'Artifacts · Object: The watch') }] };
    const counted = read(prefix, body);
    expect(counted.tile?.observations.find((observation) => observation.id === 'O4')?.text).toBe('The watch is mentioned 2 times, first in ¶4.');
  });

  it.each(PREFIXES)('withholds, fresh, a count that only the cited tile\'s id holds (ids %s)', (prefix) => {
    const { tile } = read(prefix, withO1(prefix, INVENTED, INVENTED));
    expect(o1Reason(tile)).toBe(FIGURE);
    // Neutral and Enthusiastic weigh O1; Blunt does not, and stands alone.
    expect(tile?.views.map((view) => view.view)).toEqual(['blunt']);
    expect(tile?.withheldViews.map((view) => [view.view, view.reason])).toEqual([
      ['enthusiastic', LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn],
      ['neutral', LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn]
    ]);
    expect(JSON.stringify(tile)).not.toContain(`${DIGITS} times`);
  });

  it.each(PREFIXES)('withholds it on carry too, from an Opinion drawn before the text changed (ids %s)', async (prefix) => {
    // Drawn with a figure the headline shows nowhere, then carried onto changed text.
    const drawn = withOpinion(boardOf(prefix), read(prefix, withO1(prefix, 'The headline rests on the hurry and the fall.')));
    const fresh = drawn.readings.find((group) => group.group === 'F')?.tiles[0] as LightboxOpinionTile;
    expect(fresh.observations[0].text).toBe('The headline rests on the hurry and the fall.');
    const edited: LightboxOpinionTile = { ...fresh, observations: fresh.observations.map((observation) => (observation.id === 'O1' ? { ...observation, text: INVENTED } : observation)) };
    const before = { ...drawn, readings: drawn.readings.map((group) => (group.group === 'F' ? { ...group, tiles: [edited] } : group)) };
    const rebuilt = await boardWithNumbers(INSERTED);
    const readings = carryLightboxReadings(before.readings, {
      readAgainst: before.source.contentHash,
      paragraphs: INSERTED,
      averageWordsPerSentence: rebuilt.measured.headline.averageWordsPerSentence,
      columns: rebuilt.ribbon,
      numbers: rebuilt.measured.numbers.rows,
      measured: rebuilt.measured
    });
    const f = readings.find((group) => group.group === 'F');
    // The headline itself carries, under the same id.
    expect(readings.flatMap((group) => group.tiles).some((tile) => tile.id === `lbt-${prefix}-A-1`)).toBe(true);
    const reason = o1Reason(f?.tiles[0] as LightboxOpinionTile | undefined) ??
      f?.withheldClaims.find((claim) => claim.title === 'Opinion · O1')?.reason;
    expect(reason).toBe(FIGURE);
    expect(JSON.stringify(f?.tiles)).not.toContain(`${DIGITS} times`);
  });

  it.each(PREFIXES)('never brings it: the view that weighs it is refused, and a view that does not travels clean (ids %s)', (prefix) => {
    const opinion = read(prefix, withO1(prefix, INVENTED, INVENTED));
    const board = withOpinion(boardOf(prefix), opinion);
    const bring = (view: 'neutral' | 'blunt') =>
      prepareLightboxTileHandoff({ kind: 'tile', boardId: board.boardId, tileId: `lbt-${prefix}-F-1`, view }, board, ALICE);
    expect(bring('neutral')).toEqual({ ok: false, reason: LIGHTBOX_OPINION_HANDOFF_REFUSALS.withheld });
    const blunt = bring('blunt');
    if (!blunt.ok) {
      throw new Error(blunt.reason);
    }
    // Its ids carry the digits, as every id of this run does; its words never state them.
    const { title, claim, points, quotes } = blunt.handoff.tile;
    expect(JSON.stringify({ title, claim, points, quotes })).not.toContain(DIGITS);
  });
});
