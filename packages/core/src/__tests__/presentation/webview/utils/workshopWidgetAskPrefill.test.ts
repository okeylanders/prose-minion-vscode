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

  it('requires every live registry widget to provide a non-generic Host prefill', () => {
    const liveWidgets = WORKSHOP_WIDGET_CATALOG
      .flatMap((group) => group.items)
      .filter((widget) => widget.live);

    for (const widget of liveWidgets) {
      expect(canBuildWorkshopWidgetAskPrefill(widget.id)).toBe(true);
      expect(buildWorkshopWidgetAskPrefill(widget.id, 'Jill')).toContain(widget.label);
    }
    expect(canBuildWorkshopWidgetAskPrefill('show-vs-tell')).toBe(false);
    expect(() => buildWorkshopWidgetAskPrefill('show-vs-tell', 'Jill'))
      .toThrow('has no Host-preparation prompt');
  });
});
