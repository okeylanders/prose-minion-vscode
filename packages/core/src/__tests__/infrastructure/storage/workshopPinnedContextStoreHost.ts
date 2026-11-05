/**
 * A window's WorkshopPinnedContextStore over a memory file system, for the
 * store's tests (Workshop Pinned Context, Slice 1). Windows may share one
 * file system, each with its own store, staging ids and folders, so a test
 * can hold one window mid-write while another acts, or move a window to
 * another workspace. *Alice*, with made-up paths.
 */
import * as path from 'node:path';
import type { LogSink } from '@/platform';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import { deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';
import { encodeWorkshopPinnedContext } from '@/infrastructure/storage/WorkshopPinnedContextCodec';
import { WorkshopPinnedContextStore } from '@/infrastructure/storage/WorkshopPinnedContextStore';
import type { WorkshopPinnedContextList } from '@shared/types/workshopPinnedContext';

export const ROOT = '/workspace';
export const OTHER_ROOT = '/other';
export const FOLDER = path.join(ROOT, 'prose-minion');
export const FILE = path.join(FOLDER, 'pinned-context.json');
export const OTHER_FILE = path.join(OTHER_ROOT, 'prose-minion', 'pinned-context.json');
/** When claims are taken. */
export const NOW = Date.parse('2026-11-05T09:30:00Z');

export const list = (...paths: string[]): WorkshopPinnedContextList => ({ files: paths.map((entryPath) => ({ path: entryPath })) });
export const bytesOf = (value: WorkshopPinnedContextList) => new TextEncoder().encode(encodeWorkshopPinnedContext(value));
export const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);
/** Append `entryPath` to the list as it reads. */
export const pin = (entryPath: string) => (current: WorkshopPinnedContextList) => ({ files: [...current.files, { path: entryPath }] });

interface HostOptions {
  fileSystem?: MemoryFileSystem;
  /** The prefix of this window's staging and claim ids. */
  prefix?: string;
  /** This window's workspace folders, changed in place by a test. */
  folders?: Array<{ path: string; name: string }>;
  clock?: { at: number };
  platform?: 'windows' | 'posix';
}

export function pinnedHost(options: HostOptions = {}) {
  const fileSystem = options.fileSystem ?? new MemoryFileSystem();
  const folders = options.folders ?? [{ path: ROOT, name: 'workspace' }];
  const clock = options.clock ?? { at: NOW };
  const lines: string[] = [];
  const log = { appendLine: (line: string) => { lines.push(line); }, show: jest.fn(), clear: jest.fn() } as unknown as LogSink;
  const prefix = options.prefix ?? 's';
  let staged = 0;
  const store = new WorkshopPinnedContextStore(fileSystem, createFakeWorkspace({ workspaceFolders: () => folders }), log, {
    platform: options.platform ?? 'posix',
    mintStagingId: () => `${prefix}${++staged}`,
    claimNow: () => new Date(clock.at)
  });
  return { fileSystem, store, log, lines, folders, clock };
}

/** The renames a write made of the list and its claims: the lock directory's own renames left out. */
export const listRenames = (fileSystem: MemoryFileSystem) => fileSystem.renameCalls
  .filter((call) => ![call.fromPath, call.toPath].some((file) => /^\.pinned-context\.lock(?:$|\.)/.test(path.basename(file))));

/** Every file under `folder`, relative to it, sorted. */
export const everyFile = (fileSystem: MemoryFileSystem, folder = FOLDER) => [...fileSystem.files.keys()]
  .filter((file) => file.startsWith(`${folder}${path.sep}`))
  .map((file) => path.relative(folder, file))
  .sort();

/**
 * Hold the first file operation `matches` picks until the gate opens;
 * `reached` says it was reached. One hold per method at a time: a second
 * spy on the same method replaces the first.
 */
export function holdOnce<K extends 'rename' | 'writeFile' | 'readFile' | 'readDirectory' | 'delete'>(
  fileSystem: MemoryFileSystem,
  method: K,
  matches: (firstPath: string) => boolean
) {
  const gate = deferred<void>();
  const reached = deferred<void>();
  const original = (fileSystem[method] as (...args: unknown[]) => Promise<unknown>).bind(fileSystem);
  let held = false;
  jest.spyOn(fileSystem, method).mockImplementation((async (...args: unknown[]) => {
    if (!held && matches(args[0] as string)) {
      held = true;
      reached.resolve();
      await gate.promise;
    }
    return original(...args);
  }) as never);
  return { open: () => gate.resolve(), reached: reached.promise };
}
