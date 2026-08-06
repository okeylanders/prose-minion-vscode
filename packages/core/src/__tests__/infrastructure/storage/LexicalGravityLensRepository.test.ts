import * as path from 'path';
import {
  LexicalGravityLensRepository,
  LexicalGravityLibraryUnavailableError
} from '@/infrastructure/storage/LexicalGravityLensRepository';
import {
  builtInLexicalGravityLens
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import { FileStat, FileSystem, FileType, Workspace } from '@/platform';

class MemoryFileSystem implements FileSystem {
  readonly files = new Map<string, Uint8Array>();
  readonly renames: Array<{ from: string; to: string; overwrite?: boolean }> = [];
  failRenameTo?: string;

  async readFile(filePath: string): Promise<Uint8Array> {
    const data = this.files.get(filePath);
    if (!data) {throw new Error(`ENOENT: ${filePath}`);}
    return new Uint8Array(data);
  }

  async writeFile(filePath: string, data: Uint8Array): Promise<void> {
    this.files.set(filePath, new Uint8Array(data));
  }

  async rename(from: string, to: string, options?: { overwrite?: boolean }): Promise<void> {
    if (to === this.failRenameTo) {throw new Error(`EIO: ${to}`);}
    const data = this.files.get(from);
    if (!data) {throw new Error(`ENOENT: ${from}`);}
    this.files.set(to, data);
    this.files.delete(from);
    this.renames.push({ from, to, overwrite: options?.overwrite });
  }

  async delete(filePath: string): Promise<void> {
    this.files.delete(filePath);
  }

  async readDirectory(directoryPath: string): Promise<Array<[string, FileType]>> {
    const entries = [...this.files.keys()]
      .filter((filePath) => path.dirname(filePath) === directoryPath)
      .map((filePath) => [path.basename(filePath), FileType.File] as [string, FileType]);
    if (entries.length === 0) {throw new Error(`ENOENT: ${directoryPath}`);}
    return entries;
  }

  async stat(filePath: string): Promise<FileStat> {
    const data = this.files.get(filePath);
    if (!data) {throw new Error(`ENOENT: ${filePath}`);}
    return { type: FileType.File, ctime: 0, mtime: 0, size: data.byteLength };
  }

  async createDirectory(): Promise<void> {}
}

const workspace = (folders: string[]): Workspace => ({
  workspaceFolders: () => folders.map((folder) => ({ path: folder, name: path.basename(folder) })),
  extensionPath: '/extension',
  asRelativePath: (value) => value,
  findFiles: async () => []
});

describe('LexicalGravityLensRepository', () => {
  const root = '/workspace/novel';
  const directory = path.join(root, 'prose-minion', 'lenses');
  let fileSystem: MemoryFileSystem;
  let appendLine: jest.Mock;

  beforeEach(() => {
    fileSystem = new MemoryFileSystem();
    appendLine = jest.fn();
  });

  const repository = (folders = [root]) => new LexicalGravityLensRepository(
    fileSystem,
    workspace(folders),
    { appendLine } as never
  );

  it('requires one unambiguous project root', () => {
    expect(() => repository([]).availability()).toThrow(
      expect.objectContaining<Partial<LexicalGravityLibraryUnavailableError>>({
        reason: 'no-workspace'
      })
    );
    expect(() => repository(['/one', '/two']).availability()).toThrow(
      expect.objectContaining<Partial<LexicalGravityLibraryUnavailableError>>({
        reason: 'multi-root'
      })
    );
  });

  it('atomically stages selected project lenses with distinct reusable slugs', async () => {
    const store = repository();
    const source = builtInLexicalGravityLens('photography')!;
    const saved = await store.saveManyForQuery(
      '  Radio Astronomy  ',
      [
        { ...source, name: 'Radio Astronomy', variant: 'Signal' },
        { ...source, name: 'Radio Astronomy', variant: 'Deep Field' },
        { ...source, name: 'Radio Astronomy', variant: 'Interference' }
      ]
    );
    const destinations = [
      path.join(directory, 'radio-astronomy.json'),
      path.join(directory, 'radio-astronomy-deep-field.json'),
      path.join(directory, 'radio-astronomy-interference.json')
    ];

    expect(saved.map(({ slug }) => slug)).toEqual([
      'radio-astronomy',
      'radio-astronomy-deep-field',
      'radio-astronomy-interference'
    ]);
    expect(saved).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Radio Astronomy',
        source: 'project',
        originQuery: 'Radio Astronomy'
      })
    ]));
    expect(fileSystem.renames.map(({ to, overwrite }) => ({ to, overwrite }))).toEqual(
      destinations.map((to) => ({ to, overwrite: false }))
    );
    await expect(store.findForQuery('radio astronomy')).resolves.toEqual(saved[0]);
    await expect(store.list()).resolves.toEqual(expect.arrayContaining(saved));
  });

  it('requires at least one generated lens in a save batch', async () => {
    await expect(repository().saveManyForQuery('falconry', [])).rejects.toThrow(
      'Choose 1–3 generated lenses to save'
    );
  });

  it('bounds composed subject and variant slugs without leaving a trailing separator', async () => {
    const source = builtInLexicalGravityLens('photography')!;
    const saved = await repository().saveManyForQuery(
      `${'very-long-subject-'.repeat(8)}tail-`,
      [
        { ...source, variant: `${'long-variant-'.repeat(8)}first-` },
        { ...source, variant: `${'long-variant-'.repeat(8)}second-` }
      ]
    );

    expect(saved).toHaveLength(2);
    for (const lens of saved) {
      expect(lens.slug.length).toBeLessThanOrEqual(64);
      expect(lens.slug).not.toMatch(/-$/);
    }
    expect(new Set(saved.map(({ slug }) => slug)).size).toBe(2);
  });

  it('stamps project provenance on read and rejects a filename/slug mismatch', async () => {
    const source = builtInLexicalGravityLens('photography')!;
    fileSystem.files.set(
      path.join(directory, 'photography.json'),
      new TextEncoder().encode(JSON.stringify({ ...source, source: 'built-in' }))
    );
    fileSystem.files.set(
      path.join(directory, 'wrong-name.json'),
      new TextEncoder().encode(JSON.stringify({ ...source, source: 'project' }))
    );

    await expect(repository().findForQuery('photography')).resolves.toEqual(
      expect.objectContaining({ slug: 'photography', source: 'project' })
    );
    await expect(repository().list()).resolves.toEqual([
      expect.objectContaining({ slug: 'photography', source: 'project' })
    ]);
    expect(appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'declared slug photography does not match filename wrong-name'
    ));
  });

  it('rolls back the batch when publishing any selected lens fails', async () => {
    const store = repository();
    const source = builtInLexicalGravityLens('photography')!;
    const destinations = [
      path.join(directory, 'falconry.json'),
      path.join(directory, 'falconry-the-mews.json')
    ];
    fileSystem.failRenameTo = destinations[1];

    await expect(store.saveManyForQuery('falconry', [
      { ...source, variant: 'The hunt' },
      { ...source, variant: 'The mews' }
    ])).rejects.toThrow('EIO');

    expect(destinations.every((destination) => !fileSystem.files.has(destination))).toBe(true);
    expect([...fileSystem.files.keys()].filter((filePath) => filePath.endsWith('.tmp'))).toEqual([]);
  });

  it('tolerates unrelated corrupt files in the catalog but refuses to regenerate over an exact corrupt lens', async () => {
    const store = repository();
    fileSystem.files.set(
      path.join(directory, 'broken.json'),
      new TextEncoder().encode('{not json')
    );

    await expect(store.list()).resolves.toEqual([]);
    expect(appendLine).toHaveBeenCalledWith(expect.stringContaining('Skipped broken.json'));
    await expect(store.findForQuery('broken')).rejects.toThrow(
      'Saved Lexical Gravity lens broken.json is invalid'
    );
  });
});
