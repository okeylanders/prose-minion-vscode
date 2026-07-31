import * as path from 'path';
import {
  LexicalGravityLensRepository,
  LexicalGravityLibraryUnavailableError
} from '@/infrastructure/storage/LexicalGravityLensRepository';
import {
  builtInLexicalGravityLens
} from '@/application/services/workshop/lexicalGravity/LexicalGravityLenses';
import { FileStat, FileSystem, FileType, Workspace } from '@/platform';

class MemoryFileSystem implements FileSystem {
  readonly files = new Map<string, Uint8Array>();
  readonly renames: Array<{ from: string; to: string; overwrite?: boolean }> = [];

  async readFile(filePath: string): Promise<Uint8Array> {
    const data = this.files.get(filePath);
    if (!data) {throw new Error(`ENOENT: ${filePath}`);}
    return new Uint8Array(data);
  }

  async writeFile(filePath: string, data: Uint8Array): Promise<void> {
    this.files.set(filePath, new Uint8Array(data));
  }

  async rename(from: string, to: string, options?: { overwrite?: boolean }): Promise<void> {
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

  it('atomically saves the chosen project lens and finds it without regeneration', async () => {
    const store = repository();
    const saved = await store.saveForQuery(
      '  Radio Astronomy  ',
      { ...builtInLexicalGravityLens('photography')!, name: 'Radio Astronomy' }
    );
    const destination = path.join(directory, 'radio-astronomy.json');

    expect(saved).toEqual(expect.objectContaining({
      slug: 'radio-astronomy',
      name: 'Radio Astronomy',
      source: 'project'
    }));
    expect(fileSystem.renames).toEqual([
      expect.objectContaining({ to: destination, overwrite: true })
    ]);
    await expect(store.findForQuery('radio astronomy')).resolves.toEqual(saved);
    await expect(store.list()).resolves.toEqual([saved]);
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
