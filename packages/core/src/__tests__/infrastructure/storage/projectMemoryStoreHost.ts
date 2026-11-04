/**
 * A window's ProjectMemoryStore over a memory file system, for the store's
 * tests (Workshop Project Memory, Slice 1). Windows may share one file
 * system, each with its own store, staging ids, memory ids and clock, so a
 * test can hold one window mid-write while another acts. *Alice*, with
 * made-up ids.
 */
import * as path from 'node:path';
import type { LogSink } from '@/platform';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import { ProjectMemoryStore, type ProjectMemoryDraft, type ProjectMemoryEntry } from '@/infrastructure/storage/ProjectMemoryStore';

export const ROOT = '/workspace';
export const MEMORY = path.join(ROOT, 'prose-minion', 'memory');
/** When the store saves, and takes its claims. */
export const NOW = '2026-11-04T09:30:00Z';

export const DRAFT: ProjectMemoryDraft = {
  title: 'The Rabbit\'s watch runs backward',
  kind: 'canon',
  summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
  status: 'active',
  pinned: false,
  origin: 'proposed',
  proposedBy: 'cliff',
  sourceSession: '6b0f3c9e-2c1d-4e8a-9a51-0d6f2b7c9e11',
  sourceTurns: ['turn-12-assistant-1730643725000'],
  supersedes: [],
  body: 'Settled at the tea party.'
};

interface HostOptions {
  fileSystem?: MemoryFileSystem;
  /** The prefix of this window's staging and claim ids. */
  prefix?: string;
  mintMemoryId?: () => string;
  clock?: { at: number };
}

/** A window's store over `fileSystem`; its clock reads `clock.at`; its memory ids are `7f3c2a`, then `1a9e04`, then counted, unless given. */
export function memoryHost(options: HostOptions = {}) {
  const fileSystem = options.fileSystem ?? new MemoryFileSystem();
  const clock = options.clock ?? { at: Date.parse(NOW) };
  const lines: string[] = [];
  const log = { appendLine: (line: string) => { lines.push(line); }, show: jest.fn(), clear: jest.fn() } as unknown as LogSink;
  const workspace = createFakeWorkspace({ workspaceFolders: () => [{ path: ROOT, name: 'workspace' }] });
  const prefix = options.prefix ?? 's';
  let staged = 0;
  let minted = 0;
  const ids = ['7f3c2a', '1a9e04'];
  const store = new ProjectMemoryStore(fileSystem, workspace, log, {
    now: () => new Date(clock.at),
    mintStagingId: () => `${prefix}${++staged}`,
    mintMemoryId: options.mintMemoryId ?? (() => ids.shift() ?? (++minted).toString(16).padStart(6, '0'))
  });
  return { fileSystem, store, log, lines, clock };
}

/** Create a memory from `DRAFT` with `changes`, and hand back its entry. */
export async function createdEntry(store: ProjectMemoryStore, changes: Partial<ProjectMemoryDraft> = {}): Promise<ProjectMemoryEntry> {
  const created = await store.create({ ...DRAFT, ...changes });
  if (created.kind !== 'created') {
    throw new Error(`expected a new memory, got ${created.kind}`);
  }
  return created.entry;
}

export const everyFile = (fileSystem: MemoryFileSystem) => [...fileSystem.files.keys()].map((file) => path.relative(MEMORY, file)).sort();
export const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);
/** A claim's path beside the memory file `fileName`, taken at `at` (epoch ms) by `id`. */
export const claimOf = (fileName: string, at: number, id: string) => path.join(MEMORY, `.${fileName}.claim-${at}-${id}`);
