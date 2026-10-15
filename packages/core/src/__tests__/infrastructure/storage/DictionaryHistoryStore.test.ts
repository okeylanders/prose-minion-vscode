import * as path from 'path';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import {
  DictionaryHistoryRecordInput,
  DictionaryHistoryStore,
  DictionaryHistoryStoreOptions
} from '@/infrastructure/storage/DictionaryHistoryStore';
import { DICTIONARY_HISTORY_LIMIT } from '@shared/constants/dictionaryHistory';
import type { LogSink } from '@/platform';

const ROOT = '/workspace/novel';
const HISTORY_DIRECTORY = path.join(ROOT, 'prose-minion', 'history');
const HISTORY_FILE = path.join(HISTORY_DIRECTORY, 'dictionary.json');
const NOW = new Date('2026-10-14T14:02:00.000Z');
const QUARANTINE_FILE = path.join(HISTORY_DIRECTORY, 'dictionary.invalid-2026-10-14T14-02-00-000Z.json');

const lookup = (word: string, overrides: Partial<DictionaryHistoryRecordInput> = {}): DictionaryHistoryRecordInput => ({
  request: {
    word,
    context: `Context for ${word}.`,
    includeEncyclopedia: true,
    includePalettes: false,
    mode: 'standard'
  },
  modelIds: ['anthropic/claude-sonnet-4.5'],
  toolName: 'dictionary_lookup',
  result: `# ${word}`,
  ...overrides
});

