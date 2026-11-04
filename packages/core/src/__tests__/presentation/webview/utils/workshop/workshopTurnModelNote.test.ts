/**
 * A bubble's model note and title (ADR 2026-11-03 D8). The note appears only
 * when the provider named a model other than the one requested; the title
 * names the raw ids on every stamped reply.
 */

import {
  workshopRawModelId,
  workshopServedByNote,
  workshopTurnModelTitle
} from '@utils/workshop/workshopTurnModelNote';

const label = (id: string) => ({ 'vendor/auto': 'Auto router', 'vendor/model-a': 'Model A' }[id] ?? id);
const model = (requestedModelId: string, servedModelIds: string[]) =>
  ({ scope: 'assistant' as const, requestedModelId, servedModelIds });

describe('workshopServedByNote', () => {
  it('says nothing for an unstamped reply, a match, or a provider that named no model', () => {
    expect(workshopServedByNote(undefined, label)).toBeUndefined();
    expect(workshopServedByNote(model('vendor/model-a', ['vendor/model-a']), label)).toBeUndefined();
    expect(workshopServedByNote(model('vendor/model-a', []), label)).toBeUndefined();
  });

  it('names the requested and served models on a mismatch, in display names with the id fallback', () => {
    expect(workshopServedByNote(model('vendor/auto', ['vendor/model-a']), label))
      .toBe('Auto router · served by Model A');
    expect(workshopServedByNote(model('vendor/auto', ['vendor/model-a', 'vendor/model-z']), label))
      .toBe('Auto router · served by Model A, vendor/model-z');
    // Two requests, the second served by a fallback: still not what was asked.
    expect(workshopServedByNote(model('vendor/model-a', ['vendor/model-a', 'vendor/model-z']), workshopRawModelId))
      .toBe('vendor/model-a · served by vendor/model-a, vendor/model-z');
  });
});

describe('workshopTurnModelTitle', () => {
  it('names the raw ids, and nothing for an unstamped reply', () => {
    expect(workshopTurnModelTitle(undefined)).toBeUndefined();
    expect(workshopTurnModelTitle(model('vendor/model-a', ['vendor/model-a'])))
      .toBe('vendor/model-a · requested and served');
    expect(workshopTurnModelTitle(model('vendor/auto', ['vendor/model-a'])))
      .toBe('Requested vendor/auto · served by vendor/model-a');
    expect(workshopTurnModelTitle(model('vendor/model-a', [])))
      .toBe('Requested vendor/model-a · the provider named no model');
  });
});
