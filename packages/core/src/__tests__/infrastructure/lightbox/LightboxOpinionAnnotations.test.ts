/**
 * Host words inside a digest line are not evidence (PR #157 F-01 residual).
 * Some lines carry host-authored routing or labels beside the reading's
 * values: Subtext's "the said line is q0" (which quote is the said line)
 * and a gravity field's degree labels "1°, 2°, 3°". The digest shows them,
 * so its wording and every basis stay as they were, but they authorize no
 * figure: an Opinion may not state 0 because a line says q0, nor 3 because
 * a line says 3°.
 *
 * Expected figures are literal values read off the board's own data, never
 * derived from the lines under test. Witnesses run fresh through the
 * production codec, digest and gates, on carry, and through the
 * selected-view Bring preparer, each beside a control: the same tile without
 * the annotation, and with a displayed zero. The board is the every-lens
 * worked-example board over ¶1–¶8 of "Alice's Adventures in Wonderland"
 * (1865, public domain).
 */
import type { LightboxBoard, LightboxOpinionTile, LightboxReadingTile } from '@messages';
import { lightboxOpinionItemMap, lightboxOpinionItemText } from '@shared/constants/lightboxOpinionItems';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { LIGHTBOX_OPINION_GATE_REASONS } from '@/infrastructure/lightbox/LightboxOpinionGates';
import { LIGHTBOX_OPINION_HANDOFF_REFUSALS } from '@/infrastructure/lightbox/LightboxOpinionHandoff';
import { LIGHTBOX_OPINION_PHRASING_REASONS } from '@/infrastructure/lightbox/LightboxOpinionPhrasing';
import { prepareLightboxTileHandoff } from '@/infrastructure/lightbox/LightboxTileHandoff';
import { boardWithNumbers } from './lightboxCraftFixtures';
import { ALICE, aliceOpinionBoard, itemKey, readOpinion, withOpinion, type OpinionBody } from './lightboxOpinionFixtures';

const RABBIT = 'Subtext · Said / meant: White Rabbit';
const FIRE = 'Lexical gravity · Borrowed field: Fire';
const ZERO = 'The passage contains 0 spoken lines.';
const FIGURE = LIGHTBOX_OPINION_PHRASING_REASONS.figure('This observation');
const OPINION_ID = 'lbt-annotations-F-1';
/** ¶1–¶7, a new paragraph, then the old ¶8 as ¶9. */
const INSERTED = [...ALICE.slice(0, 7), 'She fell on and on, and the shelves went by.', ALICE[7]];

let board: LightboxBoard;
beforeAll(async () => {
  board = await aliceOpinionBoard([]);
});

const sorted = (figures: ReadonlySet<string> | undefined) => [...(figures ?? [])].sort();

/** An Opinion whose O1 cites `cite` and says `text`; Neutral weighs O1 alone (and may say `neutral`), Blunt only O2. */
function opinion(on: LightboxBoard, cite: OpinionBody['observations'][number]['cites'][number], text: string, neutral?: string): OpinionBody {
  const view = (headline: string, observations: string[], body = 'The two readings weigh evenly, and the chapter keeps its pace.') =>
    ({ headline, body, why: [{ weight: 'even', text: 'They weigh the same.', observations }] });
  return {
    observations: [
      { id: 'O1', text, cites: [cite] },
      { id: 'O2', text: 'The headline reading follows the hurry and the fall.', cites: [{ tile: itemKey(on, 'Headline · Headline:'), quote: 0 }] }
    ],
    views: {
      enthusiastic: view('Both readings carry the chapter.', ['O1', 'O2']),
      neutral: view('One reading carries the chapter.', ['O1'], neutral),
      blunt: view('The fall does the work.', ['O2'])
    },
    friction: 'A stand-in Opinion for these checks: it weighs two readings and no more.'
  };
}

