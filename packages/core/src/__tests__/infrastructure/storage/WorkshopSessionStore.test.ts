import * as path from 'path';
import {
  WorkshopNamedSessionNotFoundError,
  WorkshopSessionFileReadError,
  WorkshopSessionStore,
  WorkshopSessionStoreUnavailableError
} from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopPersistedSessionV1 } from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { FileStat, FileSystem, FileType, LogSink, Workspace } from '@/platform';

class MemoryFileSystem implements FileSystem {
  readonly files = new Map<string, Uint8Array>();
  readonly renameCalls: Array<{ fromPath: string; toPath: string; overwrite: boolean }> = [];
  readDirectoryCalls = 0;

  async readFile(filePath: string): Promise<Uint8Array> {
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
    const bytes = await this.readFile(filePath);
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

const workspace = (folders: string[]): Workspace => ({
  workspaceFolders: () => folders.map((folder, index) => ({ path: folder, name: `workspace-${index + 1}` })),
  extensionPath: '/extension',
  asRelativePath: (value) => value,
  findFiles: async () => []
});

const session = (
  sessionId: string,
  title: string,
  overrides: Partial<WorkshopPersistedSessionV1> = {}
): WorkshopPersistedSessionV1 => {
  const workshop = new WorkshopSessionService(() => Date.parse('2026-07-23T10:00:00.000Z'));
  workshop.setExcerpt({
    text: 'The silver anemone opened at dawn.',
    source: { kind: 'manual' }
  });
  workshop.beginPersonaMessage('request-1', 'Find the silver anemone in this passage.');
  workshop.completeRun(
    'request-1',
    'The silver anemone is a strong recurring image.',
    undefined,
    false,
    'runtime-host'
  );
  const temporal = new WorkshopSessionTimeService({
    now: () => new Date('2026-07-23T09:00:00.000Z'),
    timezone: 'America/Chicago'
  });
  temporal.touch(new Date('2026-07-23T10:00:00.000Z'));
  return {
    schemaVersion: 1,
    sessionId,
    title,
    createdAt: '2026-07-23T09:00:00.000Z',
    updatedAt: '2026-07-23T10:00:00.000Z',
    temporal: temporal.exportState(),
    summary: {
      hostPersonaId: 'jill',
      participantPersonaIds: ['jill', 'margot'],
      turnCount: 2,
      excerptWordCount: 120,
      excerptLabel: 'Chapter 5',
      excerptIdentity: 'drafts/chapter-5.md',
      preview: 'A useful preview.'
    },
    workshop: workshop.exportCommittedState(),
    conversations: [],
    ...overrides
  };
};

describe('WorkshopSessionStore', () => {
  const root = '/workspace/novel';
  const sessionsDirectory = path.join(root, 'prose-minion', 'sessions');
  let fileSystem: MemoryFileSystem;
  let logLines: string[];
  let clock: Date;

  const createStore = (folders = [root], limits?: ConstructorParameters<typeof WorkshopSessionStore>[4]) => {
    const log: LogSink = {
      appendLine: (line) => logLines.push(line),
      show: () => undefined,
      clear: () => undefined
    };
    return new WorkshopSessionStore(fileSystem, workspace(folders), log, () => clock, limits);
  };

  beforeEach(() => {
    fileSystem = new MemoryFileSystem();
    logLines = [];
    clock = new Date('2026-07-23T10:20:30.000Z');
  });

  it('makes persistence unavailable rather than guessing a workspace root', async () => {
    expect(createStore([]).availability()).toEqual({ available: false, reason: 'no-workspace' });
    expect(createStore(['/one', '/two']).availability()).toEqual({ available: false, reason: 'multi-root' });

    await expect(createStore([]).writeCurrent(session('current-1', 'Current')))
      .rejects.toEqual(expect.objectContaining<Partial<WorkshopSessionStoreUnavailableError>>({ reason: 'no-workspace' }));
  });

  it('writes and reads current through a temporary file and native overwrite rename', async () => {
    const store = createStore();
    const current = session('current-1', 'Current room');

    await store.writeCurrent(current);

    expect(fileSystem.renameCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        toPath: path.join(sessionsDirectory, 'current.json'),
        overwrite: true
      }),
      expect.objectContaining({
        toPath: path.join(sessionsDirectory, 'current.summary.json'),
        overwrite: true
      })
    ]));
    await expect(store.readCurrent()).resolves.toEqual(current);
  });

  it('returns undefined only when current.json is genuinely missing', async () => {
    const store = createStore();

    await expect(store.readCurrent()).resolves.toBeUndefined();

    fileSystem.setJson(path.join(sessionsDirectory, 'current.json'), { schemaVersion: 1 });
    await expect(store.readCurrent()).rejects.toEqual(
      expect.objectContaining<Partial<WorkshopSessionFileReadError>>({
        fileName: 'current.json'
      })
    );
  });

  it('reads exact snapshots and discovers current/named sidecars beyond the browser byte bound', async () => {
    const limits = {
      maximumFiles: 200,
      maximumFileBytes: 1_000,
      maximumSearchCharacters: 250_000,
      maximumNameCollisions: 100
    };
    const store = createStore([root], limits);
    const largeCurrent = session('large-current', 'Large current', {
      summary: {
        ...session('summary-source', 'Summary').summary,
        preview: 'x'.repeat(2_000)
      }
    });
    const largeNamed = session('large-named', 'Large named', {
      summary: {
        ...session('summary-source-2', 'Summary').summary,
        preview: 'y'.repeat(2_000)
      }
    });

    await store.writeCurrent(largeCurrent);
    await store.saveNamed(largeNamed);

    await expect(store.readCurrent()).resolves.toMatchObject({ sessionId: 'large-current' });
    await expect(store.readNamed('large-named')).resolves.toMatchObject({ sessionId: 'large-named' });
    await expect(store.list()).resolves.toMatchObject({
      current: { sessionId: 'large-current' },
      sessions: [{ sessionId: 'large-named' }],
      truncated: false,
      searchTruncated: false
    });
    expect(logLines).toEqual([]);
  });

  it('creates collision-safe timestamped filenames for named checkpoints', async () => {
    const store = createStore();

    const first = await store.saveNamed(session('named-1', 'Pentecost — auditorium beat'));
    const second = await store.saveNamed(session('named-2', 'Pentecost — auditorium beat'));

    expect(first.fileName).toBe('20260723-102030-pentecost-auditorium-beat.json');
    expect(second.fileName).toBe('20260723-102030-pentecost-auditorium-beat-2.json');
    expect([...fileSystem.files.keys()]).toEqual(expect.arrayContaining([
      path.join(sessionsDirectory, first.fileName),
      path.join(sessionsDirectory, second.fileName)
    ]));
  });

  it('lists named files newest first and performs bounded case-insensitive content search', async () => {
    const store = createStore();
    await store.saveNamed(session('older', 'Older', { updatedAt: '2026-07-22T10:00:00.000Z' }));
    await store.saveNamed(session('newer', 'Newer', { updatedAt: '2026-07-23T11:00:00.000Z' }));
    await store.writeCurrent(session('current', 'Current'));

    await expect(store.list()).resolves.toMatchObject({
      current: { sessionId: 'current', fileName: 'current.json' },
      sessions: [{ sessionId: 'newer' }, { sessionId: 'older' }],
      truncated: false
    });
    await expect(store.list('SILVER ANEMONE')).resolves.toMatchObject({
      sessions: [{ sessionId: 'newer' }, { sessionId: 'older' }]
    });
  });

  it('skips malformed and unknown-version files while preserving healthy browser results', async () => {
    const store = createStore();
    await store.saveNamed(session('healthy', 'Healthy'));
    fileSystem.setJson(path.join(sessionsDirectory, 'broken.json'), { nope: true });
    fileSystem.setJson(path.join(sessionsDirectory, 'future.json'), { schemaVersion: 2 });

    await expect(store.list()).resolves.toMatchObject({ sessions: [{ sessionId: 'healthy' }] });
    expect(logLines).toEqual(expect.arrayContaining([
      expect.stringContaining('Skipped broken.json'),
      expect.stringContaining('Skipped future.json')
    ]));
  });

  it('does not let unrelated malformed files hide a healthy exact named match', async () => {
    const store = createStore();
    await store.saveNamed(session('healthy', 'Healthy'));
    fileSystem.setJson(path.join(sessionsDirectory, 'broken.json'), { nope: true });

    await expect(store.readNamed('healthy')).resolves.toMatchObject({ sessionId: 'healthy' });
    await expect(store.readNamed('absent')).rejects.toBeInstanceOf(WorkshopSessionFileReadError);
  });

  it('renames title metadata without moving the immutable named file or changing its id', async () => {
    const store = createStore();
    const saved = await store.saveNamed(session('rename-me', 'Before'));
    const beforePath = await store.resolveRevealPath('rename-me');

    const renamed = await store.renameNamed('rename-me', 'After');

    expect(renamed).toMatchObject({ sessionId: 'rename-me', title: 'After', fileName: saved.fileName });
    await expect(store.resolveRevealPath('rename-me')).resolves.toBe(beforePath);
    await expect(store.readNamed('rename-me')).resolves.toMatchObject({ title: 'After' });
  });

  it('updates a named checkpoint in place without duplicating its file or identity', async () => {
    const store = createStore();
    const saved = await store.saveNamed(session('living-room', 'Before'));
    const beforePath = await store.resolveRevealPath('living-room');
    fileSystem.readDirectoryCalls = 0;
    const updatedSnapshot = session('living-room', 'After', {
      updatedAt: '2026-07-23T11:00:00.000Z',
      savedAt: '2026-07-23T11:00:00.000Z',
      summary: {
        ...session('summary', 'Summary').summary,
        turnCount: 18,
        preview: 'The conversation kept moving.'
      }
    });

    const updated = await store.updateNamed('living-room', updatedSnapshot);

    expect(updated).toMatchObject({
      sessionId: 'living-room',
      title: 'After',
      fileName: saved.fileName,
      turnCount: 18
    });
    await expect(store.resolveRevealPath('living-room')).resolves.toBe(beforePath);
    await expect(store.list()).resolves.toMatchObject({
      sessions: [expect.objectContaining({ sessionId: 'living-room', title: 'After' })]
    });
    // The live-room path was established by Save; updating it must not parse
    // every other full checkpoint on every autosave.
    expect(fileSystem.readDirectoryCalls).toBe(1);
    expect([...fileSystem.files.keys()].filter((filePath) =>
      filePath.endsWith('.json') && !filePath.endsWith('.summary.json')
    )).toHaveLength(1);
  });

  it('rejects an update whose snapshot identity does not match the target', async () => {
    const store = createStore();
    await store.saveNamed(session('target', 'Target'));

    await expect(store.updateNamed('target', session('intruder', 'Intruder')))
      .rejects.toThrow('identity does not match');
    await expect(store.readNamed('target')).resolves.toMatchObject({ title: 'Target' });
  });

  it('keeps current.json outside all named-session mutations', async () => {
    const store = createStore();
    await store.writeCurrent(session('only-current', 'Current'));

    await expect(store.readNamed('only-current')).resolves.toBeUndefined();
    await expect(store.deleteNamed('only-current')).rejects.toBeInstanceOf(WorkshopNamedSessionNotFoundError);
    await expect(store.readCurrent()).resolves.toMatchObject({ sessionId: 'only-current' });
  });

  it('reports browser truncation at the configured file bound without scanning past it', async () => {
    const store = createStore([root], {
      maximumFiles: 1,
      maximumFileBytes: 5 * 1024 * 1024,
      maximumSearchCharacters: 250_000,
      maximumNameCollisions: 100
    });
    await store.saveNamed(session('first', 'First'));
    await store.saveNamed(session('second', 'Second'));

    await expect(store.list()).resolves.toMatchObject({
      sessions: [{ sessionId: 'second' }],
      truncated: true
    });
  });

  it('keeps an oversized named checkpoint discoverable and manageable through its sidecar', async () => {
    const store = createStore([root], {
      maximumFiles: 200,
      maximumFileBytes: 1_000,
      maximumSearchCharacters: 250_000,
      maximumNameCollisions: 100
    });
    const large = session('long-room', 'Long room', {
      summary: {
        ...session('summary-source', 'Summary').summary,
        preview: 'x'.repeat(2_000)
      }
    });
    const saved = await store.saveNamed(large);

    await expect(store.list()).resolves.toMatchObject({
      sessions: [{ sessionId: 'long-room', title: 'Long room' }]
    });
    await expect(store.resolveRevealPath('long-room')).resolves.toBe(
      path.join(sessionsDirectory, saved.fileName)
    );

    await store.renameNamed('long-room', 'Long room renamed');
    await expect(store.readNamed('long-room')).resolves.toMatchObject({ title: 'Long room renamed' });
    const copy = await store.duplicateNamed('long-room', session('long-room-copy', 'Long room copy'));
    expect(copy.sessionId).toBe('long-room-copy');

    await store.deleteNamed('long-room');
    expect(fileSystem.files.has(path.join(sessionsDirectory, saved.fileName))).toBe(false);
    expect(fileSystem.files.has(path.join(
      sessionsDirectory,
      saved.fileName.replace(/\.json$/, '.summary.json')
    ))).toBe(false);
  });

  it('tolerates orphan/corrupt sidecars and falls back to bounded legacy full snapshots', async () => {
    const store = createStore();
    const saved = await store.saveNamed(session('healthy', 'Healthy'));
    const sidecarPath = path.join(
      sessionsDirectory,
      saved.fileName.replace(/\.json$/, '.summary.json')
    );
    fileSystem.setJson(sidecarPath, { schemaVersion: 1, unexpected: true });
    fileSystem.setJson(path.join(sessionsDirectory, 'orphan.summary.json'), {
      schemaVersion: 1,
      sessionId: 'orphan'
    });
    fileSystem.setJson(path.join(sessionsDirectory, '20260723-101500-legacy.json'), session('legacy', 'Legacy'));

    await expect(store.list()).resolves.toMatchObject({
      sessions: expect.arrayContaining([
        expect.objectContaining({ sessionId: 'healthy' }),
        expect.objectContaining({ sessionId: 'legacy' })
      ])
    });
    expect(logLines).toEqual(expect.arrayContaining([
      expect.stringContaining(saved.fileName.replace(/\.json$/, '.summary.json'))
    ]));
  });

  it('reports content-search limits while still returning sidecar metadata matches', async () => {
    const store = createStore([root], {
      maximumFiles: 200,
      maximumFileBytes: 5 * 1024 * 1024,
      maximumSearchCharacters: 10,
      maximumNameCollisions: 100
    });
    await store.saveNamed(session('search-limit', 'Searchable title'));

    await expect(store.list('searchable title')).resolves.toMatchObject({
      sessions: [{ sessionId: 'search-limit' }],
      searchTruncated: false
    });
    await expect(store.list('not-present-in-summary')).resolves.toMatchObject({
      sessions: [],
      searchTruncated: true
    });
  });

  it('ignores sidecars during identity scans, tolerates unrelated malformed files on save, and fails closed on duplicate full ids', async () => {
    const store = createStore();
    fileSystem.setJson(path.join(sessionsDirectory, 'broken.json'), { not: 'a session' });
    // A copied sidecar-looking filename is not a named authoritative snapshot.
    fileSystem.setJson(
      path.join(sessionsDirectory, 'copied.summary.json'),
      session('sidecar-only', 'Must not reserve identity')
    );

    await expect(store.saveNamed(session('sidecar-only', 'Fresh save')))
      .resolves.toMatchObject({ sessionId: 'sidecar-only' });

    fileSystem.setJson(path.join(sessionsDirectory, '20260723-090000-dup-a.json'), session('duplicate-id', 'A'));
    fileSystem.setJson(path.join(sessionsDirectory, '20260723-090001-dup-b.json'), session('duplicate-id', 'B'));

    await expect(store.readNamed('duplicate-id')).rejects.toEqual(
      expect.objectContaining({ name: 'WorkshopNamedSessionIdentityConflictError' })
    );
    await expect(store.renameNamed('duplicate-id', 'Nope')).rejects.toEqual(
      expect.objectContaining({ name: 'WorkshopNamedSessionIdentityConflictError' })
    );
  });
});
