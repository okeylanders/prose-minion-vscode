/**
 * ProseStatsService Tests
 *
 * Tests for prose statistics service including:
 * - Single file analysis
 * - Multi-file analysis (manuscript/chapters mode)
 * - Error handling for missing/invalid files
 */

import * as vscode from 'vscode';
import { ProseStatsService } from '@services/measurement/ProseStatsService';

// Mock vscode module
jest.mock('vscode');

describe('ProseStatsService', () => {
  let service: ProseStatsService;
  let mockOutputChannel: jest.Mocked<vscode.OutputChannel>;

  beforeEach(() => {
    // Create mock output channel
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      name: 'Test Channel',
      replace: jest.fn()
    } as any;

    service = new ProseStatsService(mockOutputChannel);
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
    // Mock workspace functions
    const mockWorkspaceFolders = [
      {
        uri: { fsPath: '/mock/workspace', path: '/mock/workspace' } as vscode.Uri,
        name: 'test-workspace',
        index: 0
      }
    ];

    beforeEach(() => {
      // Mock workspace.workspaceFolders
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: mockWorkspaceFolders,
        configurable: true
      });

      // Mock Uri.joinPath
      (vscode.Uri.joinPath as jest.Mock) = jest.fn((base, ...paths) => ({
        fsPath: `${base.fsPath}/${paths.join('/')}`,
        path: `${base.path}/${paths.join('/')}`
      } as vscode.Uri));
    });

    it('should analyze multiple files successfully', async () => {
      const relativePaths = ['chapter1.txt', 'chapter2.txt'];

      // Mock file reads
      const mockFileContent1 = Buffer.from('This is chapter one. It has two sentences.');
      const mockFileContent2 = Buffer.from('This is chapter two. It also has two sentences.');

      (vscode.workspace.fs.stat as jest.Mock) = jest.fn().mockResolvedValue({});
      (vscode.workspace.fs.readFile as jest.Mock) = jest.fn()
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

      (vscode.workspace.fs.stat as jest.Mock) = jest.fn().mockResolvedValue({});
      (vscode.workspace.fs.readFile as jest.Mock) = jest.fn().mockResolvedValue(mockFileContent);

      const results = await service.analyzeMultipleFiles(relativePaths);

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('path', 'chapter1.txt');
      expect(results[0]).toHaveProperty('stats');
      expect(results[0].stats).toHaveProperty('wordCount');
    });

    it('should handle missing files gracefully', async () => {
      const relativePaths = ['missing.txt', 'exists.txt'];
      const mockFileContent = Buffer.from('This file exists.');

      // First file: stat fails (file doesn't exist) - findUriByRelativePath returns undefined
      // Second file: stat succeeds, read succeeds
      (vscode.workspace.fs.stat as jest.Mock) = jest.fn()
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce({});

      (vscode.workspace.fs.readFile as jest.Mock) = jest.fn()
        .mockResolvedValue(mockFileContent);

      const results = await service.analyzeMultipleFiles(relativePaths);

      // Should only have result for the existing file
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('exists.txt');
      // Note: Missing files are silently skipped (no logging), only read errors are logged
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('should skip files that do not exist', async () => {
      const relativePaths = ['nonexistent1.txt', 'nonexistent2.txt'];

      // All files fail stat check (findUriByRelativePath returns undefined)
      (vscode.workspace.fs.stat as jest.Mock) = jest.fn()
        .mockRejectedValue(new Error('File not found'));

      const results = await service.analyzeMultipleFiles(relativePaths);

      expect(results).toHaveLength(0);
      // Note: Missing files are silently skipped (no logging)
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', async () => {
      const relativePaths = ['error.txt'];

      // Stat succeeds but read fails
      (vscode.workspace.fs.stat as jest.Mock) = jest.fn().mockResolvedValue({});
      (vscode.workspace.fs.readFile as jest.Mock) = jest.fn()
        .mockRejectedValue(new Error('Read permission denied'));

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
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: undefined,
        configurable: true
      });

      const relativePaths = ['chapter1.txt'];
      const results = await service.analyzeMultipleFiles(relativePaths);

      expect(results).toHaveLength(0);
    });
  });
});
