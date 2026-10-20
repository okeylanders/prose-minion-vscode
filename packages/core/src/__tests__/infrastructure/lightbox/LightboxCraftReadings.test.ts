/**
 * Group D (ADR 2026-10-19 D7 and its addendum; Slice 4B), through the
 * production codec, verifier, counter and assembly: what the codec withholds,
 * how a handoff is held to two adjacent sentences, how a numbers reading's
 * quotes are held to an instance of its figure, and how the tier mix and
 * familiar phrasing are counted by the host. The worked example reads ¶1–¶8
 * of "Alice's Adventures in Wonderland" (1865, public domain); the door and
 * Rabbit paragraphs are synthetic sentences written for these tests.
 */
import type { LightboxLensId, LightboxNumberRow, LightboxNumberStatId, LightboxReadingTile } from '@messages';
import { LIGHTBOX_TILE_REGISTER } from '@shared/constants/lightbox';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- reading bodies are edited as plain JSON. */
type Body = Record<string, any>;

const ALICE = readWorkedExample('D').paragraphs;
const exampleBody = (): Body => framedJson(readWorkedExample('D').response) as Body;

function read(lenses: LightboxLensId[], body: Body, paragraphs: readonly string[] = ALICE, rows: LightboxNumberRow[] = []) {
  const decoded = decodeLightboxGroup(frame('D', body), { group: 'D', lenses, columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `t${++id}`,
    standouts: lightboxStandoutRows(rows)
  });
  return { decoded, assembled };
}

const drawn = (tiles: LightboxReadingTile[]) => tiles.map((tile) => `${tile.kind}:${tile.title}`);
const malformedOf = (decoded: ReturnType<typeof read>['decoded'], lens: LightboxLensId) => {
  const block = decoded.blocks.find((candidate) => candidate.lens === lens);
  return block && 'malformed' in block ? block.malformed : undefined;
};

