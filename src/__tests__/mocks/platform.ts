/**
 * In-memory test doubles for the platform ports (ADR 2026-06-16).
 *
 * Used where a unit under test takes an injected port but the test does not
 * exercise the host integration. Grows as later waves add FileSystem/Workspace/
 * ShellService/EditorContext fakes.
 */
import { FileStat, FileSystem, FileType, SettingsStore, Workspace } from '@/platform';

/**
 * A SettingsStore that serves `values` (keyed by "key" or "section.key") and
 * returns the caller's default for anything unseeded — mirroring an unset config.
 */
export function createFakeSettings(values: Record<string, unknown> = {}): SettingsStore {
  const get = (<T>(section: string, key: string, defaultValue?: T): T | undefined => {
    if (key in values) {
      return values[key] as T;
    }
    const full = `${section}.${key}`;
    if (full in values) {
      return values[full] as T;
    }
    return defaultValue;
  });
  return {
    get: get as SettingsStore['get'],
    update: async () => undefined,
  };
}

/**
 * A FileSystem returning empty results by default; override any method (commonly
 * `readFile`) to feed fixture bytes.
 */
export function createFakeFileSystem(overrides: Partial<FileSystem> = {}): FileSystem {
  const emptyStat: FileStat = { type: FileType.File, ctime: 0, mtime: 0, size: 0 };
  return {
    readFile: async () => new Uint8Array(),
    writeFile: async () => undefined,
    readDirectory: async () => [],
    stat: async () => emptyStat,
    createDirectory: async () => undefined,
    ...overrides,
  };
}

/**
 * A Workspace with no folders and an `/ext` extension path by default; override
 * `workspaceFolders`/`findFiles` to simulate a project.
 */
export function createFakeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    workspaceFolders: () => [],
    extensionPath: '/ext',
    asRelativePath: (p: string) => p,
    findFiles: async () => [],
    ...overrides,
  };
}
