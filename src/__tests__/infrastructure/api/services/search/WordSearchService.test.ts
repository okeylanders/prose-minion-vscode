/**
 * WordSearchService Business Logic Tests
 * Tests word clustering algorithm and occurrence detection
 */

import { WordSearchService } from '@/infrastructure/api/services/search/WordSearchService';

describe('WordSearchService - Business Logic', () => {
  let service: WordSearchService;
  let mockToolOptions: any;

  beforeEach(() => {
    mockToolOptions = {
      getWordSearchOptions: jest.fn().mockReturnValue({
        caseSensitive: false,
        contextWords: 5,
        clusterWindow: 50,
        minClusterSize: 2
      })
    };
    service = new WordSearchService(mockToolOptions);
  });

  describe('Clustering Algorithm', () => {
    it('should detect cluster when occurrences are within window', async () => {
      // Setup: Text with word "test" appearing 3 times within 50 words
      const text = Array(15).fill('word').join(' ') + ' test ' +
                   Array(15).fill('word').join(' ') + ' test ' +
                   Array(15).fill('word').join(' ') + ' test';

      // This creates a scenario where 3 occurrences of "test" are spread across ~50 words
      // With clusterWindow: 60 and minClusterSize: 3, this should form a cluster

      const result = await service.searchWords(text, undefined, 'selection', {
        wordsOrPhrases: ['test'],
        contextWords: 5,
        clusterWindow: 60,
        minClusterSize: 3,
        caseSensitive: false
      });

      expect(result.toolName).toBe('word_search');
      const data = result.metrics;
      expect(data.targets).toHaveLength(1);
      expect(data.targets[0].totalOccurrences).toBe(3);
      expect(data.targets[0].perFile[0].clusters.length).toBeGreaterThan(0);
    });

    it('should not detect cluster when occurrences are outside window', async () => {
      // Setup: Text with word "test" appearing far apart (> 100 words)
      const text = Array(100).fill('word').join(' ') + ' test ' +
                   Array(100).fill('word').join(' ') + ' test ' +
                   Array(100).fill('word').join(' ') + ' test';

      // With clusterWindow: 50, these occurrences should NOT form a cluster

      const result = await service.searchWords(text, undefined, 'selection', {
        wordsOrPhrases: ['test'],
        contextWords: 5,
        clusterWindow: 50,
        minClusterSize: 3,
        caseSensitive: false
      });

      expect(result.toolName).toBe('word_search');
      const data = result.metrics;
      expect(data.targets[0].perFile[0].clusters).toHaveLength(0);
    });

    it('should respect minimum cluster size', async () => {
      // Setup: Text with only 2 occurrences
      const text = 'word test word test word';

      // With minClusterSize: 3, should not detect cluster
      const result = await service.searchWords(text, undefined, 'selection', {
        wordsOrPhrases: ['test'],
        contextWords: 5,
        clusterWindow: 50,
        minClusterSize: 3,
        caseSensitive: false
      });

      expect(result.toolName).toBe('word_search');
      const data = result.metrics;
      expect(data.targets[0].perFile[0].clusters).toHaveLength(0);
    });

    it('should handle edge case of single occurrence', async () => {
      const text = 'This is a test';

      const result = await service.searchWords(text, undefined, 'selection', {
        wordsOrPhrases: ['test'],
        contextWords: 5,
        clusterWindow: 50,
        minClusterSize: 2,
        caseSensitive: false
      });

      expect(result.toolName).toBe('word_search');
      const data = result.metrics;
      expect(data.targets[0].totalOccurrences).toBe(1);
      expect(data.targets[0].perFile[0].clusters).toHaveLength(0);
    });

    it('should handle multi-word phrase clustering', async () => {
      const text = 'said John said John said John';

      const result = await service.searchWords(text, undefined, 'selection', {
        wordsOrPhrases: ['said John'],
        contextWords: 5,
        clusterWindow: 20,
        minClusterSize: 2,
        caseSensitive: false
      });

      expect(result.toolName).toBe('word_search');
      const data = result.metrics;
      expect(data.targets[0].totalOccurrences).toBe(3);
      expect(data.targets[0].perFile[0].clusters.length).toBeGreaterThan(0);
    });
  });

  describe('Case Sensitivity', () => {
    it('should find matches case-insensitively by default', async () => {
      const text = 'Test test TEST';

      const result = await service.searchWords(text, undefined, 'selection', {
        wordsOrPhrases: ['test'],
        contextWords: 5,
        clusterWindow: 50,
        minClusterSize: 2,
        caseSensitive: false
      });

      expect(result.metrics.targets[0].totalOccurrences).toBe(3);
    });

    it('should find matches case-sensitively when enabled', async () => {
      const text = 'Test test TEST';

      const result = await service.searchWords(text, undefined, 'selection', {
        wordsOrPhrases: ['test'],
        contextWords: 5,
        clusterWindow: 50,
        minClusterSize: 2,
        caseSensitive: true
      });

      expect(result.metrics.targets[0].totalOccurrences).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', async () => {
      const result = await service.searchWords('', undefined, 'selection', {
        wordsOrPhrases: ['test'],
        contextWords: 5,
        clusterWindow: 50,
        minClusterSize: 2
      });

      expect(result.toolName).toBe('word_search');
      expect(result.metrics.note).toBeDefined();
    });

    it('should handle empty target list', async () => {
      const result = await service.searchWords('some text', undefined, 'selection', {
        wordsOrPhrases: [],
        contextWords: 5,
        clusterWindow: 50,
        minClusterSize: 2
      });

      expect(result.toolName).toBe('word_search');
      expect(result.metrics.note).toContain('No valid targets');
    });

    it('should handle text with no matches', async () => {
      const result = await service.searchWords('foo bar baz', undefined, 'selection', {
        wordsOrPhrases: ['test'],
        contextWords: 5,
        clusterWindow: 50,
        minClusterSize: 2
      });

      expect(result.toolName).toBe('word_search');
      expect(result.metrics.targets[0].totalOccurrences).toBe(0);
    });
  });
});
