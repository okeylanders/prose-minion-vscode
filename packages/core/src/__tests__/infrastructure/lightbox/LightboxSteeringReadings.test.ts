/**
 * Group G, craft steering (ADR 2026-10-19 D7 second addendum; Slice 4F),
 * through the production codec, verifier, gates and assembly: what the codec
 * withholds and by which host title, the words and marks a steering text
 * never holds, the one example and how it is anchored in its note's checked
 * quote, and how every quote is held to an instance of its figure by the
 * numbers' own detector. Literal expected values throughout. The board
 * reads ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public domain);
 * the Rabbit and hall paragraphs are synthetic sentences written for these
 * tests.
 */
import type {
  LightboxNumberRow,
  LightboxNumberStatId,
  LightboxReadingTile,
  LightboxSteeringNoteTile,
  LightboxVerifiedQuote
} from '@messages';
import {
  LIGHTBOX_READING_GROUPS,
  LIGHTBOX_TILE_LENS,
  LIGHTBOX_TILE_REGISTER,
  lightboxGroupLenses,
  lightboxLensGroup
} from '@shared/constants/lightbox';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { createLightboxDialogueIndex } from '@/infrastructure/lightbox/LightboxDialogueAnchor';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { LIGHTBOX_GATE_REASONS, lightboxTileGate } from '@/infrastructure/lightbox/LightboxTileGates';
import { LIGHTBOX_STEERING_EXAMPLE_REASONS } from '@/infrastructure/lightbox/LightboxSteeringCodec';
import { lightboxSteeringTaskLines } from '@/infrastructure/lightbox/LightboxSteeringTiles';
import { frame, readWorkedExample } from './lightboxReadingFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- reading bodies are written as plain JSON. */
type Body = Record<string, any>;

const ALICE = readWorkedExample('G').paragraphs;
const FRICTION = 'A short opening is thin ground for a habit.';

const note = (para: number, quote: string, stance: string, why: string, nudge: string | null = null, example: unknown = null) =>
  ({ para, quote, stance, why, nudge, example });
const figure = (stat: string, notes: Body[] = [], claim = 'How the figure works in this chapter.', evidence: Body[] = []) =>
  ({ stat, claim, evidence: evidence.length > 0 ? evidence : [{ para: 7, quote: QUOTES[stat] }], notes });
const body = (figures: Body[]): Body => ({ version: 1, steering: { figures, friction: FRICTION } });

/** A quote holding an instance of each figure in the Alice opening. */
const QUOTES: Record<string, string> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the figures' kebab-case protocol ids.
  'being-verbs': 'it was too dark to see anything',
  adverbs: 'or she fell very slowly',
  intensifiers: 'Either the well was very deep'
};

function read(value: Body, paragraphs: readonly string[] = ALICE) {
  const decoded = decodeLightboxGroup(frame('G', value), { group: 'G', lenses: ['steering'], columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `g${++id}`
  });
  return { decoded, assembled };
}

const withheld = (value: Body, paragraphs?: readonly string[]) =>
  read(value, paragraphs).assembled.withheldClaims.map((claim) => [claim.kind, claim.title, claim.reason]);
const notesOf = (tiles: LightboxReadingTile[]) =>
  tiles.filter((tile): tile is LightboxSteeringNoteTile => tile.kind === 'steering-note');

describe('craft steering is its own call', () => {
  it('reads in group G, alone, before the Opinion, and registers a counted reading and a reading', () => {
    expect(lightboxLensGroup('steering')).toBe('G');
    expect(lightboxGroupLenses('G')).toEqual(['steering']);
    expect(LIGHTBOX_READING_GROUPS).toEqual(['A', 'B', 'C', 'D', 'E', 'G', 'F']);
    expect([LIGHTBOX_TILE_REGISTER['steering-reading'], LIGHTBOX_TILE_REGISTER['steering-note']]).toEqual(['counted-read', 'read']);
    expect([LIGHTBOX_TILE_LENS['steering-reading'], LIGHTBOX_TILE_LENS['steering-note']]).toEqual(['steering', 'steering']);
  });
});

