/**
 * The resolver's listing for a search (ADR 2026-11-20 D3a): root-aware, a
 * file in every group whose own patterns match it, and a failed scan
 * refusing rather than returning fewer files. The browse catalog is
 * unchanged. *Alice*.
 */
import { ContextCandidateReadIncomplete, ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { distinctContextGroupFiles, hostFileIdentity } from '@/infrastructure/context/ContextGroupFiles';
import { FileStat, FileType, LogSink } from '@/platform';
import { createFakeFileSystem, createFakeSettings, createFakeWorkspace } from '../../mocks/platform';

const stat = (type: FileType, size = 0): FileStat => ({ type, size, ctime: 0, mtime: 0 });

const ROOTS = [{ path: '/one', name: 'one' }, { path: '/two', name: 'two' }];
const TREE = new Map([
  ['/one', ['/one/chapters/1.md', '/one/chapters/2.md', '/one/chapters/notes.docx', '/one/linked/3.md']],
  ['/two', ['/two/chapters/1.md']]
]);

function createResolver(options: { failing?: (folder: string, glob: string) => boolean; settings?: Record<string, string> } = {}) {
  const log = { appendLine: jest.fn() };
  const findFiles = jest.fn(async (folder: string, glob: string) => {
    if (options.failing?.(folder, glob)) {
      throw new Error(`search failed in ${folder}`);
    }
    return (TREE.get(folder) ?? []).filter((file) => {
      if (glob === 'chapters/1.md') {
        return file.endsWith('/chapters/1.md');
      }
      return glob.startsWith('chapters') ? file.startsWith(`${folder}/chapters/`) : true;
    });
  });
  const resolver = new ContextResourceResolver(
    createFakeSettings(options.settings ?? Object.fromEntries([
      ['contextPaths.chapters', 'chapters/*.md, chapters/1.md'],
      ['contextPaths.manuscript', '**/*.md']
    ])),
    createFakeFileSystem({
      stat: async (filePath: string) => {
        if (filePath.includes('/linked')) {
          return stat(FileType.SymbolicLink);
        }
        return stat(/\.[a-z]+$/.test(filePath) ? FileType.File : FileType.Directory, 10);
      }
    }),
    createFakeWorkspace({ workspaceFolders: () => ROOTS, findFiles }),
    log as unknown as LogSink
  );
  return { resolver, log, findFiles };
}

const rows = (files: ReadonlyArray<{ group: string; absolutePath: string }>): string[] => files.map((file) => `${file.group}:${file.absolutePath}`);

describe('ContextResourceResolver.listGroupFiles', () => {
  it('keeps the same relative path in two roots as two files', async () => {
    const files = await createResolver().resolver.listGroupFiles(['chapters']);
    expect(rows(files)).toEqual(['chapters:/one/chapters/1.md', 'chapters:/one/chapters/2.md', 'chapters:/two/chapters/1.md']);
    expect(files.filter((file) => file.relativePath === 'chapters/1.md').map((file) => file.workspaceFolderPath)).toEqual(['/one', '/two']);
  });

  it('puts a file in every group whose own patterns match it, once per group', async () => {
    const { resolver } = createResolver();
    const both = await resolver.listGroupFiles(['chapters', 'manuscript']);
    expect(rows(both)).toEqual([
      'chapters:/one/chapters/1.md',
      'chapters:/one/chapters/2.md',
      'chapters:/two/chapters/1.md',
      'manuscript:/one/chapters/1.md',
      'manuscript:/one/chapters/2.md',
      'manuscript:/two/chapters/1.md'
    ]);
    // Searched alone, the second group still holds the files the first also matched.
    expect(rows(await resolver.listGroupFiles(['manuscript']))).toEqual([
      'manuscript:/one/chapters/1.md',
      'manuscript:/one/chapters/2.md',
      'manuscript:/two/chapters/1.md'
    ]);
    // The browse catalog, unchanged, shows such a file under its first group only, and one root's.
    const catalog = (await resolver.createProvider(['chapters', 'manuscript'])).listResources();
    expect(catalog.map((each) => `${each.group}:${each.absolutePath}`)).toEqual(['chapters:/one/chapters/1.md', 'chapters:/one/chapters/2.md']);
  });

  it('admits only supported, contained, link-free files, as the catalog does', async () => {
    const files = await createResolver().resolver.listGroupFiles(['manuscript']);
    expect(files.some((file) => file.absolutePath.includes('linked') || file.absolutePath.endsWith('.docx'))).toBe(false);
  });

  it('refuses when one scan fails, never returning fewer files', async () => {
    const { resolver } = createResolver({ failing: (folder) => folder === '/two' });
    await expect(resolver.listGroupFiles(['chapters'])).rejects.toBeInstanceOf(ContextCandidateReadIncomplete);
    // The tolerant catalog still lists what it could.
    expect((await resolver.createProvider(['chapters'])).listResources()).toHaveLength(2);
  });

  it('logs counts only, never a path or a pattern', async () => {
    const { resolver, log } = createResolver();
    await resolver.listGroupFiles(['chapters']);
    const logged = log.appendLine.mock.calls.map(([line]) => String(line)).join('\n');
    expect(logged).not.toMatch(/chapters|\.md|\/one|\/two/);
  });
});

describe('ContextResourceResolver.listPatternFiles', () => {
  it('walks the given patterns as a context path is walked, in every root', async () => {
    const { resolver, findFiles } = createResolver({ settings: {} });
    const files = await resolver.listPatternFiles(['chapters/*.md']);
    expect(files.map((file) => file.absolutePath)).toEqual(['/one/chapters/1.md', '/one/chapters/2.md', '/two/chapters/1.md']);
    expect(findFiles).toHaveBeenCalledWith('/one', 'chapters/*.md', expect.stringContaining('node_modules'));
    expect(findFiles).toHaveBeenCalledWith('/two', 'chapters/*.md', expect.stringContaining('node_modules'));
  });

  it('refuses when a scan fails', async () => {
    const { resolver } = createResolver({ failing: () => true });
    await expect(resolver.listPatternFiles(['chapters/*.md'])).rejects.toBeInstanceOf(ContextCandidateReadIncomplete);
  });
});

describe('a host file\'s identity', () => {
  it('is the normalized absolute path, case-folded only where the platform\'s paths are', () => {
    expect(hostFileIdentity('/one/chapters/../chapters/1.md', 'linux')).toBe('/one/chapters/1.md');
    expect(hostFileIdentity('/one/Chapters/1.md', 'linux')).not.toBe(hostFileIdentity('/one/chapters/1.md', 'linux'));
    expect(hostFileIdentity('/one/Chapters/1.md', 'win32')).toBe(hostFileIdentity('/one/chapters/1.md', 'win32'));
  });

  it('makes a file two of a group\'s patterns match one file in that group', () => {
    const file = { group: 'chapters' as const, relativePath: 'chapters/1.md', workspaceFolderPath: '/one', absolutePath: '/one/chapters/1.md', sizeBytes: 10 };
    expect(distinctContextGroupFiles([file, { ...file }, { ...file, group: 'manuscript' }])).toEqual([file, { ...file, group: 'manuscript' }]);
  });
});
