/**
 * A collision's witness (PR #150 F-04): two borrowed fields "share a
 * sentence" only when one sentence of a found quote holds a term of each.
 * The host checks that sentence, by the same sentence rule prose stats uses,
 * and keeps it on the tile as the witness the board shows. Synthetic
 * sentences written for this test; no manuscript text.
 */
import type { LightboxGravityCollisionTile, LightboxLensId } from '@messages';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { countProseSentences, proseSentenceSpans } from '@/tools/measure/passageProseStats';
import { frame } from './lightboxReadingFixtures';

export const WITNESS_PARAGRAPHS = [
  'Her hope was a flame.',
  'The tide came in at noon.',
  'The flame went out. The tide came in.',
  'A tide swallowed the flame.'
];

type Quote = { para: number; quote: string };

/** A gravity block with Fire (flame) and Ocean (tide), and the collisions given. */
export function witnessBody(collisions: Array<{ evidence: Quote[] }>): Record<string, unknown> {
  return {
    version: 1,
    gravity: {
      fields: [
        { name: 'Fire', metaphor: 'Hope as a flame.', pull: 0.4, claim: 'Hope burns.',
          terms: [{ term: 'flame', degree: 3 }], evidence: [{ para: 1, quote: 'Her hope was a flame.' }] },
        { name: 'Ocean', metaphor: 'Time as a tide.', pull: 0.3, claim: 'Time comes in.',
          terms: [{ term: 'tide', degree: 3 }], evidence: [{ para: 2, quote: 'The tide came in at noon.' }] }
      ],
      collisions: collisions.map(({ evidence }) => ({ fields: ['Fire', 'Ocean'], claim: 'They meet.', evidence })),
      literal: [{ name: 'Noon', reason: 'The hour is the scene\'s own.', terms: ['noon'], evidence: [{ para: 2, quote: 'at noon' }] }],
      friction: 'Two fields, both faint.'
    }
  };
}

export function assembleWitness(collisions: Array<{ evidence: Quote[] }>, paragraphs = WITNESS_PARAGRAPHS) {
  const lenses: LightboxLensId[] = ['gravity'];
  const decoded = decodeLightboxGroup(frame('A', witnessBody(collisions)), { group: 'A', lenses, columnCount: paragraphs.length });
  let id = 0;
  return assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `w${++id}`
  });
}

const collisionOf = (assembled: ReturnType<typeof assembleWitness>) =>
  assembled.tiles.find((tile): tile is LightboxGravityCollisionTile => tile.kind === 'gravity-collision');

describe('a collision\'s supporting sentence (PR #150 F-04)', () => {
  it('splits sentences by the prose-stats rule, keeping each sentence\'s span', () => {
    const text = 'The flame went out. The tide came in!  And then? ';
    const spans = proseSentenceSpans(text);
    expect(spans.map(({ start, end }) => text.slice(start, end).trim())).toEqual(['The flame went out.', 'The tide came in!', 'And then?']);
    expect(spans.length).toBe(countProseSentences(text));
  });

  it('withholds a collision whose two fields\' terms stand in different sentences of its quote', () => {
    const assembled = assembleWitness([{ evidence: [{ para: 3, quote: 'The flame went out. The tide came in.' }] }]);
    expect(collisionOf(assembled)).toBeUndefined();
    expect(assembled.withheldClaims).toEqual([expect.objectContaining({
      kind: 'gravity-collision',
      title: 'Fire meets Ocean',
      reason: 'No sentence of its quotes holds a term of each field, so the board cannot show them sharing one.'
    })]);
  });

  it('draws a collision from a later quote that holds both fields in one sentence, and keeps that sentence as its witness', () => {
    const assembled = assembleWitness([{ evidence: [
      { para: 1, quote: 'Her hope was a flame.' },
      { para: 4, quote: 'A tide swallowed the flame.' }
    ] }]);
    const collision = collisionOf(assembled);
    expect(collision?.witness).toEqual({ paragraph: 4, text: 'A tide swallowed the flame.', match: 'exact' });
    // Both quotes stay evidence; only the second is the witness.
    expect(collision?.evidence.map((quote) => quote.paragraph)).toEqual([1, 4]);
  });

  it('takes the sentence, not the whole quote, as the witness', () => {
    const paragraphs = [...WITNESS_PARAGRAPHS.slice(0, 3), 'It rained. A tide swallowed the flame. Then dusk.'];
    const assembled = assembleWitness([{ evidence: [{ para: 4, quote: 'It rained. A tide swallowed the flame. Then dusk.' }] }], paragraphs);
    expect(collisionOf(assembled)?.witness).toEqual({ paragraph: 4, text: 'A tide swallowed the flame.', match: 'exact' });
  });
});
