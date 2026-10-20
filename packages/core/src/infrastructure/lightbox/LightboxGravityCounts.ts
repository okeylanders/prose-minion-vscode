/**
 * What the host counts for a borrowed or literal field (ADR 2026-10-19 D7;
 * Slice 3). Pure: no host, no I/O.
 *
 * A reading names a field's terms; the host counts everything else:
 * - each term's own occurrences and paragraphs (shown term by term);
 * - the field's hits: every occurrence of its terms, each counted once. When
 *   one named term stands inside another ("telescope" inside "like a
 *   telescope"), the occurrence counts once, under the longer term and its
 *   degree, so a field cannot raise its hits by naming a phrase and its parts;
 * - its hits by degree (1° latent, 2° felt, 3° overt), from those same
 *   occurrences;
 * - whether it clears the gravity line (`LIGHTBOX_GRAVITY_LINE_HITS`);
 * - its drift: the first and last paragraphs it reaches, and the stretch
 *   where it is densest.
 * The model's claimed pull never changes any of these.
 */

import type { LightboxGravityDegree, LightboxGravityDrift, LightboxGravityTerm } from '@messages';
import { LIGHTBOX_GRAVITY_LINE_HITS } from '@shared/constants/lightbox';
import { lightboxTermTokens, type LightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';

export interface LightboxNamedTerm {
  term: string;
  degree: LightboxGravityDegree;
}

export interface LightboxFieldCount {
  /** One per distinct term, in the order named; a lone stopword is dropped. */
  support: LightboxGravityTerm[];
  hits: number;
  degreeHits: [number, number, number];
  belowLine: boolean;
  drift: LightboxGravityDrift | null;
}

/**
 * The densest stretch is the run of this many paragraphs (a tenth of the
 * chapter, at least one) holding the most hits.
 */
export function lightboxDriftWindow(paragraphCount: number): number {
  return Math.max(1, Math.ceil(paragraphCount / 10));
}

export function countLightboxField(
  named: readonly LightboxNamedTerm[],
  counter: LightboxTermCounter,
  paragraphCount: number
): LightboxFieldCount {
  const terms: Array<LightboxNamedTerm & { key: string; length: number }> = [];
  const seen = new Set<string>();
  for (const entry of named) {
    if (counter.isStopword(entry.term)) {
      continue;
    }
    const parts = lightboxTermTokens(entry.term);
    const key = parts.join(' ');
    if (parts.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    terms.push({ ...entry, key, length: parts.length });
  }

  // Each occurrence once, under the longest named term that holds it.
  const covered = new Map<number, Set<number>>();
  const perParagraph = new Array<number>(paragraphCount).fill(0);
  const degreeHits: [number, number, number] = [0, 0, 0];
  const longestFirst = terms
    .map((term, order) => ({ term, order }))
    .sort((a, b) => b.term.length - a.term.length || a.order - b.order);
  for (const { term } of longestFirst) {
    for (const occurrence of counter.occurrences(term.key)) {
      const taken = covered.get(occurrence.paragraph) ?? new Set<number>();
      const tokens = Array.from({ length: occurrence.length }, (_, offset) => occurrence.start + offset);
      if (tokens.some((token) => taken.has(token))) {
        continue;
      }
      tokens.forEach((token) => taken.add(token));
      covered.set(occurrence.paragraph, taken);
      perParagraph[occurrence.paragraph - 1] += 1;
      degreeHits[term.degree - 1] += 1;
    }
  }
  const hits = degreeHits[0] + degreeHits[1] + degreeHits[2];
  return {
    support: terms.map((term) => ({ ...counter.count(term.key), degree: term.degree })),
    hits,
    degreeHits,
    belowLine: hits < LIGHTBOX_GRAVITY_LINE_HITS,
    drift: lightboxGravityDrift(perParagraph)
  };
}

/** A field's reach across the chapter from its hits per paragraph (index 0 is ¶1). */
export function lightboxGravityDrift(perParagraph: readonly number[]): LightboxGravityDrift | null {
  const lit = perParagraph.flatMap((hits, index) => (hits > 0 ? [index] : []));
  if (lit.length === 0) {
    return null;
  }
  const window = lightboxDriftWindow(perParagraph.length);
  let best = { start: lit[0], hits: -1 };
  for (let start = 0; start + window <= perParagraph.length; start++) {
    const sum = perParagraph.slice(start, start + window).reduce((total, hits) => total + hits, 0);
    if (sum > best.hits) {
      best = { start, hits: sum };
    }
  }
  // Trim the stretch to the paragraphs inside it that the field reaches.
  const inside = lit.filter((index) => index >= best.start && index < best.start + window);
  return {
    first: lit[0] + 1,
    last: lit[lit.length - 1] + 1,
    densest: { from: inside[0] + 1, to: inside[inside.length - 1] + 1, hits: best.hits }
  };
}
