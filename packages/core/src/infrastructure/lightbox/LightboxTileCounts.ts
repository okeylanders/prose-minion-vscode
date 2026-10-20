/**
 * The counted parts of reading tiles (ADR 2026-10-19 D7). Pure: no host, no
 * I/O.
 *
 * A reading names terms; the host counts them. This module is the one place
 * that turns named terms into counted support and sets host-measured figures
 * beside a reading, so a first reading (`LightboxReadingTiles`) and a reading
 * carried onto a changed text (`LightboxStaleReadings`) count the same way.
 */

import type { LightboxCountedSupport, LightboxReadingTile, LightboxTensionArcTile } from '@messages';
import { lightboxContentHash } from '@/infrastructure/lightbox/LightboxParagraphs';
import type { LightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { LIGHTBOX_VOICE_TRAITS } from '@/infrastructure/lightbox/LightboxReadingWire';
import { countLightboxField } from '@/infrastructure/lightbox/LightboxGravityCounts';

/** The voice trait the host sets its measured sentence length beside. */
const MUSIC_LABEL = LIGHTBOX_VOICE_TRAITS.find(([key]) => key === 'music')?.[1] ?? 'Sentence music';

/** What a recount needs to know about the current text beyond its terms. */
export interface LightboxRecountContext {
  paragraphCount: number;
  /** Set beside the voice's sentence music. */
  averageWordsPerSentence: number;
  /** The current ribbon columns' keys (`lightboxColumnKeys`); a tension arc's scores follow them. */
  columnKeys?: readonly string[];
}

/** How long a column key is: enough to tell paragraphs apart, short enough to post. */
const COLUMN_KEY_LENGTH = 16;

/**
 * Each ribbon column's identity: a hash of the text of the paragraphs it
 * holds. A tension score is read on a column's paragraphs, so this is what a
 * carried score is matched by, never its position (PR #150 F-06).
 */
export function lightboxColumnKeys(
  paragraphs: readonly string[],
  columns: ReadonlyArray<{ from: number; to: number }>
): string[] {
  return columns.map(({ from, to }) =>
    lightboxContentHash(paragraphs.slice(from - 1, to).join('\n\n')).slice(0, COLUMN_KEY_LENGTH));
}

/**
 * A tension arc's scores on the current columns: each score follows the
 * column whose paragraphs it was read on, wherever that column now stands;
 * a column whose paragraphs are new or changed (or whose old scores
 * disagree) has none. Without current keys, the arc is unchanged.
 */
export function carryLightboxTension(
  arc: Pick<LightboxTensionArcTile, 'scores' | 'columnKeys'>,
  columnKeys: readonly string[] | undefined
): Pick<LightboxTensionArcTile, 'scores' | 'columnKeys'> {
  if (!columnKeys) {
    return { scores: [...arc.scores], columnKeys: [...arc.columnKeys] };
  }
  const byKey = new Map<string, number | null>();
  arc.columnKeys.forEach((key, index) => {
    const score = arc.scores[index] ?? null;
    byKey.set(key, byKey.has(key) && byKey.get(key) !== score ? null : score);
  });
  return { scores: columnKeys.map((key) => byKey.get(key) ?? null), columnKeys: [...columnKeys] };
}

/**
 * Count each named term once, in the order named. A lone stopword ("she")
 * counts nothing worth showing and is skipped, as is a term that normalizes
 * to nothing or repeats one already counted.
 */
export function countLightboxSupport(terms: readonly string[], counter: LightboxTermCounter): LightboxCountedSupport[] {
  const support: LightboxCountedSupport[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    if (counter.isStopword(term)) {
      continue;
    }
    const counted = counter.count(term);
    if (counted.term.length === 0 || seen.has(counted.term)) {
      continue;
    }
    seen.add(counted.term);
    support.push(counted);
  }
  return support;
}

/** The voice's measured sentence figure, or none when the text has no sentence to measure. */
export function lightboxMeasuredMusic(averageWordsPerSentence: number | undefined): { measured: string } | Record<string, never> {
  return averageWordsPerSentence !== undefined && averageWordsPerSentence > 0
    ? { measured: `${averageWordsPerSentence} avg` }
    : {};
}

/**
 * The tile with every counted part recomputed against the current text: its
 * support recounted term by term, a field's hits, degrees, line and drift
 * counted again, and any host figure set beside the reading measured again.
 * The reading's own words (and a field's claimed pull) are untouched.
 */
export function recountLightboxTile(
  tile: LightboxReadingTile,
  counter: LightboxTermCounter,
  context: LightboxRecountContext
): LightboxReadingTile {
  const support = tile.support.map((term) => counter.count(term.term));
  switch (tile.kind) {
    case 'voice':
      return {
        ...tile,
        support,
        traits: tile.traits.map(({ measured: _measured, ...trait }) =>
          (trait.label === MUSIC_LABEL ? { ...trait, ...lightboxMeasuredMusic(context.averageWordsPerSentence) } : trait))
      };
    case 'gravity-field': {
      const field = countLightboxField(tile.support, counter, context.paragraphCount);
      return {
        ...tile,
        support: field.support,
        hits: field.hits,
        degreeHits: field.degreeHits,
        belowLine: field.belowLine,
        drift: field.drift
      };
    }
    case 'gravity-literal': {
      const field = countLightboxField(
        tile.support.map((term) => ({ term: term.term, degree: 1 })),
        counter,
        context.paragraphCount
      );
      return { ...tile, support: field.support.map(({ degree: _degree, ...term }) => term), hits: field.hits };
    }
    case 'tension-arc':
      return { ...tile, support, ...carryLightboxTension(tile, context.columnKeys) };
    case 'headline':
    case 'motif':
    case 'palette-cluster':
    case 'swatch':
    case 'gravity-collision':
    case 'character':
    case 'genre-neighbor':
    case 'reader-promise':
    case 'subtext':
    case 'lineage':
    case 'spark':
      return { ...tile, support };
  }
}
