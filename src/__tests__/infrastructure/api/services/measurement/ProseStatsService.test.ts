/**
 * ProseStatsService Tests
 *
 * Tests for prose statistics service including:
 * - Single file analysis
 * - Multi-file analysis (manuscript/chapters mode)
 * - Error handling for missing/invalid files
 */

import { ProseStatsService } from '@services/measurement/ProseStatsService';
import { createFakeFileSystem, createFakeWorkspace } from '../../../../mocks/platform';

describe('ProseStatsService', () => {
  let service: ProseStatsService;
  let mockOutputChannel: { appendLine: jest.Mock; [k: string]: unknown };
  let mockReadFile: jest.Mock;
  let mockStat: jest.Mock;
  let fakeWorkspaceFolders: Array<{ path: string; name: string }>;

  beforeEach(() => {
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      name: 'Test Channel',
      replace: jest.fn()
    };

    mockReadFile = jest.fn();
    mockStat = jest.fn();
    fakeWorkspaceFolders = [{ path: '/mock/workspace', name: 'test-workspace' }];

    service = new ProseStatsService(
      createFakeFileSystem({ readFile: mockReadFile, stat: mockStat }),
      createFakeWorkspace({ workspaceFolders: () => fakeWorkspaceFolders }),
      mockOutputChannel as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyze', () => {
    it('should analyze single text and return prose stats', () => {
      const input = { text: 'This is a test. It has two sentences.' };
      const result = service.analyze(input);

      expect(result).toBeDefined();
      expect(result.wordCount).toBe(8);
      expect(result.sentenceCount).toBe(2);
    });

    it('should handle empty text', () => {
      const input = { text: '' };
      const result = service.analyze(input);

      expect(result).toBeDefined();
      expect(result.wordCount).toBe(0);
    });
  });

  describe('analyzeMultipleFiles', () => {
    it('should analyze multiple files successfully', async () => {
      const relativePaths = ['chapter1.txt', 'chapter2.txt'];

      const mockFileContent1 = Buffer.from('This is chapter one. It has two sentences.');
      const mockFileContent2 = Buffer.from('This is chapter two. It also has two sentences.');

      mockStat.mockResolvedValue(undefined);
      mockReadFile
        .mockResolvedValueOnce(mockFileContent1)
        .mockResolvedValueOnce(mockFileContent2);

      const results = await service.analyzeMultipleFiles(relativePaths);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        path: 'chapter1.txt',
        stats: expect.objectContaining({
          wordCount: expect.any(Number),
          sentenceCount: expect.any(Number)
        })
      });
      expect(results[1]).toEqual({
        path: 'chapter2.txt',
        stats: expect.objectContaining({
          wordCount: expect.any(Number),
          sentenceCount: expect.any(Number)
        })
      });
    });

    it('should return array of { path, stats } objects', async () => {
      const relativePaths = ['chapter1.txt'];
      const mockFileContent = Buffer.from('Test content.');

      mockStat.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(mockFileContent);

      const results = await service.analyzeMultipleFiles(relativePaths);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('path', 'chapter1.txt');
      expect(results[0]).toHaveProperty('stats');
      expect(results[0].stats).toHaveProperty('wordCount');
    });

    it('should handle missing files gracefully', async () => {
      const relativePaths = ['missing.txt', 'exists.txt'];
      const mockFileContent = Buffer.from('This file exists.');

      // First file: stat rejects (missing) → resolver returns undefined → skipped.
      // Second file: stat resolves, read succeeds.
      mockStat
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(undefined);
      mockReadFile.mockResolvedValue(mockFileContent);

      const results = await service.analyzeMultipleFiles(relativePaths);

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('exists.txt');
      // Missing files are silently skipped (no logging); only read errors are logged.
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('should skip files that do not exist', async () => {
      const relativePaths = ['nonexistent1.txt', 'nonexistent2.txt'];

      mockStat.mockRejectedValue(new Error('File not found'));

      const results = await service.analyzeMultipleFiles(relativePaths);

      expect(results).toHaveLength(0);
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', async () => {
      const relativePaths = ['error.txt'];

      mockStat.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error('Read permission denied'));

      const results = await service.analyzeMultipleFiles(relativePaths);

      expect(results).toHaveLength(0);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[ProseStatsService] Per-file stats failed for error.txt')
      );
    });

    it('should work with empty array of paths', async () => {
      const results = await service.analyzeMultipleFiles([]);

      expect(results).toHaveLength(0);
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('should handle no workspace folders', async () => {
      fakeWorkspaceFolders = [];

      const relativePaths = ['chapter1.txt'];
      const results = await service.analyzeMultipleFiles(relativePaths);

      expect(results).toHaveLength(0);
    });
  });
});
