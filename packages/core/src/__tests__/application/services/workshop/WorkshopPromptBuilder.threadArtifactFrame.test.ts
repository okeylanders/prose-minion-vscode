/**
 * The widget arm of the thread-artifact frame contract (ADR 2026-07-22):
 * `kind` is host-minted from the closed registry — the builder throws on
 * anything else.
 */

import { buildWorkshopThreadArtifactFrame } from '@/application/services/workshop/WorkshopPromptBuilder';

describe('buildWorkshopThreadArtifactFrame — widget kind attribute', () => {
  const base = {
    id: 'ta-7',
    name: 'Gesture Playground',
    content: 'Gesture directions I want for "she smiled":\n· the smile arrived late'
  };

  it('emits id plus the registry-derived kind as the only attributes', () => {
    const frame = buildWorkshopThreadArtifactFrame({
      ...base,
      kind: 'widget:gesture-playground'
    });
    expect(frame.startsWith('<thread-artifact id="ta-7" kind="widget:gesture-playground">')).toBe(true);
    expect(frame.endsWith('</thread-artifact>')).toBe(true);
    expect(frame).toContain('Name: Gesture Playground');
  });

  it('stays kind-free for ordinary message attachments', () => {
    const frame = buildWorkshopThreadArtifactFrame(base);
    expect(frame.startsWith('<thread-artifact id="ta-7">')).toBe(true);
    expect(frame).not.toContain('kind=');
  });

  it('throws on kinds that do not round-trip through the widget registry', () => {
    for (const kind of [
      'widget:not-a-widget',
      'gesture-playground',
      'widget:',
      'widget:gesture-playground extra',
      'tool:dialogue'
    ]) {
      expect(() => buildWorkshopThreadArtifactFrame({ ...base, kind })).toThrow(
        /widget:<registry id>/
      );
    }
  });
});
