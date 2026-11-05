/**
 * The resolver's every-candidate read (ADR 2026-11-05 D4.1, PR #226 F-02,
 * F-03): every root, group and relative path a file matches is kept, under
 * the catalog's containment and symbolic-link checks, while the catalog
 * itself still keeps the first root. *Alice*.
 */
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { FileStat, FileType, LogSink } from '@/platform';
import { createFakeFileSystem, createFakeSettings, createFakeWorkspace } from '../../mocks/platform';

const stat = (type: FileType, size = 0): FileStat => ({ type, size, ctime: 0, mtime: 0 });

describe('ContextResourceResolver.listCandidates', () => {
  it('keeps equal paths in two roots, nested-root aliases and overlapping groups, and drops what the catalog drops', async () => {
    const resolver = new ContextResourceResolver(
      createFakeSettings(Object.fromEntries([['contextPaths.chapters', 'chapters/*.md'], ['contextPaths.general', '**/*.md']])),
      createFakeFileSystem({
        stat: async (filePath: string) => {
          if (filePath.includes('/linked')) {
            return stat(FileType.SymbolicLink);
          }
          return stat(filePath.endsWith('.md') ? FileType.File : FileType.Directory, 10);
        }
      }),
      createFakeWorkspace({
        workspaceFolders: () => [{ path: '/one', name: 'one' }, { path: '/two', name: 'two' }, { path: '/one/book', name: 'book' }],
        findFiles: async (folder: string, glob: string) => {
          const files = new Map([
            ['/one', ['/one/chapters/alice.md', '/one/book/chapters/rabbit.md', '/one/linked/x.md', '/elsewhere/y.md']],
            ['/two', ['/two/chapters/alice.md']],
            ['/one/book', ['/one/book/chapters/rabbit.md']]
          ]);
          return (files.get(folder) ?? []).filter((file) => glob.startsWith('chapters') ? file.startsWith(`${folder}/chapters/`) : true);
        }
      }),
      { appendLine: jest.fn() } as unknown as LogSink
    );

    const candidates = await resolver.listCandidates(['chapters', 'general']);
    const keys = candidates.map((each) => `${each.group}:${each.workspaceFolderPath}:${each.relativePath}`);
    expect(keys).toEqual([
      'chapters:/one:chapters/alice.md',
      'chapters:/two:chapters/alice.md',
      'chapters:/one/book:chapters/rabbit.md',
      'general:/one:chapters/alice.md',
      'general:/one:book/chapters/rabbit.md',
      'general:/two:chapters/alice.md',
      'general:/one/book:chapters/rabbit.md'
    ]);
    // The catalog still keeps one row per relative path, first root first.
    const catalog = (await resolver.createProvider(['chapters'])).listResources();
    expect(catalog.map((each) => each.absolutePath)).toEqual(['/one/chapters/alice.md', '/one/book/chapters/rabbit.md']);
  });
});
