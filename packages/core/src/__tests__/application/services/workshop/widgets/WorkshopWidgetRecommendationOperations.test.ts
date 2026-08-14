/** Generic recommendation-registry, envelope, and transcript-cleanup coverage. */

import {
  buildWorkshopWidgetRecommendationInstruction,
  inspectWorkshopWidgetRecommendation,
  WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES,
  WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS,
  WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION
} from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';
import {
  fixedWorkshopWidgetAvailabilityPolicy,
  WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import {
  sanitizeWorkshopWidgetRecommendationForRetention,
  stripWorkshopWidgetRecommendationControl
} from '@/utils/workshopWidgetRecommendationProtocol';

interface RecommendationFrameFields {
  widgetId?: string;
  writerInstructions?: string;
  surroundingContext?: string;
}

function recommendationFrame(fields: RecommendationFrameFields = {}): string {
  return [
    '### Try a widget',
    '<workshop-widget-recommendation version="1">',
    '<widget-id>',
    fields.widgetId ?? 'gesture-playground',
    '</widget-id>',
    '<target-phrase>',
    'His eyes stretched wide.',
    '</target-phrase>',
    '<writer-instructions>',
    fields.writerInstructions
      ?? 'Preserve the shock breaking through his practiced control.',
    '</writer-instructions>',
    '<surrounding-context>',
    fields.surroundingContext
      ?? 'Micah looked past Jasper. His eyes stretched wide. Nate followed his gaze.',
    '</surrounding-context>',
    '<source-references>',
    'none',
    '</source-references>',
    '<character-notes>',
    'Micah has been containing his fear for Nate.',
    '</character-notes>',
    '</workshop-widget-recommendation>'
  ].join('\n');
}

function creativeRecommendationFrame(): string {
  return [
    '### Try a widget',
    '<workshop-widget-recommendation version="1">',
    '<widget-id>', 'creative-variations', '</widget-id>',
    '<subject-passage>', 'She turned the mug until the chip faced the wall.', '</subject-passage>',
    '<surrounding-context>', '', '</surrounding-context>',
    '<source-references>', 'none', '</source-references>',
    '<must-survive>', '', '</must-survive>',
    '<must-not-change>', '', '</must-not-change>',
    '<creative-aim>', '', '</creative-aim>',
    '<sampling-distance>', 'tail', '</sampling-distance>',
    '<take-count>', '3', '</take-count>',
    '</workshop-widget-recommendation>'
  ].join('\n');
}

const inspectWithCatalog = (content: string) =>
  inspectWorkshopWidgetRecommendation(
    content,
    WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
  );

describe('WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION', () => {
  it('assembles every registered feature once inside the generic response contract', () => {
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toMatch(
      /^<workshop-widget-recommendation-contract>\n/
    );
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toContain(
      'A recommendation or uncommitted chip from an earlier turn never counts against this response'
    );
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toContain(
      'The writer has the following interactive widgets you may recommend:'
    );
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).not.toContain(
      'The writer has two interactive widgets'
    );
    for (const entry of Object.values(WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES)) {
      expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION.split(entry.instruction)).toHaveLength(2);
      expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toContain(entry.catalogSummary);
    }
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION).toMatch(
      /\n<\/workshop-widget-recommendation-contract>$/
    );
  });

  it('derives both stable prompt orders from one closed registry membership list', () => {
    const entries = Object.values(WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES);
    expect(entries.map(({ widgetId }) => widgetId)).toEqual([
      'gesture-playground',
      'lexical-gravity',
      'creative-variations'
    ]);
    expect(new Set(entries.map(({ catalogOrder }) => catalogOrder)).size).toBe(entries.length);
    expect(new Set(entries.map(({ instructionOrder }) => instructionOrder)).size).toBe(
      entries.length
    );
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION.indexOf(
      WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES['lexical-gravity'].instruction
    )).toBeLessThan(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION.indexOf(
      WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES['gesture-playground'].instruction
    ));
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION.indexOf(
      WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES['gesture-playground'].instruction
    )).toBeLessThan(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION.indexOf(
      WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES['creative-variations'].instruction
    ));
  });

  it('builds route-test instructions from an exact injected availability set', () => {
    const gestureOnly = fixedWorkshopWidgetAvailabilityPolicy(['gesture-playground']);
    const instruction = buildWorkshopWidgetRecommendationInstruction(gestureOnly);

    expect(instruction).toContain(
      WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES['gesture-playground'].instruction
    );
    expect(instruction).not.toContain(
      WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES['lexical-gravity'].instruction
    );
  });
});

