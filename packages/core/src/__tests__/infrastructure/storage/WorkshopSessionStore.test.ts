import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import * as path from 'path';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { STORED_FILE_CLAIM_LEASE_MS } from '@/infrastructure/storage/StoredFileClaims';
import {
  WorkshopNamedSessionNotFoundError,
  WorkshopSessionFileReadError,
  WorkshopRollingCheckpointBusyError,
  WorkshopRollingCheckpointRecoveryRequiredError,
  WorkshopSessionStore,
  WorkshopSessionStoreUnavailableError
} from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopNamedSessionBusyError, WorkshopNamedSessionRecoveryRequiredError, WorkshopNamedSessionUnconfirmedError } from '@/infrastructure/storage/WorkshopNamedSessionLock';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { builtInLexicalGravityLens } from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import { FileSystem, FileType, LogSink, Workspace } from '@/platform';


const workspace = (folders: string[]): Workspace => ({
  workspaceFolders: () => folders.map((folder, index) => ({ path: folder, name: `workspace-${index + 1}` })),
  extensionPath: '/extension',
  asRelativePath: (value) => value,
  findFiles: async () => []
});

const session = (
  sessionId: string,
  title: string,
  overrides: Partial<WorkshopPersistedSessionV2> = {}
): WorkshopPersistedSessionV2 => {
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
    schemaVersion: 2,
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

  const roomId = '13345678-1234-4123-8123-123456789abc';
  const roomIdB = '23345678-1234-4123-8123-123456789abc';
  const rollingPath = (id: string) => path.join(sessionsDirectory, `current-${id}.json`);

  it('finds contentful index-less and legacy rooms, ignores startup metadata and never trusts a stale summary', async () => {
    const store = createStore();
    const room = new WorkshopSessionService();
    room.recordSessionMarker('start', 'Session started yesterday');
    const blank = session('untouched', 'Untitled session', { workshop: room.exportCommittedState() });
    fileSystem.setJson(rollingPath(roomId), blank);
    fileSystem.setJson(path.join(sessionsDirectory, 'current.json'), { ...blank, schemaVersion: 1 });
    const draft = session('draft', 'My room');
    fileSystem.setJson(rollingPath(roomIdB), { ...draft, savedAt: draft.updatedAt, schemaVersion: 1 });
    const rows = await store.listUnsavedRooms();
    expect(rows).toEqual([{ roomId: roomIdB, title: draft.title, updatedAt: draft.updatedAt,
      revision: expect.stringMatching(/^[a-f0-9]{64}$/), preview: draft.workshop.excerpt!.text }]);
    expect(await store.roomCheckpointStatus(roomId)).toMatchObject({ status: 'empty' });
    expect(fileSystem.files.has(rollingPath(roomId))).toBe(true);
  });

  it('compares named and rolling contents including later edits and checks the named copy again before pruning', async () => {
    const store = createStore();
    const draft = session('named-id', 'My named room');
    const named = await store.saveNamed({ ...draft, savedAt: draft.updatedAt });
    const namedFile = path.join(sessionsDirectory, named.fileName);
    await store.forRoom(roomId).writeCurrent(draft);
    const original = fileSystem.json(namedFile);
    const match = await store.roomCheckpointStatus(roomId);
    expect(match).toMatchObject({ status: 'saved' });
    expect(await store.listUnsavedRooms()).toEqual([]);

    const changed: WorkshopPersistedSessionV2 = JSON.parse(JSON.stringify(draft));
    changed.workshop.excerpt!.text += ' Another manuscript paragraph.';
    fileSystem.setJson(namedFile, changed);
    expect((await store.listUnsavedRooms()).map(row => row.roomId)).toEqual([roomId]);
    await expect(store.deleteUnsavedRoom(roomId, match!.revision, () => true, 'saved')).rejects.toThrow(/changed/);
    expect(fileSystem.json(rollingPath(roomId))).toMatchObject({ sessionId: 'named-id' });

    fileSystem.setJson(namedFile, original);
    await store.deleteUnsavedRoom(roomId, match!.revision, () => true, 'saved');
    expect(fileSystem.files.has(rollingPath(roomId))).toBe(false);
    expect(fileSystem.files.has(rollingPath(roomId).replace('.json', '.summary.json'))).toBe(false);
    expect(fileSystem.json(namedFile)).toEqual(original);
  });

  it('refuses stale confirmation after a same-identity and timestamp edit, a reattachment, or another slot or workspace', async () => {
    const firstHost = createStore();
    const draft = session('draft', 'Manuscript');
    const writer = firstHost.forRoom(roomId);
    await writer.writeCurrent(draft);
    const otherHost = createStore();
    const [first] = await otherHost.listUnsavedRooms();
    const changed: WorkshopPersistedSessionV2 = JSON.parse(JSON.stringify(draft));
    changed.workshop.excerpt!.text = 'A different manuscript with the same timestamp.';
    await writer.writeCurrent(changed);
    await expect(otherHost.deleteUnsavedRoom(roomId, first.revision, () => true)).rejects.toThrow(/changed/);
    const [current] = await otherHost.listUnsavedRooms();
    await expect(otherHost.deleteUnsavedRoom(roomId, current.revision, () => false)).rejects.toThrow(/changed/);
    await firstHost.forRoom(roomIdB).writeCurrent(changed);
    const elsewhere = createStore(['/somewhere/else']);
    await elsewhere.forRoom(roomId).writeCurrent(changed);
    for (const [store, slot] of [[firstHost, roomIdB], [elsewhere, roomId]] as const) {
      await expect(store.deleteUnsavedRoom(slot, current.revision, () => true)).rejects.toThrow(/changed/);
    }
    await expect(otherHost.deleteUnsavedRoom('legacy', current.revision, () => true)).rejects.toThrow(/protected/);
    await expect(otherHost.deleteUnsavedRoom('../shared', current.revision, () => true)).rejects.toThrow();
    await expect(otherHost.deleteUnsavedRoom(roomId, current.revision, () => true, 'empty')).rejects.toThrow(/changed/);
    expect(await writer.readCurrent()).toMatchObject({ workshop: { excerpt: { text: changed.workshop.excerpt!.text } } });
    const remove = jest.spyOn(fileSystem, 'delete');
    await otherHost.deleteUnsavedRoom(roomId, current.revision, () => true);
    expect(remove).toHaveBeenCalledWith(rollingPath(roomId), { useTrash: true });
    expect((await otherHost.listUnsavedRooms()).map(row => row.roomId)).toEqual([roomIdB]);
  });

  it('refuses a stale Delete once a named copy has appeared, and commits removal even if derived metadata cleanup fails', async () => {
    const store = createStore();
    const draft = session('became-named', 'Room');
    await store.forRoom(roomId).writeCurrent(draft);
    const [listed] = await store.listUnsavedRooms();
    await store.saveNamed(draft);
    await expect(store.deleteUnsavedRoom(roomId, listed.revision, () => true)).rejects.toThrow(/changed/);
    expect(fileSystem.files.has(rollingPath(roomId))).toBe(true);
    await store.deleteNamed(draft.sessionId);
    const metadata = rollingPath(roomId).replace('.json', '.summary.json');
    const original = fileSystem.delete.bind(fileSystem);
    jest.spyOn(fileSystem, 'delete').mockImplementation(async (file, options) => {
      if (file === metadata) { throw new Error('Sidecar is read only'); }
      return original(file, options);
    });
    await store.deleteUnsavedRoom(roomId, listed.revision, () => true);
    expect(await store.listUnsavedRooms()).toEqual([]);
    expect(fileSystem.files.has(metadata)).toBe(true);
    expect(logLines.some(line => line.includes('could not remove search index'))).toBe(true);
  });

  it('protects an unreadable checkpoint without hiding other content', async () => {
    const store = createStore();
    fileSystem.setJson(rollingPath(roomId), { schemaVersion: 77, manuscript: 'Unrecognized format' });
    await store.forRoom(roomIdB).writeCurrent(session('draft', 'Recognized second room'));
    const rows = await store.listUnsavedRooms();
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.roomId === roomId)?.revision).toBe('');
    await expect(store.roomCheckpointStatus(roomId)).rejects.toThrow();
    await expect(store.deleteUnsavedRoom(roomId, '', () => true)).rejects.toThrow(/protected/);
    expect(fileSystem.json(rollingPath(roomId))).toMatchObject({ manuscript: 'Unrecognized format' });
  });

  it('makes persistence unavailable rather than guessing a workspace root', async () => {
    expect(createStore([]).availability()).toEqual({ available: false, reason: 'no-workspace' });
    expect(createStore(['/one', '/two']).availability()).toEqual({ available: false, reason: 'multi-root' });

    await expect(createStore([]).writeCurrent(session('current-1', 'Current')))
      .rejects.toEqual(expect.objectContaining<Partial<WorkshopSessionStoreUnavailableError>>({ reason: 'no-workspace' }));
  });

  it.each(['legacy', roomId])('recovers an expired claim without taking the paused writer’s checkpoint in slot %s', async slot => {
    const directory = await fs.mkdtemp(path.join(tmpdir(), 'workshop-rolling-'));
    const typeOf = (entry: { isDirectory(): boolean }) => entry.isDirectory() ? FileType.Directory : FileType.File;
    const disk: FileSystem = {
      readFile: file => fs.readFile(file),
      writeFile: async (file, data) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, data); },
      createDirectory: async folder => { await fs.mkdir(folder, { recursive: true }); },
      readDirectory: async folder => (await fs.readdir(folder, { withFileTypes: true })).map(entry => [entry.name, typeOf(entry)]),
      stat: async file => { const stat = await fs.stat(file); return { type: typeOf(stat), size: stat.size, ctime: stat.ctimeMs, mtime: stat.mtimeMs }; },
      rename: async (from, to, options) => {
        if (!options?.overwrite && await fs.lstat(to).then(() => true, () => false)) {throw new Error('EEXIST');}
        await fs.rename(from, to);
      },
      delete: async (file, options) => {
        if (options?.recursive) {await fs.rm(file, { recursive: true });}
        else if ((await fs.stat(file)).isDirectory()) {await fs.rmdir(file);}
        else {await fs.unlink(file);}
      }
    };
    const freshHost = () => new WorkshopSessionStore(disk, workspace([directory]),
      { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() }, () => clock).forRoom(slot);
    const fileName = slot === 'legacy' ? 'current.json' : `current-${slot}.json`;
    const current = path.join(directory, 'prose-minion', 'sessions', fileName);
    const index = current.replace('.json', '.summary.json');
    let pause!: () => void;
    let resume!: () => void;
    const locked = new Promise<void>(resolve => { pause = resolve; });
    const unblock = new Promise<void>(resolve => { resume = resolve; });
    const original = freshHost();
    let pending: Promise<void> | undefined;
    try {
      await original.writeCurrent(session('original', 'Original checkpoint'));
      const observed = (await original.listUnsavedRooms()).find(row => row.roomId === slot);
      const prior = await fs.readFile(current);
      const priorIndex = await fs.readFile(index);
      pending = original.writeCurrent(session('original', 'Owner finished'), { beforeCommit: async () => { pause(); await unblock; } });
      await locked;
      const claimPath = path.join(path.dirname(current), `.${fileName}.lock`);
      const claimFiles = await fs.readdir(claimPath);
      const fresh = freshHost();
      const seen = await fresh.readCurrent();
      expect(seen?.title).toBe('Original checkpoint');
      await expect(fresh.writeCurrent(session('original', 'Racing edit'))).rejects.toBeInstanceOf(WorkshopRollingCheckpointBusyError);
      expect((await fresh.listRoomCheckpoints())[0].recoveryToken).toBeUndefined();
      await expect(fresh.recoverRollingRoom(slot, 'forged')).rejects.toBeInstanceOf(WorkshopRollingCheckpointBusyError);

      if (slot !== 'legacy') {
        expect(observed?.revision).toBeTruthy();
        expect((await fresh.listUnsavedRooms())[0].revision).toBe('');
        await expect(fresh.deleteUnsavedRoom(slot, observed!.revision, () => true)).rejects.toBeInstanceOf(WorkshopNamedSessionBusyError);
      }

      // A fresh host sees exactly what a crashed writer leaves. Expiry permits copying only.
      clock = new Date(clock.getTime() + STORED_FILE_CLAIM_LEASE_MS + 1);
      await expect(fresh.writeCurrent(session('original', 'New edit'))).rejects.toBeInstanceOf(WorkshopRollingCheckpointRecoveryRequiredError);
      const [blocked] = await fresh.listRoomCheckpoints();
      await expect(fresh.recoverRollingRoom(slot, 'old-claim')).rejects.toThrow(/changed/);
      if (slot !== 'legacy') {
        expect((await fresh.listUnsavedRooms())[0]).toMatchObject({ revision: '', recoveryToken: blocked.recoveryToken });
        await expect(fresh.deleteUnsavedRoom(slot, observed!.revision, () => true)).rejects.toBeInstanceOf(WorkshopNamedSessionRecoveryRequiredError);
      }
      await expect(fresh.recoverRollingRoom(slot, blocked.recoveryToken!, () => false)).rejects.toThrow();
      expect((await fresh.listRoomCheckpoints()).map(row => row.roomId)).toEqual([slot]);
      const copiedId = await fresh.recoverRollingRoom(slot, blocked.recoveryToken!);
      const recovered = freshHost().forRoom(copiedId);
      const copied = await recovered.readCurrent();
      expect(copied?.sessionId).not.toBe(seen?.sessionId);
      expect(copied?.workshop).toEqual(seen?.workshop);
      expect(copied?.conversations).toEqual(seen?.conversations);
      await recovered.writeCurrent({ ...copied!, title: 'Continued in the recovered room' });
      expect((await freshHost().forRoom(copiedId).readCurrent())?.title).toBe('Continued in the recovered room');
      expect(await fs.readFile(current)).toEqual(prior);
      expect(await fs.readFile(index)).toEqual(priorIndex);
      expect(await fs.readdir(claimPath)).toEqual(claimFiles);
      resume();
      await pending;
      expect((await freshHost().readCurrent())?.title).toBe('Owner finished');
    } finally {
      resume();
      await pending?.catch(() => {});
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('creates current through a temporary file without replacing an unseen checkpoint', async () => {
    const store = createStore();
    const current = session('current-1', 'Current room');

    await store.writeCurrent(current);

    expect(fileSystem.renameCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        toPath: path.join(sessionsDirectory, 'current.json'),
        overwrite: false
      }),
      expect.objectContaining({
        toPath: path.join(sessionsDirectory, 'current.summary.json'),
        overwrite: true
      })
    ]));
    const canonical = decodeWorkshopPersistedSessionCheckpoint(
      JSON.parse(JSON.stringify(current))
    ).session;
    expect(fileSystem.json(path.join(sessionsDirectory, 'current.json')))
      .toMatchObject({ schemaVersion: 2 });
    await expect(store.readCurrent()).resolves.toEqual(canonical);
  });

  it('runs a current.json commit check after the temporary write, and keeps the old file when it throws', async () => {
    const store = createStore();
    const currentPath = path.join(sessionsDirectory, 'current.json');
    await store.writeCurrent(session('current-1', 'Current room'));
    const before = fileSystem.files.get(currentPath);
    let staged: string[] = [];

    await expect(store.writeCurrent(session('current-2', 'Replacement'), {
      beforeCommit: async () => {
        staged = [...fileSystem.files.keys()].filter((file) => file.startsWith(`${currentPath}.tmp-`));
        throw new Error('source changed');
      }
    })).rejects.toThrow('source changed');

    // The check saw the staged snapshot; the rename never happened.
    expect(staged).toHaveLength(1);
    expect(fileSystem.files.get(currentPath)).toEqual(before);
    expect([...fileSystem.files.keys()].filter((file) => file.includes('.tmp-'))).toEqual([]);
  });

  it('returns codec-owned recovery evidence for an exact legacy widget checkpoint', async () => {
    const store = createStore();
    const checkpoint = session('legacy-current', 'Legacy current');
    const { logic: _logic, ...legacyLens } = builtInLexicalGravityLens('music')!;
    checkpoint.workshop.counters.widgetConfig = 1;
    checkpoint.workshop.widgetConfigs = [{
      id: 'wc-1',
      widgetId: 'lexical-gravity',
      revision: 1,
      createdAt: Date.parse(checkpoint.createdAt),
      draft: {
        lensSlug: 'music',
        weight: 40,
        reach: 2,
        metaphorPull: false,
        resolvedLens: { ...legacyLens, version: 1 }
      }
    } as never];
    fileSystem.files.set(
      path.join(sessionsDirectory, 'current.json'),
      new TextEncoder().encode(JSON.stringify(checkpoint))
    );

    const decoded = await store.readCurrentWithRecovery();

    expect(decoded?.normalizations).toEqual(expect.arrayContaining([
      'recovered-widget-lexical-gravity-v1',
      'defaulted-widget-lexical-gravity-evidence-mode'
    ]));
    expect(decoded?.recoveryNotices).toEqual([
      expect.objectContaining({ configId: 'wc-1', widgetId: 'lexical-gravity' })
    ]);
    expect(decoded?.session.workshop.widgetConfigs?.[0].draft).toMatchObject({
      applicationMode: 'lexical',
      evidenceMode: 'blend',
      resolvedLens: { version: 1 }
    });
  });

  it('creates a generated-files gitignore without overwriting workspace policy', async () => {
    const store = createStore();
    const gitignorePath = path.join(sessionsDirectory, '.gitignore');

    await store.writeCurrent(session('current-1', 'Current room'));

    expect(new TextDecoder().decode(fileSystem.files.get(gitignorePath))).toBe(
      '*\n!.gitignore\n'
    );

    const existingPolicy = new TextEncoder().encode('# writer-owned policy\n');
    fileSystem.files.clear();
    fileSystem.files.set(gitignorePath, existingPolicy);
    await createStore().writeCurrent(session('current-2', 'Another room'));

    expect(fileSystem.files.get(gitignorePath)).toEqual(existingPolicy);
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

  it('rejects exact reads above the Marketplace safety bound before loading file bytes', async () => {
    const currentPath = path.join(sessionsDirectory, 'current.json');
    const store = createStore([root], {
      maximumFiles: 200,
      maximumFileBytes: 100,
      maximumExactFileBytes: 1_000,
      maximumSearchCharacters: 250_000,
      maximumNameCollisions: 100
    });
    fileSystem.files.set(currentPath, new Uint8Array(1_001));

    await expect(store.readCurrent()).rejects.toThrow(
      'file exceeds the 1,000 bytes exact-read bound'
    );
    expect(fileSystem.readFileCalls).not.toContain(currentPath);
  });

  it('rejects deeply nested persisted JSON before recursive schema validation', async () => {
    const currentPath = path.join(sessionsDirectory, 'current.json');
    let nested: unknown = 'leaf';
    for (let depth = 0; depth < 110; depth += 1) {
      nested = { nested };
    }
    fileSystem.setJson(currentPath, {
      ...session('deep-current', 'Deep current'),
      conversations: nested
    });

    await expect(createStore().readCurrent()).rejects.toThrow(
      'exceeds the maximum JSON nesting depth of 100'
    );
  });

  it.each([
    { absoluteDepth: 99, accepted: true },
    { absoluteDepth: 100, accepted: true },
    { absoluteDepth: 101, accepted: false }
  ])(
    'uses the same $absoluteDepth-level JSON depth boundary on write and read',
    async ({ absoluteDepth, accepted }) => {
      // File root + conversations array account for two levels.
      let nestedConversation: unknown = null;
      for (let depth = 0; depth < absoluteDepth - 2; depth += 1) {
        nestedConversation = [nestedConversation];
      }
      const candidate = session(`depth-${absoluteDepth}`, `Depth ${absoluteDepth}`, {
        conversations: [nestedConversation] as unknown as
          WorkshopPersistedSessionV2['conversations']
      });
      const store = createStore();

      if (!accepted) {
        await expect(store.writeCurrent(candidate)).rejects.toThrow(
          'exceeds the maximum JSON nesting depth of 100'
        );
        await expect(store.readCurrent()).resolves.toBeUndefined();
        return;
      }

      await store.writeCurrent(candidate);
      await expect(store.readCurrent()).resolves.toMatchObject({
        sessionId: `depth-${absoluteDepth}`
      });
    }
  );

  it('refuses to persist a snapshot that the exact reader could not restore', async () => {
    const currentPath = path.join(sessionsDirectory, 'current.json');
    const store = createStore([root], {
      maximumFiles: 200,
      maximumFileBytes: 100,
      maximumExactFileBytes: 1_000,
      maximumSearchCharacters: 250_000,
      maximumNameCollisions: 100
    });

    await expect(store.writeCurrent(session('oversized-current', 'Oversized current')))
      .rejects.toThrow(
        'exceeds the maximum persisted size of 1,000 bytes. ' +
        'Start a new Workshop session or remove retained context'
      );
    expect(fileSystem.files.has(currentPath)).toBe(false);
  });

  it('reads exact snapshots and discovers current/named sidecars beyond the browser byte bound', async () => {
    const limits = {
      maximumFiles: 200,
      maximumFileBytes: 1_000,
      maximumExactFileBytes: 100_000,
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

  it('never overwrites a file that took a named checkpoint\'s name first: the final rename refuses, the name moves on', async () => {
    // Another window (or anything else) wrote the first candidate name after this store's identity scan.
    const store = createStore();
    const taken = path.join(sessionsDirectory, '20260723-102030-pentecost-auditorium-beat.json');
    const planted = new TextEncoder().encode('not this store\'s file');
    await fileSystem.writeFile(taken, planted);

    const saved = await store.saveNamed(session('named-1', 'Pentecost — auditorium beat'));

    expect(saved.fileName).toBe('20260723-102030-pentecost-auditorium-beat-2.json');
    expect(Buffer.from(await fileSystem.readFile(taken)).toString()).toBe('not this store\'s file');
    expect(fileSystem.renameCalls.filter(({ toPath }) => toPath === taken)).toEqual([]);
    expect(fileSystem.renameCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ toPath: path.join(sessionsDirectory, saved.fileName), overwrite: false })
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

  it('uses compact search indexes for a fresh no-query browser listing', async () => {
    const writer = createStore();
    const first = await writer.saveNamed(session('first', 'First'));
    const second = await writer.saveNamed(session('second', 'Second'));
    fileSystem.readFileCalls.length = 0;

    await expect(createStore().list()).resolves.toMatchObject({
      sessions: expect.arrayContaining([
        expect.objectContaining({ sessionId: 'first' }),
        expect.objectContaining({ sessionId: 'second' })
      ])
    });

    const fullPaths = [first.fileName, second.fileName].map((fileName) =>
      path.join(sessionsDirectory, fileName)
    );
    expect(fileSystem.readFileCalls).not.toEqual(
      expect.arrayContaining(fullPaths)
    );
  });

  it('rechecks the full checkpoint even when listing warmed its path', async () => {
    const writer = createStore();
    const saved = await writer.saveNamed(session('warm-room', 'Before'));
    const store = createStore();
    await store.list();
    fileSystem.readFileCalls.length = 0;

    await store.updateNamed(
      'warm-room',
      session('warm-room', 'After', { updatedAt: '2026-07-23T11:00:00.000Z' }),
      session('warm-room', 'Before')
    );

    expect(fileSystem.readFileCalls).toContain(
      path.join(sessionsDirectory, saved.fileName)
    );
    await expect(store.readNamed('warm-room')).resolves.toMatchObject({
      title: 'After'
    });
  });

  it('searches retained conversation archives without stringifying the full snapshot', async () => {
    const store = createStore();
    await store.saveNamed(session('archive-memory', 'Archive memory', {
      conversations: [{
        key: 'host',
        toolName: 'workshop_persona_jill',
        messages: [{ role: 'assistant', content: 'The vespertine bell is the buried clue.' }],
        lastActivity: 1_000,
        contextSources: [],
        nextArtifactNumber: 0
      }]
    }));

    await expect(store.list('VESPERTINE BELL')).resolves.toMatchObject({
      sessions: [{ sessionId: 'archive-memory' }],
      searchTruncated: false
    });
  });

  it('cancels a superseded browser scan before reading session payloads', async () => {
    const store = createStore();
    await store.saveNamed(session('cancel-me', 'Cancel me'));
    fileSystem.readFileCalls.length = 0;
    const controller = new AbortController();
    controller.abort();

    await expect(store.list(undefined, controller.signal)).rejects.toMatchObject({
      name: 'AbortError'
    });
    expect(fileSystem.readFileCalls).toEqual([]);
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

  it('requires a recovered legacy checkpoint to be opened before rename or duplicate can write it', async () => {
    const store = createStore();
    const saved = await store.saveNamed(session('legacy-room', 'Legacy room'));
    const filePath = await store.resolveRevealPath('legacy-room');
    const checkpoint = fileSystem.json(filePath) as WorkshopPersistedSessionV2;
    const { logic: _logic, ...legacyLens } = builtInLexicalGravityLens('music')!;
    checkpoint.workshop.counters.widgetConfig = 1;
    checkpoint.workshop.widgetConfigs = [{
      id: 'wc-1',
      widgetId: 'lexical-gravity',
      revision: 1,
      createdAt: clock.getTime(),
      draft: {
        lensSlug: 'music',
        weight: 40,
        reach: 2,
        metaphorPull: false,
        resolvedLens: { ...legacyLens, version: 1 }
      }
    } as never];
    fileSystem.setJson(filePath, checkpoint);

    await expect(store.renameNamed('legacy-room', 'Renamed legacy room'))
      .rejects.toThrow(/Open this Workshop session/);
    await expect(store.duplicateNamed('legacy-room', session('legacy-copy', 'Legacy copy')))
      .rejects.toThrow(/Open this Workshop session/);
    expect(fileSystem.json(filePath)).toEqual(checkpoint);
    expect(saved.sessionId).toBe('legacy-room');
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

    const updated = await store.updateNamed('living-room', updatedSnapshot, session('living-room', 'Before'));

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
    // One listing more than before: the lock looks for a recovery marker of this file before it is taken (ADR 2026-11-19 D6d).
    expect(fileSystem.readDirectoryCalls).toBe(2);
    expect([...fileSystem.files.keys()].filter((filePath) =>
      filePath.endsWith('.json') && !filePath.endsWith('.summary.json')
    )).toHaveLength(1);
  });

  it.each(['unchanged', 'updated', 'missing'] as const)(
    'rejects changed full content with a %s summary', async (indexState) => {
      const store = createStore();
      const original = session('shared', 'Before');
      const saved = await store.saveNamed(original);
      const fullPath = path.join(sessionsDirectory, saved.fileName);
      const indexPath = fullPath.replace(/\.json$/, '.summary.json');
      const incoming = session('shared', 'Incoming');
      // Same session ID, timestamps and turn count: only full content detects it.
      fileSystem.setJson(fullPath, incoming);
      if (indexState === 'updated') {
        fileSystem.setJson(indexPath, { ...(fileSystem.json(indexPath) as object), title: 'Incoming' });
      } else if (indexState === 'missing') {
        fileSystem.files.delete(indexPath);
      }
      const before = fileSystem.files.get(fullPath);
      fileSystem.readFileCalls.length = 0;
      const writes = jest.spyOn(fileSystem, 'writeFile');

      await expect(store.updateNamed('shared', session('shared', 'Stale'), original))
        .rejects.toThrow('changed on disk');
      expect(fileSystem.files.get(fullPath)).toBe(before);
      expect(fileSystem.readFileCalls).toEqual([fullPath]);
      expect(writes).not.toHaveBeenCalled();
      expect([...fileSystem.files.keys()].some((name) => name.includes('.tmp-'))).toBe(false);
    }
  );

  it('rechecks incoming content after preparing the temporary named write', async () => {
    const store = createStore();
    const original = session('shared', 'Before');
    const saved = await store.saveNamed(original);
    const fullPath = path.join(sessionsDirectory, saved.fileName);
    const incoming = session('shared', 'Incoming during write');
    const write = fileSystem.writeFile.bind(fileSystem);
    jest.spyOn(fileSystem, 'writeFile').mockImplementation(async (filePath, data) => {
      await write(filePath, data);
      // The rewrite stages inside its owner's folder in the file's lock (ADR 2026-11-19 D6b, D6d).
      if (filePath.startsWith(path.join(sessionsDirectory, `.${saved.fileName}.lock`)) && filePath.endsWith(`${path.sep}next.json`)) {
        fileSystem.setJson(fullPath, incoming);
      }
    });

    await expect(store.updateNamed('shared', session('shared', 'Stale'), original))
      .rejects.toThrow('changed on disk');
    expect(fileSystem.json(fullPath)).toEqual(incoming);
  });

  it.each(['deleted', 'malformed'] as const)('preserves a %s named target instead of recreating it', async (state) => {
    const store = createStore();
    const original = session('shared', 'Before');
    const saved = await store.saveNamed(original);
    const fullPath = path.join(sessionsDirectory, saved.fileName);
    if (state === 'deleted') {
      fileSystem.files.delete(fullPath);
    } else {
      fileSystem.setJson(fullPath, { invalid: true });
    }
    const before = fileSystem.files.get(fullPath);
    await expect(store.updateNamed('shared', session('shared', 'Stale'), original)).rejects.toThrow();
    expect(fileSystem.files.get(fullPath)).toBe(before);
  });

  it('rejects an update whose snapshot identity does not match the target', async () => {
    const store = createStore();
    await store.saveNamed(session('target', 'Target'));

    await expect(store.updateNamed('target', session('intruder', 'Intruder'), session('target', 'Target')))
      .rejects.toThrow('identity does not match');
    await expect(store.readNamed('target')).resolves.toMatchObject({ title: 'Target' });
  });

  it('keeps current.json outside all named-session mutations', async () => {
    const store = createStore();
    await store.writeCurrent(session('only-current', 'Current'));

    // Never named, and no lock to read it under: not found, never decided missing (D6e; PR #289).
    await expect(store.readNamed('only-current')).rejects.toBeInstanceOf(WorkshopNamedSessionUnconfirmedError);
    await expect(store.deleteNamed('only-current')).rejects.toBeInstanceOf(WorkshopNamedSessionUnconfirmedError);
    await expect(store.readCurrent()).resolves.toMatchObject({ sessionId: 'only-current' });
  });

  it('reports browser truncation at the configured file bound without scanning past it', async () => {
    const store = createStore([root], {
      maximumFiles: 1,
      maximumFileBytes: 5 * 1024 * 1024,
      maximumExactFileBytes: 25 * 1024 * 1024,
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

  it('keeps an oversized named checkpoint discoverable and manageable through its search index', async () => {
    const store = createStore([root], {
      maximumFiles: 200,
      maximumFileBytes: 1_000,
      maximumExactFileBytes: 100_000,
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

  it('tolerates orphan/corrupt search indexes and falls back to bounded legacy full snapshots', async () => {
    const store = createStore();
    const saved = await store.saveNamed(session('healthy', 'Healthy'));
    const searchIndexPath = path.join(
      sessionsDirectory,
      saved.fileName.replace(/\.json$/, '.summary.json')
    );
    fileSystem.setJson(searchIndexPath, { schemaVersion: 1, unexpected: true });
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

  it('reports content-search limits while still returning search-index metadata matches', async () => {
    const store = createStore([root], {
      maximumFiles: 200,
      maximumFileBytes: 5 * 1024 * 1024,
      maximumExactFileBytes: 25 * 1024 * 1024,
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

  it('ignores search indexes during identity scans, tolerates unrelated malformed files on save, and fails closed on duplicate full ids', async () => {
    const store = createStore();
    fileSystem.setJson(path.join(sessionsDirectory, 'broken.json'), { not: 'a session' });
    // A copied search-index-looking filename is not a named authoritative snapshot.
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

  it('keeps the committed snapshot and removes a stale search index when index replacement fails', async () => {
    const store = createStore();
    const saved = await store.saveNamed(session('living-room', 'Before'));
    const fullPath = path.join(sessionsDirectory, saved.fileName);
    const searchIndexPath = path.join(
      sessionsDirectory,
      saved.fileName.replace(/\.json$/, '.summary.json')
    );
    fileSystem.failRenameToPath = searchIndexPath;

    await expect(store.updateNamed(
      'living-room',
      session('living-room', 'After', { updatedAt: '2026-07-23T11:00:00.000Z' }),
      session('living-room', 'Before')
    )).resolves.toMatchObject({ title: 'After' });

    expect(fileSystem.json(fullPath)).toMatchObject({ title: 'After' });
    expect(fileSystem.files.has(searchIndexPath)).toBe(false);
    expect(logLines).toEqual(expect.arrayContaining([
      expect.stringContaining('removed stale index')
    ]));
  });
});
