/**
 * Group F's codec and gates (Slice 4D; ADR 2026-10-19 D7 addendum): the
 * Opinion read on the worked example's own board (the Alice excerpt, Lewis
 * Carroll, 1865, public domain, groups A–E read from their worked
 * examples), through the production codec, digest and gates. Every reason
 * is the host's: none repeats the Opinion's words or a key it named.
 */
import type { LightboxBoard } from '@messages';
import { LIGHTBOX_OPINION_GATE_REASONS } from '@/infrastructure/lightbox/LightboxOpinionGates';
import { LIGHTBOX_OPINION_PHRASING_REASONS, lightboxOpinionPhrasingFault } from '@/infrastructure/lightbox/LightboxOpinionPhrasing';
import { LIGHTBOX_DOUBLE_QUOTATION_MARKS, createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { lightboxOpinionDefaultView } from '@shared/constants/lightboxOpinion';
import { aliceOpinionBoard, itemKey, opinionBody, readOpinion, type OpinionBody } from './lightboxOpinionFixtures';
import { makeReadBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

let board: LightboxBoard;
beforeAll(async () => {
  board = await aliceOpinionBoard();
});

const edited = (edit: (body: OpinionBody) => void): OpinionBody => {
  const body = opinionBody();
  edit(body);
  return body;
};
const withheldView = (read: ReturnType<typeof readOpinion>, view: string) =>
  read.tile?.withheldViews.find((entry) => entry.view === view)?.reason;
/** Why an observation was withheld: on the tile, or, when no view stood, in the claims withheld in its place. */
const withheldObservation = (read: ReturnType<typeof readOpinion>, id: string) =>
  read.tile?.withheldObservations.find((entry) => entry.id === id)?.reason ??
    read.withheld.find((claim) => claim.title === `Opinion · ${id}`)?.reason;

describe('the Opinion, read on the board it weighs (Slice 4D)', () => {
  it('draws the worked example whole: six observations citing the board, three views of them, Neutral first', () => {
    const read = readOpinion(board);
    expect(read.decoded.withheld).toEqual([]);
    expect(read.tile?.observations.map((observation) => observation.id)).toEqual(['O1', 'O2', 'O3', 'O4', 'O5', 'O6']);
    expect(read.tile?.views.map((view) => view.view)).toEqual(['enthusiastic', 'neutral', 'blunt']);
    expect(read.tile?.withheldObservations).toEqual([]);
    expect(read.tile?.withheldViews).toEqual([]);
    expect(read.tile && lightboxOpinionDefaultView(read.tile)).toBe('neutral');
    expect(read.tile?.claim).toBe(read.tile?.views[1].headline);
    // Each cite carries the item's host label and the quote its tile holds, copied, never typed by the model.
    const [first] = read.tile?.observations ?? [];
    expect(first.cites[1]).toMatchObject({ label: 'Stock & signature · Signature: The narrator’s aside', quote: { paragraph: 8, text: '(Which was very likely true.)' } });
    // Its evidence is only the quotes its observations cite, each one a quote the digest showed for its tile.
    const shown = [...read.digest.items.values()].flatMap((item) => item.quotes.map((quote) => `${quote.paragraph}:${quote.text}`));
    expect(read.tile?.evidence.length).toBe(4);
    expect(read.tile?.evidence.every((quote) => shown.includes(`${quote.paragraph}:${quote.text}`))).toBe(true);
    expect(read.tile?.paragraphs).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // Its own register, and no counts of its own.
    expect(read.tile?.support).toEqual([]);
  });

  it('draws the webview fixture\'s Opinion whole too, on another board with other ids', () => {
    const tile = makeReadBoard().readings.find((group) => group.group === 'F')?.tiles[0];
    expect(tile?.kind === 'opinion' && [tile.observations.length, tile.views.length, tile.withheldViews.length]).toEqual([5, 3, 0]);
  });

  describe('the codec', () => {
    it('needs all three views: a block without one is withheld whole, by kind', () => {
      const read = readOpinion(board, edited((body) => { delete body.views.blunt; }));
      expect(read.tile).toBeUndefined();
      expect(read.decoded.withheld).toEqual([{ lens: 'opinion', reason: expect.stringMatching(/^The opinion\.views block broke the format|opinion\.views/) }]);
    });

    it('withholds a view that breaks the format alone, by name, and keeps the others', () => {
      const read = readOpinion(board, edited((body) => { body.views.blunt.why = []; }));
      expect(read.tile?.views.map((view) => view.view)).toEqual(['enthusiastic', 'neutral']);
      expect(withheldView(read, 'blunt')).toMatch(/^It broke the format: opinion\.views\.blunt\.why must be an array of 1 or more points/);
    });

    it('ignores fields the format does not define, counting them and never naming them (Slice 4K, decision 50)', () => {
      const clean = readOpinion(board);
      const read = readOpinion(board, edited((body) => {
        body.observations[0].mood = 'secret word';
        body.observations[0].cites[0].weight = 'secret word';
        body.views.neutral.tone = 'secret word';
        body.views.neutral.why[0].certainty = 'secret word';
        body.views.gentle = { headline: 'secret word' };
      }));
      // Nothing is withheld for them, and the Opinion is the one the clean reply gives.
      expect(read.tile?.withheldObservations).toEqual([]);
      expect(read.tile?.withheldViews).toEqual([]);
      expect(read.tile).toEqual(clean.tile);
      expect(read.decoded.report?.ignored).toBe(5);
      expect(JSON.stringify([read.tile, read.decoded])).not.toContain('secret word');
    });

    it('still holds a cite to one of its two shapes: a measured figure beside a tile\'s quote is withheld', () => {
      const read = readOpinion(board, edited((body) => { body.observations[0].cites = [{ measured: 'headline', quote: 0 }]; }));
      expect(withheldObservation(read, 'O1')).toBe(
        'It broke the format: opinion.observations[0].cites[0] must be one cite: a tile, with or without one of its quotes, or a measured figure, never both'
      );
    });

    it('withholds an observation with a malformed id by its position, and a second O1 as a duplicate', () => {
      const bad = readOpinion(board, edited((body) => { body.observations[2].id = 'X3'; }));
      expect(bad.tile?.withheldObservations).toEqual([{ id: 'Observation 3', reason: expect.stringContaining('an observation id: O and a number from 1') }]);
      const twice = readOpinion(board, edited((body) => { body.observations[1].id = 'O1'; }));
      expect(withheldObservation(twice, 'Observation 2')).toBe('Another observation in this block already has that id.');
    });

    it('takes at least 2 observations and 1 cite, and a cite as a tile (maybe with a quote number) or a measured ref, nothing else', () => {
      expect(readOpinion(board, edited((body) => { body.observations = body.observations.slice(0, 1); })).decoded.withheld[0].reason)
        .toMatch(/opinion\.observations must be an array of 2 or more observations/);
      const odd = readOpinion(board, edited((body) => {
        body.observations[0].cites = [{ tile: body.observations[0].cites[0].tile, measured: 'headline' }];
        body.observations[1].cites = [{ tile: body.observations[1].cites[1].tile, quote: -1 }];
      }));
      expect(withheldObservation(odd, 'O1')).toMatch(/It broke the format: opinion\.observations\[0\]\.cites\[0\]/);
      expect(withheldObservation(odd, 'O2')).toMatch(/a quote number \(a whole number from 0\)/);
    });
  });

  describe('more than asked is shown (Slice 4H)', () => {
    it('reads a seventh observation, a fourth cite, a fifth Why point and words past their asks, and draws them all', () => {
      const long = (text: string, ask: number) => `${text} ${'It holds across the chapter, paragraph by paragraph. '.repeat(Math.ceil(ask / 40))}`.trim();
      const read = readOpinion(board, edited((body) => {
        const [first, second] = body.observations;
        body.observations.push({ id: 'O7', text: long(first.text, 260), cites: [...first.cites, ...second.cites].slice(0, 4) });
        body.views.neutral.headline = long(body.views.neutral.headline, 160);
        body.views.neutral.body = long(body.views.neutral.body, 400);
        const points = body.views.neutral.why;
        body.views.neutral.why = [...points, ...points, { weight: 'even', text: long('Both readings stand.', 160), observations: ['O1', 'O2', 'O7', 'O3'] }]
          .slice(0, 5);
      }));
      expect(read.decoded.withheld).toEqual([]);
      expect(read.tile?.withheldObservations).toEqual([]);
      expect(read.tile?.observations.map((observation) => observation.id)).toEqual(['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7']);
      expect(read.tile?.observations[6].text.length).toBeGreaterThan(260);
      expect(read.tile?.observations[6].cites).toHaveLength(4);
      const neutral = read.tile?.views.find((view) => view.view === 'neutral');
      expect(neutral?.why).toHaveLength(5);
      expect(neutral?.headline.length).toBeGreaterThan(160);
      expect(neutral?.body.length).toBeGreaterThan(400);
      expect(read.tile?.withheldViews).toEqual([]);
    });
  });

  describe('citations: only what the digest held', () => {
    it('withholds an observation citing an id the board does not hold, and every view weighing it, whole', () => {
      const read = readOpinion(board, edited((body) => { body.observations[2].cites[0].tile = 'lbt-ffffffff-E-99'; }));
      expect(withheldObservation(read, 'O3')).toBe(LIGHTBOX_OPINION_GATE_REASONS.notOnBoard.fresh);
      // Enthusiastic and Blunt weigh O3, so each is withheld whole; Neutral does not, and stands.
      expect(read.tile?.views.map((view) => view.view)).toEqual(['neutral']);
      expect(read.tile?.withheldViews).toEqual([
        { view: 'enthusiastic', reason: LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn },
        { view: 'blunt', reason: LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn }
      ]);
      expect(JSON.stringify(read.tile)).not.toContain('ffffffff');
    });

    it('withholds the tile when no view stands, with the tile\'s reason, then each view\'s and each observation\'s', () => {
      const read = readOpinion(board, edited((body) => { body.observations[1].cites[0] = { measured: 'standout:passive-voice' }; }));
      // Every view weighs O2.
      expect(read.tile).toBeUndefined();
      expect(read.withheld.map((claim) => [claim.kind, claim.title, claim.reason])).toEqual([
        ['opinion', 'Opinion', LIGHTBOX_GATE_REASONS.opinionNoView.fresh],
        ['opinion', 'Opinion · Enthusiastic view', LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn],
        ['opinion', 'Opinion · Neutral view', LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn],
        ['opinion', 'Opinion · Blunt view', LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn],
        ['opinion', 'Opinion · O2', LIGHTBOX_OPINION_GATE_REASONS.notOnBoard.fresh]
      ]);
    });

    it('withholds a view citing an observation that is not drawn, and keeps the views that do not', () => {
      const read = readOpinion(board, edited((body) => { body.observations[5].cites[0].quote = 7; }));
      expect(withheldObservation(read, 'O6')).toBe(LIGHTBOX_OPINION_GATE_REASONS.quoteNotHeld.fresh);
      expect(read.tile?.views.map((view) => view.view)).toEqual(['enthusiastic']);
      expect(withheldView(read, 'neutral')).toBe(LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn);
      expect(withheldView(read, 'blunt')).toBe(LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn);
      // With Neutral withheld, the tile opens on the first view that stood.
      expect(read.tile && lightboxOpinionDefaultView(read.tile)).toBe('enthusiastic');
    });

    it('never lets a view weigh an observation id it was not given', () => {
      const read = readOpinion(board, edited((body) => { body.views.blunt.why[2].observations = ['O6', 'O5']; body.views.neutral.why[0].observations = ['O1', 'O5', 'O6']; }));
      expect(read.tile?.views.map((view) => view.view)).toEqual(['enthusiastic', 'neutral', 'blunt']);
      const unknown = readOpinion(board, edited((body) => { body.observations = body.observations.slice(0, 5); }));
      expect(withheldView(unknown, 'neutral')).toBe(LIGHTBOX_OPINION_GATE_REASONS.viewUndrawn);
    });

    it('withholds a citation of a stale tile, a tile being read again, a spark, or a quote of a measured figure', () => {
      const stock = itemKey(board, 'Stock & signature · Cognitive economy');
      const stale: LightboxBoard = {
        ...board,
        readings: board.readings.map((group) => (group.group === 'D' ? { ...group, staleLenses: [{ lens: 'stock', readAgainst: 'old' }] } : group))
      };
      expect(withheldObservation(readOpinion(stale), 'O1')).toBe(LIGHTBOX_OPINION_GATE_REASONS.notOnBoard.fresh);
      const rereading: LightboxBoard = {
        ...board,
        readings: board.readings.map((group) => (group.group === 'D' ? { ...group, status: 'running', pending: ['stock'] } : group))
      };
      expect(withheldObservation(readOpinion(rereading), 'O1')).toBe(LIGHTBOX_OPINION_GATE_REASONS.notOnBoard.fresh);
      expect(stock).toBe('lbt-5b1e09c4-D-1');
      const measuredQuote = readOpinion(board, edited((body) => { body.observations[1].cites[0].quote = 0; }));
      expect(withheldObservation(measuredQuote, 'O2')).toMatch(/It broke the format|a quote of a measured figure/);
    });

    it('cites measured figures by stable refs only: a figure that does not stand out, or a section the board does not have, is withheld', () => {
      const notStandout = readOpinion(board, edited((body) => { body.observations[1].cites[0] = { measured: 'standout:passive-voice' }; }));
      expect(withheldObservation(notStandout, 'O2')).toBe(LIGHTBOX_OPINION_GATE_REASONS.notOnBoard.fresh);
      const noSection = readOpinion(board, edited((body) => { body.observations[1].cites.push({ measured: 'section:1' }); }));
      expect(withheldObservation(noSection, 'O2')).toBe(LIGHTBOX_OPINION_GATE_REASONS.notOnBoard.fresh);
      const headline = readOpinion(board, edited((body) => { body.observations[1].cites.push({ measured: 'headline' }); }));
      expect(withheldObservation(headline, 'O2')).toBeUndefined();
    });
  });

  describe('the text rules', () => {
    const observationFault = (text: string) => withheldObservation(readOpinion(board, edited((body) => { body.observations[0].text = text; })), 'O1');
    const bluntFault = (body: string) => withheldView(readOpinion(board, edited((opinion) => { opinion.views.blunt.body = body; })), 'blunt');

    it('cites, never quotes: double quotation marks of any kind withhold the part', () => {
      expect(observationFault('The narrator says “very likely true” about her boast.')).toBe(LIGHTBOX_OPINION_PHRASING_REASONS.quotes('This observation'));
      expect(bluntFault('The fall is "slow" and the chase is quick.')).toBe(LIGHTBOX_OPINION_PHRASING_REASONS.quotes('The Blunt view'));
      // An apostrophe is not a quotation mark.
      expect(observationFault('Half of the beats are the chapter\'s own, in Alice\'s talk to herself.')).toBeUndefined();
    });

    it('withholds every double quotation mark the quote verifier knows, fullwidth and CJK included (PR #157 N-01)', () => {
      const neutralFault = (body: string) => withheldView(readOpinion(board, edited((opinion) => { opinion.views.neutral.body = body; })), 'neutral');
      // Paired: the variants the review found passing, then the straight and curly controls that always were withheld.
      for (const [open, close] of [['＂', '＂'], ['〝', '〞'], ['"', '"'], ['“', '”']]) {
        const text = `The image says ${open}the stone remembers${close} at the end.`;
        expect([open, observationFault(text)]).toEqual([open, LIGHTBOX_OPINION_PHRASING_REASONS.quotes('This observation')]);
        expect([open, neutralFault(text)]).toEqual([open, LIGHTBOX_OPINION_PHRASING_REASONS.quotes('The Neutral view')]);
      }
      // One set, shared with the verifier: every mark it folds as a double quote withholds the part.
      for (const mark of LIGHTBOX_DOUBLE_QUOTATION_MARKS) {
        expect([mark, lightboxOpinionPhrasingFault([`The fall ${mark}slows${mark} the chase.`], new Set(), 'This view')])
          .toEqual([mark, LIGHTBOX_OPINION_PHRASING_REASONS.quotes('This view')]);
      }
      // The verifier still finds a quote the model wrapped in fullwidth marks.
      expect(createLightboxQuoteVerifier(['She said ＂no＂ twice.']).verify(1, 'She said "no" twice.').found).toBe(true);
    });

    it('is about the work, never the writer: second person or naming the writer withholds it', () => {
      for (const text of ['Your sentences run long in the fall.', 'You keep the fall slow.', 'The writer leans on the asides.', 'The author\'s asides carry it.']) {
        expect(bluntFault(text)).toBe(LIGHTBOX_OPINION_PHRASING_REASONS.writer('The Blunt view'));
      }
    });

    it('is diagnosis only, in every view: a rewrite word or a clause opening with an instruction withholds it', () => {
      for (const text of [
        'The fall should be shorter.',
        'The chase needs to move faster.',
        'Cut the second description of the well.',
        'The middle drags, so trim the shelves.',
        'Replace the stock phrase with something plainer.',
        'Consider a shorter fall.'
      ]) {
        expect({ text, fault: bluntFault(text) }).toEqual({ text, fault: LIGHTBOX_OPINION_PHRASING_REASONS.rewrite('The Blunt view') });
      }
      const neutral = readOpinion(board, edited((body) => { body.views.neutral.why[1].text = 'The long sentences should be shorter in the chase.'; }));
      expect(withheldView(neutral, 'neutral')).toBe(LIGHTBOX_OPINION_PHRASING_REASONS.rewrite('The Neutral view'));
    });

    it('states its limits: a rewrite in unlisted words passes, and a listed word used to describe is withheld', () => {
      // A word list, not a parse (LightboxOpinionPhrasing): the safe failure is to withhold.
      expect(bluntFault('A shorter fall would read lighter.')).toBeUndefined();
      expect(bluntFault('The cut between the bank and the hole is abrupt.')).toBe(LIGHTBOX_OPINION_PHRASING_REASONS.rewrite('The Blunt view'));
    });

    it('states no percentage and no figure its cited items do not show', () => {
      expect(observationFault('Half of the beats, 50% of them, are the chapter\'s own.')).toBe(LIGHTBOX_OPINION_PHRASING_REASONS.percent('This observation'));
      expect(observationFault('Eight of the 16 classified beats are the chapter\'s own.')).toBeUndefined();
      expect(observationFault('Nine of the 17 classified beats are the chapter\'s own.')).toBe(LIGHTBOX_OPINION_PHRASING_REASONS.figure('This observation'));
      // A view's figures are its observations' items': 12.2 is on O5's figure, which Blunt weighs and Enthusiastic does not.
      const enthusiastic = readOpinion(board, edited((body) => { body.views.enthusiastic.body = 'Speech sits at 12.2 per 100 words, and the fall takes its time.'; }));
      expect(withheldView(enthusiastic, 'enthusiastic')).toBe(LIGHTBOX_OPINION_PHRASING_REASONS.figure('The Enthusiastic view'));
      // An observation id is a key, not a figure.
      const ids = readOpinion(board, edited((body) => { body.views.blunt.why[0].text = 'O2 and O5 together slow the chase.'; }));
      expect(withheldView(ids, 'blunt')).toBeUndefined();
    });
  });
});
