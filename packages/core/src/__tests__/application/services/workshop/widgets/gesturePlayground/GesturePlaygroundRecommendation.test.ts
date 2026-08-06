import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION,
  inspectGesturePlaygroundRecommendation
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundRecommendation';

interface RecommendationFrameFields {
  targetPhrase?: string;
  writerInstructions?: string;
  surroundingContext?: string;
  sourceReferences?: string;
  characterNotes?: string;
}

function recommendationSection(fields: RecommendationFrameFields = {}): string[] {
  return [
    '<workshop-widget-recommendation version="1">',
    '<widget-id>',
    'gesture-playground',
    '</widget-id>',
    '<target-phrase>',
    fields.targetPhrase ?? 'His eyes stretched wide.',
    '</target-phrase>',
    '<writer-instructions>',
    fields.writerInstructions
      ?? 'Preserve the shock breaking through his practiced control. Explore quieter reactions as well as direct facial alternatives.',
    '</writer-instructions>',
    '<surrounding-context>',
    fields.surroundingContext
      ?? 'Micah looked past Jasper and into the dark hall.\nHis eyes stretched wide.\nNate followed his gaze but saw nothing.',
    '</surrounding-context>',
    '<source-references>',
    fields.sourceReferences ?? 'none',
    '</source-references>',
    '<character-notes>',
    fields.characterNotes
      ?? 'Micah has been containing his fear for Nate. In this beat, recognition overwhelms that defense before he can disguise it.',
    '</character-notes>',
    '</workshop-widget-recommendation>'
  ].join('\n').split('\n');
}