describe('group D codec', () => {
  it('registers every new kind as the D3 table does: counted readings, readings, and none measured', () => {
    expect([
      'stock-tiers', 'signature', 'familiar-phrase', 'air-lock', 'echo', 'rhythm-endings', 'handoff', 'number-usage'
    ].map((kind) => LIGHTBOX_TILE_REGISTER[kind as keyof typeof LIGHTBOX_TILE_REGISTER])).toEqual([
      'counted-read', 'read', 'counted-read', 'read', 'read', 'read', 'read', 'counted-read'
    ]);
  });

  it('withholds a block holding a field the format does not define, counting it and never naming it', () => {
    const body = exampleBody();
    body.stock.confidence = 'high';
    const { decoded } = read(['stock'], { version: 1, stock: body.stock });
    expect(decoded.blocks).toEqual([]);
    expect(decoded.withheld).toHaveLength(1);
    expect(decoded.withheld[0].reason).toContain('1 field the format does not define');
    expect(decoded.withheld[0].reason).not.toContain('confidence');
  });

  it('withholds a beat or a phrase that breaks its vocabulary, by a host title, and keeps the rest', () => {
    const body = exampleBody();
    body.stock.economy.beats[2].tier = 'tired';
    body.stock.economy.beats[3].mood = 'idle';
    body.stock.familiar[0].kind = 'proverb';
    const { decoded, assembled } = read(['stock'], { version: 1, stock: body.stock });
    expect(malformedOf(decoded, 'stock')).toEqual({
      beats: [
        { title: 'Beat 3', reason: expect.stringContaining('functional, decorated, weighted or signature') },
        { title: 'Beat 4', reason: expect.stringContaining('1 field the format does not define') }
      ],
      signature: [],
      familiar: [{ title: 'Familiar phrase 1', reason: expect.stringContaining('idiom, cliche, stock or weighted') }],
      airLocks: [],
      echoes: []
    });
    const mix = assembled.tiles.find((tile) => tile.kind === 'stock-tiers');
    expect(mix?.kind === 'stock-tiers' && mix.classified).toBe(14);
    expect(drawn(assembled.tiles)).not.toContain('familiar-phrase:In another moment');
  });

  it('withholds an echo that states a likelihood, and keeps one that only names a source with a number in it', () => {
    const withEchoes = (edits: Body[]) => {
      const body = exampleBody();
      body.stock.echoes = edits.map((edit) => ({ ...body.stock.echoes[0], ...edit }));
      return read(['stock'], { version: 1, stock: body.stock });
    };
    const first = withEchoes([
      { title: 'Likely a proverb', reminiscentOf: 'a proverb, 80% likely' },
      { title: 'Per cent', note: 'Ninety per cent a proverb, the reading guesses.' },
      { title: 'Room 101', reminiscentOf: 'a line from Nineteen Eighty-Four, chapter 1' }
    ]);
    expect(malformedOf(first.decoded, 'stock')).toMatchObject({ echoes: [
      { title: 'Likely a proverb', reason: expect.stringContaining('states no likelihood') },
      { title: 'Per cent', reason: expect.stringContaining('states no likelihood') }
    ] });
    expect(drawn(first.assembled.tiles).filter((tile) => tile.startsWith('echo:'))).toEqual(['echo:Room 101']);
    // A likelihood in the title alone withholds it too.
    expect(malformedOf(withEchoes([{ title: '90% a proverb' }]).decoded, 'stock'))
      .toMatchObject({ echoes: [{ title: '90% a proverb', reason: expect.stringContaining('states no likelihood') }] });
  });

  it('withholds the rhythm block unless it gives one ending in the vocabulary for every ribbon column', () => {
    const short = exampleBody();
    short.rhythm.endings.pop();
    expect(read(['rhythm'], { version: 1, rhythm: short.rhythm }).decoded.withheld)
      .toEqual([{ lens: 'rhythm', reason: expect.stringContaining('endings, one per ribbon column') }]);
    const unknown = exampleBody();
    unknown.rhythm.endings[3] = 'trails';
    expect(read(['rhythm'], { version: 1, rhythm: unknown.rhythm }).decoded.withheld)
      .toEqual([{ lens: 'rhythm', reason: expect.stringContaining('lands, holds or opens') }]);
  });

  it('withholds a block without friction', () => {
    const body = exampleBody();
    delete body.numbers.friction;
    expect(read(['numbers'], { version: 1, numbers: body.numbers }).decoded.withheld.map((entry) => entry.lens)).toEqual(['numbers']);
  });

  describe('a numbers reading', () => {
    const decodeItem = (claim: string, stat = 'intensifiers') => {
      const body = { version: 1, numbers: {
        items: [{ stat, usage: 'mixed', claim, evidence: [{ para: 2, quote: 'get very tired of sitting by her sister' }] }],
        friction: 'Rates over eight paragraphs.'
      } };
      return malformedOf(read(['numbers'], body).decoded, 'numbers');
    };

    it('never directs: a claim holding a listed word is withheld, the word list\'s safe failure included', () => {
      expect(decodeItem('Each very could be cut.')).toEqual([{ title: 'Reading 1', reason: expect.stringContaining('never directs a change') }]);
      expect(decodeItem('You should keep them; they are Alice’s.')).toHaveLength(1);
      expect(decodeItem('It is worth trying them aloud.')).toEqual([]);
      // Described, not directed, and still withheld: the list cannot tell.
      expect(decodeItem('The intensifiers sit like the cut of her coat.')).toHaveLength(1);
      // Directed without a listed word, and decoded: the stated limit.
      expect(decodeItem('It would read better shorter.')).toEqual([]);
    });

    it('never states a figure: a digit outside a ¶ address, a % or "percent" is withheld', () => {
      expect(decodeItem('Twelve of them, 12 times over.')).toEqual([{ title: 'Reading 1', reason: expect.stringContaining('never states a figure') }]);
      expect(decodeItem('Half the paragraphs, 50% of them.')).toHaveLength(1);
      expect(decodeItem('Half of them, fifty percent.')).toHaveLength(1);
      expect(decodeItem('They gather in ¶2 and ¶7, around her idleness.')).toEqual([]);
      // A figure in words passes: the stated limit.
      expect(decodeItem('They come twice as often as anywhere else.')).toEqual([]);
    });

    it('names one of the host\'s figures, once each', () => {
      expect(decodeItem('A reading of commas.', 'commas')).toEqual([{ title: 'Reading 1', reason: expect.stringContaining('one of the figures the task lists') }]);
      const body = { version: 1, numbers: {
        items: ['First.', 'Second.'].map((claim) => ({
          stat: 'intensifiers', usage: 'mixed', claim, evidence: [{ para: 2, quote: 'get very tired of sitting by her sister' }]
        })),
        friction: 'Rates over eight paragraphs.'
      } };
      expect(malformedOf(read(['numbers'], body).decoded, 'numbers')).toEqual([{
        title: 'Intensifiers and fillers', reason: 'Another reading in this block already reads that figure.'
      }]);
    });
  });
});

