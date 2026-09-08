import * as path from 'path';
import { FileStat, FileSystem, FileType } from '@/platform';

export class MemoryFileSystem implements FileSystem {
  readonly files = new Map<string, Uint8Array>();
  readonly renameCalls: Array<{ fromPath: string; toPath: string; overwrite: boolean }> = [];
  readonly readFileCalls: string[] = [];
  readDirectoryCalls = 0;
  failRenameToPath?: string;

  async readFile(filePath: string): Promise<Uint8Array> {
    this.readFileCalls.push(filePath);
    const value = this.files.get(filePath);
    if (!value) {
      throw new Error(`ENOENT: ${filePath}`);
    }
    return new Uint8Array(value);
  }

  async writeFile(filePath: string, data: Uint8Array): Promise<void> {
    this.files.set(filePath, new Uint8Array(data));
  }

  async rename(fromPath: string, toPath: string, options?: { overwrite?: boolean }): Promise<void> {
    if (toPath === this.failRenameToPath) {
      throw new Error(`EIO: ${toPath}`);
    }
    const source = this.files.get(fromPath);
    if (!source) {
      throw new Error(`ENOENT: ${fromPath}`);
    }
    const overwrite = options?.overwrite ?? false;
    if (this.files.has(toPath) && !overwrite) {
      throw new Error(`EEXIST: ${toPath}`);
    }
    this.renameCalls.push({ fromPath, toPath, overwrite });
    this.files.set(toPath, source);
    this.files.delete(fromPath);
  }

  async delete(filePath: string): Promise<void> {
    if (!this.files.delete(filePath)) {
      throw new Error(`ENOENT: ${filePath}`);
    }
  }

  async readDirectory(directoryPath: string): Promise<Array<[string, FileType]>> {
    this.readDirectoryCalls += 1;
    const entries = [...this.files.keys()]
      .filter((filePath) => path.dirname(filePath) === directoryPath)
      .map((filePath) => [path.basename(filePath), FileType.File] as [string, FileType]);
    if (entries.length === 0 && ![...this.files.keys()].some((filePath) => filePath.startsWith(`${directoryPath}${path.sep}`))) {
      throw new Error(`ENOENT: ${directoryPath}`);
    }
    return entries;
  }

  async stat(filePath: string): Promise<FileStat> {
    const bytes = this.files.get(filePath);
    if (!bytes) {
      throw new Error(`ENOENT: ${filePath}`);
    }
    return { type: FileType.File, ctime: 0, mtime: 0, size: bytes.byteLength };
  }

  async createDirectory(): Promise<void> {}

  setJson(filePath: string, value: unknown): void {
    this.files.set(filePath, new TextEncoder().encode(JSON.stringify(value)));
  }

  json(filePath: string): unknown {
    const bytes = this.files.get(filePath);
    if (!bytes) {
      throw new Error(`Missing test file ${filePath}`);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }
}
