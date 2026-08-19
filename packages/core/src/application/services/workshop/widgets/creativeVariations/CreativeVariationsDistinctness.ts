/** Deterministic overlap evidence for settled Creative Variations workups. */

import {
  CREATIVE_VARIATIONS_OVERLAP_ALGORITHM_VERSION,
  type WorkshopCreativeVariationCard,
  type WorkshopCreativeVariationsWorkup
} from '@messages';

/** Presentation calibration: scores at or above 80 warrant the high-overlap warning. */
export const CREATIVE_VARIATIONS_HIGH_OVERLAP_SCORE = 80;
const SUBJECT_OVERLAP_FLOOR_RATIO = 0.95;

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const APOSTROPHE_VARIANTS = /[\u2018\u2019\u02bc]/g;
const DASH_VARIANTS = /\p{Dash_Punctuation}/gu;

export class CreativeVariationsExactDuplicateError extends Error {
  constructor(readonly leftPosition: number, readonly rightPosition: number) {
    super(`Creative Variations cards ${leftPosition} and ${rightPosition} have identical normalized prose`);
    this.name = 'CreativeVariationsExactDuplicateError';
  }
}

export function tokenizeCreativeVariationText(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(APOSTROPHE_VARIANTS, "'")
    .replace(DASH_VARIANTS, '-')
    .match(TOKEN_PATTERN) ?? [];
}

export function computeCreativeVariationsTextualOverlap(
  subjectText: string,
  cards: readonly WorkshopCreativeVariationCard[]
): WorkshopCreativeVariationsWorkup['overlap'] {
  const subjectProseGrams = gramSet(tokenizeCreativeVariationText(subjectText), 3);
  const normalized = cards.map((card) => ({
    position: card.position,
    proseTokens: requireTokens(card.prose, `card ${card.position} prose`),
    directionTokens: requireTokens(card.direction, `card ${card.position} direction`)
  })).map((card) => {
    const proseGrams = gramSet(card.proseTokens, 3);
    return {
      ...card,
      proseGrams,
      proseResidualGrams: difference(proseGrams, subjectProseGrams),
      directionGrams: gramSet(card.directionTokens, 2)
    };
  });

  for (let left = 0; left < normalized.length; left += 1) {
    for (let right = left + 1; right < normalized.length; right += 1) {
      if (sameTokens(normalized[left].proseTokens, normalized[right].proseTokens)) {
        throw new CreativeVariationsExactDuplicateError(
          normalized[left].position,
          normalized[right].position
        );
      }
    }
  }

  const pairs = [] as WorkshopCreativeVariationsWorkup['overlap']['pairs'];
  for (let left = 0; left < normalized.length; left += 1) {
    for (let right = left + 1; right < normalized.length; right += 1) {
      const leftCard = normalized[left];
      const rightCard = normalized[right];
      const fullProse = jaccardPercent(leftCard.proseGrams, rightCard.proseGrams);
      const residualProse = jaccardPercent(
        leftCard.proseResidualGrams,
        rightCard.proseResidualGrams
      );
      // Subject removal can discount expected shared language, but it cannot
      // erase overwhelming whole-card reuse. The floor removes the residual-
      // size cliff: one or two disjoint trailing grams no longer turn a pair
      // from near-identical to 0%, while genuinely expanded takes still earn
      // their score primarily from residual overlap.
      const prose = Math.max(
        residualProse,
        Math.round(fullProse * SUBJECT_OVERLAP_FLOOR_RATIO)
      );
      const direction = jaccardPercent(
        leftCard.directionGrams,
        rightCard.directionGrams
      );
      pairs.push({
        leftPosition: leftCard.position,
        rightPosition: rightCard.position,
        prose,
        direction,
        maximum: Math.max(prose, direction)
      });
    }
  }

  if (pairs.length === 0) {
    throw new Error('Creative Variations overlap requires at least two cards');
  }
  const maximum = pairs.reduce((current, pair) =>
    pair.maximum > current.maximum ? pair : current
  );
  return {
    algorithmVersion: CREATIVE_VARIATIONS_OVERLAP_ALGORITHM_VERSION,
    pairs,
    maximumPair: {
      leftPosition: maximum.leftPosition,
      rightPosition: maximum.rightPosition,
      score: maximum.maximum
    }
  };
}

function requireTokens(text: string, label: string): string[] {
  const tokens = tokenizeCreativeVariationText(text);
  if (tokens.length === 0) {
    throw new Error(`${label} must contain at least one letter or number`);
  }
  return tokens;
}

function gramSet(tokens: readonly string[], size: number): Set<string> {
  if (tokens.length < size) {
    return new Set(tokens);
  }
  const grams = new Set<string>();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    grams.add(tokens.slice(index, index + size).join(' '));
  }
  return grams;
}

function difference(values: ReadonlySet<string>, removed: ReadonlySet<string>): Set<string> {
  return new Set([...values].filter((value) => !removed.has(value)));
}

function jaccardPercent(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  const intersection = [...left].filter((value) => right.has(value)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : Math.round(100 * intersection / union);
}

function sameTokens(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((token, index) => token === right[index]);
}
