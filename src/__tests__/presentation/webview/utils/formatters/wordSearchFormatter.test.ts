/**
 * Tests for word search formatter
 */

import { formatSearchResultAsMarkdown } from '@formatters/wordSearchFormatter';
import { WORD_SEARCH_DEFAULTS } from '@shared/constants/wordSearchDefaults';

describe('formatSearchResultAsMarkdown', () => {
  it('returns empty string for null/undefined input', () => {
    expect(formatSearchResultAsMarkdown(null)).toBe('');
    expect(formatSearchResultAsMarkdown(undefined)).toBe('');
  });

  it('criteria line falls back to the shipped WORD_SEARCH_DEFAULTS when options are absent', () => {
    // Pins #2: the display layer must echo the same defaults as the runtime sites
    // (3/50/2), not the old 7/150/3 that never shipped.
    const markdown = formatSearchResultAsMarkdown({ scannedFiles: ['f.md'], targets: [] });
    expect(markdown).toContain(
      `Context window: ${WORD_SEARCH_DEFAULTS.contextWords} words | ` +
        `Cluster window: ${WORD_SEARCH_DEFAULTS.clusterWindow} ` +
        `(min ${WORD_SEARCH_DEFAULTS.minClusterSize} hits)`
    );
    expect(markdown).toContain('Context window: 3 words');
  });

  it('returns empty string for invalid shape (missing scannedFiles or targets)', () => {
    expect(formatSearchResultAsMarkdown({})).toBe('');
    expect(formatSearchResultAsMarkdown({ scannedFiles: [] })).toBe('');
    expect(formatSearchResultAsMarkdown({ targets: [] })).toBe('');
  });

  it('formats basic word search result with no matches', () => {
    const result = {
      scannedFiles: ['file1.md'],
      targets: [
        {
          target: 'testword',
          totalOccurrences: 0,
          filesWithMatches: 0,
          perFile: []
        }
      ],
      options: {
        caseSensitive: false,
        contextWords: 3,
        clusterWindow: 50,
        minClusterSize: 2
      }
    };

    const markdown = formatSearchResultAsMarkdown(result);

    expect(markdown).toContain('# 🔎 Word Search');
    expect(markdown).toContain('## Criteria');
    expect(markdown).toContain('Targets: `testword`');
    expect(markdown).toContain('Case sensitive: no');
    expect(markdown).toContain('## Results');
    expect(markdown).toContain('Total occurrences: 0');
  });

  it('formats word search result with matches', () => {
    const result = {
      scannedFiles: ['chapter1.md'],
      targets: [
        {
          target: 'example',
          totalOccurrences: 3,
          filesWithMatches: 1,
          overallAverageGap: 50.5,
          perFile: [
            {
              file: '/path/to/chapter1.md',
              relative: 'chapter1.md',
              count: 3,
              averageGap: 50.5,
              occurrences: [
                { index: 1, line: 10, snippet: 'This is an example sentence' },
                { index: 2, line: 25, snippet: 'Another example here' },
                { index: 3, line: 40, snippet: 'Final example' }
              ],
              clusters: []
            }
          ]
        }
      ],
      options: {
        caseSensitive: false,
        contextWords: 3,
        clusterWindow: 50,
        minClusterSize: 2
      }
    };

    const markdown = formatSearchResultAsMarkdown(result);

    expect(markdown).toContain('# 🔎 Word Search');
    expect(markdown).toContain('Total occurrences: 3');
    expect(markdown).toContain('Average gap between hits: 50.5 words');
    expect(markdown).toContain('### Summary');
    expect(markdown).toContain('chapter1.md');
    expect(markdown).toContain('`example`');
    expect(markdown).toContain('This is an example sentence');
  });

  it('formats result with clusters', () => {
    const result = {
      scannedFiles: ['file.md'],
      targets: [
        {
          target: 'word',
          totalOccurrences: 5,
          filesWithMatches: 1,
          perFile: [
            {
              file: 'file.md',
              relative: 'file.md',
              count: 5,
              occurrences: [],
              clusters: [
                {
                  count: 5,
                  spanWords: 100,
                  startLine: 10,
                  endLine: 15,
                  snippet: 'cluster context'
                }
              ]
            }
          ]
        }
      ],
      options: {}
    };

    const markdown = formatSearchResultAsMarkdown(result);

    expect(markdown).toContain('Clusters detected:');
    expect(markdown).toContain('5 hits within 100 words');
    expect(markdown).toContain('lines 10–15');
  });

  it('handles multiple targets', () => {
    const result = {
      scannedFiles: ['file.md'],
      targets: [
        { target: 'first', totalOccurrences: 2, filesWithMatches: 1, perFile: [] },
        { target: 'second', totalOccurrences: 3, filesWithMatches: 1, perFile: [] }
      ],
      options: {}
    };

    const markdown = formatSearchResultAsMarkdown(result);

    expect(markdown).toContain('Targets: `first`, `second`');
    expect(markdown).toContain('Total occurrences: 5'); // 2 + 3
  });

  it('escapes pipe characters in snippets for markdown tables', () => {
    const result = {
      scannedFiles: ['file.md'],
      targets: [
        {
          target: 'test',
          totalOccurrences: 1,
          filesWithMatches: 1,
          perFile: [
            {
              file: 'file.md',
              relative: 'file.md',
              count: 1,
              occurrences: [
                { index: 1, line: 1, snippet: 'text with | pipe character' }
              ]
            }
          ]
        }
      ],
      options: {}
    };

    const markdown = formatSearchResultAsMarkdown(result);

    expect(markdown).toContain('text with \\| pipe character');
  });
});
