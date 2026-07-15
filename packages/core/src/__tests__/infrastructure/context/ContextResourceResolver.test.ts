import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { FileStat, FileType, LogSink } from '@/platform';
import {
  createFakeFileSystem,
  createFakeSettings,
  createFakeWorkspace
} from '../../mocks/platform';

const stat = (type: FileType, size = 0): FileStat => ({ type, size, ctime: 0, mtime: 0 });

describe('ContextResourceResolver configured-resource boundary', () => {
  it('indexes and reads only contained, non-symlink configured files', async () => {
    const files: Record<string, string> = {
      '/ws/characters/raven.md': 'Raven is cautious.',
      '/private/secret.md': 'Never expose this.',
      '/ws/linked/secret.md': 'Also never expose this.'
    };
    const fileSystem = createFakeFileSystem({
      stat: async (filePath: string) => {
        if (filePath === '/ws/characters') return stat(FileType.Directory);
        if (filePath === '/ws/characters/raven.md') return stat(FileType.File, files[filePath].length);
        if (filePath === '/ws/linked') return stat(FileType.SymbolicLink);
        if (filePath === '/ws/linked/secret.md') return stat(FileType.File, files[filePath].length);
        if (filePath === '/private' || filePath === '/private/secret.md') return stat(FileType.File);
        throw new Error('missing');
      }
    }, files);
    const log = { appendLine: jest.fn() } as unknown as LogSink;
    const resolver = new ContextResourceResolver(
      createFakeSettings({ 'contextPaths.characters': 'characters/**/*.md' }),
      fileSystem,
      createFakeWorkspace({
        workspaceFolders: () => [{ path: '/ws', name: 'novel' }],
        findFiles: async () => [
          '/ws/characters/raven.md',
          '/ws/characters/../../private/secret.md',
          '/private/secret.md',
          '/ws/linked/secret.md'
        ]
      }),
      log
    );

    const provider = await resolver.createProvider(['characters']);
    expect(provider.listResources()).toEqual([{
      group: 'characters',
      path: 'characters/raven.md',
      label: 'Raven',
      workspaceFolder: 'novel'
    }]);
    await expect(provider.loadResources(['characters/raven.md'])).resolves.toEqual([{
      group: 'characters',
      path: 'characters/raven.md',
      label: 'Raven',
      workspaceFolder: 'novel',
      content: 'Raven is cautious.'
    }]);
    expect(log.appendLine).toHaveBeenCalledWith(expect.stringContaining('outside its workspace root'));
    expect(log.appendLine).toHaveBeenCalledWith(expect.stringContaining('Skipped symbolic-link resource'));
  });

  it('never turns an absolute, traversal, or unknown requested key into a filesystem read', async () => {
    const readFile = jest.fn().mockResolvedValue(new TextEncoder().encode('safe'));
    const resolver = new ContextResourceResolver(
      createFakeSettings({ 'contextPaths.general': 'notes/*.md' }),
      createFakeFileSystem({
        readFile,
        stat: async (filePath: string) => filePath === '/ws/notes'
          ? stat(FileType.Directory)
          : stat(FileType.File)
      }),
      createFakeWorkspace({
        workspaceFolders: () => [{ path: '/ws', name: 'novel' }],
        findFiles: async () => ['/ws/notes/safe.md']
      })
    );
    const provider = await resolver.createProvider(['general']);

    await expect(provider.loadResources([
      '/etc/passwd',
      '../.env',
      'file:///private/secret',
      'notes/unknown.md'
    ])).resolves.toEqual([]);
    expect(readFile).not.toHaveBeenCalled();
  });
});
