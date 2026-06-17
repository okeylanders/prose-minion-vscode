/**
 * PublishingStandardsRepository Business Logic Tests
 * Tests genre lookup and page size key generation
 */

import { PublishingStandardsRepository } from '@/infrastructure/standards/PublishingStandardsRepository';
import { Genre, PageSize } from '@/domain/models/PublishingStandards';
import { createFakeFileSystem } from '../../mocks/platform';

describe('PublishingStandardsRepository - Business Logic', () => {
  let repository: PublishingStandardsRepository;
  let readFileMock: jest.Mock;

  const mockGenres: Genre[] = [
    {
      slug: 'literary-fiction',
      abbreviation: 'LF',
      name: 'Literary Fiction',
      words_per_page: { average: 250 },
      page_sizes: [],
      word_count_range: { min: 70000, max: 120000 },
      page_count_range: { min: 280, max: 480 },
      formatting: { font_size_pt: [12], line_spacing: [2], margins_inches: [1] },
      literary_statistics: {} as any
    },
    {
      slug: 'ya-fantasy',
      abbreviation: 'YAF',
      name: 'YA Fantasy',
      words_per_page: { average: 250 },
      page_sizes: [],
      word_count_range: { min: 50000, max: 90000 },
      page_count_range: { min: 200, max: 360 },
      formatting: { font_size_pt: [12], line_spacing: [2], margins_inches: [1] },
      literary_statistics: {} as any
    },
    {
      slug: 'mystery-thriller',
      abbreviation: 'MT',
      name: 'Mystery/Thriller',
      words_per_page: { average: 250 },
      page_sizes: [],
      word_count_range: { min: 70000, max: 100000 },
      page_count_range: { min: 280, max: 400 },
      formatting: { font_size_pt: [12], line_spacing: [2], margins_inches: [1] },
      literary_statistics: {} as any
    }
  ];

  const mockData = {
    publishing_standards: {
      genres: mockGenres,
      manuscript_format: {
        page_margins: { top: 1, bottom: 1, left: 1, right: 1 },
        font_family: 'Times New Roman',
        font_size: 12,
        line_spacing: 2
      }
    }
  };

  beforeEach(() => {
    readFileMock = jest.fn().mockResolvedValue(Buffer.from(JSON.stringify(mockData)));
    repository = new PublishingStandardsRepository(
      '/test',
      createFakeFileSystem({ readFile: readFileMock })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Genre Lookup', () => {
    it('should find genre by slug (exact match)', async () => {
      const result = await repository.findGenre('literary-fiction');
      expect(result).toBeDefined();
      expect(result?.slug).toBe('literary-fiction');
      expect(result?.name).toBe('Literary Fiction');
    });

    it('should find genre by abbreviation (case-insensitive)', async () => {
      const result = await repository.findGenre('yaf');
      expect(result).toBeDefined();
      expect(result?.slug).toBe('ya-fantasy');
    });

    it('should find genre by name (case-insensitive)', async () => {
      const result = await repository.findGenre('mystery/thriller');
      expect(result).toBeDefined();
      expect(result?.slug).toBe('mystery-thriller');
    });

    it('should handle case variations', async () => {
      const result = await repository.findGenre('LITERARY-FICTION');
      expect(result).toBeDefined();
      expect(result?.slug).toBe('literary-fiction');
    });

    it('should trim whitespace', async () => {
      const result = await repository.findGenre('  literary-fiction  ');
      expect(result).toBeDefined();
      expect(result?.slug).toBe('literary-fiction');
    });

    it('should return undefined for non-existent genre', async () => {
      const result = await repository.findGenre('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should handle empty string', async () => {
      const result = await repository.findGenre('');
      expect(result).toBeUndefined();
    });
  });

  describe('Page Size Key Generation', () => {
    it('should use format label when available', () => {
      const pageSize: PageSize = {
        format: 'Trade Paperback',
        width_inches: 6,
        height_inches: 9,
        common: true
      };

      const key = repository.getPageSizeKey(pageSize);
      expect(key).toBe('Trade Paperback');
    });

    it('should use dimensions when format is missing', () => {
      const pageSize: PageSize = {
        width_inches: 5.5,
        height_inches: 8.5,
        common: true
      };

      const key = repository.getPageSizeKey(pageSize);
      expect(key).toBe('5.5x8.5');
    });

    it('should use dimensions when format is empty string', () => {
      const pageSize: PageSize = {
        format: '',
        width_inches: 6,
        height_inches: 9,
        common: true
      };

      const key = repository.getPageSizeKey(pageSize);
      expect(key).toBe('6x9');
    });

    it('should use dimensions when format is whitespace', () => {
      const pageSize: PageSize = {
        format: '   ',
        width_inches: 5.06,
        height_inches: 7.81,
        common: false
      };

      const key = repository.getPageSizeKey(pageSize);
      expect(key).toBe('5.06x7.81');
    });

    it('should handle decimal dimensions', () => {
      const pageSize: PageSize = {
        width_inches: 5.5,
        height_inches: 8.25,
        common: false
      };

      const key = repository.getPageSizeKey(pageSize);
      expect(key).toBe('5.5x8.25');
    });
  });

  describe('Caching', () => {
    it('should cache loaded data and not re-read file', async () => {
      await repository.load();
      await repository.load();
      await repository.getGenres();

      // File should only be read once
      expect(readFileMock).toHaveBeenCalledTimes(1);
    });

    it('should use cached data for subsequent operations', async () => {
      await repository.findGenre('literary-fiction');
      await repository.getGenres();
      await repository.getManuscriptFormat();

      // File should only be read once despite multiple operations
      expect(readFileMock).toHaveBeenCalledTimes(1);
    });
  });
});