describe('the tier mix and familiar phrasing, counted by the host', () => {
  it('counts the tiers from the beats it found, each span once, the first tier given standing', () => {
    const body = exampleBody();
    body.stock.economy.beats[0].quote = 'Alice was beginning to get very bored';
    body.stock.economy.beats.push({ ...body.stock.economy.beats[1], tier: 'functional' });
    const { assembled } = read(['stock'], { version: 1, stock: body.stock });
    const mix = assembled.tiles.find((tile) => tile.kind === 'stock-tiers');
    if (mix?.kind !== 'stock-tiers') {
      throw new Error('expected the tier mix');
    }
    // 17 beats given: one not found, one a repeat of a span already kept.
    expect(mix.classified).toBe(15);
    expect(mix.tiers).toEqual({ functional: 5, decorated: 1, weighted: 1, signature: 8 });
    expect(mix.beats.find((beat) => beat.quote.text === 'what is the use of a book')?.tier).toBe('signature');
    expect(mix.withheldQuotes).toEqual([{ paragraph: 2, reason: 'not-in-chapter' }]);
  });

  it('withholds a mix standing on fewer than four found beats', () => {
    const body = exampleBody();
    body.stock.economy.beats = body.stock.economy.beats.slice(0, 3);
    const { assembled } = read(['stock'], { version: 1, stock: body.stock });
    expect(assembled.withheldClaims).toEqual([expect.objectContaining({
      kind: 'stock-tiers', title: 'Cognitive economy', reason: LIGHTBOX_GATE_REASONS.tiersTooFew.fresh
    })]);
  });

  it('counts a familiar phrase as named, and withholds one the chapter does not hold by its kind, never its words', () => {
    const body = exampleBody();
    body.stock.familiar[1].phrase = 'curiosity killed the cat';
    body.stock.familiar[2].evidence = [{ para: 5, quote: 'In another moment down went Alice after it' }];
    const { assembled } = read(['stock'], { version: 1, stock: body.stock });
    const phrases = assembled.tiles.filter((tile) => tile.kind === 'familiar-phrase');
    expect(phrases.map((tile) => tile.title)).toEqual(['In another moment', 'Oh dear']);
    expect(phrases[0].support).toEqual([expect.objectContaining({ term: 'in another moment', count: 1, paragraphs: [5] })]);
    expect(assembled.withheldClaims.map((claim) => [claim.title, claim.reason])).toEqual([
      ['Stock carrying weight 2', LIGHTBOX_GATE_REASONS.familiarUncounted.fresh],
      ['Idiom 3', LIGHTBOX_GATE_REASONS.familiarUnquoted]
    ]);
  });
});

