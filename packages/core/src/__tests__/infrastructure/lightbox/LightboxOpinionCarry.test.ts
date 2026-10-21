/**
 * Group F carried onto changed text (Slice 4D; ADR 2026-10-19 D4, D7
 * addendum): the Opinion is held to the same rules as a fresh reply,
 * against the rebuilt board's items (PR #150 F-05), and marked stale. Its
 * citations keep the basis they were read with, its quotes follow their
 * words, and what no longer stands is withheld in host words. Built on the
 * worked examples' board (the Alice excerpt, Lewis Carroll, 1865, public
 * domain), carried by the production carry.
 */
import type { LightboxBoard, LightboxOpinionTile, LightboxReadingGroup } from '@messages';
import { carryLightboxReadings, LIGHTBOX_CHANGED_WHILE_READING } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { LIGHTBOX_OPINION_GATE_REASONS } from '@/infrastructure/lightbox/LightboxOpinionGates';
import { LIGHTBOX_OPINION_PHRASING_REASONS } from '@/infrastructure/lightbox/LightboxOpinionPhrasing';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import type { LightboxWriterAverages } from '@/infrastructure/lightbox/LightboxNumbers';
import { lightboxOpinionDefaultView, lightboxOpinionStanding, lightboxOpinionTile } from '@shared/constants/lightboxOpinion';
import { boardWithNumbers, WRITER_AVERAGES } from './lightboxCraftFixtures';
import { ALICE, aliceOpinionBoard, itemKey, readOpinion, withOpinion, type OpinionBody } from './lightboxOpinionFixtures';

let board: LightboxBoard;
beforeAll(async () => {
  board = await aliceOpinionBoard();
});

/** ¶1–¶7, a new paragraph, then the old ¶8 as ¶9: the figures move, and so does every quote of ¶8. */
const INSERTED = [...ALICE.slice(0, 7), 'She fell on and on, and the shelves went by.', ALICE[7]];

/** An Opinion that states no figure: O1 on the narrator's aside (¶8), O2 on the watch. */
function plainBody(o2Cites?: OpinionBody['observations']): OpinionBody {
  const view = (headline: string, observations: string[]) => ({
    headline,
    body: 'The voice sits in the asides, and the watch moves the plot along.',
    why: [{ weight: 'even', text: 'They weigh the same.', observations }]
  });
  return {
    observations: [
      { id: 'O1', text: 'The narrator\'s asides carry the chapter\'s voice.', cites: [{ tile: itemKey(board, 'Stock & signature · Signature: The narrator’s aside'), quote: 0 }] },
      { id: 'O2', text: 'The watch turns idle notice into pursuit.', cites: o2Cites ?? [{ tile: itemKey(board, 'Artifacts · Object: The watch') }] }
    ],
    views: {
      enthusiastic: view('The asides give the chapter its voice.', ['O1']),
      neutral: view('Voice and one object carry the chapter.', ['O1', 'O2']),
      blunt: view('The watch does the plotting.', ['O2'])
    },
    friction: 'A stand-in Opinion: it weighs two readings and states no figure.'
  };
}

/** `of`'s readings carried onto `paragraphs`, as the service carries them when the text changes. */
async function carryOnto(
  of: LightboxBoard,
  paragraphs: readonly string[],
  options: { writer?: LightboxWriterAverages; measured?: boolean } = {}
): Promise<LightboxBoard> {
  const rebuilt = await boardWithNumbers(paragraphs, options.writer);
  const readings = carryLightboxReadings(of.readings, {
    readAgainst: of.source.contentHash,
    paragraphs,
    averageWordsPerSentence: rebuilt.measured.headline.averageWordsPerSentence,
    columns: rebuilt.ribbon,
    numbers: rebuilt.measured.numbers.rows,
    ...(options.measured === false ? {} : { measured: rebuilt.measured })
  });
  return { ...rebuilt, readings };
}

const groupF = (of: LightboxBoard) => of.readings.find((group) => group.group === 'F') as LightboxReadingGroup;
const opinionOf = (of: LightboxBoard): LightboxOpinionTile => {
  const tile = lightboxOpinionTile(of);
  if (!tile) {
    throw new Error(`expected the Opinion; withheld: ${JSON.stringify(groupF(of).withheldClaims.map((claim) => [claim.title, claim.reason]))}`);
  }
  return tile;
};
const withheldObservation = (of: LightboxBoard, id: string) =>
  lightboxOpinionTile(of)?.withheldObservations.find((entry) => entry.id === id)?.reason ??
    groupF(of).withheldClaims.find((claim) => claim.title === `Opinion · ${id}`)?.reason;

