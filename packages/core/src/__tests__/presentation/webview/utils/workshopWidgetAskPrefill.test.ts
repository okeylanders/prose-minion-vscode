import {
  buildWorkshopWidgetAskPrefill,
  canBuildWorkshopWidgetAskPrefill
} from '@utils/workshopWidgetAskPrefill';
import { WORKSHOP_WIDGET_CATALOG } from '@shared/constants/workshopWidgets';

describe('buildWorkshopWidgetAskPrefill', () => {
  it('asks the Host for a grounded Gesture Playground recommendation seed', () => {
    expect(buildWorkshopWidgetAskPrefill('gesture-playground', 'Jill')).toBe(
      'Hey Jill! Please prepare Gesture Playground for the beat we’re discussing. ' +
      'Seed it with the exact target phrase, useful surrounding context, and grounded ' +
      'character notes, then offer it for me to review and open.'
    );
  });

  it('asks the Host for all four Lexical Gravity seed values', () => {
    const prefill = buildWorkshopWidgetAskPrefill('lexical-gravity', 'Jill');
    expect(prefill).toContain('Choose a useful starting lens, weight, reach, and metaphor setting');
    expect(prefill).toContain('offer it for me to review and open');
  });

  it('asks the Host for an input-only Creative Variations seed', () => {
    const prefill = buildWorkshopWidgetAskPrefill('creative-variations', 'Jill');
    expect(prefill).toContain('exact subject passage');
    expect(prefill).toContain('any constraints I have actually stated');
    expect(prefill).toContain('fields empty when I have not stated them');
    expect(prefill).toContain('sampling distance, and take count');
    expect(prefill).toContain('Do not generate, select, accept, or commit any takes.');
  });

  it('reports Host-prefill capability independently from launch availability', () => {
    expect(canBuildWorkshopWidgetAskPrefill('gesture-playground')).toBe(true);
    expect(canBuildWorkshopWidgetAskPrefill('lexical-gravity')).toBe(true);
    expect(canBuildWorkshopWidgetAskPrefill('creative-variations')).toBe(true);
    expect(canBuildWorkshopWidgetAskPrefill('show-vs-tell')).toBe(true);
    expect(canBuildWorkshopWidgetAskPrefill('topic-relationship')).toBe(false);
    expect(() => buildWorkshopWidgetAskPrefill('topic-relationship', 'Jill'))
      .toThrow('has no Host-preparation prompt');
  });

  it('asks the Host for an input-only Show vs. Tell seed and forbids acting on it', () => {
    const prefill = buildWorkshopWidgetAskPrefill('show-vs-tell', 'Jill');
    expect(prefill).toContain('Hey Jill! Please prepare Show vs. Tell Playground');
    expect(prefill).toContain('Seed the exact beat');
    expect(prefill).toContain('any surrounding source');
    expect(prefill).toContain('the “must survive” fact that the beat already carries');
    expect(prefill).toContain('any constraint I have actually stated');
    expect(prefill).toContain('what the line buys and what it spends where it stands, rather than judging it');
    expect(prefill).toContain('Do not generate, keep, carry, or commit anything.');
    expect(prefill).not.toMatch(/\b(weak|lazy|flat|wrong)\b/);
  });

  it('leaves no live widget without a Host-preparation door', () => {
    const liveWidgetsWithoutHostPrefill = WORKSHOP_WIDGET_CATALOG
      .flatMap((group) => group.items)
      .filter((widget) => widget.live)
      .filter((widget) => !canBuildWorkshopWidgetAskPrefill(widget.id))
      .map((widget) => widget.id);

    expect(liveWidgetsWithoutHostPrefill).toEqual([]);
  });
});
