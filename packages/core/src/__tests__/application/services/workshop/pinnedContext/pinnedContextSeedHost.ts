/**
 * Pinned context's library and room seed over a memory file system, for
 * Slice 2b's tests: the real store, the real intake service (over a catalog
 * that reads the same files), the real library and the real seed. Only the
 * file system, the workspace and the coordinator's scope are stand-ins.
 * *Alice*, with made-up paths and text.
 */
import * as path from 'node:path';
import { FileType, type FileStat, type LogSink, type Workspace } from '@/platform';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { WorkshopPinnedContextStore } from '@/infrastructure/storage/WorkshopPinnedContextStore';
import { encodeWorkshopPinnedContext } from '@/infrastructure/storage/WorkshopPinnedContextCodec';
import { WorkshopPinnedContextLibrary } from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextLibrary';
import { WorkshopPinnedContextRoomSeed } from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextRoomSeed';
import type { WorkshopSessionRecallScope } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { ContextPathGroup } from '@shared/types/context';
import type { WorkshopPinnedContextPathPlatform } from '@shared/types/workshopPinnedContext';

export const ROOT = '/workspace/novel';
export const LIST_FILE = path.join(ROOT, 'prose-minion', 'pinned-context.json');
/** Another project's folder, for the workspace-change tests. */
export const OTHER_ROOT = '/workspace/other';

/** Words of made-up prose, `count` of them. */
export const words = (count: number, word = 'rabbit'): string => Array.from({ length: count }, () => word).join(' ');

/** A memory file system that also answers a `stat` of a folder holding files, as a real one does. */
export class FolderFileSystem extends MemoryFileSystem {
  override async stat(filePath: string): Promise<FileStat> {
    if (this.files.has(filePath)) {
      return super.stat(filePath);
    }
    const prefix = filePath.endsWith(path.sep) ? filePath : `${filePath}${path.sep}`;
    if ([...this.files.keys()].some((file) => file.startsWith(prefix))) {
      return { type: FileType.Directory, ctime: 0, mtime: 0, size: 0 };
    }
    return super.stat(filePath);
  }
}

export interface SeedHostOptions {
  fileSystem?: MemoryFileSystem;
  /** Workspace-relative paths the catalog lists, with their groups. */
  catalog?: Array<{ group: ContextPathGroup; path: string }>;
  /** The workspace's folders, changed in place by a test. */
  folders?: Array<{ path: string; name: string }>;
  platform?: WorkshopPinnedContextPathPlatform;
  /** The coordinator's accepted workspace, as `recallScope()` reads it. */
  scope?: () => WorkshopSessionRecallScope;
}

export function seedHost(options: SeedHostOptions = {}) {
  const fileSystem = options.fileSystem ?? new FolderFileSystem();
  const folders = options.folders ?? [{ path: ROOT, name: 'novel' }];
  const catalog = options.catalog ?? [];
  const platform = options.platform ?? 'posix';
  const lines: string[] = [];
  const log: LogSink = { appendLine: (line: string) => { lines.push(line); }, show: jest.fn(), clear: jest.fn() };
  const workspace: Workspace = {
    workspaceFolders: () => folders,
    extensionPath: '/extension',
    asRelativePath: (value: string) => value.startsWith(`${ROOT}/`) ? value.slice(ROOT.length + 1) : value,
    findFiles: async () => []
  };
  // As the real provider does, a catalog lists the live folder's files when it
  // opens, and reads the absolute paths it listed then.
  const summariesUnder = (root: string): ContextResourceSummary[] => catalog
    .filter((entry) => fileSystem.files.has(path.join(root, entry.path)))
    .map((entry) => ({
      group: entry.group,
      path: entry.path,
      label: path.posix.basename(entry.path),
      sizeBytes: fileSystem.files.get(path.join(root, entry.path))!.byteLength,
      absolutePath: path.join(root, entry.path),
      workspaceFolder: root
    }));
  const providerFactory = {
    createProvider: jest.fn(async () => {
      const listed = summariesUnder(folders[0]?.path ?? ROOT);
      return {
        listResources: () => [...listed],
        loadResources: async (paths: string[]) => listed
          .filter((summary) => paths.includes(summary.path))
          .map((summary) => ({ ...summary, content: new TextDecoder().decode(fileSystem.files.get(summary.absolutePath)) }))
      };
    })
  };
  const intake = new WorkshopContextIntakeService(providerFactory as never, fileSystem, workspace);
  const store = new WorkshopPinnedContextStore(fileSystem, workspace, log, { platform });
  const scope = { current: options.scope ?? ((): WorkshopSessionRecallScope => ({ available: true, liveSessionId: 'room-1' })) };
  const library = new WorkshopPinnedContextLibrary(store, intake, fileSystem, () => scope.current(), log, { platform });
  const seed = new WorkshopPinnedContextRoomSeed(library, log, platform);

  const write = (relativePath: string, text: string, root = ROOT) => {
    fileSystem.files.set(path.join(root, relativePath), new TextEncoder().encode(text));
  };
  /** Put the window in another folder, or back. */
  const moveTo = (root: string) => {
    folders.splice(0, folders.length, { path: root, name: path.basename(root) });
  };
  const pinIn = (root: string, ...paths: string[]) => {
    fileSystem.files.set(
      path.join(root, 'prose-minion', 'pinned-context.json'),
      new TextEncoder().encode(encodeWorkshopPinnedContext({ files: paths.map((entryPath) => ({ path: entryPath })) }))
    );
  };
  const pin = (...paths: string[]) => pinIn(ROOT, ...paths);
  return { fileSystem, folders, catalog, providerFactory, intake, store, library, seed, scope, lines, log, write, pin, pinIn, moveTo };
}
