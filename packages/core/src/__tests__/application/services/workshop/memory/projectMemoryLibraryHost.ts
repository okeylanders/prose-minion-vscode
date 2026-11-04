/**
 * A project-memory library over a real ProjectMemoryStore on the memory file
 * system (Workshop Project Memory, Slice 2a): memory files written as a
 * writer would leave them, the mode setting, the coordinator's scope and
 * recall's positions as stubs a test can move. *Alice*, with made-up ids.
 */
import * as path from 'node:path';
import type { LogSink, SettingsStore } from '@/platform';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import { ProjectMemoryStore } from '@/infrastructure/storage/ProjectMemoryStore';
import { encodeProjectMemory } from '@/infrastructure/storage/ProjectMemoryCodec';
import { projectMemoryBody, type ProjectMemory } from '@shared/types/projectMemory';
import { ProjectMemoryLibrary, type ProjectMemoryPositionsPort } from '@/application/services/workshop/memory/ProjectMemoryLibrary';
import type { WorkshopRecallScope } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type { WorkshopRecallPositions } from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import type { WorkshopProjectMemoryMode } from '@messages';

export const ROOT = '/workspace';
export const MEMORY = path.join(ROOT, 'prose-minion', 'memory');
export const LIVE_SESSION = 'live-room-0001';
export const SOURCE_SESSION = '6b0f3c9e-2c1d-4e8a-9a51-0d6f2b7c9e11';

/** A memory as its file holds it, from `changes` over the Rabbit's watch. */
export function memory(changes: Partial<ProjectMemory> = {}): ProjectMemory {
  return {
    id: 'mem-7f3c2a',
    title: 'The Rabbit\'s watch runs backward',
    kind: 'canon',
    summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
    status: 'active',
    pinned: false,
    created: '2026-11-01T10:00:00Z',
    updated: '2026-11-03T14:22:05Z',
    origin: 'proposed',
    proposedBy: 'cliff',
    sourceSession: SOURCE_SESSION,
    sourceTurns: ['turn-12-assistant-1730643725000', 'turn-15-assistant-1730643925000'],
    supersedes: [],
    body: projectMemoryBody('Settled at the tea party. The Hatter says it has always been six o\'clock.'),
    ...changes
  };
}

/** A writer's own memory, with no provenance. */
export function writerMemory(changes: Partial<ProjectMemory> = {}): ProjectMemory {
  return memory({ origin: 'writer', proposedBy: undefined, sourceSession: undefined, sourceTurns: [], ...changes });
}

export interface LibraryHostOptions {
  mode?: WorkshopProjectMemoryMode | unknown;
  folders?: Array<{ path: string; name: string }>;
  scope?: WorkshopRecallScope;
  positions?: (sessionId: string, turnIds: readonly string[]) => WorkshopRecallPositions;
  now?: string;
  /** Another window's file system, to share its folder (Slice 3's two-window test). */
  fileSystem?: MemoryFileSystem;
}

export function libraryHost(options: LibraryHostOptions = {}) {
  const fileSystem = options.fileSystem ?? new MemoryFileSystem();
  const lines: string[] = [];
  const log = { appendLine: (line: string) => { lines.push(line); }, show: jest.fn(), clear: jest.fn() } as unknown as LogSink;
  const state = {
    mode: options.mode === undefined ? 'ask' : options.mode,
    folders: options.folders ?? [{ path: ROOT, name: 'workspace' }],
    scope: options.scope ?? ({ available: true, liveSessionId: LIVE_SESSION } as WorkshopRecallScope)
  };
  const workspace = createFakeWorkspace({ workspaceFolders: () => state.folders });
  const store = new ProjectMemoryStore(fileSystem, workspace, log, { now: () => new Date('2026-11-04T09:30:00Z') });
  const settings: SettingsStore = {
    get: ((section: string, key: string) =>
      section === 'proseMinion' && key === 'workshop.projectMemory' ? state.mode : undefined) as SettingsStore['get'],
    update: jest.fn(async () => undefined)
  };
  const positionsOf = jest.fn(async (sessionId: string, turnIds: readonly string[]): Promise<WorkshopRecallPositions> =>
    options.positions?.(sessionId, turnIds) ?? { kind: 'positions', sessionId, title: 'Chapter 3 tea party', positions: [38, 41] });
  const recall: ProjectMemoryPositionsPort = { positionsOf };
  const library = new ProjectMemoryLibrary(store, { recallScope: () => state.scope }, recall, settings, log, {
    now: () => new Date(options.now ?? '2026-11-04T09:30:00Z')
  });
  const put = (value: ProjectMemory, fileName = `${value.id.slice(4)}-note.md`): string => {
    const file = path.join(MEMORY, fileName);
    fileSystem.files.set(file, new TextEncoder().encode(encodeProjectMemory(value)));
    return file;
  };
  const putText = (fileName: string, text: string): void => {
    fileSystem.files.set(path.join(MEMORY, fileName), new TextEncoder().encode(text));
  };
  return { fileSystem, store, library, settings, state, lines, log, positionsOf, put, putText };
}

/** Every log line the host wrote, joined: what a sentinel must never appear in. */
export const allLines = (lines: readonly string[]): string => lines.join('\n');
