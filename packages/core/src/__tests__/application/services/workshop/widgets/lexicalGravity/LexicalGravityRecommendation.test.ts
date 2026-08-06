import {
  inspectLexicalGravityRecommendation,
  LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityRecommendation';

type LexicalRecommendationField = 'lensSlug' | 'weight' | 'reach' | 'metaphorPull';

function recommendationSection(
  overrides: Partial<Record<LexicalRecommendationField, string>> = {}
): string[] {
  return [
    '<workshop-widget-recommendation version="1">',
    '<widget-id>', 'lexical-gravity', '</widget-id>',
    '<lens-slug>', overrides.lensSlug ?? 'photography', '</lens-slug>',
    '<weight>', overrides.weight ?? '60', '</weight>',
    '<reach>', overrides.reach ?? '2', '</reach>',
    '<metaphor-pull>', overrides.metaphorPull ?? 'false', '</metaphor-pull>',
    '</workshop-widget-recommendation>'
  ].join('\n').split('\n');
}

describe('LexicalGravityRecommendation', () => {
  it('owns the closed prompt grammar while leaving installation to the writer', () => {
    expect(LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION).toContain(
      'For Lexical Gravity, propose but never install.'
    );
    expect(LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION).toContain(
      'weight must be 10–100 in steps of 5'
    );
    expect(LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION).toContain('reach is 1, 2, 3');
    expect(LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION).toContain(
      'metaphor-pull is true or false'
    );
  });

  it('accepts a built-in lens and valid controls', () => {
    expect(inspectLexicalGravityRecommendation(recommendationSection({
      lensSlug: 'music',
      weight: '40',
      reach: '3',
      metaphorPull: 'true'
    }))).toEqual({
      outcome: 'accepted',
      recommendation: {
        widgetId: 'lexical-gravity',
        seed: { lensSlug: 'music', weight: 40, reach: 3, metaphorPull: true }
      }
    });
  });

  it('rejects a persona-supplied lens outside the host-owned starter set', () => {
    expect(inspectLexicalGravityRecommendation(
      recommendationSection({ lensSlug: 'falconry' })
    )).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'lensSlug',
      reason: 'unsupported_lens'
    });
  });

  it.each([
    ['lensSlug', 'lensSlug'],
    ['weight', 'weight'],
    ['reach', 'reach'],
    ['metaphorPull', 'metaphorPull']
  ] as const)('reports an empty %s separately from invalid values', (inputField, resultField) => {
    expect(inspectLexicalGravityRecommendation(
      recommendationSection({ [inputField]: '   ' })
    )).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: resultField,
      reason: 'empty'
    });
  });

  it.each([
    ['weight', '63', 'weight', 'invalid_weight'],
    ['reach', '4', 'reach', 'invalid_reach'],
    ['metaphorPull', 'yes', 'metaphorPull', 'invalid_metaphor_pull']
  ] as const)(
    'rejects invalid %s with its exact field and reason',
    (inputField, value, resultField, reason) => {
      expect(inspectLexicalGravityRecommendation(
        recommendationSection({ [inputField]: value })
      )).toEqual({
        outcome: 'rejected',
        rejection: 'invalid_field',
        field: resultField,
        reason
      });
    }
  );
});
