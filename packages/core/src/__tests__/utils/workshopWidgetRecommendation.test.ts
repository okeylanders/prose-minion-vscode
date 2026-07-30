/**
 * The persona recommend/prefill protocol (ADR 2026-07-22 decision 13):
 * strict, fail-closed, and live-gated — a malformed frame or a comp-only
 * widget id rejects wholesale rather than rendering a dead chip.
 */

import {
  inspectWorkshopWidgetRecommendation,
  stripWorkshopWidgetRecommendationControl,
  WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION
} from '@/utils/workshopWidgetRecommendation';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

interface RecommendationFrameFields {
  widgetId?: string;
  targetPhrase?: string;
  writerInstructions?: string;
  surroundingContext?: string;
  characterNotes?: string;
}

function recommendationFrame(fields: RecommendationFrameFields = {}): string {
  return [
    '### Try a widget',
    '<workshop-widget-recommendation version="1">',
    '<widget-id>',
    fields.widgetId ?? 'gesture-playground',
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
    '<character-notes>',
    fields.characterNotes
      ?? 'Micah has been containing his fear for Nate. In this beat, recognition overwhelms that defense before he can disguise it.',
    '</character-notes>',
    '</workshop-widget-recommendation>'
  ].join('\n');
}

describe('WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION', () => {
  it('requires a generous quality-first handoff with every rich prefill field', () => {
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toContain(
      'This is a quality-first handoff, not a token-saving exercise.'
    );
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toContain(
      'Do not be thrifty, terse, or generically minimal'
    );
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toContain(
      'copy a generous, consecutive stretch of the supplied prose'
    );
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toContain(
      'All four fields are required'
    );
    for (const tag of [
      'target-phrase',
      'writer-instructions',
      'surrounding-context',
      'character-notes'
    ]) {
      expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toContain(`<${tag}>`);
      expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toContain(`</${tag}>`);
    }
  });
});