describe('GesturePlaygroundRecommendation', () => {
  it('owns the quality-first prompt and every rich prefill field', () => {
    expect(GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION).toContain(
      'This is a quality-first handoff, not a token-saving exercise.'
    );
    expect(GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION).toContain(
      'Do not be thrifty, terse, or generically minimal'
    );
    expect(GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION).toContain(
      'copy a generous, consecutive stretch of the supplied prose'
    );
    expect(GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION).toContain(
      'The four prose fields and the source-references field are required'
    );
    expect(GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION).toContain(
      `${PROMPT_BUDGETS.workshopWidgets.gestureTargetPhraseCharacters.toLocaleString('en-US')} characters`
    );
    expect(GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION).toContain(
      `${PROMPT_BUDGETS.workshopWidgets.gestureWriterInstructionsCharacters.toLocaleString('en-US')} characters`
    );
    expect(GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION).toContain(
      `${PROMPT_BUDGETS.workshopWidgets.gestureContextCharacters.toLocaleString('en-US')} characters`
    );
    expect(GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION).toContain(
      `${PROMPT_BUDGETS.workshopWidgets.gestureCharacterNotesCharacters.toLocaleString('en-US')} characters`
    );
    expect(GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION).toContain(
      `${PROMPT_BUDGETS.workshopWidgets.gestureSourceReferences} references and `
      + `${PROMPT_BUDGETS.workshopWidgets.gestureSourceReferenceCharacters.toLocaleString('en-US')} characters`
    );
    for (const tag of [
      'target-phrase',
      'writer-instructions',
      'surrounding-context',
      'source-references',
      'character-notes'
    ]) {
      expect(GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION).toContain(`<${tag}>`);
      expect(GESTURE_PLAYGROUND_RECOMMENDATION_INSTRUCTION).toContain(`</${tag}>`);
    }
  });

  it('accepts the complete multiline frame and preserves rich field content', () => {
    const result = inspectGesturePlaygroundRecommendation(recommendationSection({
      targetPhrase: 'His eyes stretched wide.',
      writerInstructions: [
        'Keep this as recognition rather than generic surprise.',
        'Explore stillness, interrupted breath, and one option that lets Nate misread the reaction.'
      ].join('\n'),
      surroundingContext: [
        '### The hall',
        'Micah was up, locked on Jasper, shoulders set back and taut.',
        'Nate said, “Stay here | with me.”',
        'Nate glanced at Jasper, then back to Micah.',
        'But Micah’s gaze had gone past Jasper. Past the room. His eyes stretched wide.'
      ].join('\n'),
      characterNotes: [
        'Micah has been maintaining control for Nate’s sake.',
        'The sight beyond Jasper breaks that defense; Nate knows his fear but may mistake this recognition for terror.'
      ].join('\n')
    }));

    expect(result).toEqual({
      outcome: 'accepted',
      recommendation: {
        widgetId: 'gesture-playground',
        seed: {
          targetPhrase: 'His eyes stretched wide.',
          writerInstructions: [
            'Keep this as recognition rather than generic surprise.',
            'Explore stillness, interrupted breath, and one option that lets Nate misread the reaction.'
          ].join('\n'),
          contextText: [
            '### The hall',
            'Micah was up, locked on Jasper, shoulders set back and taut.',
            'Nate said, “Stay here | with me.”',
            'Nate glanced at Jasper, then back to Micah.',
            'But Micah’s gaze had gone past Jasper. Past the room. His eyes stretched wide.'
          ].join('\n'),
          characterNotes: [
            'Micah has been maintaining control for Nate’s sake.',
            'The sight beyond Jasper breaks that defense; Nate knows his fear but may mistake this recognition for terror.'
          ].join('\n'),
          sourceReferences: []
        }
      }
    });
  });

  it('accepts only host-addressable source references and preserves their order', () => {
    expect(inspectGesturePlaygroundRecommendation(recommendationSection({
      sourceReferences: [
        'active-excerpt',
        'context-attachment:ctx-2',
        'context-attachment:ctx-18'
      ].join('\n')
    }))).toEqual(expect.objectContaining({
      outcome: 'accepted',
      recommendation: expect.objectContaining({
        seed: expect.objectContaining({
          sourceReferences: [
            { kind: 'active-excerpt' },
            { kind: 'context-attachment', attachmentId: 'ctx-2' },
            { kind: 'context-attachment', attachmentId: 'ctx-18' }
          ]
        })
      })
    }));
  });

  it('rejects a recommendation that omits or empties any required rich field', () => {
    expect(
      inspectGesturePlaygroundRecommendation(
        recommendationSection({ writerInstructions: '   ' })
      )
    ).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'writerInstructions',
      reason: 'empty'
    });

    const missingContextFrame = recommendationSection().join('\n').replace(
      '<surrounding-context>\nMicah looked past Jasper and into the dark hall.\nHis eyes stretched wide.\nNate followed his gaze but saw nothing.\n</surrounding-context>\n',
      ''
    );
    expect(inspectGesturePlaygroundRecommendation(missingContextFrame.split('\n'))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_frame'
    });

    const missingSourcesFrame = recommendationSection().join('\n').replace(
      '<source-references>\nnone\n</source-references>\n',
      ''
    );
    expect(inspectGesturePlaygroundRecommendation(missingSourcesFrame.split('\n'))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_frame'
    });
  });

  it.each([
    ['blank', '   '],
    ['mixed none', 'none\nactive-excerpt'],
    ['duplicate', 'context-attachment:ctx-2\ncontext-attachment:ctx-2'],
    ['path-shaped value', '/workspace/chapter.md'],
    ['invented id shape', 'context-attachment:ctx-0'],
    [
      'too many references',
      Array.from({ length: PROMPT_BUDGETS.workshopWidgets.gestureSourceReferences + 1 },
        (_, index) => `context-attachment:ctx-${index + 1}`).join('\n')
    ]
  ])('rejects invalid source references: %s', (label, sourceReferences) => {
    expect(
      inspectGesturePlaygroundRecommendation(recommendationSection({ sourceReferences }))
    ).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'sourceReferences',
      reason: label === 'blank' ? 'empty' : 'invalid_source_references'
    });
  });

  it('identifies source-reference text that exceeds its interpolated limit', () => {
    const maximum = PROMPT_BUDGETS.workshopWidgets.gestureSourceReferenceCharacters;
    const sourceReferences = `context-attachment:ctx-${'9'.repeat(maximum)}`;
    expect(
      inspectGesturePlaygroundRecommendation(recommendationSection({ sourceReferences }))
    ).toEqual({
      outcome: 'rejected',
      rejection: 'field_too_long',
      field: 'sourceReferences',
      actualCharacters: sourceReferences.length,
      maximumCharacters: maximum
    });
  });

  it('rejects context that does not contain the exact target evidence', () => {
    expect(inspectGesturePlaygroundRecommendation(recommendationSection({
      targetPhrase: 'His eyes stretched wide.',
      surroundingContext: 'Micah looked past Jasper. Nate followed his gaze.'
    }))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_field',
      field: 'contextText',
      reason: 'target_missing_from_context'
    });
  });

  it('rejects duplicated, reordered, or unrecognized frame material', () => {
    expect(
      inspectGesturePlaygroundRecommendation(
        recommendationSection().join('\n').replace(
          '</target-phrase>',
          '</target-phrase>\n</target-phrase>'
        ).split('\n')
      )
    ).toEqual({ outcome: 'rejected', rejection: 'invalid_frame' });

    expect(
      inspectGesturePlaygroundRecommendation(
        recommendationSection().join('\n').replace(
          '<writer-instructions>',
          '<unknown-field>\nnope\n</unknown-field>\n<writer-instructions>'
        ).split('\n')
      )
    ).toEqual({ outcome: 'rejected', rejection: 'invalid_frame' });

    const ordered = recommendationSection({
      writerInstructions: 'WRITER DIRECTIONS',
      surroundingContext: 'SOURCE CONTEXT'
    }).join('\n');
    const writerBlock = [
      '<writer-instructions>',
      'WRITER DIRECTIONS',
      '</writer-instructions>'
    ].join('\n');
    const contextBlock = [
      '<surrounding-context>',
      'SOURCE CONTEXT',
      '</surrounding-context>'
    ].join('\n');
    const reordered = ordered.replace(
      `${writerBlock}\n${contextBlock}`,
      `${contextBlock}\n${writerBlock}`
    );
    expect(reordered).not.toBe(ordered);
    expect(inspectGesturePlaygroundRecommendation(reordered.split('\n'))).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_frame'
    });
  });

  it.each([
    ['writerInstructions', 'gestureWriterInstructionsCharacters'],
    ['characterNotes', 'gestureCharacterNotesCharacters']
  ] as const)('accepts %s at its exact bound and rejects one character more', (field, budgetKey) => {
    const maximum = PROMPT_BUDGETS.workshopWidgets[budgetKey];
    expect(
      inspectGesturePlaygroundRecommendation(
        recommendationSection({ [field]: 'x'.repeat(maximum) })
      ).outcome
    ).toBe('accepted');
    expect(
      inspectGesturePlaygroundRecommendation(
        recommendationSection({ [field]: 'x'.repeat(maximum + 1) })
      )
    ).toEqual({
      outcome: 'rejected',
      rejection: 'field_too_long',
      field,
      actualCharacters: maximum + 1,
      maximumCharacters: maximum
    });
  });

  it('enforces the target-phrase bound while keeping it grounded in context', () => {
    const maximum = PROMPT_BUDGETS.workshopWidgets.gestureTargetPhraseCharacters;
    const atBound = 'x'.repeat(maximum);
    expect(inspectGesturePlaygroundRecommendation(recommendationSection({
      targetPhrase: atBound,
      surroundingContext: atBound
    })).outcome).toBe('accepted');

    const overBound = 'x'.repeat(maximum + 1);
    expect(inspectGesturePlaygroundRecommendation(recommendationSection({
      targetPhrase: overBound,
      surroundingContext: overBound
    }))).toEqual({
      outcome: 'rejected',
      rejection: 'field_too_long',
      field: 'targetPhrase',
      actualCharacters: maximum + 1,
      maximumCharacters: maximum
    });
  });

  it('enforces the surrounding-context bound while retaining target evidence', () => {
    const maximum = PROMPT_BUDGETS.workshopWidgets.gestureContextCharacters;
    const targetPhrase = 'His eyes stretched wide.';
    const atBound = `${targetPhrase}${'x'.repeat(maximum - targetPhrase.length)}`;
    expect(inspectGesturePlaygroundRecommendation(recommendationSection({
      targetPhrase,
      surroundingContext: atBound
    })).outcome).toBe('accepted');

    expect(inspectGesturePlaygroundRecommendation(recommendationSection({
      targetPhrase,
      surroundingContext: `${atBound}x`
    }))).toEqual({
      outcome: 'rejected',
      rejection: 'field_too_long',
      field: 'contextText',
      actualCharacters: maximum + 1,
      maximumCharacters: maximum
    });
  });
});