describe('a handoff is two adjacent sentences of one paragraph', () => {
  const DOOR = [
    'The door was shut. She knocked twice. Nobody came. She knocked again, louder.',
    'She knocked. The door held. She knocked. Nobody came.',
    'Inside, a clock ticked. It ticked on and on.'
  ];
  const handoff = (from: [number, string], to: [number, string]) => ({
    from: { para: from[0], quote: from[1] },
    to: { para: to[0], quote: to[1] },
    carried: 'The knocking.',
    changes: 'No one answers it.',
    effect: 'continues'
  });
  const readHandoffs = (handoffs: Body[], paragraphs: readonly string[] = DOOR) => read(['rhythm'], {
    version: 1,
    rhythm: {
      endings: paragraphs.map(() => 'holds'),
      movement: 'Short sentences that stop and start again.',
      evidence: [{ para: 1, quote: 'The door was shut.' }],
      handoffs,
      friction: 'Endings are one reading aloud among several.'
    }
  }, paragraphs).assembled;
  const outcome = (assembled: ReturnType<typeof readHandoffs>) => ({
    drawn: assembled.tiles.filter((tile) => tile.kind === 'handoff')
      .map((tile) => (tile.kind === 'handoff' ? [tile.from.paragraph, tile.from.text, tile.to.text] : [])),
    withheld: assembled.withheldClaims.map((claim) => claim.reason)
  });

  it('draws a pair whose second quote stands in the sentence directly after the first\'s', () => {
    const assembled = readHandoffs([handoff([1, 'She knocked twice'], [1, 'Nobody came'])]);
    expect(outcome(assembled)).toEqual({ drawn: [[1, 'She knocked twice', 'Nobody came']], withheld: [] });
    const tile = assembled.tiles.find((candidate) => candidate.kind === 'handoff');
    expect(tile).toMatchObject({ title: 'Handoff in ¶1', claim: 'No one answers it.', carried: 'The knocking.', effect: 'continues' });
    expect(tile?.evidence).toEqual([
      { paragraph: 1, text: 'She knocked twice', match: 'exact' },
      { paragraph: 1, text: 'Nobody came', match: 'exact' }
    ]);
  });

  it.each([
    ['a sentence apart', handoff([1, 'The door was shut'], [1, 'Nobody came'])],
    ['in reverse order', handoff([1, 'Nobody came'], [1, 'She knocked twice'])],
    ['inside one sentence', handoff([1, 'The door'], [1, 'was shut'])],
    ['across a sentence break', handoff([1, 'was shut. She knocked'], [1, 'Nobody came'])],
    ['in two paragraphs', handoff([2, 'Nobody came'], [3, 'Inside, a clock ticked'])]
  ])('withholds a pair %s, as no handoff', (_case, pair) => {
    expect(outcome(readHandoffs([pair]))).toEqual({ drawn: [], withheld: [LIGHTBOX_GATE_REASONS.handoffNotAdjacent.fresh] });
  });

  it('finds the pair by the occurrence that is adjacent when its first words stand twice', () => {
    // ¶2: "She knocked." is sentence 1 and sentence 3; only sentence 3 hands to "Nobody came."
    expect(outcome(readHandoffs([handoff([2, 'She knocked'], [2, 'Nobody came'])])))
      .toEqual({ drawn: [[2, 'She knocked', 'Nobody came']], withheld: [] });
    // And "The door held" follows sentence 1, not sentence 3.
    expect(outcome(readHandoffs([handoff([2, 'She knocked'], [2, 'The door held'])])))
      .toEqual({ drawn: [[2, 'She knocked', 'The door held']], withheld: [] });
  });

  it('withholds a pair one of whose sentences is not in the paragraph it named, with that quote\'s reason', () => {
    const assembled = readHandoffs([handoff([1, 'She knocked twice'], [1, 'Somebody came'])]);
    expect(outcome(assembled)).toEqual({ drawn: [], withheld: [LIGHTBOX_GATE_REASONS.handoffGone.fresh] });
    expect(assembled.withheldClaims[0].quotes).toEqual([{ paragraph: 1, reason: 'not-in-chapter' }]);
  });
});

