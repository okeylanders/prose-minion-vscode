/**
 * Registry integrity for the Conversation Widgets catalog (ADR 2026-07-22
 * decision 14): one deterministic table, ids that round-trip through the
 * frame-kind derivation, and honest availability.
 */

import {
  WORKSHOP_WIDGET_CATALOG,
  isLiveWorkshopWidgetId,
  isWorkshopWidgetId,
  workshopWidgetArtifactKind,
  workshopWidgetDescriptor,
  workshopWidgetIdFromArtifactKind,
  workshopWidgetLabel
} from '@shared/constants/workshopWidgets';

const allWidgets = WORKSHOP_WIDGET_CATALOG.flatMap((group) => group.items);

describe('workshopWidgets registry', () => {
  it('holds unique ids with labels, rails, and blurbs on every row', () => {
    const ids = allWidgets.map((widget) => widget.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const widget of allWidgets) {
      expect(widget.label.length).toBeGreaterThan(0);
      expect(['oneshot', 'standing', 'resource']).toContain(widget.rail);
      expect(widget.blurb.length).toBeGreaterThan(0);
      expect(widget.group.length).toBeGreaterThan(0);
    }
  });

  it('keeps items homed in the group that lists them', () => {
    for (const group of WORKSHOP_WIDGET_CATALOG) {
      for (const widget of group.items) {
        expect(widget.group).toBe(group.name);
      }
    }
  });

  it('marks the Sprint 01 and Sprint 02B widgets live', () => {
    expect(allWidgets.filter((widget) => widget.live).map((widget) => widget.id))
      .toEqual(['gesture-playground', 'lexical-gravity']);
    expect(isLiveWorkshopWidgetId('gesture-playground')).toBe(true);
    expect(isLiveWorkshopWidgetId('lexical-gravity')).toBe(true);
    expect(isLiveWorkshopWidgetId('not-a-widget')).toBe(false);
    expect(isLiveWorkshopWidgetId(undefined)).toBe(false);
  });

  it('derives frame kinds mechanically and round-trips them', () => {
    for (const widget of allWidgets) {
      const kind = workshopWidgetArtifactKind(widget.id);
      expect(kind).toBe(`widget:${widget.id}`);
      expect(workshopWidgetIdFromArtifactKind(kind)).toBe(widget.id);
    }
    expect(workshopWidgetIdFromArtifactKind('widget:not-a-widget')).toBeUndefined();
    expect(workshopWidgetIdFromArtifactKind('gesture-playground')).toBeUndefined();
    expect(workshopWidgetIdFromArtifactKind('widget:')).toBeUndefined();
  });

  it('answers lookups without drifting from the catalog', () => {
    expect(isWorkshopWidgetId('gesture-playground')).toBe(true);
    expect(isWorkshopWidgetId('gesture')).toBe(false);
    expect(workshopWidgetLabel('gesture-playground')).toBe('Gesture Playground');
    expect(workshopWidgetDescriptor('gesture-playground')?.rail).toBe('oneshot');
  });
});