describe('inspectWorkshopWidgetRecommendation', () => {
  it('is absent when no exact section exists', () => {
    expect(inspectWithCatalog('Just prose about a smile.').outcome).toBe('absent');
  });

  it('normalizes CRLF framing before dispatching a live widget id', () => {
    expect(
      inspectWithCatalog(recommendationFrame().replace(/\n/g, '\r\n')).outcome
    ).toBe('accepted');
  });

  it('dispatches Creative Variations through the production catalog policy', () => {
    expect(inspectWithCatalog(creativeRecommendationFrame())).toEqual({
      outcome: 'accepted',
      recommendation: {
        widgetId: 'creative-variations',
        seed: expect.objectContaining({
          subjectText: 'She turned the mug until the chip faced the wall.',
          sourceReferences: [],
          distance: 'tail',
          requestedCount: 3
        })
      }
    });
  });

  it('requires the exact frame to be the final response content', () => {
    expect(
      inspectWithCatalog(`${recommendationFrame()}\n\n### Epilogue\nMore prose.`)
    ).toEqual({ outcome: 'rejected', rejection: 'invalid_frame' });
    expect(
      inspectWithCatalog(
        '### Try a widget\nA prefatory line inside the control section.\n'
        + recommendationFrame().split('\n').slice(1).join('\n')
      )
    ).toEqual({ outcome: 'rejected', rejection: 'invalid_frame' });
  });

  it('rejects duplicate headings wholesale', () => {
    expect(
      inspectWithCatalog(`${recommendationFrame()}\n\n${recommendationFrame()}`)
    ).toEqual({ outcome: 'rejected', rejection: 'duplicate_heading' });
  });

  it('rejects widget ids that are not live and host-addressable', () => {
    expect(
      inspectWithCatalog(recommendationFrame({ widgetId: 'show-vs-tell' }))
    ).toEqual({ outcome: 'rejected', rejection: 'unknown_or_unavailable_widget' });
    expect(
      inspectWithCatalog(recommendationFrame({ widgetId: 'made-up-widget' }))
    ).toEqual({ outcome: 'rejected', rejection: 'unknown_or_unavailable_widget' });
  });

  it('uses the injected availability policy before feature dispatch', () => {
    expect(inspectWorkshopWidgetRecommendation(
      recommendationFrame({ widgetId: 'lexical-gravity' }),
      fixedWorkshopWidgetAvailabilityPolicy(['gesture-playground'])
    )).toEqual({ outcome: 'rejected', rejection: 'unknown_or_unavailable_widget' });
  });

  it('rejects an oversized whole frame before feature inspection', () => {
    expect(
      inspectWithCatalog(recommendationFrame({
        surroundingContext: 'x'.repeat(WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS + 1)
      }))
    ).toEqual({
      outcome: 'rejected',
      rejection: 'frame_too_long',
      actualCharacters: expect.any(Number),
      maximumCharacters: WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS
    });
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

  it('replaces a frame-only retained response with a neutral non-protocol row', () => {
    const sanitized = sanitizeWorkshopWidgetRecommendationForRetention(recommendationFrame());
    expect(sanitized).toBe('[Widget setup delivered through the Workshop interface.]');
    expect(sanitized).not.toContain('workshop-widget-recommendation');
  });
});
