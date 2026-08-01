import { buildWorkshopWidgetAskPrefill } from '@utils/workshopWidgetAskPrefill';

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
});