describe('inspectWorkshopWidgetRecommendation', () => {
  it('is absent when no exact section exists', () => {
    expect(inspectWorkshopWidgetRecommendation('Just prose about a smile.').outcome).toBe('absent');
  });

  it('accepts the complete multiline frame and preserves rich field content', () => {
    const result = inspectWorkshopWidgetRecommendation(recommendationFrame({
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
          ].join('\n')
        }
      }
    });
  });

  it('normalizes CRLF framing while retaining multiline field boundaries', () => {
    const result = inspectWorkshopWidgetRecommendation(
      recommendationFrame({
        writerInstructions: 'First sentence.\nSecond sentence.'
      }).replace(/\n/g, '\r\n')
    );

    expect(result.outcome).toBe('accepted');
    expect(result.recommendation?.seed?.writerInstructions).toBe(
      'First sentence.\nSecond sentence.'
    );
  });

  it('rejects a recommendation that omits or empties any required rich field', () => {
    expect(
      inspectWorkshopWidgetRecommendation(
        recommendationFrame({ writerInstructions: '   ' })
      )
    ).toEqual({ outcome: 'rejected', rejection: 'invalid_field' });

    const missingContextFrame = recommendationFrame().replace(
      '<surrounding-context>\nMicah looked past Jasper and into the dark hall.\nHis eyes stretched wide.\nNate followed his gaze but saw nothing.\n</surrounding-context>\n',
      ''
    );
    expect(inspectWorkshopWidgetRecommendation(missingContextFrame)).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_frame'
    });
  });

  it('requires the exact frame to be the final response content', () => {
    expect(
      inspectWorkshopWidgetRecommendation(`${recommendationFrame()}\n\n### Epilogue\nMore prose.`)
    ).toEqual({ outcome: 'rejected', rejection: 'invalid_frame' });
    expect(
      inspectWorkshopWidgetRecommendation(
        '### Try a widget\nA prefatory line inside the control section.\n'
        + recommendationFrame().split('\n').slice(1).join('\n')
      )
    ).toEqual({ outcome: 'rejected', rejection: 'invalid_frame' });
  });

  it('rejects duplicate headings wholesale', () => {
    const result = inspectWorkshopWidgetRecommendation(
      `${recommendationFrame()}\n\n${recommendationFrame()}`
    );
    expect(result).toEqual({ outcome: 'rejected', rejection: 'duplicate_heading' });
  });

  it('rejects widgets that are not live — comp-only cards never grow chips', () => {
    expect(
      inspectWorkshopWidgetRecommendation(recommendationFrame({ widgetId: 'lexical-gravity' }))
    ).toEqual({ outcome: 'rejected', rejection: 'unknown_or_unavailable_widget' });
    expect(
      inspectWorkshopWidgetRecommendation(recommendationFrame({ widgetId: 'made-up-widget' }))
    ).toEqual({ outcome: 'rejected', rejection: 'unknown_or_unavailable_widget' });
  });

  it('rejects duplicated, reordered, or unrecognized frame material', () => {
    expect(
      inspectWorkshopWidgetRecommendation(
        recommendationFrame().replace(
          '</target-phrase>',
          '</target-phrase>\n</target-phrase>'
        )
      )
    ).toEqual({ outcome: 'rejected', rejection: 'invalid_frame' });

    expect(
      inspectWorkshopWidgetRecommendation(
        recommendationFrame().replace(
          '<writer-instructions>',
          '<unknown-field>\nnope\n</unknown-field>\n<writer-instructions>'
        )
      )
    ).toEqual({ outcome: 'rejected', rejection: 'invalid_frame' });

    const ordered = recommendationFrame({
      writerInstructions: 'WRITER DIRECTIONS',
      surroundingContext: 'SOURCE CONTEXT'
    });
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
    expect(inspectWorkshopWidgetRecommendation(reordered)).toEqual({
      outcome: 'rejected',
      rejection: 'invalid_frame'
    });
  });

  it.each([
    ['targetPhrase', 'gestureTargetPhraseCharacters'],
    ['writerInstructions', 'gestureWriterInstructionsCharacters'],
    ['surroundingContext', 'gestureContextCharacters'],
    ['characterNotes', 'gestureCharacterNotesCharacters']
  ] as const)('accepts %s at its exact bound and rejects one character more', (field, budgetKey) => {
    const maximum = PROMPT_BUDGETS.workshopWidgets[budgetKey];
    expect(
      inspectWorkshopWidgetRecommendation(
        recommendationFrame({ [field]: 'x'.repeat(maximum) })
      ).outcome
    ).toBe('accepted');
    expect(
      inspectWorkshopWidgetRecommendation(
        recommendationFrame({ [field]: 'x'.repeat(maximum + 1) })
      )
    ).toEqual({ outcome: 'rejected', rejection: 'field_too_long' });
  });

  it('rejects an oversized whole frame before inspecting its fields', () => {
    expect(
      inspectWorkshopWidgetRecommendation(
        recommendationFrame({ surroundingContext: 'x'.repeat(15_000) })
      )
    ).toEqual({ outcome: 'rejected', rejection: 'frame_too_long' });
  });
});

describe('stripWorkshopWidgetRecommendationControl', () => {
  it('removes an accepted final control frame while preserving visible prose', () => {
    expect(
      stripWorkshopWidgetRecommendationControl(
        `The reaction needs a more specific dramatic shape.\n\n${recommendationFrame()}`
      )
    ).toBe('The reaction needs a more specific dramatic shape.');
  });

  it('also removes rejected or truncated control debris from visible prose', () => {
    expect(
      stripWorkshopWidgetRecommendationControl(
        'Useful advice remains visible.\n\n### Try a widget\n'
        + '<workshop-widget-recommendation version="1">\n<widget-id>\ngesture-playground'
      )
    ).toBe('Useful advice remains visible.');
  });

  it('leaves ordinary prose and inexact headings untouched', () => {
    const content = 'Try a widget if useful.\n\n### Try a widget later\nThis is ordinary prose.';
    expect(stripWorkshopWidgetRecommendationControl(content)).toBe(content);
  });
});