describe('group G codec', () => {
  it('withholds a figure holding a field the format does not define, by its label, counting it and never naming it', () => {
    const extra = { ...figure('being-verbs'), severity: 'high' };
    expect(withheld(body([extra]))).toEqual([
      ['steering-reading', 'Being verbs', 'It broke the format: steering.figures[0] has 1 field the format does not define.']
    ]);
  });

  it('titles a figure that names none of the three by its place, and withholds a second reading of one figure', () => {
    expect(withheld(body([figure('passive-voice'), figure('adverbs'), figure('adverbs')]))).toEqual([
      ['steering-reading', 'Figure 1', 'It broke the format: steering.figures[0].stat must be one of the figures the task lists'],
      ['steering-reading', 'Adverbs (-ly)', 'Another reading in this block already reads that figure.']
    ]);
  });

  it('reads a fourth figure as the repeat it is, withheld by its label alone, and every note past the four asked (Slice 4H)', () => {
    const { decoded, assembled } = read(body([figure('being-verbs'), figure('adverbs'), figure('intensifiers'), figure('adverbs')]));
    // The block stands: a figure is one of three, so the fourth can only repeat one, and only the repeat is withheld.
    expect(decoded.withheld).toEqual([]);
    expect(assembled.withheldClaims.map((claim) => [claim.title, claim.reason])).toEqual([
      ['Adverbs (-ly)', 'Another reading in this block already reads that figure.']
    ]);
    expect(assembled.tiles.filter((tile) => tile.kind === 'steering-reading')).toHaveLength(3);
    // Five notes where four are asked: all five are read and drawn.
    const fiveNotes = Array.from({ length: 5 }, () => note(7, QUOTES.adverbs, 'earns', 'The adverb is the joke’s hinge.'));
    const five = read(body([figure('adverbs', fiveNotes)]));
    expect(five.assembled.withheldClaims).toEqual([]);
    expect(notesOf(five.assembled.tiles).map((tile) => tile.title)).toEqual([
      'Adverbs (-ly) · note I', 'Adverbs (-ly) · note II', 'Adverbs (-ly) · note III', 'Adverbs (-ly) · note IV', 'Adverbs (-ly) · note V'
    ]);
  });

  it('shows a claim, a why and a nudge longer than asked, whole (Slice 4H)', () => {
    const claim = 'The -ly words gather at the fall and just before it, carrying speed and manner where the verbs stay plain. '.repeat(5).trim();
    const why = 'Slowly answers deep in the either-or, and the sentence turns on it, so the adverb is the hinge of the joke here. '.repeat(3).trim();
    expect(claim.length).toBeGreaterThan(400);
    expect(why.length).toBeGreaterThan(200);
    const { assembled } = read(body([figure('adverbs', [note(7, QUOTES.adverbs, 'earns', why)], claim)]));
    expect(assembled.withheldClaims).toEqual([]);
    expect(assembled.tiles.map((tile) => tile.claim)).toEqual([claim, why]);
  });

  it('withholds a claim that breaks a text rule as the reading alone, and keeps its notes', () => {
    const notes = [note(7, QUOTES.adverbs, 'earns', 'The adverb answers the depth in the either-or.')];
    const { assembled } = read(body([figure('adverbs', notes, 'These adverbs should go.')]));
    expect(assembled.withheldClaims.map((claim) => [claim.kind, claim.title, claim.reason])).toEqual([
      ['steering-reading', 'Adverbs (-ly)', 'It uses a word craft steering never uses (cut, fix and the like): a nudge names a craft move, never a correction.']
    ]);
    expect(assembled.tiles.map((tile) => [tile.kind, tile.title])).toEqual([['steering-note', 'Adverbs (-ly) · note I']]);
  });

  it('holds each note to its stance: earns names no nudge, leans and compensates name one in narration', () => {
    const why = 'The speed sits in the adverb beside a plain verb.';
    const notes = [
      note(7, QUOTES.adverbs, 'overuses', why, 'A verb that holds the speed may be worth a look.'),
      note(7, QUOTES.adverbs, 'earns', why, 'A verb that holds the speed may be worth a look.'),
      note(7, QUOTES.adverbs, 'leans', why, null),
      { ...note(7, QUOTES.adverbs, 'compensates', why, 'A verb that holds the speed may be worth a look.'), severity: 'high' }
    ];
    // The codec reads a leaning note with no nudge (the shape for dialogue, epic decision 26); its quote is narration,
    // so the gate withholds it once the quote is checked, after the notes the codec could not read.
    expect(withheld(body([figure('adverbs', notes)])).filter(([kind]) => kind === 'steering-note')).toEqual([
      ['steering-note', 'Adverbs (-ly) · note I', 'It broke the format: steering.figures[0].notes[0].stance must be earns, leans or compensates'],
      ['steering-note', 'Adverbs (-ly) · note II', 'It earns its place, so it names no nudge, and this one does.'],
      ['steering-note', 'Adverbs (-ly) · note IV', 'It broke the format: steering.figures[0].notes[3] has 1 field the format does not define.'],
      ['steering-note', 'Adverbs (-ly) · note III', 'It leans or compensates in narration, so it names the craft move worth a look, and this one names none.']
    ]);
  });

  it('withholds a note whose why or nudge breaks a text rule, saying which, and keeps its siblings', () => {
    const nudge = 'A verb that holds the speed may be worth a look.';
    const notes = [
      note(7, QUOTES.adverbs, 'leans', 'The adverb should carry less here.', nudge),
      note(7, QUOTES.adverbs, 'leans', 'The speed sits in the adverb.', 'Try a verb that holds the speed.'),
      note(7, QUOTES.adverbs, 'leans', 'The speed sits in the adverb.', 'A verb like “plunged” may be worth a look.'),
      note(7, QUOTES.adverbs, 'leans', 'Three of 4 adverbs sit here.', nudge)
    ];
    const tiles = read(body([figure('adverbs', notes)])).assembled;
    expect(tiles.withheldClaims.map((claim) => [claim.title, claim.reason])).toEqual([
      ['Adverbs (-ly) · note I', 'Its why was withheld. It uses a word craft steering never uses (cut, fix and the like): a nudge names a craft move, never a correction.'],
      ['Adverbs (-ly) · note II', 'Its nudge was withheld. It gives an order: craft steering names a move worth a look, and the call is yours.'],
      ['Adverbs (-ly) · note III', 'Its nudge was withheld. It holds quotation marks: craft steering quotes the chapter only in a note\'s checked quote, and never offers words as yours.'],
      ['Adverbs (-ly) · note IV', 'Its why was withheld. It states a figure: the counts are the board\'s, shown beside the reading.']
    ]);
    expect(tiles.tiles.map((tile) => tile.kind)).toEqual(['steering-reading']);
  });

  it('draws a note that leans with its stance and nudge, and one that earns with neither nudge nor example', () => {
    const notes = [
      note(7, QUOTES['being-verbs'], 'leans', 'A state stands where the fall could act.', 'An action that lets the dark do something may be worth a look.'),
      note(3, 'So she was considering in her own mind', 'earns', 'The progressive keeps her idle thinking going.')
    ];
    const drawn = notesOf(read(body([figure('being-verbs', notes)])).assembled.tiles);
    expect(drawn.map((tile) => [tile.title, tile.stat, tile.stance, tile.claim, tile.nudge, tile.ordinal, tile.evidence.map((quote) => quote.paragraph)])).toEqual([
      ['Being verbs · note I', 'being-verbs', 'leans', 'A state stands where the fall could act.', 'An action that lets the dark do something may be worth a look.', 1, [7]],
      ['Being verbs · note II', 'being-verbs', 'earns', 'The progressive keeps her idle thinking going.', undefined, 2, [3]]
    ]);
    expect(Object.keys(drawn[1])).not.toContain('nudge');
    expect(Object.keys(drawn[1])).not.toContain('example');
  });
});

