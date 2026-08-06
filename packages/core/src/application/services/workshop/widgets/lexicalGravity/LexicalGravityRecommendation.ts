/** Lexical Gravity prompt copy and strict recommendation-field parser. */

import {
  isLexicalGravityReach,
  isLexicalGravityWeight,
  LEXICAL_GRAVITY_REACH,
  LEXICAL_GRAVITY_WEIGHT
} from './LexicalGravityConfigCodec';
import {
  inspectExactWorkshopWidgetRecommendationFrame,
  WorkshopWidgetRecommendationEntry,
  WorkshopWidgetRecommendationInspection,
  workshopWidgetRecommendationField,
  WIDGET_RECOMMENDATION_FRAME_END,
  WIDGET_RECOMMENDATION_FRAME_START,
  WIDGET_RECOMMENDATION_ID_END,
  WIDGET_RECOMMENDATION_ID_START
} from '@/utils/workshopWidgetRecommendationProtocol';

const LENS_SLUG_START = '<lens-slug>';
const LENS_SLUG_END = '</lens-slug>';
const WEIGHT_START = '<weight>';
const WEIGHT_END = '</weight>';
const REACH_START = '<reach>';
const REACH_END = '</reach>';
const METAPHOR_PULL_START = '<metaphor-pull>';
const METAPHOR_PULL_END = '</metaphor-pull>';

const LEXICAL_GRAVITY_MARKERS = [
  WIDGET_RECOMMENDATION_FRAME_START,
  WIDGET_RECOMMENDATION_ID_START,
  WIDGET_RECOMMENDATION_ID_END,
  LENS_SLUG_START,
  LENS_SLUG_END,
  WEIGHT_START,
  WEIGHT_END,
  REACH_START,
  REACH_END,
  METAPHOR_PULL_START,
  METAPHOR_PULL_END,
  WIDGET_RECOMMENDATION_FRAME_END
] as const;

const BUILT_IN_LENS_SLUGS = new Set([
  'photography',
  'music',
  'mathematics',
  'weather',
  'botany',
  'architecture'
]);

export const LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION = [
  `For Lexical Gravity, propose but never install. Choose one starter lens slug from photography, music, mathematics, weather, botany, architecture; weight must be ${LEXICAL_GRAVITY_WEIGHT.minimum}–${LEXICAL_GRAVITY_WEIGHT.maximum} in steps of ${LEXICAL_GRAVITY_WEIGHT.step}; reach is ${LEXICAL_GRAVITY_REACH.values.join(', ')}; metaphor-pull is true or false. The writer can change every value before explicitly installing it.`,
  'Lexical Gravity frame:',
  '### Try a widget',
  WIDGET_RECOMMENDATION_FRAME_START,
  WIDGET_RECOMMENDATION_ID_START,
  'lexical-gravity',
  WIDGET_RECOMMENDATION_ID_END,
  LENS_SLUG_START,
  'photography',
  LENS_SLUG_END,
  WEIGHT_START,
  '60',
  WEIGHT_END,
  REACH_START,
  '2',
  REACH_END,
  METAPHOR_PULL_START,
  'false',
  METAPHOR_PULL_END,
  WIDGET_RECOMMENDATION_FRAME_END
].join('\n');

export function inspectLexicalGravityRecommendation(
  sectionLines: readonly string[]
): WorkshopWidgetRecommendationInspection {
  const inspected = inspectExactWorkshopWidgetRecommendationFrame(
    sectionLines,
    LEXICAL_GRAVITY_MARKERS
  );
  if (!(inspected instanceof Map)) {
    return inspected;
  }

  const field = (start: string, end: string): string =>
    workshopWidgetRecommendationField(sectionLines, inspected, start, end);
  const lensSlug = field(LENS_SLUG_START, LENS_SLUG_END);
  const weight = Number(field(WEIGHT_START, WEIGHT_END));
  const reach = Number(field(REACH_START, REACH_END));
  const metaphorText = field(METAPHOR_PULL_START, METAPHOR_PULL_END);

  // Personas may seed host-owned starters only, never name an arbitrary
  // project lens whose body would enter a system prompt.
  if (!BUILT_IN_LENS_SLUGS.has(lensSlug)) {
    return {
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'lensSlug',
      reason: 'unsupported_lens'
    };
  }
  if (!isLexicalGravityWeight(weight)) {
    return {
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'weight',
      reason: 'invalid_weight'
    };
  }
  if (!isLexicalGravityReach(reach)) {
    return {
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'reach',
      reason: 'invalid_reach'
    };
  }
  if (metaphorText !== 'true' && metaphorText !== 'false') {
    return {
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'metaphorPull',
      reason: 'invalid_metaphor_pull'
    };
  }

  return {
    outcome: 'accepted',
    recommendation: {
      widgetId: 'lexical-gravity',
      seed: {
        lensSlug,
        weight,
        reach,
        metaphorPull: metaphorText === 'true'
      }
    }
  };
}

export const LEXICAL_GRAVITY_WIDGET_RECOMMENDATION_ENTRY:
  WorkshopWidgetRecommendationEntry = Object.freeze({
    widgetId: 'lexical-gravity',
    catalogSummary:
      'Lexical Gravity installs a writer-approved lexical field that influences story prose only when prose is composed or revised',
    instruction: LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION,
    inspect: inspectLexicalGravityRecommendation
  });
