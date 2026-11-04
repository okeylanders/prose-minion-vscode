/**
 * A bubble's participant-label title (ADR 2026-11-03 D8): it names the raw
 * ids on every stamped reply. The header's model text is the shared rule,
 * pinned in `workshopTurnModelLabel.test.ts`.
 */

import { workshopRawModelId, workshopTurnModelTitle } from '@utils/workshop/workshopTurnModelNote';

const model = (requestedModelId: string, servedModelIds: string[]) =>
  ({ scope: 'assistant' as const, requestedModelId, servedModelIds });

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

describe('workshopRawModelId', () => {
  it('names a model by its id', () => {
    expect(workshopRawModelId('vendor/model-a')).toBe('vendor/model-a');
  });
});