describe('the words and marks craft steering never uses', () => {
  const reasonOf = (why: string, nudge = 'A verb that holds the speed may be worth a look.') => {
    const claims = read(body([figure('adverbs', [note(7, QUOTES.adverbs, 'leans', why, nudge)])])).assembled.withheldClaims;
    return claims.map((claim) => claim.reason)[0];
  };
  const FORBIDDEN = 'It uses a word craft steering never uses (cut, fix and the like): a nudge names a craft move, never a correction.';

  it.each([
    'cut', 'cuts', 'cutting', 'delete', 'deletes', 'deleted', 'deleting', 'remove', 'removes', 'removed', 'removing',
    'fix', 'fixes', 'fixed', 'fixing', 'wrong', 'wrongly', 'bad', 'badly', 'should', 'shouldn’t', 'must', 'mustn\'t', 'Cut'
  ])('withholds a why holding %s', (word) => {
    expect(reasonOf(`The adverb ${word} the line here.`)).toBe(`Its why was withheld. ${FORBIDDEN}`);
  });

  it('withholds a listed word used to describe, as its stated safe failure', () => {
    for (const why of ['The adverb sits on the cut of her coat.', 'The adverb colors a bad dream.', 'The adverb holds the knot fixed in place.']) {
      expect(reasonOf(why)).toBe(`Its why was withheld. ${FORBIDDEN}`);
    }
  });

  it('passes plain diagnosis, and words that only begin like a listed one', () => {
    for (const why of [
      'The adverb carries the speed the verb leaves plain.',
      'The shoulder of the sentence leans on the adverb.',
      'A badger at the door, a fixture of the scene, and the adverb beside it.',
      'Mustard light and a cutlery drawer: the adverb does the moving.',
      'Its removal of doubt is the voice’s own, as in ¶7.'
    ]) {
      expect(reasonOf(why)).toBeUndefined();
    }
  });

  it('withholds a figure in a why or a nudge, and an order in either, but not single quotation marks or apostrophes', () => {
    expect(reasonOf('The speed sits in the adverb.', 'A verb that holds 40% of the speed may be worth a look.'))
      .toBe('Its nudge was withheld. It states a figure: the counts are the board\'s, shown beside the reading.');
    expect(reasonOf('The speed sits in forty percent of the adverbs.'))
      .toBe('Its why was withheld. It states a figure: the counts are the board\'s, shown beside the reading.');
    expect(reasonOf('Consider the speed in the adverb.'))
      .toBe('Its why was withheld. It gives an order: craft steering names a move worth a look, and the call is yours.');
    expect(reasonOf('The speed sits in the adverb, the narrator’s ‘slowly’.')).toBeUndefined();
    expect(reasonOf('The speed sits in the adverb.', 'A "plunge" may be worth a look.'))
      .toBe('Its nudge was withheld. It holds quotation marks: craft steering quotes the chapter only in a note\'s checked quote, and never offers words as yours.');
  });

  it('holds a claim to the words, the marks and the figures, but not to the opener check', () => {
    const claimFault = (claim: string) => withheld(body([figure('adverbs', [], claim)])).map(([, , reason]) => reason);
    expect(claimFault('Consider how the adverbs gather at the fall.')).toEqual([]);
    expect(claimFault('The adverbs gather in 2 places.')).toEqual(['It states a figure: the counts are the board\'s, shown beside the reading.']);
  });
});