describe('DictionaryHistoryStore', () => {
  let fileSystem: MemoryFileSystem;
  let log: LogSink & { appendLine: jest.Mock };
  let nextId: number;

  beforeEach(() => {
    fileSystem = new MemoryFileSystem();
    log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    nextId = 0;
  });

  const createStore = (
    folders: string[] = [ROOT],
    options: DictionaryHistoryStoreOptions = {}
  ): DictionaryHistoryStore => new DictionaryHistoryStore(
    fileSystem,
    createFakeWorkspace({
      workspaceFolders: () => folders.map((folder) => ({ path: folder, name: path.basename(folder) }))
    }),
    log,
    { now: () => NOW, createId: () => `entry-${++nextId}`, ...options }
  );

  const fileBytes = (filePath: string): string => new TextDecoder().decode(fileSystem.files.get(filePath));
  const logs = (): string => log.appendLine.mock.calls.map(([line]) => line).join('\n');

  it('keeps entries newest first and evicts the oldest past the limit', async () => {
    const store = createStore([ROOT], { limit: 3 });

    for (const word of ['alpha', 'beta', 'gamma', 'delta']) {
      await store.record(lookup(word));
    }

    const snapshot = await store.snapshot();
    expect(snapshot.limit).toBe(3);
    expect(snapshot.entries.map((entry) => entry.word)).toEqual(['delta', 'gamma', 'beta']);
    expect(await store.get('entry-1')).toBeUndefined();
    expect(fileSystem.json(HISTORY_FILE)).toMatchObject({
      formatVersion: 1,
      entries: [{ id: 'entry-4' }, { id: 'entry-3' }, { id: 'entry-2' }]
    });
  });

  it('defaults to the documented limit, a timestamped id, and the clock for createdAt', async () => {
    const store = new DictionaryHistoryStore(
      fileSystem,
      createFakeWorkspace({ workspaceFolders: () => [{ path: ROOT, name: 'novel' }] }),
      log
    );

    const entry = await store.record(lookup('alpha'));

    expect((await store.snapshot()).limit).toBe(DICTIONARY_HISTORY_LIMIT);
    expect(entry.id).toMatch(/^dict-hist-\d+-[0-9a-f-]{36}$/);
    expect(Number.isFinite(Date.parse(entry.createdAt))).toBe(true);
  });

  it('persists through a temporary sibling and reloads in a new store', async () => {
    const first = createStore();
    const recorded = await first.record(lookup('alpha', {
      request: {
        word: 'alpha',
        context: 'First letter.',
        includeEncyclopedia: false,
        includePalettes: true,
        mode: 'fast',
        sourceUri: 'file:///workspace/novel/chapter-01.md',
        relativePath: 'chapter-01.md'
      },
      toolName: 'dictionary_fast_generate'
    }));
    await first.record(lookup('beta', { modelIds: [] }));

    const lastWrite = fileSystem.renameCalls.at(-1);
    expect(lastWrite).toMatchObject({ toPath: HISTORY_FILE, overwrite: true });
    expect(path.dirname(lastWrite!.fromPath)).toBe(HISTORY_DIRECTORY);
    expect([...fileSystem.files.keys()]).toEqual([HISTORY_FILE]);

    const second = createStore();
    const snapshot = await second.snapshot();
    expect(snapshot.durability).toEqual({ kind: 'project', displayPath: 'prose-minion/history/dictionary.json' });
    expect(snapshot.entries.map((entry) => entry.id)).toEqual(['entry-2', 'entry-1']);
    expect(await second.get('entry-1')).toEqual({
      ...recorded,
      createdAt: NOW.toISOString()
    });
    expect(await second.get('entry-2')).not.toHaveProperty('modelId');
  });

  it('starts empty, without writing, when the file is missing', async () => {
    const store = createStore();

    const snapshot = await store.snapshot();

    expect(snapshot.entries).toEqual([]);
    expect(snapshot.durability).toEqual({ kind: 'project', displayPath: 'prose-minion/history/dictionary.json' });
    expect(fileSystem.files.size).toBe(0);
  });

  it.each([
    ['bad JSON', '{"formatVersion": 1, "entries": ['],
    ['an unknown formatVersion', JSON.stringify({ formatVersion: 2, entries: [] })]
  ])('sets aside a file with %s, never overwriting it, and starts empty', async (_label, text) => {
    fileSystem.files.set(HISTORY_FILE, new TextEncoder().encode(text));
    const store = createStore();

    expect((await store.snapshot()).entries).toEqual([]);
    expect(fileBytes(QUARANTINE_FILE)).toBe(text);
    expect(fileSystem.renameCalls[0]).toEqual({ fromPath: HISTORY_FILE, toPath: QUARANTINE_FILE, overwrite: false });
    expect(logs()).toContain('renamed it to dictionary.invalid-2026-10-14T14-02-00-000Z.json');

    await store.record(lookup('alpha'));

    expect(fileBytes(QUARANTINE_FILE)).toBe(text);
    expect(fileSystem.json(HISTORY_FILE)).toMatchObject({ entries: [{ id: 'entry-1' }] });
  });

  it('keeps the file and stays session-only when an invalid file cannot be set aside', async () => {
    fileSystem.files.set(HISTORY_FILE, new TextEncoder().encode('not json'));
    fileSystem.failRenameToPath = QUARANTINE_FILE;
    const store = createStore();

    await store.record(lookup('alpha'));

    expect(fileBytes(HISTORY_FILE)).toBe('not json');
    expect(await store.snapshot()).toMatchObject({
      entries: [{ id: 'entry-1' }],
      durability: { kind: 'session', reason: 'write-failed' }
    });
  });

  it('never overwrites a file it could not read', async () => {
    fileSystem.files.set(HISTORY_FILE, new TextEncoder().encode('{"formatVersion":1,"entries":[]}'));
    jest.spyOn(fileSystem, 'readFile').mockRejectedValueOnce(new Error('EACCES: permission denied'));
    const store = createStore();

    await store.record(lookup('alpha'));

    expect(fileBytes(HISTORY_FILE)).toBe('{"formatVersion":1,"entries":[]}');
    expect(await store.snapshot()).toMatchObject({
      entries: [{ id: 'entry-1' }],
      durability: { kind: 'session', reason: 'write-failed' }
    });
    expect(logs()).toContain('EACCES');
  });

  it('loads the valid entries of a partly malformed file and logs the dropped count', async () => {
    const valid = {
      id: 'kept',
      createdAt: NOW.toISOString(),
      request: { word: 'kept', context: '', includeEncyclopedia: true, includePalettes: false, mode: 'standard' },
      modelIds: [],
      toolName: 'dictionary_lookup',
      result: '# kept'
    };
    fileSystem.setJson(HISTORY_FILE, { formatVersion: 1, entries: [{ id: 'broken' }, valid, 'junk'] });
    const store = createStore();

    expect((await store.snapshot()).entries.map((entry) => entry.id)).toEqual(['kept']);
    expect(logs()).toContain('Dropped 2 invalid entries');
  });

  it.each([
    [[], 'no-workspace'],
    [[ROOT, '/workspace/notes'], 'multi-root']
  ] as const)('keeps history in memory only with %j folders', async (folders, reason) => {
    const store = createStore([...folders]);

    const entry = await store.record(lookup('alpha'));

    expect(await store.snapshot()).toMatchObject({
      entries: [{ id: entry.id, word: 'alpha' }],
      durability: { kind: 'session', reason }
    });
    expect(await store.get(entry.id)).toEqual(entry);
    expect(fileSystem.files.size).toBe(0);
  });

  it('reports a failed write as session-only without rejecting, until a write succeeds', async () => {
    const store = createStore();
    const listener = jest.fn();
    store.onDidChange(listener);
    fileSystem.failRenameToPath = HISTORY_FILE;

    await expect(store.record(lookup('alpha'))).resolves.toMatchObject({ id: 'entry-1' });

    expect(await store.snapshot()).toMatchObject({
      entries: [{ id: 'entry-1' }],
      durability: { kind: 'session', reason: 'write-failed' }
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect([...fileSystem.files.keys()]).toEqual([]); // the temporary file was cleaned up
    expect(logs()).toContain('Could not save prose-minion/history/dictionary.json');

    fileSystem.failRenameToPath = undefined;
    await store.record(lookup('beta'));

    expect((await store.snapshot()).durability).toEqual({
      kind: 'project',
      displayPath: 'prose-minion/history/dictionary.json'
    });
    expect(fileSystem.json(HISTORY_FILE)).toMatchObject({ entries: [{ id: 'entry-2' }, { id: 'entry-1' }] });
  });

  it('emits a change on record, on a delete that removes something, and on clear', async () => {
    const store = createStore();
    const listener = jest.fn();
    const unsubscribe = store.onDidChange(listener);

    await store.record(lookup('alpha'));
    await store.record(lookup('beta'));
    expect(listener).toHaveBeenCalledTimes(2);

    const writesBeforeMiss = fileSystem.renameCalls.length;
    await expect(store.delete('missing')).resolves.toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(fileSystem.renameCalls).toHaveLength(writesBeforeMiss);

    await expect(store.delete('entry-1')).resolves.toBe(true);
    expect(listener).toHaveBeenCalledTimes(3);
    expect((await store.snapshot()).entries.map((entry) => entry.id)).toEqual(['entry-2']);
    expect(fileSystem.json(HISTORY_FILE)).toMatchObject({ entries: [{ id: 'entry-2' }] });

    await store.clear();
    expect(listener).toHaveBeenCalledTimes(4);
    expect(fileSystem.json(HISTORY_FILE)).toEqual({ formatVersion: 1, entries: [] });

    unsubscribe();
    await store.record(lookup('gamma'));
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('lands concurrent records, behind one lazy load, without interleaving their writes', async () => {
    await createStore().record(lookup('saved'));
    const store = createStore();

    const [first, second] = await Promise.all([
      store.record(lookup('alpha')),
      store.record(lookup('beta'))
    ]);

    const ids = [second.id, first.id, 'entry-1'];
    expect((await store.snapshot()).entries.map((entry) => entry.id)).toEqual(ids);
    expect(fileSystem.json(HISTORY_FILE)).toMatchObject({ entries: ids.map((id) => ({ id })) });
  });

  it('hands out copies that cannot change the stored entry', async () => {
    const store = createStore();
    const recorded = await store.record(lookup('alpha'));

    recorded.request.word = 'mutated';
    const loaded = await store.get(recorded.id);
    loaded!.result = 'mutated';

    expect(await store.get(recorded.id)).toMatchObject({ request: { word: 'alpha' }, result: '# alpha' });
  });

  it('never logs the writer\'s words, context, or results', async () => {
    fileSystem.failRenameToPath = HISTORY_FILE;
    const store = createStore();

    await store.record(lookup('confidential'));

    expect(logs()).not.toContain('confidential');
  });

  // Astra F-05: a cancellable lookup's entry becomes history only at the
  // store's commit point. The new ledger is staged in a temporary file and
  // replaces the history file only after `beforeCommit` agrees, so withdrawing
  // never needs a compensating write, and the history file holds only
  // committed history whatever fails.
  describe('a record with a commit point (beforeCommit)', () => {
    const settle = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

    /** Hold the next file write until released; later writes run as normal. */
    const holdNextWrite = (): { release: () => void; write: jest.SpyInstance } => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const writeFile = fileSystem.writeFile.bind(fileSystem);
      const write = jest.spyOn(fileSystem, 'writeFile').mockImplementationOnce(async (filePath, data) => {
        await gate;
        return writeFile(filePath, data);
      });
      return { release, write };
    };

    const storedIds = async (store: DictionaryHistoryStore): Promise<string[]> =>
      (await store.snapshot()).entries.map((entry) => entry.id);
    const fileIds = (): string[] =>
      (fileSystem.json(HISTORY_FILE) as { entries: Array<{ id: string }> }).entries.map((entry) => entry.id);
    const temporaryFiles = (): string[] => [...fileSystem.files.keys()].filter((filePath) => filePath.includes('.tmp-'));

    /** A full two-entry ledger on disk: [entry-2, entry-1]. Recording again would evict entry-1. */
    const fullStore = async (): Promise<DictionaryHistoryStore> => {
      const store = createStore([ROOT], { limit: 2 });
      await store.record(lookup('alpha'));
      await store.record(lookup('beta'));
      return store;
    };

    /** What a fresh store, as after a reload, reads back from the same files. */
    const reopenedIds = async (): Promise<string[]> => storedIds(createStore([ROOT], { limit: 2 }));

    it('consults the commit point after staging and immediately before the rename that commits', async () => {
      const store = await fullStore();
      const order: string[] = [];
      const stage = fileSystem.writeFile.bind(fileSystem);
      const commit = fileSystem.rename.bind(fileSystem);
      jest.spyOn(fileSystem, 'writeFile').mockImplementation(async (filePath, data) => {
        order.push('stage');
        return stage(filePath, data);
      });
      jest.spyOn(fileSystem, 'rename').mockImplementation(async (fromPath, toPath, options) => {
        order.push('commit');
        return commit(fromPath, toPath, options);
      });

      const entry = await store.record(lookup('gamma'), { beforeCommit: () => { order.push('beforeCommit'); return true; } });

      expect(order).toEqual(['stage', 'beforeCommit', 'commit']);
      expect(entry?.id).toBe('entry-3');
      expect(fileIds()).toEqual(['entry-3', 'entry-2']);
    });

    it('withdraws at the commit point at capacity: the history file, memory, and a reload keep the prior ledger', async () => {
      const store = await fullStore();
      const changes = jest.fn();
      store.onDidChange(changes);
      const rename = jest.spyOn(fileSystem, 'rename');

      await expect(store.record(lookup('gamma'), { beforeCommit: () => false })).resolves.toBeUndefined();

      expect(rename).not.toHaveBeenCalled();
      expect(await storedIds(store)).toEqual(['entry-2', 'entry-1']);
      expect(fileIds()).toEqual(['entry-2', 'entry-1']);
      expect(await reopenedIds()).toEqual(['entry-2', 'entry-1']);
      expect(temporaryFiles()).toEqual([]);
      expect(changes).not.toHaveBeenCalled();
    });

    it('withdraws a lookup cancelled while its ledger was being staged', async () => {
      const store = await fullStore();
      const { release, write } = holdNextWrite();
      let cancelled = false;

      const pending = store.record(lookup('gamma'), { beforeCommit: () => !cancelled });
      await settle();
      expect(write).toHaveBeenCalledTimes(1); // staging is in flight
      cancelled = true;
      release();

      await expect(pending).resolves.toBeUndefined();
      expect(await reopenedIds()).toEqual(['entry-2', 'entry-1']);
    });

    it('keeps the prior ledger when the withdrawn temporary file cannot even be deleted', async () => {
      const store = await fullStore();
      jest.spyOn(fileSystem, 'delete').mockRejectedValueOnce(new Error('EIO: delete'));

      await expect(store.record(lookup('gamma'), { beforeCommit: () => false })).resolves.toBeUndefined();

      // The leftover is never read as history; the history file still holds the prior ledger.
      expect(temporaryFiles()).toHaveLength(1);
      expect(await reopenedIds()).toEqual(['entry-2', 'entry-1']);
    });

    it('surfaces degraded durability when staging fails, whether the entry is then withdrawn or committed', async () => {
      const store = await fullStore();
      const changes = jest.fn();
      store.onDidChange(changes);
      jest.spyOn(fileSystem, 'writeFile').mockRejectedValueOnce(new Error('EIO: write'));

      await expect(store.record(lookup('gamma'), { beforeCommit: () => false })).resolves.toBeUndefined();

      expect(changes).toHaveBeenCalledTimes(1);
      expect(await store.snapshot()).toMatchObject({
        entries: [{ id: 'entry-2' }, { id: 'entry-1' }],
        durability: { kind: 'session', reason: 'write-failed' }
      });
      expect(await reopenedIds()).toEqual(['entry-2', 'entry-1']);

      jest.spyOn(fileSystem, 'writeFile').mockRejectedValueOnce(new Error('EIO: write'));
      const committed = await store.record(lookup('delta'), { beforeCommit: () => true });

      // Committed for this session only, and reported so; the file keeps committed history.
      expect(committed?.id).toBe('entry-4');
      expect(await store.snapshot()).toMatchObject({
        entries: [{ id: 'entry-4' }, { id: 'entry-2' }],
        durability: { kind: 'session', reason: 'write-failed' }
      });
      expect(await reopenedIds()).toEqual(['entry-2', 'entry-1']);
    });

    it('keeps the prior history file when the committing rename fails, and reports it', async () => {
      const store = await fullStore();
      const changes = jest.fn();
      store.onDidChange(changes);
      fileSystem.failRenameToPath = HISTORY_FILE;

      const entry = await store.record(lookup('gamma'), { beforeCommit: () => true });

      expect(entry?.id).toBe('entry-3');
      expect(changes).toHaveBeenCalledTimes(1);
      expect(await store.snapshot()).toMatchObject({
        entries: [{ id: 'entry-3' }, { id: 'entry-2' }],
        durability: { kind: 'session', reason: 'write-failed' }
      });
      fileSystem.failRenameToPath = undefined;
      expect(await reopenedIds()).toEqual(['entry-2', 'entry-1']);
      expect(temporaryFiles()).toEqual([]);
    });

    it('consults the commit point at once when there is no history file to write', async () => {
      const store = createStore([]);
      const beforeCommit = jest.fn(() => false);

      await expect(store.record(lookup('alpha'), { beforeCommit })).resolves.toBeUndefined();

      expect(beforeCommit).toHaveBeenCalledTimes(1);
      expect(await storedIds(store)).toEqual([]);
    });
  });

  describe('never logs writer text from an invalid file', () => {
    const MARKER = 'SECRET_MANUSCRIPT_WORDS';
    const malformed = `{"formatVersion":1,"entries":[{"request":{"context":${MARKER}}}]}`;
    const unknownVersion = JSON.stringify({ formatVersion: { note: MARKER }, entries: [] });

    it.each([
      ['malformed JSON', malformed],
      ['an arbitrary formatVersion value', unknownVersion]
    ])('when setting aside a file with %s', async (_label, text) => {
      fileSystem.files.set(HISTORY_FILE, new TextEncoder().encode(text));

      await createStore().snapshot();

      expect(fileBytes(QUARANTINE_FILE)).toBe(text);
      expect(logs()).toContain('renamed it to');
      expect(logs()).not.toContain('SECRET');
    });

    it.each([
      ['malformed JSON', malformed],
      ['an arbitrary formatVersion value', unknownVersion]
    ])('when a file with %s cannot be set aside', async (_label, text) => {
      fileSystem.files.set(HISTORY_FILE, new TextEncoder().encode(text));
      fileSystem.failRenameToPath = QUARANTINE_FILE;

      await createStore().snapshot();

      expect(fileBytes(HISTORY_FILE)).toBe(text);
      expect(logs()).toContain('could not be set aside');
      expect(logs()).not.toContain('SECRET');
    });
  });
});
