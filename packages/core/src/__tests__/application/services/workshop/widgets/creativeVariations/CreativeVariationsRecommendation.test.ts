import {
  CREATIVE_VARIATIONS_RECOMMENDATION_INSTRUCTION,
  inspectCreativeVariationsRecommendation
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsRecommendation';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

interface RecommendationFields {
  subjectText: string;
  contextText: string;
  sourceReferences: string;
  mustSurvive: string;
  mustNotChange: string;
  aim: string;
  distance: string;
  requestedCount: string;
}

function recommendationSection(
  overrides: Partial<RecommendationFields> = {}
): string[] {
  const fields: RecommendationFields = {
    subjectText: 'She turned the mug until its chipped handle faced the wall.',
    contextText: 'Nate waited across the table. She did not look up.',
    sourceReferences: 'active-excerpt\ncontext-attachment:ctx-2',
    mustSurvive: 'She refuses the invitation without saying no.',
    mustNotChange: 'Keep close third person and the chipped mug.',
    aim: 'Make the refusal physical without using a facial expression.',
    distance: 'tail',
    requestedCount: '4',
    ...overrides
  };
  return [
    '<workshop-widget-recommendation version="1">',
    '<widget-id>', 'creative-variations', '</widget-id>',
    '<subject-passage>', fields.subjectText, '</subject-passage>',
    '<surrounding-context>', fields.contextText, '</surrounding-context>',
    '<source-references>', fields.sourceReferences, '</source-references>',
    '<must-survive>', fields.mustSurvive, '</must-survive>',
    '<must-not-change>', fields.mustNotChange, '</must-not-change>',
    '<creative-aim>', fields.aim, '</creative-aim>',
    '<sampling-distance>', fields.distance, '</sampling-distance>',
    '<take-count>', fields.requestedCount, '</take-count>',
    '</workshop-widget-recommendation>'
  ].join('\n').split('\n');
}

describe('CreativeVariationsRecommendation', () => {
  it('owns an input-only prompt frame and keeps writer authority explicit', () => {
    const sourceReferencesCharacters = PROMPT_BUDGETS.workshopWidgets.creativeSourceReferences
      * PROMPT_BUDGETS.workshopWidgets.creativeSourceReferenceCharacters;
    expect(CREATIVE_VARIATIONS_RECOMMENDATION_INSTRUCTION).toContain(
      'Prepare inputs only: never generate the workup, choose a take, accept a risk, or commit'
    );
    expect(CREATIVE_VARIATIONS_RECOMMENDATION_INSTRUCTION).toContain(
      'Everything remains editable and nothing runs until the writer presses Generate.'
    );
    expect(CREATIVE_VARIATIONS_RECOMMENDATION_INSTRUCTION).toContain(
      `at most ${PROMPT_BUDGETS.workshopWidgets.creativeSubjectCharacters.toLocaleString('en-US')} characters`
    );
    expect(CREATIVE_VARIATIONS_RECOMMENDATION_INSTRUCTION).toContain(
      `${PROMPT_BUDGETS.workshopWidgets.creativeSourceReferences} references and `
      + `${sourceReferencesCharacters.toLocaleString('en-US')} characters`
    );
  });

  it('accepts the complete typed prefill without generated or selected state', () => {
    const inspected = inspectCreativeVariationsRecommendation(recommendationSection());
    expect(inspected).toEqual({
      outcome: 'accepted',
      recommendation: {
        widgetId: 'creative-variations',
        seed: {
          subjectText: 'She turned the mug until its chipped handle faced the wall.',
          contextText: 'Nate waited across the table. She did not look up.',
          sourceReferences: [
            { kind: 'active-excerpt' },
            { kind: 'context-attachment', attachmentId: 'ctx-2' }
          ],
          mustSurvive: 'She refuses the invitation without saying no.',
          mustNotChange: 'Keep close third person and the chipped mug.',
          aim: 'Make the refusal physical without using a facial expression.',
          distance: 'tail',
          requestedCount: 4
        }
      }
    });
    const seed = inspected.outcome === 'accepted' ? inspected.recommendation.seed : undefined;
    expect(seed).not.toHaveProperty('workup');
    expect(seed).not.toHaveProperty('selections');
    expect(seed).not.toHaveProperty('note');
    expect(seed).not.toHaveProperty('provenance');
  });

  it('preserves blank optional constraints and aim instead of inventing defaults', () => {
    const inspected = inspectCreativeVariationsRecommendation(recommendationSection({
      contextText: '',
      sourceReferences: 'none',
      mustSurvive: '',
      mustNotChange: '',
      aim: ''
    }));
    expect(inspected).toMatchObject({
      outcome: 'accepted',
      recommendation: {
        seed: {
          contextText: '',
          sourceReferences: [],
          mustSurvive: '',
          mustNotChange: '',
          aim: ''
        }
      }
    });
  });

  it.each([
    ['subjectText', { subjectText: '   ' }, 'empty'],
    ['distance', { distance: 'extreme' }, 'invalid_distance'],
    ['requestedCount', { requestedCount: '6' }, 'invalid_requested_count'],
    [
      'sourceReferences',
      { sourceReferences: 'active-excerpt\nactive-excerpt' },
      'invalid_source_references'
    ]
  ] as const)('rejects invalid %s atomically', (field, overrides, reason) => {
    expect(inspectCreativeVariationsRecommendation(recommendationSection(overrides))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_field',
      field,
      reason
    });
  });

  it.each([
    ['subjectText', 'creativeSubjectCharacters'],
    ['contextText', 'creativeContextCharacters'],
    ['mustSurvive', 'creativeMustSurviveCharacters'],
    ['mustNotChange', 'creativeMustNotChangeCharacters'],
    ['aim', 'creativeAimCharacters']
  ] as const)('accepts %s at its exact bound and rejects one more', (field, budgetKey) => {
    const maximum = PROMPT_BUDGETS.workshopWidgets[budgetKey];
    expect(inspectCreativeVariationsRecommendation(recommendationSection({
      [field]: 'x'.repeat(maximum)
    })).outcome).toBe('accepted');
    expect(inspectCreativeVariationsRecommendation(recommendationSection({
      [field]: 'x'.repeat(maximum + 1)
    }))).toEqual({
      outcome: 'rejected',
      rejection: 'field_too_long',
      field,
      actualCharacters: maximum + 1,
      maximumCharacters: maximum
    });
  });

  it('bounds the complete source-reference field in the same unit the prompt declares', () => {
    const maximum = PROMPT_BUDGETS.workshopWidgets.creativeSourceReferences
      * PROMPT_BUDGETS.workshopWidgets.creativeSourceReferenceCharacters;
    const atBound = Array.from({ length: 8 }, (_, index) => {
      const targetLength = index === 7 ? 500 : 499;
      const prefix = `context-attachment:ctx-${index + 1}`;
      return prefix + '9'.repeat(targetLength - prefix.length);
    }).join('\n');

    expect(inspectCreativeVariationsRecommendation(recommendationSection({
      sourceReferences: atBound
    })).outcome).toBe('accepted');
    expect(inspectCreativeVariationsRecommendation(recommendationSection({
      sourceReferences: `${atBound}9`
    }))).toEqual({
      outcome: 'rejected',
      rejection: 'field_too_long',
      field: 'sourceReferences',
      actualCharacters: maximum + 1,
      maximumCharacters: maximum
    });
  });

  it('rejects missing, duplicated, or reordered control markers', () => {
    const valid = recommendationSection().join('\n');
    expect(inspectCreativeVariationsRecommendation(
      valid.replace('<creative-aim>\n', '').split('\n')
    )).toEqual({ outcome: 'rejected', rejection: 'invalid_frame' });
    expect(inspectCreativeVariationsRecommendation(
      valid.replace('</take-count>', '</take-count>\n</take-count>').split('\n')
    )).toEqual({ outcome: 'rejected', rejection: 'invalid_frame' });
    expect(inspectCreativeVariationsRecommendation(
      valid.replace(
        '<sampling-distance>\ntail\n</sampling-distance>\n<take-count>\n4\n</take-count>',
        '<take-count>\n4\n</take-count>\n<sampling-distance>\ntail\n</sampling-distance>'
      ).split('\n')
    )).toEqual({ outcome: 'rejected', rejection: 'invalid_frame' });
  });
});
