/**
 * How the board draws borrowed fields (ADR 2026-10-19 D7; Slice 3): the
 * claimed pull places a field on the orbit but the host's count decides the
 * gravity line; drift and degree wording come from the host's counts.
 */
import type { LightboxGravityFieldTile } from '@messages';
import {
  LIGHTBOX_ORBIT_BUTTON,
  LIGHTBOX_ORBIT_RINGS,
  LIGHTBOX_ORBIT_SIZE,
  lightboxBelowLineNote,
  lightboxDegreeAria,
  lightboxDegreeRows,
  lightboxDriftNote,
  lightboxOrbitPlacements,
  lightboxPullLabel
} from '@hooks/domain/lightbox/lightboxGravity';

const field = (over: Partial<LightboxGravityFieldTile>): LightboxGravityFieldTile => ({
  id: 'f',
  kind: 'gravity-field',
  lens: 'gravity',
  title: 'Liturgy',
  claim: 'c',
  paragraphs: [14],
  evidence: [{ paragraph: 14, text: 'the presence walked beside him', match: 'exact' }],
  withheldQuotes: [],
  support: [
    { term: 'presence', count: 11, paragraphs: [14], degree: 1 },
    { term: 'vigil', count: 2, paragraphs: [29], degree: 2 },
    { term: 'church', count: 1, paragraphs: [36], degree: 3 }
  ],
  friction: 'f',
  metaphor: 'The night as a vigil.',
  pull: 0.62,
  hits: 14,
  degreeHits: [11, 2, 1],
  belowLine: false,
  drift: { first: 14, last: 36, densest: { from: 14, to: 15, hits: 7 } },
  ...over
});

const radius = (placement: { left: number; top: number }) => {
  const center = LIGHTBOX_ORBIT_SIZE / 2 - LIGHTBOX_ORBIT_BUTTON / 2;
  return Math.hypot(placement.left - center, placement.top - center);
};

describe('the gravity orbit', () => {
  it('draws more claimed pull nearer the center, and a field under the line on it whatever its pull', () => {
    const [strong, faint, under] = lightboxOrbitPlacements([
      field({ id: 'a', pull: 0.9 }),
      field({ id: 'b', pull: 0.1 }),
      field({ id: 'c', pull: 0.95, hits: 2, belowLine: true })
    ]);
    expect(radius(strong)).toBeLessThan(radius(faint));
    expect(radius(under)).toBeCloseTo(LIGHTBOX_ORBIT_RINGS.line, 0);
    expect(under.belowLine).toBe(true);
    // The dot grows with the host's hits, bounded.
    expect(strong.dot).toBeGreaterThan(under.dot);
    expect(lightboxOrbitPlacements([field({ hits: 5_000 })])[0].dot).toBe(34);
  });

  it('spreads fields around the circle so none stack', () => {
    const placements = lightboxOrbitPlacements([0, 1, 2, 3, 4].map((index) => field({ id: `f${index}`, pull: 0.5 })));
    const spots = placements.map((placement) => `${placement.left},${placement.top}`);
    expect(new Set(spots).size).toBe(5);
  });
});

describe('gravity wording', () => {
  it('labels the pull a claim, and words the drift and the line from the host\'s counts', () => {
    expect(lightboxPullLabel(0.62)).toBe('pull 0.62 · claim');
    expect(lightboxDriftNote(field({}))).toBe('Enters at ¶14, last at ¶36; densest at ¶14–¶15 (7 of 14 hits).');
    expect(lightboxDriftNote(field({ hits: 2, drift: { first: 27, last: 27, densest: { from: 27, to: 27, hits: 2 } } })))
      .toBe('Only in ¶27, 2 hits.');
    expect(lightboxDriftNote(field({ hits: 0, drift: null }))).toBe('None of its terms is in the chapter.');
    expect(lightboxBelowLineNote(field({ hits: 2 }))).toMatch(/^Below the gravity line: 2 hits, fewer than 3\./);
  });

  it('rows the terms by degree with the host\'s hits at each, and names the split for the degree bar', () => {
    expect(lightboxDegreeRows(field({}))).toEqual([
      { degree: 1, label: '1° latent', terms: 'presence ×11', hits: 11 },
      { degree: 2, label: '2° felt', terms: 'vigil ×2', hits: 2 },
      { degree: 3, label: '3° overt', terms: 'church ×1', hits: 1 }
    ]);
    expect(lightboxDegreeRows(field({ support: [{ term: 'kept', count: 1, paragraphs: [2], degree: 1 }], degreeHits: [1, 0, 0] })))
      .toEqual([{ degree: 1, label: '1° latent', terms: 'kept ×1', hits: 1 }]);
    expect(lightboxDegreeAria(field({}))).toBe('By degree: 11 latent, 2 felt, 1 overt');
  });
});