/** `on` with the tile under `label` replaced by `edit` of it. */
function withTile(on: LightboxBoard, label: string, edit: (tile: LightboxReadingTile) => LightboxReadingTile): LightboxBoard {
  const id = itemKey(on, label);
  return { ...on, readings: on.readings.map((group) => ({ ...group, tiles: group.tiles.map((tile) => (tile.id === id ? edit(tile) : tile)) })) };
}
/** The Subtext tile as an ordinary headline-kind tile: same id, title, claim and quotes, no annotation. */
const asHeadline = (tile: LightboxReadingTile) => ({ ...tile, kind: 'headline' }) as LightboxReadingTile;

const o1Reason = (tile: LightboxOpinionTile | undefined) => tile?.withheldObservations.find((entry) => entry.id === 'O1')?.reason;
const read = (on: LightboxBoard, body: OpinionBody) => readOpinion(on, body, OPINION_ID);

describe('host words inside a digest line are not evidence (PR #157 F-01 residual)', () => {
  it('allows each item exactly the figures its readings and quotes show, as literal values', () => {
    const items = lightboxOpinionItemMap(board);
    // Subtext's said line and its context are both in ¶4; "the said line is q0" adds nothing.
    expect(sorted(items.get(itemKey(board, RABBIT))?.figures)).toEqual(['4']);
    // Fire: 2 hits (1, 1 and 0 by degree), pull 0.18, all in ¶4, each term once; the degree labels 1°, 2°, 3° add nothing.
    expect(sorted(items.get(itemKey(board, FIRE))?.figures)).toEqual(['0', '0.18', '1', '2', '4']);
    // Ledger: 3 hits (2, 1, 0), pull 0.24, ¶2 and ¶3: its own values already hold 1, 2 and 3.
    expect(sorted(items.get(itemKey(board, 'Lexical gravity · Borrowed field: Ledger'))?.figures)).toEqual(['0', '0.24', '1', '2', '3']);
    // An ordinary reading: counted terms ×4, ×3, ×1 in ¶1, ¶3, ¶4, ¶6, ¶8, and quotes in ¶4 and ¶6.
    expect(sorted(items.get(itemKey(board, 'Headline · Headline:'))?.figures)).toEqual(['1', '3', '4', '6', '8']);
    // Measured: 508 words, 15 sentences, 8 paragraphs, 33.9 a sentence, dialogue 12.2 per 100 words.
    // ADR 2026-10-21 moved these: 17 and 29.9 originally; 16 and 31.8 once the `)` that ends ¶8 joined
    // its sentence; 15 and 33.9 once ¶8's "“Well!” thought Alice …" joined its speech tag.
    expect(sorted(items.get('headline')?.figures)).toEqual(['100', '12.2', '15', '33.9', '508', '8']);
  });

  it('keeps the digest\'s wording, so no digest, key or basis moves', () => {
    const rabbit = lightboxOpinionItemMap(board).get(itemKey(board, RABBIT));
    expect(rabbit && lightboxOpinionItemText(rabbit)).toBe([
      `[${itemKey(board, RABBIT)}] ${RABBIT}`,
      '  claim: Being late is the whole of its worry; what it is late for never comes into it.',
      '  speaker: White Rabbit · the said line is q0; the claim is what it is read as meaning',
      '  q0 ¶4: “Oh dear! Oh dear! I shall be late!”',
      '  q1 ¶4: “TOOK A WATCH OUT OF ITS WAISTCOAT-POCKET”'
    ].join('\n'));
    const fire = lightboxOpinionItemMap(board).get(itemKey(board, FIRE));
    expect(fire?.lines).toContain('hits 2 (1° 1, 2° 1, 3° 0) · below the gravity line · first ¶4, last ¶4, densest ¶4–¶4');
  });

  it('withholds, fresh, a zero that only "the said line is q0" holds, and every view that weighs it', () => {
    const { tile } = read(board, opinion(board, { tile: itemKey(board, RABBIT), quote: 0 }, ZERO, ZERO));
    expect(o1Reason(tile)).toBe(FIGURE);
    expect(tile?.views.map((view) => view.view)).toEqual(['blunt']);
    expect(tile?.withheldViews.map((view) => [view.view, view.reason])).toEqual([
      ['enthusiastic', LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn],
      ['neutral', LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn]
    ]);
  });

  it('controls: the same tile without the annotation withholds it too; with a displayed zero, it stands', () => {
    const plain = withTile(board, RABBIT, asHeadline);
    const plainLabel = 'Subtext · Headline: White Rabbit';
    expect(o1Reason(read(plain, opinion(plain, { tile: itemKey(plain, plainLabel), quote: 0 }, ZERO)).tile)).toBe(FIGURE);
    const shown = withTile(board, RABBIT, (tile) => asHeadline({ ...tile, title: 'White Rabbit, after 0 replies' }));
    const drawn = read(shown, opinion(shown, { tile: itemKey(shown, 'Subtext · Headline: White Rabbit, after 0 replies'), quote: 0 }, ZERO));
    expect(drawn.tile?.observations.map((observation) => observation.id)).toEqual(['O1', 'O2']);
    // The fix withholds no more than it should: a Subtext tile that shows a zero still allows it.
    const subtextShown = withTile(board, RABBIT, (tile) => ({ ...tile, title: 'White Rabbit, after 0 replies' }));
    const subtext = read(subtextShown, opinion(subtextShown, { tile: itemKey(subtextShown, 'Subtext · Said / meant: White Rabbit, after 0 replies'), quote: 0 }, ZERO));
    expect(o1Reason(subtext.tile)).toBeUndefined();
  });

  it('withholds a count that only a degree label (3°) holds, and keeps the field\'s own hit count (2)', () => {
    const fire = { tile: itemKey(board, FIRE) };
    expect(o1Reason(read(board, opinion(board, fire, 'The fire field is borrowed 3 times.')).tile)).toBe(FIGURE);
    expect(o1Reason(read(board, opinion(board, fire, 'The fire field is borrowed 2 times.')).tile)).toBeUndefined();
  });

  it('withholds it on carry too, from an Opinion drawn before the text changed', async () => {
    const drawn = withOpinion(board, read(board, opinion(board, { tile: itemKey(board, RABBIT), quote: 0 }, 'The Rabbit worries only about being late.')));
    const fresh = drawn.readings.find((group) => group.group === 'F')?.tiles[0] as LightboxOpinionTile;
    expect(o1Reason(fresh)).toBeUndefined();
    const edited: LightboxOpinionTile = { ...fresh, observations: fresh.observations.map((observation) => (observation.id === 'O1' ? { ...observation, text: ZERO } : observation)) };
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
    // The Rabbit's said line carries, under the same id.
    expect(readings.flatMap((group) => group.tiles).some((tile) => tile.id === itemKey(board, RABBIT))).toBe(true);
    const f = readings.find((group) => group.group === 'F');
    expect(o1Reason(f?.tiles[0] as LightboxOpinionTile | undefined) ?? f?.withheldClaims.find((claim) => claim.title === 'Opinion · O1')?.reason).toBe(FIGURE);
  });

  it('never brings it: the view that weighs it is refused on the fresh board, and a view that does not travels clean', () => {
    const on = withOpinion(board, read(board, opinion(board, { tile: itemKey(board, RABBIT), quote: 0 }, ZERO, ZERO)));
    const bring = (view: 'neutral' | 'blunt') =>
      prepareLightboxTileHandoff({ kind: 'tile', boardId: on.boardId, tileId: OPINION_ID, view }, on, ALICE);
    expect(bring('neutral')).toEqual({ ok: false, reason: LIGHTBOX_OPINION_HANDOFF_REFUSALS.withheld });
    const blunt = bring('blunt');
    if (!blunt.ok) {
      throw new Error(blunt.reason);
    }
    expect(JSON.stringify(blunt.handoff.tile)).not.toContain('0 spoken lines');
  });
});