describe('the one example', () => {
  const NUDGE = 'An action that lets the dark do something may be worth a look.';
  const WHY = 'A state stands where the fall could act.';
  const exampleOf = (example: unknown, stance = 'leans', quote = QUOTES['being-verbs'], para = 7) => {
    const drawn = notesOf(read(body([figure('being-verbs', [note(para, quote, stance, WHY, stance === 'earns' ? null : NUDGE, example)])])).assembled.tiles);
    expect(drawn).toHaveLength(1);
    return { example: drawn[0].example, withheld: drawn[0].exampleWithheld };
  };

  it('shows a phrase of the note\'s checked quote holding the instance, and a few words of one way it could go', () => {
    expect(exampleOf({ before: 'it was too dark', after: 'the dark swallowed everything' }))
      .toEqual({ example: { before: 'it was too dark', after: 'the dark swallowed everything' }, withheld: undefined });
  });

  it('shows none when the reading gives none, as null or an empty list', () => {
    expect(exampleOf(null)).toEqual({ example: undefined, withheld: undefined });
    expect(exampleOf([])).toEqual({ example: undefined, withheld: undefined });
  });

  it('withholds an example on a note that earns, and keeps the note', () => {
    expect(exampleOf({ before: 'it was too dark', after: 'the dark swallowed everything' }, 'earns'))
      .toEqual({ example: undefined, withheld: 'A note that earns its place shows no example, so this one is not shown.' });
  });

  it('shows the first of several, and says the rest are withheld', () => {
    expect(exampleOf([
      { before: 'it was too dark', after: 'the dark swallowed everything' },
      { before: 'was too dark', after: 'darkness pooled' }
    ])).toEqual({
      example: { before: 'it was too dark', after: 'the dark swallowed everything' },
      withheld: 'A note shows one example; the reading gave more, and only the first is shown.'
    });
  });

  it.each([
    ['a missing part', { before: 'it was too dark' }, 'Its example broke the format, so it is not shown.'],
    ['a field the format does not define', { before: 'it was too dark', after: 'the dark swallowed it', why: 'shorter' }, 'Its example broke the format, so it is not shown.'],
    ['a bare string', 'the dark swallowed everything', 'Its example broke the format, so it is not shown.'],
    ['a blank part', { before: 'it was too dark', after: '  ' }, 'Its example broke the format, so it is not shown.'],
    ['no change', { before: 'it was too dark', after: 'It  was too DARK' }, 'Its example shows no change: its second part is its first again.'],
    ['quotation marks', { before: 'it was too dark', after: 'the “dark” swallowed it' },
      'Its example was withheld. It holds quotation marks: craft steering quotes the chapter only in a note\'s checked quote, and never offers words as yours.'],
    ['a word steering never uses', { before: 'it was too dark', after: 'the dark cut in' },
      'Its example was withheld. It uses a word craft steering never uses (cut, fix and the like): a nudge names a craft move, never a correction.'],
    ['a figure', { before: 'it was too dark', after: 'the 3 lamps died' },
      'Its example was withheld. It states a figure: the counts are the board\'s, shown beside the reading.']
  ])('withholds the example alone for %s, and keeps the note', (_case, example, reason) => {
    expect(exampleOf(example)).toEqual({ example: undefined, withheld: reason });
  });

  it.each([
    ['a second part of nine words', 'the dark came up all at once and swallowed it'],
    ['a second part of eighty characters', 'incomprehensibilities overwhelmingly counterrevolutionary internationalisations'],
    ['a second part past eight times its ask, whole', 'darkness '.repeat(70).trim()]
  ])('shows an example with %s: its length is an ask (Slice 4H)', (_case, after) => {
    const shown = exampleOf({ before: 'it was too dark', after });
    expect(shown.withheld).toBeUndefined();
    expect(shown.example?.before).toBe('it was too dark');
    // Whole however long (PR #165 F-01): both parts are checked as written, fresh, on carry and at Bring, so the codec
    // never clips them; Bring clips the pair to one Workshop point after its checks.
    expect(shown.example?.after).toBe(after);
  });

  it('shows a first part longer than asked when it stands whole in the note\'s checked quote', () => {
    const quote = 'it was too dark to see anything; then she looked at the sides of the well, and noticed';
    const before = quote;
    expect(before.split(' ').length).toBeGreaterThan(8);
    expect(before.length).toBeGreaterThan(72);
    expect(exampleOf({ before, after: 'the dark swallowed the shelves' }, 'leans', quote))
      .toEqual({ example: { before, after: 'the dark swallowed the shelves' }, withheld: undefined });
  });

  it('holds a second part to its words but not to the opener check: it is a phrase, not an order', () => {
    expect(exampleOf({ before: 'it was too dark', after: 'Use of darkness' }).example).toEqual({ before: 'it was too dark', after: 'Use of darkness' });
  });

  it.each([
    ['outside the quote, in its paragraph', 'Either the well was very deep'],
    ['cut inside a word', 't was too dark'],
    ['holding no instance', 'too dark to see'],
    ['not in the chapter', 'it was too black']
  ])('withholds an example whose first part is %s', (_case, before) => {
    expect(exampleOf({ before, after: 'the dark swallowed it' })).toEqual({ example: undefined, withheld: LIGHTBOX_STEERING_EXAMPLE_REASONS.unanchored });
    expect(LIGHTBOX_STEERING_EXAMPLE_REASONS.unanchored)
      .toBe('Its example\'s first part is not a run of whole words of its checked quote holding the instance, so it is not shown.');
  });

  it('shows the first part as the chapter has it, never as the reading spelled it', () => {
    // The verifier's folded match: a straight apostrophe in the reading finds the chapter's curly one.
    const paragraphs = ['She said she’d been there and was glad of it.'];
    const drawn = notesOf(read(body([figure('being-verbs', [note(1, 'she’d been there and was glad', 'leans', WHY, NUDGE,
      { before: "she'd been there", after: 'she knew the place' })], 'A state holds the visit.', [{ para: 1, quote: 'and was glad of it' }])]), paragraphs).assembled.tiles);
    expect(drawn[0].example).toEqual({ before: 'she’d been there', after: 'she knew the place' });
  });

  it('never counts an example as a quote', () => {
    const { assembled } = read(body([figure('being-verbs', [note(7, QUOTES['being-verbs'], 'leans', WHY, NUDGE, { before: 'it was too dark', after: 'the dark swallowed it' })])]));
    // The reading's quote and the note's quote: two checked, none for the example.
    expect(assembled.quotesChecked).toBe(2);
    expect(notesOf(assembled.tiles)[0].evidence.map((quote) => quote.text)).toEqual(['it was too dark to see anything']);
  });
});

