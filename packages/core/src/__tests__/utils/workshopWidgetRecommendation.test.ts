/**
 * The persona recommend/prefill protocol (ADR 2026-07-22 decision 13):
 * strict, fail-closed, and live-gated — a malformed section or a comp-only
 * widget id rejects wholesale rather than rendering a dead chip.
 */

import { inspectWorkshopWidgetRecommendation } from '@/utils/workshopWidgetRecommendation';

describe('inspectWorkshopWidgetRecommendation', () => {
  it('is absent when no section exists', () => {
    expect(inspectWorkshopWidgetRecommendation('Just prose about a smile.').outcome).toBe('absent');
  });

  it('accepts the bare recommendation', () => {
    const result = inspectWorkshopWidgetRecommendation(
      'Take another pass.\n\n### Try a widget\n- gesture-playground\n'
    );
    expect(result).toEqual({
      outcome: 'accepted',
      recommendation: { widgetId: 'gesture-playground' }
    });
  });

  it('accepts phrase and notes prefill fields, stripping wrapping quotes', () => {
    const result = inspectWorkshopWidgetRecommendation(
      '### Try a widget\n- gesture-playground | phrase: “she smiled” | notes: Mara — guarded, hates being read\n'
    );
    expect(result.outcome).toBe('accepted');
    expect(result.recommendation).toEqual({
      widgetId: 'gesture-playground',
      seed: {
        targetPhrase: 'she smiled',
        characterNotes: 'Mara — guarded, hates being read'
      }
    });
  });

  it('stops the section at the next heading', () => {
    const result = inspectWorkshopWidgetRecommendation(
      '### Try a widget\n- gesture-playground\n\n### Next steps\n- [high] fix the beat\n'
    );
    expect(result.outcome).toBe('accepted');
  });

  it('rejects duplicate headings wholesale', () => {
    const result = inspectWorkshopWidgetRecommendation(
      '### Try a widget\n- gesture-playground\n\n### Try a widget\n- gesture-playground\n'
    );
    expect(result).toEqual({ outcome: 'rejected', rejection: 'duplicate_heading' });
  });

  it('rejects anything but exactly one item', () => {
    expect(
      inspectWorkshopWidgetRecommendation('### Try a widget\n').outcome
    ).toBe('rejected');
    expect(
      inspectWorkshopWidgetRecommendation(
        '### Try a widget\n- gesture-playground\n- gesture-playground\n'
      )
    ).toEqual({ outcome: 'rejected', rejection: 'not_exactly_one_item' });
  });

  it('rejects widgets that are not live — comp-only cards never grow chips', () => {
    expect(
      inspectWorkshopWidgetRecommendation('### Try a widget\n- lexical-gravity\n')
    ).toEqual({ outcome: 'rejected', rejection: 'unknown_or_unavailable_widget' });
    expect(
      inspectWorkshopWidgetRecommendation('### Try a widget\n- made-up-widget\n')
    ).toEqual({ outcome: 'rejected', rejection: 'unknown_or_unavailable_widget' });
  });

  it('rejects unknown or duplicated fields', () => {
    expect(
      inspectWorkshopWidgetRecommendation(
        '### Try a widget\n- gesture-playground | mood: wistful\n'
      )
    ).toEqual({ outcome: 'rejected', rejection: 'invalid_field' });
    expect(
      inspectWorkshopWidgetRecommendation(
        '### Try a widget\n- gesture-playground | phrase: a | phrase: b\n'
      )
    ).toEqual({ outcome: 'rejected', rejection: 'invalid_field' });
  });

  it('rejects over-budget fields wholesale', () => {
    const longPhrase = 'x'.repeat(400);
    expect(
      inspectWorkshopWidgetRecommendation(
        `### Try a widget\n- gesture-playground | phrase: ${longPhrase}\n`
      )
    ).toEqual({ outcome: 'rejected', rejection: 'field_too_long' });
  });
});
