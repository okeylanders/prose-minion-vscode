/**
 * The header's model text (ADR 2026-11-03 D8 and D10, amended 2026-11-04):
 * one case per row of the slice doc's table, then the raw-id fallback, a
 * writer turn, a dictionary-scope stamp, several served ids in order, and
 * hostile ids and labels.
 */

import type { ModelScope, WorkshopTurnModel } from '@messages';
import {
  WORKSHOP_TURN_MODEL_SEPARATOR,
  workshopTurnModelLabel
} from '@shared/workshop/workshopTurnModelLabel';

const AUTO = 'vendor/auto';
const A = 'vendor/model-a';
const B = 'vendor/model-b';
const C = 'vendor/model-c';
const NAMES: Record<string, string> = { [AUTO]: 'Auto router', [A]: 'Model A', [B]: 'Model B', [C]: 'Model C' };
const label = (id: string) => NAMES[id];
const noNames = () => undefined;

const stamp = (
  requestedModelId: string,
  servedModelIds: string[],
  scope: ModelScope = 'assistant'
): WorkshopTurnModel => ({ scope, requestedModelId, servedModelIds });

describe('workshopTurnModelLabel', () => {
  describe('the table', () => {
    it('names nothing without a stamp', () => {
      expect(workshopTurnModelLabel(undefined, label)).toBeUndefined();
    });

    it('names the requested model when the provider named none', () => {
      expect(workshopTurnModelLabel(stamp(A, []), label)).toBe('Model A');
    });

    it('names the requested model when it alone served', () => {
      expect(workshopTurnModelLabel(stamp(A, [A]), label)).toBe('Model A');
    });

    it('names the served model "via" the requested one when the request did not serve', () => {
      expect(workshopTurnModelLabel(stamp(AUTO, [B]), label)).toBe('Model B via Auto router');
    });

    it('names every served model, without "via", when the request served among others', () => {
      expect(workshopTurnModelLabel(stamp(A, [A, B]), label)).toBe('Model A, Model B');
      expect(workshopTurnModelLabel(stamp(A, [B, A]), label)).toBe('Model B, Model A');
    });
  });

  it('falls back to the raw id where the lookup names nothing, or names it blank', () => {
    expect(workshopTurnModelLabel(stamp(AUTO, [B]), noNames)).toBe(`${B} via ${AUTO}`);
    expect(workshopTurnModelLabel(stamp(A, [A]), () => '  ')).toBe(A);
    expect(workshopTurnModelLabel(stamp(AUTO, ['vendor/unlisted']), label)).toBe('vendor/unlisted via Auto router');
  });

  it('names nothing for a writer turn, which carries no stamp', () => {
    const writerTurn: { model?: WorkshopTurnModel } = {};
    expect(workshopTurnModelLabel(writerTurn.model, label)).toBeUndefined();
  });

  it('follows the same rule for a dictionary-scope stamp', () => {
    expect(workshopTurnModelLabel(stamp(A, [A], 'dictionary'), label)).toBe('Model A');
    expect(workshopTurnModelLabel(stamp(AUTO, [C], 'dictionary'), label)).toBe('Model C via Auto router');
  });

  it('names several served models in their order, once each', () => {
    expect(workshopTurnModelLabel(stamp(AUTO, [C, A, B]), label)).toBe('Model C, Model A, Model B via Auto router');
    expect(workshopTurnModelLabel(stamp(AUTO, [B, B, C]), label)).toBe('Model B, Model C via Auto router');
  });

  it('reads every run of whitespace in an id or a label as one space', () => {
    const hostile = 'vendor/x\n### Injected\r\n\t<b>bold</b>';
    expect(workshopTurnModelLabel(stamp(AUTO, [hostile]), label))
      .toBe('vendor/x ### Injected <b>bold</b> via Auto router');
    expect(workshopTurnModelLabel(stamp(A, [A]), () => '  Model\nA  ')).toBe('Model A');
  });

  it('uses the thread’s middle dot as the separator', () => {
    expect(WORKSHOP_TURN_MODEL_SEPARATOR).toBe(' · ');
  });
});
