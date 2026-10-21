/**
 * Craft steering in the Opinion's digest (Slice 4F; epic decision 24): each
 * figure's measured counts as a citable item of its own, each reading with
 * its counts and each note with its stance, never a nudge or an example,
 * which are the board's advice to the writer and no evidence. A count the
 * digest shows is a figure an observation citing it may state; one it does
 * not show is withheld. Built on the worked example's own board (the Alice
 * excerpt, Lewis Carroll, 1865, public domain, groups A–E and G read from
 * their worked examples) by the production digest, codec and gates.
 */
import type { LightboxBoard, LightboxSteeringNoteTile } from '@messages';
import { buildLightboxOpinionDigest } from '@/infrastructure/lightbox/LightboxOpinionDigest';
import { LIGHTBOX_OPINION_GATE_REASONS } from '@/infrastructure/lightbox/LightboxOpinionGates';
import { LIGHTBOX_OPINION_PHRASING_REASONS } from '@/infrastructure/lightbox/LightboxOpinionPhrasing';
import { lightboxOpinionItemText } from '@shared/constants/lightboxOpinionItems';
import { aliceOpinionBoard, opinionBody, readOpinion, type OpinionBody } from './lightboxOpinionFixtures';

let board: LightboxBoard;
beforeAll(async () => {
  board = await aliceOpinionBoard();
});

const textOf = (digest: ReturnType<typeof buildLightboxOpinionDigest>, key: string) => {
  const item = digest.items.get(key);
  return item ? lightboxOpinionItemText(item) : undefined;
};
const notes = () => board.readings.flatMap((group) => group.tiles)
  .filter((tile): tile is LightboxSteeringNoteTile => tile.kind === 'steering-note');

describe('craft steering in the Opinion\'s digest', () => {
  it('holds each figure\'s counts under its steering key, as the host measured them', () => {
    const digest = buildLightboxOpinionDigest(board);
    expect(textOf(digest, 'steering:adverbs')).toBe([
      '[steering:adverbs] Measured · Craft steering: Adverbs (-ly)',
      '  7 -ly words, 13.8 per 1,000 words: 7 in narration, 0 in dialogue',
      '  by construction, counted by code: with a verb 4 (weak verbs 1) · in a dialogue tag 0 · before an adjective 1 · before an adverb 0 · other 2',
      '  in runs of short sentences: 0'
    ].join('\n'));
    expect([...digest.items.keys()].filter((key) => key.startsWith('steering:'))).toEqual([
      'steering:being-verbs', 'steering:adverbs', 'steering:intensifiers'
    ]);
  });

  it('holds each note with its stance and its why, and never its nudge or its example', () => {
    const digest = buildLightboxOpinionDigest(board);
    const leaning = notes().find((tile) => tile.title === 'Being verbs · note II') as LightboxSteeringNoteTile;
    expect(textOf(digest, leaning.id)).toBe([
      `[${leaning.id}] Craft steering · Instance note: Being verbs · note II`,
      '  claim: A state stands where the fall could act: the darkness is reported rather than met.',
      '  stance: Leans · figure: Being verbs',
      '  q0 ¶7: “it was too dark to see anything”'
    ].join('\n'));
    for (const tile of notes()) {
      if (tile.nudge) {
        expect(digest.section).not.toContain(tile.nudge);
      }
      if (tile.example) {
        expect(digest.section).not.toContain(tile.example.after);
      }
    }
    expect(digest.section).not.toContain('One way it could go');
    expect(notes().filter((tile) => tile.nudge).length).toBe(4);
    expect(notes().filter((tile) => tile.example).length).toBe(3);
  });
});

describe('an observation citing craft steering', () => {
  const observing = (text: string, cites: OpinionBody[]) => {
    const body = opinionBody();
    body.observations[0] = { id: 'O1', text, cites };
    const read = readOpinion(board, body);
    return read.tile?.withheldObservations.find((entry) => entry.id === 'O1')?.reason ??
      read.withheld.find((claim) => claim.title === 'Opinion · O1')?.reason;
  };
  const leaning = () => notes().find((tile) => tile.title === 'Being verbs · note II') as LightboxSteeringNoteTile;

  it('may state a count the cited figure shows', () => {
    expect(observing('15 of the 17 being verbs sit in narration, and one leans where the fall could act.', [
      { measured: 'steering:being-verbs' }, { tile: leaning().id, quote: 0 }
    ])).toBeUndefined();
  });

  it('may not state a count the cited items do not show', () => {
    expect(observing('12 of the 17 being verbs sit in narration.', [{ measured: 'steering:being-verbs' }]))
      .toBe(LIGHTBOX_OPINION_PHRASING_REASONS.figure('This observation'));
    // A note shows no count: its title's place is a numeral, never a figure (PR #157 F-01).
    expect(observing('A second note on being verbs finds 2 leaning.', [{ tile: leaning().id }]))
      .toBe(LIGHTBOX_OPINION_PHRASING_REASONS.figure('This observation'));
  });

  it('cites a steering figure by its key, and none the board does not measure', () => {
    expect(observing('Passive voice is the narration\'s own.', [{ measured: 'steering:passive-voice' }]))
      .toBe(LIGHTBOX_OPINION_GATE_REASONS.notOnBoard.fresh);
  });
});