describe('a numbers reading keeps only quotes holding an instance of its figure', () => {
  const RABBIT = [
    '“I am very late,” said the Rabbit. He was really quite flustered, as he was every morning, and only tired light fell on the lawn.',
    'Alice followed him down the long dark passage that wound on and on beneath the hedge for what seemed a great while to her.',
    'She stopped. The hall was hushed.'
  ];
  const standout = (stat: LightboxNumberStatId, direction: 'above' | 'below', reference?: number): LightboxNumberRow => ({
    stat, label: stat, unit: '', value: 1, instances: 1, instanceLabel: '', paragraphs: [],
    standout: { direction, against: ['writer'], ...(reference !== undefined ? { reference } : {}) }
  });
  const readNumber = (stat: string, quotes: Array<[number, string]>, rows: LightboxNumberRow[]) => read(['numbers'], {
    version: 1,
    numbers: {
      items: [{ stat, usage: 'mixed', claim: 'How the figure works in these lines.', evidence: quotes.map(([para, quote]) => ({ para, quote })) }],
      friction: 'Rates over three paragraphs.'
    }
  }, RABBIT, rows).assembled;
  const kept = (assembled: ReturnType<typeof readNumber>) => ({
    evidence: assembled.tiles.flatMap((tile) => tile.evidence.map((quote) => quote.text)),
    lost: assembled.tiles.flatMap((tile) => tile.withheldQuotes.map((quote) => quote.reason)),
    withheld: assembled.withheldClaims.map((claim) => claim.reason)
  });

  it.each([
    ['intensifiers', standout('intensifiers', 'above'), 'I am very late', 'said the Rabbit'],
    // A quote cut mid-word holds no match the figure counted ("nly" of "only", "very" of "every").
    ['adverbs', standout('adverbs', 'above'), 'only tired light', 'nly tired light'],
    ['intensifiers, mid-word', standout('intensifiers', 'above'), 'I am very late', 'very morning'],
    ['passive voice', standout('passive-voice', 'above'), 'The hall was hushed', 'She stopped'],
    ['being verbs', standout('being-verbs', 'above'), 'The hall was hushed', 'She stopped'],
    ['long sentences', standout('sentence-length', 'above', 15), 'the long dark passage', 'The hall was hushed'],
    ['short sentences', standout('sentence-length', 'below', 15), 'The hall was hushed', 'the long dark passage'],
    ['more dialogue', standout('dialogue', 'above'), 'I am very late', 'said the Rabbit'],
    // Below: narration from a paragraph with no dialogue, as the row counts (PR #155); a mixed paragraph's narration is none.
    ['less dialogue', standout('dialogue', 'below'), 'the long dark passage', 'said the Rabbit']
  ])('%s: keeps a quote holding one and withholds one that holds none', (_case, row, holds, lacks) => {
    const paragraphOf = (quote: string) => RABBIT.findIndex((paragraph) => paragraph.includes(quote)) + 1;
    const assembled = readNumber(row.stat, [[paragraphOf(holds), holds], [paragraphOf(lacks), lacks]], [row]);
    expect(kept(assembled)).toEqual({ evidence: [holds], lost: ['no-instance'], withheld: [] });
  });

  it('withholds a reading whose quotes hold no instance, and one of a figure that does not stand out', () => {
    const intensifiers = standout('intensifiers', 'above');
    expect(kept(readNumber('intensifiers', [[1, 'said the Rabbit']], [intensifiers])))
      .toEqual({ evidence: [], lost: [], withheld: [LIGHTBOX_GATE_REASONS.numberNoInstance.fresh] });
    expect(kept(readNumber('adverbs', [[1, 'only tired light']], [intensifiers])))
      .toEqual({ evidence: [], lost: [], withheld: [LIGHTBOX_GATE_REASONS.numberNotStandout.fresh] });
  });

  it('titles a reading by the host\'s label for its figure', () => {
    const assembled = readNumber('intensifiers', [[1, 'I am very late']], [standout('intensifiers', 'above')]);
    expect(assembled.tiles.map((tile) => (tile.kind === 'number-usage' ? [tile.title, tile.stat, tile.usage] : [])))
      .toEqual([['Intensifiers and fillers', 'intensifiers', 'mixed']]);
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
