/**
 * Synthetic sentences for the collision-witness tests (PR #150 F-04, F-05):
 * Fire (term "flame") and Ocean (term "tide"), and a gravity block with the
 * collisions given. Written for these tests; no manuscript text.
 */
import type { LightboxLensId } from '@messages';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
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
