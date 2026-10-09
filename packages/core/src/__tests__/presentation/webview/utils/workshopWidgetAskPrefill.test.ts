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
    expect(canBuildWorkshopWidgetAskPrefill('topic-relationship')).toBe(false);
    expect(() => buildWorkshopWidgetAskPrefill('topic-relationship', 'Jill'))
      .toThrow('has no Host-preparation prompt');
  });

  it('keeps every launchable widget either Host-preparable or explicitly deferred', () => {
    const liveWidgetsWithoutHostPrefill = WORKSHOP_WIDGET_CATALOG
      .flatMap((group) => group.items)
      .filter((widget) => widget.live)
      .filter((widget) => !canBuildWorkshopWidgetAskPrefill(widget.id))
      .map((widget) => widget.id);

    // Show vs. Tell is live for hands-on testing, but its Host-preparation door
    // is Slice 5: a persona may not prepare it until its recommendation codec
    // and seed exist, so it is deferred explicitly rather than by accident.
    expect(liveWidgetsWithoutHostPrefill).toEqual(['show-vs-tell']);
  });

  it('keeps the Show vs. Tell Host-preparation door closed until Slice 5', () => {
    expect(canBuildWorkshopWidgetAskPrefill('show-vs-tell')).toBe(false);
    expect(() => buildWorkshopWidgetAskPrefill('show-vs-tell', 'Jill'))
      .toThrow('has no Host-preparation prompt');
  });
});