describe('every steering quote holds an instance of its figure', () => {
  const RABBIT = [
    '“I am very late,” said the Rabbit. He was really quite flustered, as he was every morning, and only tired light fell on the lawn.',
    'Alice followed him down the long dark passage that wound on and on beneath the hedge for what seemed a great while to her.',
    'She stopped. The hall was hushed. She’s gone, and the hall seemed empty.'
  ];
  const paragraphOf = (quote: string) => RABBIT.findIndex((paragraph) => paragraph.includes(quote)) + 1;
  const reading = (stat: string, quotes: string[]) => read(body([figure(stat, [], 'How the figure works in these lines.',
    quotes.map((quote) => ({ para: paragraphOf(quote), quote })))]), RABBIT).assembled;

  it.each([
    ['intensifiers', 'intensifiers', 'I am very late', 'said the Rabbit'],
    // A quote cut mid-word holds no match the figure counted ("nly" of "only", "very" of "every").
    ['adverbs, mid-word', 'adverbs', 'only tired light', 'nly tired light'],
    ['intensifiers, mid-word', 'intensifiers', 'I am very late', 'very morning'],
    ['being verbs', 'being-verbs', 'The hall was hushed', 'She stopped'],
    // A contraction of be is an instance since the writer's decision (epic decision 26); a linking verb is none.
    ['being verbs, a contraction', 'being-verbs', 'She’s gone', 'She stopped'],
    ['being verbs, a linking verb', 'being-verbs', 'The hall was hushed', 'the hall seemed empty']
  ])('%s: keeps a quote holding one and withholds one that holds none', (_case, stat, holds, lacks) => {
    const assembled = reading(stat, [holds, lacks]);
    expect(assembled.tiles.map((tile) => [tile.kind, tile.evidence.map((quote) => quote.text), tile.withheldQuotes.map((quote) => quote.reason)]))
      .toEqual([['steering-reading', [holds], ['no-instance']]]);
  });

  it('withholds a reading and a note whose quotes hold none, with the host\'s reason', () => {
    expect(withheld(body([figure('being-verbs', [note(3, 'She stopped', 'earns', 'The short stop keeps the voice quick.')], 'How it works.',
      [{ para: 3, quote: 'the hall seemed empty' }])]), RABBIT)).toEqual([
      ['steering-reading', 'Being verbs', 'No quote it gave was found holding an instance of the figure it reads.'],
      ['steering-note', 'Being verbs · note I', 'No quote it gave was found holding an instance of the figure it reads.']
    ]);
  });

  it('reads a figure whether or not it stands out on the board', () => {
    // No standout rows at all: steering still reads each figure the chapter holds.
    expect(reading('adverbs', ['only tired light']).tiles.map((tile) => tile.kind)).toEqual(['steering-reading']);
  });
});

