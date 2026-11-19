/**
 * A made-up *Alice* project for the context-path tests (ADR 2026-11-19
 * D20–D25): files under one or more roots, a settings store with levels, a
 * directory listing and `findFiles` over a small glob matcher. Searches can
 * be made to fail, and a match's metadata made unreadable, by glob.
 */
import * as path from 'path';
import { FileType, type FileStat, type FileSystem, type LogSink, type SettingsLevel, type SettingsStore, type Workspace } from '@/platform';
import { createFakeFileSystem, createFakeWorkspace } from '../../../mocks/platform';

/** `**`, `*` and `?`, as VS Code's glob reads them for these tests. */
export function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === '*' && glob[index + 1] === '*') {
      if (glob[index + 2] === '/') {
        source += '(?:.*/)?';
        index += 2;
      } else {
        source += '.*';
        index += 1;
      }
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

export interface AliceProjectOptions {
  /** Root path → files under it, relative, `/`-separated. */
  readonly roots: Readonly<Record<string, readonly string[]>>;
  /** Setting key (`contextPaths.characters`) → value. */
  readonly settings?: Record<string, string>;
  readonly levels?: Record<string, SettingsLevel>;
  /** Globs (as the resolver normalizes them) whose search throws. */
  readonly failingGlobs?: readonly string[];
  /** Relative paths whose stat throws once found. */
  readonly unreadable?: readonly string[];
  /** Relative directory paths that are symbolic links. */
  readonly links?: readonly string[];
}

export interface AliceProject {
  readonly settings: SettingsStore & { readonly values: Record<string, string>; readonly writes: Array<[string, unknown]> };
  readonly fileSystem: FileSystem;
  readonly workspace: Workspace;
  readonly lines: string[];
  readonly log: LogSink;
  readonly searches: string[];
}

export function aliceProject(options: AliceProjectOptions): AliceProject {
  const values: Record<string, string> = { ...(options.settings ?? {}) };
  const levels: Record<string, SettingsLevel> = { ...(options.levels ?? {}) };
  const writes: Array<[string, unknown]> = [];
  const settings = {
    values,
    writes,
    get: ((_section: string, key: string, fallback?: unknown) => (key in values ? values[key] : fallback)) as SettingsStore['get'],
    update: async (_section: string, key: string, value: unknown) => {
      writes.push([key, value]);
      values[key] = String(value);
      levels[key] = levels[key] === 'workspace' ? 'workspace' : 'user';
    },
    levelOf: (_section: string, key: string): SettingsLevel => levels[key] ?? (key in values ? 'user' : 'default')
  };
  const rootNames = Object.keys(options.roots);
  const absolute = (root: string, relative: string) => path.join(root, relative);
  const dirs = new Map<string, Map<string, FileType>>();
  const add = (directory: string, name: string, type: FileType) => {
    const entries = dirs.get(directory) ?? new Map<string, FileType>();
    if (!entries.has(name) || type === FileType.Directory) {
      entries.set(name, type);
    }
    dirs.set(directory, entries);
  };
  for (const root of rootNames) {
    dirs.set(root, dirs.get(root) ?? new Map());
    for (const file of options.roots[root]) {
      const parts = file.split('/');
      let current = root;
      parts.forEach((part, index) => {
        const relative = parts.slice(0, index + 1).join('/');
        const isLink = (options.links ?? []).includes(relative);
        const type = index === parts.length - 1 ? FileType.File : isLink ? FileType.Directory | FileType.SymbolicLink : FileType.Directory;
        add(current, part, type);
        current = path.join(current, part);
      });
    }
  }
  const relativeOf = (filePath: string) => {
    const root = rootNames.filter((candidate) => filePath === candidate || filePath.startsWith(`${candidate}/`)).sort((a, b) => b.length - a.length)[0];
    return root ? path.relative(root, filePath).replace(/\\/g, '/') : undefined;
  };
  const fileSystem = createFakeFileSystem({
    readDirectory: async (directory: string) => {
      const entries = dirs.get(directory);
      if (!entries) {
        throw new Error(`No directory ${directory}`);
      }
      return [...entries.entries()];
    },
    stat: async (filePath: string): Promise<FileStat> => {
      const relative = relativeOf(filePath) ?? '';
      if ((options.unreadable ?? []).includes(relative)) {
        throw new Error(`Unreadable ${filePath}`);
      }
      const isLink = (options.links ?? []).includes(relative);
      const isDir = dirs.has(filePath);
      return { type: isLink ? FileType.SymbolicLink | FileType.Directory : isDir ? FileType.Directory : FileType.File, size: 10, ctime: 0, mtime: 0 };
    }
  });
  const searches: string[] = [];
  const workspace = createFakeWorkspace({
    workspaceFolders: () => rootNames.map((root) => ({ path: root, name: path.basename(root) })),
    findFiles: async (folder: string, glob: string) => {
      searches.push(glob);
      if ((options.failingGlobs ?? []).includes(glob)) {
        throw new Error(`Search failed for ${glob}`);
      }
      const matcher = globToRegExp(glob);
      return (options.roots[folder] ?? [])
        .filter((file) => !/(^|\/)(node_modules|\.git|dist|out)\//.test(file))
        .filter((file) => matcher.test(file))
        .map((file) => absolute(folder, file));
    }
  });
  const lines: string[] = [];
  return { settings, fileSystem, workspace, lines, log: { appendLine: (line: string) => { lines.push(line); }, show: () => undefined, clear: () => undefined }, searches };
}

/** Every Alice-world name a log must never carry. */
export const ALICE_NAMES = ['Alice', 'Cast', 'Wonderland', 'Hatter', 'Queen', 'Rabbit', 'Chapters', 'Notes', 'People', '**'];
