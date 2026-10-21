/**
 * Craft steering on changed text (ADR 2026-10-19 D4; Slice 4F): a reading
 * and a note keep only quotes the figure's own detector still finds an
 * instance in, as a fresh read of the changed text would, and a note's one
 * example is anchored again in its carried quote, as the chapter now has
 * it. Through the production codec, assembly and carry. The Alice cases
 * read ¶1–¶8 of "Alice's Adventures in Wonderland" (1865, public domain)
 * with group G's worked example; the keys lines are synthetic sentences
 * written for these tests.
 */
import type { LightboxReadingGroup, LightboxSteeringNoteTile } from '@messages';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { frame, readWorkedExample } from './lightboxReadingFixtures';

const ALICE = readWorkedExample('G').paragraphs;

/** Group G read on `paragraphs` from `response` (framed), as the board would hold it. */
function readG(paragraphs: readonly string[], response: string = readWorkedExample('G').response): LightboxReadingGroup {
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

const carry = (group: LightboxReadingGroup, after: readonly string[]) =>
  carryLightboxReadings([group], { readAgainst: 'old', paragraphs: after, averageWordsPerSentence: 12 })[0];
const notes = (group: LightboxReadingGroup) =>
  group.tiles.filter((tile): tile is LightboxSteeringNoteTile => tile.kind === 'steering-note');
const edited = (index: number, from: string, to: string) =>
  ALICE.map((text, at) => (at === index ? text.replace(from, to) : text));

describe('a carried steering reading and note', () => {
  it('keeps every tile, its example and its stance where the text it quotes is unchanged', () => {
    const before = readG(ALICE);
    const carried = carry(before, edited(0, 'Rabbit-Hole', 'Rabbit Hole'));
    expect(carried.tiles.map((tile) => tile.title)).toEqual(before.tiles.map((tile) => tile.title));
    expect(notes(carried).map((tile) => [tile.stance, tile.example])).toEqual([
      ['earns', undefined],
      ['leans', { before: 'it was too dark', after: 'the dark swallowed everything' }],
      ['leans', { before: 'dipped suddenly down', after: 'plunged' }],
      ['earns', undefined],
      ['earns', undefined],
      ['compensates', { before: 'a very deep well', after: 'a bottomless well' }],
      ['leans', undefined]
    ]);
    // A note with no example carries no example field at all, not one left undefined.
    expect(Object.keys(notes(carried)[0])).not.toContain('example');
    expect(Object.keys(notes(carried)[0])).not.toContain('exampleWithheld');
  });

  it('withholds a note once its quote is gone, in the carried tense, and keeps the others', () => {
    const carried = carry(readG(ALICE), edited(6, 'it was too dark', 'it grew too dark'));
    expect(carried.withheldClaims.map((claim) => [claim.kind, claim.title, claim.reason])).toEqual([
      ['steering-note', 'Being verbs · note II', 'No quote of it still holds an instance of the figure it reads.']
    ]);
    expect(notes(carried)).toHaveLength(6);
  });

  it('follows a note and its example to the paragraph that now holds its quote', () => {
    const carried = carry(readG(ALICE), ['A new first line.', ...ALICE]);
    const note = notes(carried).find((tile) => tile.title === 'Being verbs · note II');
    expect([note?.evidence.map((quote) => [quote.paragraph, quote.text]), note?.example]).toEqual([
      [[8, 'it was too dark to see anything']],
      { before: 'it was too dark', after: 'the dark swallowed everything' }
    ]);
  });

  it('shows the example\'s first part as the changed chapter has it', () => {
    // A hard line break where a space stood: the verifier's fold finds the quote, as the chapter now has it.
    const carried = carry(readG(ALICE), edited(6, 'it was too dark', 'it was too\ndark'));
    const note = notes(carried).find((tile) => tile.title === 'Being verbs · note II');
    expect([note?.evidence[0].text, note?.example]).toEqual([
      'it was too\ndark to see anything',
      { before: 'it was too\ndark', after: 'the dark swallowed everything' }
    ]);
  });

  it('withholds a quote whose words still stand but now inside a longer word, as a fresh read of that text does', () => {
    // "they are" still stands inside "they aren't", but "are" is no whole word there, so it is no instance.
    const KEYS = ['The keys? I think they are lost, and the door is shut.'];
    const FLIPPED = ['The keys? I think they aren\u2019t lost, and the door is shut.'];
    const response = frame('G', {
      version: 1,
      steering: {
        figures: [{
          stat: 'being-verbs', claim: 'A plain state keeps the worry flat.', evidence: [{ para: 1, quote: 'I think they are' }],
          notes: [{ para: 1, quote: 'I think they are', stance: 'earns', why: 'The flat state keeps the worry quiet.', nudge: null, example: null }]
        }],
        friction: 'One line is thin ground.'
      }
    });
    const carried = carry(readG(KEYS, response), FLIPPED);
    expect(carried.tiles).toEqual([]);
    expect(carried.withheldClaims.map((claim) => [claim.title, claim.reason, claim.quotes])).toEqual([
      ['Being verbs', 'No quote of it still holds an instance of the figure it reads.', [{ paragraph: 1, reason: 'no-instance' }]],
      ['Being verbs · note I', 'No quote of it still holds an instance of the figure it reads.', [{ paragraph: 1, reason: 'no-instance' }]]
    ]);
    expect(readG(FLIPPED, response).withheldClaims.map((claim) => claim.reason)).toEqual([
      'No quote it gave was found holding an instance of the figure it reads.',
      'No quote it gave was found holding an instance of the figure it reads.'
    ]);
  });
});