describe('the gates, fresh and carried', () => {
  const verifier = createLightboxQuoteVerifier(ALICE);
  const quote: LightboxVerifiedQuote = { paragraph: 7, text: 'or she fell very slowly', match: 'exact' };
  const context = (phase: 'fresh' | 'carried') => ({
    phase,
    drawnFields: new Map<string, readonly string[]>(),
    dialogue: createLightboxDialogueIndex(verifier),
    standouts: lightboxStandoutRows([{
      stat: 'adverbs', label: 'Adverbs (-ly)', unit: '', value: 1, instances: 1, instanceLabel: '', paragraphs: [],
      standout: { direction: 'above', against: ['writer'] }
    }])
  });

  it('refuses a steering tile with no quote holding an instance, in each phase\'s words', () => {
    for (const kind of ['steering-reading', 'steering-note'] as const) {
      expect(lightboxTileGate({ kind, evidence: [], support: [] }, context('fresh')))
        .toEqual({ ok: false, reason: 'No quote it gave was found holding an instance of the figure it reads.' });
      expect(lightboxTileGate({ kind, evidence: [], support: [] }, context('carried')))
        .toEqual({ ok: false, reason: 'No quote of it still holds an instance of the figure it reads.' });
      expect(lightboxTileGate({ kind, evidence: [quote], support: [] }, context('fresh'))).toEqual({ ok: true });
    }
  });

  it('refuses a numbers reading of a figure craft steering reads, though it stands out and its quote holds one', () => {
    for (const phase of ['fresh', 'carried'] as const) {
      expect(lightboxTileGate({ kind: 'number-usage', stat: 'adverbs', evidence: [quote], support: [] }, context(phase)))
        .toEqual({ ok: false, reason: 'Craft steering reads this figure, so the numbers lens does not.' });
    }
    expect(LIGHTBOX_GATE_REASONS.numberSteered).toBe('Craft steering reads this figure, so the numbers lens does not.');
  });
});

