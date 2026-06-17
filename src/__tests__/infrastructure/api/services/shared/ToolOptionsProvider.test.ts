/**
 * ToolOptionsProvider Tests
 *
 * Pins the WordSearch option resolution — in particular the `minClusterSize 3→2`
 * straggler fix (review #3): with no settings seeded, the resolver must fall back
 * to the shipped WORD_SEARCH_DEFAULTS, and seeded values must win.
 */

import { ToolOptionsProvider } from '@services/shared/ToolOptionsProvider';
import { WORD_SEARCH_DEFAULTS } from '@shared/constants/wordSearchDefaults';
import { createFakeSettings } from '../../../../mocks/platform';

describe('ToolOptionsProvider.getWordSearchOptions', () => {
  it('falls back to the shipped WORD_SEARCH_DEFAULTS when nothing is configured', () => {
    const provider = new ToolOptionsProvider(createFakeSettings());

    const options = provider.getWordSearchOptions();

    expect(options.minClusterSize).toBe(2); // the straggler fix (was 3)
    expect(options.minClusterSize).toBe(WORD_SEARCH_DEFAULTS.minClusterSize);
    expect(options.contextWords).toBe(WORD_SEARCH_DEFAULTS.contextWords);
    expect(options.clusterWindow).toBe(WORD_SEARCH_DEFAULTS.clusterWindow);
    expect(options.caseSensitive).toBe(WORD_SEARCH_DEFAULTS.caseSensitive);
  });

  it('honors configured values over the defaults', () => {
    const provider = new ToolOptionsProvider(
      createFakeSettings({
        'wordSearch.contextWords': 9,
        'wordSearch.clusterWindow': 200,
        'wordSearch.minClusterSize': 4,
        'wordSearch.caseSensitive': true,
      })
    );

    const options = provider.getWordSearchOptions();

    expect(options).toMatchObject({
      contextWords: 9,
      clusterWindow: 200,
      minClusterSize: 4,
      caseSensitive: true,
    });
  });
});
