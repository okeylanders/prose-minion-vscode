/**
 * In-memory test doubles for the platform ports (ADR 2026-06-16).
 *
 * Used where a unit under test takes an injected port but the test does not
 * exercise the host integration. Grows as later waves add FileSystem/Workspace/
 * ShellService/EditorContext fakes.
 */
import {
  ActiveSelectionInfo,
  EditorContext,
  FileStat,
  FileSystem,
  FileType,
  SettingsStore,
  ShellService,
  Workspace,
} from '@/platform';

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
 * A FileSystem that mirrors the REAL port contract (ADR 2026-06-16): `stat` and
 * `readFile` THROW on a missing path. So by default — with nothing seeded —
 * every path is "missing": a test that reads a file it never set up fails loud
 * instead of silently passing on empty bytes (the FrameMinion `createMockFileSystem`
 * convention). Seed fixtures explicitly via `overrides` (`{ readFile, stat }`) or
 * the `files` map. `readDirectory` defaults to `[]` (an empty dir is a real state);
 * `writeFile`/`createDirectory` succeed.
 *
 * `files`: a path→bytes map; seeded paths resolve from `stat`/`readFile`, unseeded
 * paths still throw. Pass `string | Uint8Array` values.
 */
export function createFakeFileSystem(
  overrides: Partial<FileSystem> = {},
  files?: Record<string, string | Uint8Array>
): FileSystem {
  const toBytes = (v: string | Uint8Array): Uint8Array =>
    typeof v === 'string' ? new TextEncoder().encode(v) : v;
  const missing = (op: string, p: string): never => {
    throw new Error(`createFakeFileSystem: ${op} on unseeded path "${p}" (ENOENT)`);
  };
  return {
    readFile: async (p: string) => (files && p in files ? toBytes(files[p]) : missing('readFile', p)),
    writeFile: async () => undefined,
    rename: async () => undefined,
    delete: async () => undefined,
    readDirectory: async () => [],
    stat: async (p: string): Promise<FileStat> => {
      if (files && p in files) {
        return { type: FileType.File, ctime: 0, mtime: 0, size: toBytes(files[p]).length };
      }
      return missing('stat', p);
    },
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

/**
 * A ShellService whose notifications return undefined (dialog dismissed), whose
 * clipboard is empty, and whose file picker is dismissed by default; override
 * any method to assert/feed values.
 */
export function createFakeShellService(overrides: Partial<ShellService> = {}): ShellService {
  return {
    showInformationMessage: async () => undefined,
    showModalInformationMessage: async () => undefined,
    copyToClipboard: async () => undefined,
    readClipboard: async () => '',
    openFileInEditor: async () => undefined,
    revealFileInOS: async () => undefined,
    pickFile: async () => undefined,
    ...overrides,
  };
}

/**
 * An EditorContext with no active editor by default; override `getActiveSelection`
 * to simulate a selection or open file.
 */
export function createFakeEditorContext(overrides: Partial<EditorContext> = {}): EditorContext {
  return {
    getActiveSelection: (): ActiveSelectionInfo | undefined => undefined,
    ...overrides,
  };
}