describe('the Opinion carried onto changed text (Slice 4D)', () => {
  it('comes along stale, every part still standing, each cite keeping the basis it was read with and its quote following its words', async () => {
    const fresh = withOpinion(board, readOpinion(board, plainBody()));
    const before = opinionOf(fresh);
    expect(before.views).toHaveLength(3);
    const carried = await carryOnto(fresh, INSERTED);
    const tile = opinionOf(carried);
    expect(tile.id).toBe(before.id);
    expect([tile.observations.length, tile.views.length, tile.withheldViews.length]).toEqual([2, 3, 0]);
    expect(groupF(carried).staleLenses).toEqual([{ lens: 'opinion', readAgainst: board.source.contentHash }]);
    // The aside now stands in ¶9, and the cite follows it there.
    expect(tile.observations[0].cites[0].quote).toMatchObject({ paragraph: 9, text: '(Which was very likely true.)' });
    expect(tile.evidence).toEqual([expect.objectContaining({ paragraph: 9, text: '(Which was very likely true.)' })]);
    expect(tile.observations.flatMap((observation) => observation.cites.map((cite) => cite.basis)))
      .toEqual(before.observations.flatMap((observation) => observation.cites.map((cite) => cite.basis)));
    const standing = lightboxOpinionStanding(tile, carried);
    expect(standing).toMatchObject({ stale: true, readEarlier: true });
    expect(standing.note).toMatch(/^Read against an earlier version of this chapter/);
  });

  it('withholds an observation whose cited quote is gone, then each view that weighs it, keeping the view that does not', async () => {
    const fresh = withOpinion(board, readOpinion(board, plainBody()));
    // The aside, worded otherwise: no quote of it is found again.
    const carried = await carryOnto(fresh, [...ALICE.slice(0, 7), ALICE[7].replace('(Which was very likely true.)', '(Which was very likely so.)')]);
    const tile = opinionOf(carried);
    // The aside's tile held that quote alone, so the tile is withheld on the carry, and the cite with it.
    expect(withheldObservation(carried, 'O1')).toBe(LIGHTBOX_OPINION_GATE_REASONS.notOnBoard.carried);
    expect(tile.withheldViews).toEqual([
      { view: 'enthusiastic', reason: LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn },
      { view: 'neutral', reason: LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn }
    ]);
    expect(tile.views.map((view) => view.view)).toEqual(['blunt']);
    // The tile opens on the view that stands, and its claim is that view's.
    expect(lightboxOpinionDefaultView(tile)).toBe('blunt');
    expect(tile.claim).toBe('The watch does the plotting.');
  });

  it('withholds a cite of a quote its tile no longer holds, while the tile itself still stands', async () => {
    const jar = itemKey(board, 'Artifacts · Object: The marmalade jar');
    const fresh = withOpinion(board, readOpinion(board, plainBody([{ tile: jar, quote: 2 }])));
    expect(opinionOf(fresh).observations[1].cites[0].quote?.text).toBe('managed to put it into one of the cupboards');
    const carried = await carryOnto(fresh, ALICE.map((paragraph) => paragraph.replace('managed to put it into', 'managed to set it in')));
    expect(carried.readings.flatMap((group) => group.tiles).some((tile) => tile.id === jar)).toBe(true);
    expect(withheldObservation(carried, 'O2')).toBe(LIGHTBOX_OPINION_GATE_REASONS.quoteNotHeld.carried);
    expect(opinionOf(carried).views.map((view) => view.view)).toEqual(['enthusiastic']);
  });

  it('withholds a cite of a figure that no longer stands out on the rebuilt board, in the carried phase\'s words', async () => {
    const fresh = withOpinion(board, readOpinion(board, plainBody([{ measured: 'standout:dialogue' }])));
    expect(opinionOf(fresh).views).toHaveLength(3);
    // Against a writer whose other chapters are as sparing of speech, the chapter's dialogue no longer stands out.
    const sparing: LightboxWriterAverages = { ...WRITER_AVERAGES, counts: WRITER_AVERAGES.counts && { ...WRITER_AVERAGES.counts, dialogueWords: 2_440 } };
    const carried = await carryOnto(fresh, INSERTED, { writer: sparing });
    expect(carried.measured.numbers.rows.find((row) => row.stat === 'dialogue')?.standout).toBeUndefined();
    expect(withheldObservation(carried, 'O2')).toBe(LIGHTBOX_OPINION_GATE_REASONS.notOnBoard.carried);
    expect(opinionOf(carried).views.map((view) => view.view)).toEqual(['enthusiastic']);
  });

  it('cannot check a measured cite without the rebuilt board\'s figures, so it withholds it', async () => {
    const fresh = withOpinion(board, readOpinion(board, plainBody([{ measured: 'headline' }])));
    const carried = await carryOnto(fresh, INSERTED, { measured: false });
    expect(withheldObservation(carried, 'O2')).toBe(LIGHTBOX_OPINION_GATE_REASONS.notOnBoard.carried);
  });

  it('withholds a figure the rebuilt board no longer shows, as a fresh reply would, and with no view left the tile', async () => {
    const fresh = withOpinion(board, readOpinion(board));
    expect(opinionOf(fresh).views).toHaveLength(3);
    // A new paragraph moves the sentence and dialogue figures the example states (31.8; 12.2) and the ¶7 it names.
    const carried = await carryOnto(fresh, INSERTED);
    const f = groupF(carried);
    expect(lightboxOpinionTile(carried)).toBeUndefined();
    expect(f.withheldClaims.slice(0, 4).map((claim) => [claim.title, claim.reason])).toEqual([
      ['Opinion', LIGHTBOX_GATE_REASONS.opinionNoView.carried],
      ['Opinion · Enthusiastic view', LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn],
      ['Opinion · Neutral view', LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn],
      ['Opinion · Blunt view', LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn]
    ]);
    for (const id of ['O2', 'O5']) {
      expect(withheldObservation(carried, id)).toBe(LIGHTBOX_OPINION_PHRASING_REASONS.figure('This observation'));
    }
    expect(f.staleLenses).toEqual([{ lens: 'opinion', readAgainst: board.source.contentHash }]);
  });

  it('holds a carried Opinion to the same text rules as a fresh one, in the same words', async () => {
    const texts = [
      'The asides speak to you, and the chapter waits.',
      'The asides should be shorter.',
      'The asides carry the voice, at 50%.',
      'The asides read as “true” to the voice.'
    ];
    for (const text of texts) {
      const body = plainBody();
      body.observations[0].text = text;
      const freshReason = withheldObservation(withOpinion(board, readOpinion(board, body)), 'O1');
      expect(freshReason).toBeDefined();
      // Carried: the same observation, drawn under an earlier rule set, then carried.
      const drawn = withOpinion(board, readOpinion(board, plainBody()));
      const tile = opinionOf(drawn);
      const edited: LightboxOpinionTile = {
        ...tile,
        observations: tile.observations.map((observation) => (observation.id === 'O1' ? { ...observation, text } : observation))
      };
      const relabelled = { ...drawn, readings: drawn.readings.map((group) => (group.group === 'F' ? { ...group, tiles: [edited] } : group)) };
      const carried = await carryOnto(relabelled, INSERTED);
      expect(withheldObservation(carried, 'O1')).toBe(freshReason);
    }
  });

  it('cancels an Opinion that was being read when the text changed, keeping what it had drawn', async () => {
    const fresh = withOpinion(board, readOpinion(board, plainBody()));
    const running = { ...fresh, readings: fresh.readings.map((group) => (group.group === 'F' ? { ...group, status: 'running' as const, pending: ['opinion' as const] } : group)) };
    const carried = await carryOnto(running, INSERTED);
    expect(groupF(carried)).toMatchObject({ status: 'cancelled', error: LIGHTBOX_CHANGED_WHILE_READING });
    expect(groupF(carried).pending).toBeUndefined();
    expect(opinionOf(carried).views).toHaveLength(3);
  });

  it('leaves an Opinion that was never read as it was', async () => {
    const carried = await carryOnto(board, INSERTED);
    expect(groupF(carried)).toEqual(groupF(board));
  });
});