describe('group G\'s task', () => {
  const row = (stat: LightboxNumberStatId, instances: number): LightboxNumberRow => ({
    stat, label: stat, unit: '', value: 0, instances, instanceLabel: '', paragraphs: []
  });

  it('says what an instance of each figure is, and gives no figure the chapter holds none of, with no count', () => {
    expect(lightboxSteeringTaskLines([row('being-verbs', 17), row('adverbs', 0), row('intensifiers', 11)])).toEqual([
      'Read each of these figures by its id, whatever its rate. A quote counts only when it holds an instance exactly as described:',
      '- `being-verbs`: an instance is one of these whole words: am, is, are, was, were, be, been, being; or one contracted: ' +
        'I\'m, \'re (you\'re, we\'re, they\'re), \'s read as is (it\'s, she\'s, there\'s, and after a name or noun before an adjective, ' +
        'an -ing word, an adverb, a preposition or a determiner: the Hatter\'s late, everyone\'s here), isn\'t, aren\'t, wasn\'t, weren\'t, ' +
        'ain\'t, \'tis, \'twas, \'twere. \'s as a possessive (the Rabbit\'s watch, Alice\'s sister) or as has (he\'s been, she\'s got, ' +
        'it\'s had), let\'s, ain\'t before been, got or had, \'d, \'ll and \'ve, a form joined to an underscore (_was_) and a linking verb ' +
        '(seem, become, look, feel, appear) are not instances.',
      '- `adverbs`: the board found no instance in this chapter, so give no figure for it.',
      '- `intensifiers`: an instance is one of these whole words: just, really, very, quite, rather, somewhat, somehow, actually, basically, literally.'
    ]);
  });
});

describe('the largest group G response', () => {
  it('fits the group response cap with every field at its bound and every quote at 240 characters, and decodes', () => {
    const quote = (para: number) => ({ para, quote: 'q'.repeat(240) });
    const fullNote = (para: number) => ({
      para, quote: 'q'.repeat(240), stance: 'leans', why: 'w'.repeat(160), nudge: 'n'.repeat(120),
      example: { before: 'b'.repeat(56), after: 'a'.repeat(56) }
    });
    const largest = {
      version: 1,
      steering: {
        figures: ['being-verbs', 'adverbs', 'intensifiers'].map((stat) => ({
          stat, claim: 'c'.repeat(320), evidence: [quote(1), quote(2), quote(3)], notes: [fullNote(4), fullNote(5), fullNote(6), fullNote(7)]
        })),
        friction: 'f'.repeat(280)
      }
    };
    const framed = frame('G', largest);
    // Measured: 12,586 characters, so group G needs no ceiling note of its own (unlike groups D and E).
    expect(framed.length).toBe(12_586);
    expect(framed.length).toBeLessThan(32_000);
    const decoded = decodeLightboxGroup(framed, { group: 'G', lenses: ['steering'], columnCount: 8 });
    expect(decoded.withheld).toEqual([]);
    const block = decoded.blocks[0];
    expect(block.lens === 'steering' && [block.figures.length, block.figures.flatMap((item) => item.notes).length, block.malformed]).toEqual([3, 12, []]);
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
