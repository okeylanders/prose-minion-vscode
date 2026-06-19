/**
 * TextSourceResolver Tests
 *
 * Focused behavior coverage for the platform-ported resolver (ADR 2026-06-16):
 * proves the FileSystem / Workspace / SettingsStore / EditorContext ports are
 * wired correctly on string paths. Seeds fixtures explicitly so the hardened
 * throwing FileSystem fake is exercised (an unseeded read would fail loud).
 */

import { TextSourceResolver } from '@/infrastructure/text/TextSourceResolver';
import {
  createFakeEditorContext,
  createFakeFileSystem,
  createFakeSettings,
  createFakeWorkspace,
} from '../../mocks/platform';
import { ActiveSelectionInfo } from '@/platform';

const selectionOf = (over: Partial<ActiveSelectionInfo> = {}): ActiveSelectionInfo => ({
  text: 'selected text',
  isEmpty: false,
  uriString: 'file:///ws/scene.md',
  fsPath: '/ws/scene.md',
  relativePath: 'scene.md',
  ...over,
});

describe('TextSourceResolver', () => {
  describe('selection mode', () => {
    it('returns the active selection text + relative path', async () => {
      const resolver = new TextSourceResolver(
        createFakeFileSystem(),
        createFakeWorkspace(),
        createFakeSettings(),
        createFakeEditorContext({ getActiveSelection: () => selectionOf() })
      );

      const result = await resolver.resolve({ mode: 'selection' });

      expect(result.text).toBe('selected text');
      expect(result.relativePaths).toEqual(['scene.md']);
      expect(result.displayPath).toBe('scene.md');
    });

    it('throws when there is no active editor', async () => {
      const resolver = new TextSourceResolver(
        createFakeFileSystem(),
        createFakeWorkspace(),
        createFakeSettings(),
        createFakeEditorContext({ getActiveSelection: () => undefined })
      );

      await expect(resolver.resolve({ mode: 'selection' })).rejects.toThrow(/No text selected/);
    });

    it('throws when an editor is open but the selection is empty', async () => {
      const resolver = new TextSourceResolver(
        createFakeFileSystem(),
        createFakeWorkspace(),
        createFakeSettings(),
        createFakeEditorContext({ getActiveSelection: () => selectionOf({ text: '', isEmpty: true }) })
      );

      await expect(resolver.resolve({ mode: 'selection' })).rejects.toThrow(/No text selected/);
    });
  });

  describe('activeFile mode', () => {
    it('reads an absolute path supplied as pathText', async () => {
      const resolver = new TextSourceResolver(
        createFakeFileSystem({}, { '/ws/chapter-1.md': 'Once upon a time.' }),
        createFakeWorkspace({
          workspaceFolders: () => [{ path: '/ws', name: 'ws' }],
          asRelativePath: (p: string) => p.replace('/ws/', ''),
        }),
        createFakeSettings(),
        createFakeEditorContext()
      );

      const result = await resolver.resolve({ mode: 'activeFile', pathText: '/ws/chapter-1.md' });

      expect(result.text).toBe('Once upon a time.');
      expect(result.relativePaths).toEqual(['chapter-1.md']);
    });

    it('falls back to the active editor file when no pathText is given', async () => {
      const resolver = new TextSourceResolver(
        createFakeFileSystem({}, { '/ws/scene.md': 'Editor file body.' }),
        createFakeWorkspace({ asRelativePath: (p: string) => p.replace('/ws/', '') }),
        createFakeSettings(),
        createFakeEditorContext({ getActiveSelection: () => selectionOf() })
      );

      const result = await resolver.resolve({ mode: 'activeFile' });

      expect(result.text).toBe('Editor file body.');
    });
  });

  describe('manuscript mode', () => {
    it('globs via settings, reads matches, and aggregates + dedupes them', async () => {
      const resolver = new TextSourceResolver(
        createFakeFileSystem({}, {
          '/ws/manuscript/a.md': 'Alpha.',
          '/ws/manuscript/b.md': 'Beta.',
        }),
        createFakeWorkspace({
          workspaceFolders: () => [{ path: '/ws', name: 'ws' }],
          asRelativePath: (p: string) => p.replace('/ws/', ''),
          // Return a duplicate to prove the dedupe path.
          findFiles: async () => [
            '/ws/manuscript/a.md',
            '/ws/manuscript/b.md',
            '/ws/manuscript/a.md',
          ],
        }),
        createFakeSettings({ 'contextPaths.manuscript': 'manuscript/*.md' }),
        createFakeEditorContext()
      );

      const result = await resolver.resolve({ mode: 'manuscript' });

      expect(result.text).toBe('Alpha.\n\nBeta.');
      expect(result.relativePaths).toEqual(['manuscript/a.md', 'manuscript/b.md']);
    });

    it('throws when no files match the patterns', async () => {
      const resolver = new TextSourceResolver(
        createFakeFileSystem(),
        createFakeWorkspace({
          workspaceFolders: () => [{ path: '/ws', name: 'ws' }],
          findFiles: async () => [],
        }),
        createFakeSettings({ 'contextPaths.manuscript': 'nope/*.md' }),
        createFakeEditorContext()
      );

      await expect(resolver.resolve({ mode: 'manuscript' })).rejects.toThrow(/No manuscript files matched/);
    });
  });

  describe('chapters mode', () => {
    // Structurally identical to manuscript, but reads a DIFFERENT settings key
    // (contextPaths.chapters) — a miswired key would otherwise slip through.
    it('globs via the chapters settings key, reads + aggregates the matches', async () => {
      const resolver = new TextSourceResolver(
        createFakeFileSystem({}, {
          '/ws/chapters/ch1.md': 'Chapter one.',
          '/ws/chapters/ch2.md': 'Chapter two.',
        }),
        createFakeWorkspace({
          workspaceFolders: () => [{ path: '/ws', name: 'ws' }],
          asRelativePath: (p: string) => p.replace('/ws/', ''),
          findFiles: async () => ['/ws/chapters/ch1.md', '/ws/chapters/ch2.md'],
        }),
        createFakeSettings({ 'contextPaths.chapters': 'chapters/*.md' }),
        createFakeEditorContext()
      );

      const result = await resolver.resolve({ mode: 'chapters' });

      expect(result.text).toBe('Chapter one.\n\nChapter two.');
      expect(result.relativePaths).toEqual(['chapters/ch1.md', 'chapters/ch2.md']);
    });

    it('throws when no chapter files match', async () => {
      const resolver = new TextSourceResolver(
        createFakeFileSystem(),
        createFakeWorkspace({
          workspaceFolders: () => [{ path: '/ws', name: 'ws' }],
          findFiles: async () => [],
        }),
        createFakeSettings({ 'contextPaths.chapters': 'nope/*.md' }),
        createFakeEditorContext()
      );

      await expect(resolver.resolve({ mode: 'chapters' })).rejects.toThrow(/No chapter files matched/);
    });
  });
});
