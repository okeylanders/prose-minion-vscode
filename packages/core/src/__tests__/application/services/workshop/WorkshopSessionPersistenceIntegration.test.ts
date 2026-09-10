import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { decodeWorkshopPersistedSessionCheckpoint, WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';
import { isCleanRollingCheckpoint } from '@/application/services/workshop/WorkshopRollingCheckpoint';
import type { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import { DEFAULT_WORKSHOP_WRITER_PROFILE } from '@messages';
import { LogSink, Workspace } from '@/platform';

const root = '/workspace/novel';
const directory = `${root}/prose-minion/sessions`;
const currentPath = `${directory}/current.json`;
const now = () => new Date('2026-09-08T12:00:00.000Z');
const workspace: Workspace = {
  workspaceFolders: () => [{ name: 'novel', path: root }],
  extensionPath: '/extension',
  asRelativePath: (value) => value,
  findFiles: async () => []
};

function checkpoint(id: string, text: string): WorkshopPersistedSessionV2 {
  const source = new WorkshopSessionService(() => now().getTime());
  source.setExcerpt({ text, source: { kind: 'manual' } });
  source.recordSessionMarker('start', 'Session started.');
  return {
    schemaVersion: 2, sessionId: id, title: id,
    createdAt: now().toISOString(), updatedAt: now().toISOString(),
    temporal: new WorkshopSessionTimeService({ now }).exportState(),
    summary: { hostPersonaId: 'jill', participantPersonaIds: ['jill'], turnCount: 1, excerptWordCount: 1 },
    workshop: source.exportCommittedState(), conversations: []
  };
}

function setup(fs = new MemoryFileSystem()) {
  const log: LogSink = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
  const store = new WorkshopSessionStore(fs, workspace, log, now);
  const session = new WorkshopSessionService(() => now().getTime());
  let nextId = 0;
  const ready = jest.fn(async () => undefined);
  const assistant = {
    exportWorkshopConversationArchive: jest.fn(() => []),
    importWorkshopConversationArchive: jest.fn(async () => []),
    discardConversation: jest.fn()
  } as unknown as AssistantToolService;
  const settings = { getWriterProfile: () => DEFAULT_WORKSHOP_WRITER_PROFILE } as WorkshopConversationSettingsService;
  const coordinator = new WorkshopSessionPersistenceCoordinator(
    session, assistant, settings, new WorkshopSessionTimeService({ now }), store, log,
    { now, idFactory: () => `room-${++nextId}`, ensureAssistantReady: ready }
  );
  return { fs, store, session, coordinator, log, ready };
}

function addResumeNotice(value: WorkshopPersistedSessionV2): void {
  value.workshop.counters.turn += 1;
  value.workshop.turns.push({
    id: `turn-${value.workshop.counters.turn}-system-${now().getTime()}`,
    role: 'system', kind: 'divider', participant: 'session', artifact: 'session_resume',
    excerptVersion: value.workshop.excerpt?.version ?? 0,
    content: 'Session resumed September 8, 2026 at 9:00 AM.', timestamp: now().getTime()
  });
  value.summary.turnCount += 1;
  value.updatedAt = '2026-09-08T14:00:00.000Z';
  value.savedAt = value.updatedAt;
  value.temporal.lastActivityAt = value.updatedAt;
}

describe('Workshop persistence with the real store', () => {
  it.each(['open', 'new'] as const)('keeps a delayed manual refresh in its original room before %s', async (action) => {
    const { fs, store, session, coordinator } = setup();
    await coordinator.initialize();
    session.setExcerpt({ text: 'Session B', source: { kind: 'manual' } });
    session.addContextAttachment({ kind: 'file', origin: 'wizard', label: 'b.md',
      content: 'B body', words: 2, sourceUri: 'file:///workspace/b.md', relativePath: 'b.md' });
    const savedB = await coordinator.saveNamed('Session B');
    const bytesB = fs.files.get(`${directory}/${savedB.fileName}`);
    await coordinator.resetSession({ clearWorkingSet: true });
    session.setExcerpt({ text: 'Session A', source: { kind: 'manual' } });
    session.addContextAttachment({ kind: 'file', origin: 'wizard', label: 'a.md',
      content: 'Old A', words: 2, sourceUri: 'file:///workspace/a.md', relativePath: 'a.md' });
    const attachmentA = session.getContextAttachments()[0];
    expect(attachmentA.id).toBe('ctx-1');
    let finishRead!: () => void;
    let started!: () => void;
    const startedRead = new Promise<void>((resolve) => { started = resolve; });
    const read = new Promise<void>((resolve) => { finishRead = resolve; });
    const refresh = coordinator.runContextRefresh(async () => {
      started();
      await read;
      expect(session.refreshContextFileAttachments([{ id: attachmentA.id,
        content: 'New A', words: 2, sourceUri: 'file:///workspace/a.md', relativePath: 'a.md' }],
      'Refreshed A').ok).toBe(true);
      coordinator.markDirty('context files refreshed');
    });
    expect(coordinator.isSessionOperationPending()).toBe(true);
    await startedRead;
    const replacement = action === 'open'
      ? coordinator.openNamed(savedB.sessionId)
      : coordinator.resetSession({ clearWorkingSet: true });
    expect(session.getExcerpt()?.text).toBe('Session A');
    finishRead();
    await refresh;
    await replacement;
    await coordinator.flush();
    if (action === 'open') {
      expect(session.getContextAttachments()[0]).toMatchObject({ id: 'ctx-1',
        label: 'b.md', content: 'B body', sourceUri: 'file:///workspace/b.md', relativePath: 'b.md' });
    } else {
      expect(session.getContextAttachments()).toEqual([]);
    }
    expect(fs.files.get(`${directory}/${savedB.fileName}`)).toBe(bytesB);
    expect(coordinator.isSessionOperationPending()).toBe(false);
  });

  it('releases manual refresh ownership after failure so another session can open', async () => {
    const { store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Saved'));
    await coordinator.initialize();
    await expect(coordinator.runContextRefresh(async () => {
      throw new Error('Read failed');
    })).rejects.toThrow('Read failed');
    expect(coordinator.isSessionOperationPending()).toBe(false);
    await coordinator.openNamed(saved.sessionId);
    expect(session.getExcerpt()?.text).toBe('Saved');
  });

  it.each(['flush', 'reveal'] as const)('retries a failed startup cache mirror through %s without rewriting named or inventing turns', async (retry) => {
    const { fs, store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Saved'));
    await store.writeCurrent(checkpoint('named', 'Unique local work'));
    const namedBytes = fs.files.get(`${directory}/${saved.fileName}`);
    const oldCurrent = fs.files.get(currentPath);
    const statuses: Array<{ status: string; error?: string }> = [];
    coordinator.addSessionSaveStatusListener((status) => statuses.push(status));
    jest.spyOn(store, 'writeCurrent').mockRejectedValueOnce(new Error('EACCES'));

    expect((await coordinator.initialize()).restored).toBe(true);
    expect(session.getExcerpt()?.text).toBe('Saved');
    expect(session.getSnapshot().turns.map((turn) => turn.artifact)).toEqual(['session_start']);
    expect(fs.files.get(currentPath)).toBe(oldCurrent);
    expect(coordinator.hasPendingWrite()).toBe(true);
    const notices = coordinator.consumeRecoveryNotices();
    expect(notices).toEqual([expect.objectContaining({ code: 'local-session-preserved' })]);
    expect((await store.list()).sessions).toHaveLength(2);
    expect(statuses.at(-1)?.error).toContain('EACCES');

    if (retry === 'flush') {
      await coordinator.flush();
    } else {
      expect(await coordinator.refreshNamedSession()).toBe(false);
    }
    expect(coordinator.hasPendingWrite()).toBe(false);
    expect(isCleanRollingCheckpoint((await store.readCurrent())!)).toBe(true);
    expect(fs.files.get(`${directory}/${saved.fileName}`)).toBe(namedBytes);
    expect(session.getSnapshot().turns.map((turn) => turn.artifact)).toEqual(['session_start']);
    expect(coordinator.beginInteraction()?.artifact).toBe('session_resume');
    expect(coordinator.beginInteraction()).toBeUndefined();
    expect(statuses.at(-1)?.status).toBe('saved');
  });

  it('announces preserved local work despite a startup named race and adopts the replacement on reveal', async () => {
    const { fs, store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'First read'));
    await store.writeCurrent(checkpoint('named', 'Unique local work'));
    const incoming = checkpoint('named', 'Incoming');
    const read = store.readNamedWithRecovery.bind(store);
    jest.spyOn(store, 'readNamedWithRecovery').mockImplementationOnce(async (id) => {
      const first = await read(id);
      fs.setJson(`${directory}/${saved.fileName}`, incoming);
      return first;
    });
    await coordinator.initialize();
    expect(session.getExcerpt()?.text).toBe('First read');
    expect(session.getSnapshot().turns.map((turn) => turn.artifact)).toEqual(['session_start']);
    // Leave the notice pending: the second hydration must not erase a committed recovery.
    expect(await coordinator.refreshNamedSession()).toBe(true);
    expect(session.getExcerpt()?.text).toBe('Incoming');
    expect(coordinator.consumeRecoveryNotices()).toEqual([
      expect.objectContaining({ code: 'local-session-preserved' })
    ]);
    expect((await store.list()).sessions).toHaveLength(2);
    expect(fs.json(`${directory}/${saved.fileName}`)).toEqual(incoming);
    expect(coordinator.beginInteraction()?.artifact).toBe('session_resume');
  });

  it('loads an archive-free named session without invoking unavailable provider setup', async () => {
    const { store, coordinator, ready, session } = setup();
    await store.saveNamed(checkpoint('named', 'Saved'));
    await store.writeCurrent(checkpoint('named', 'Saved'));
    ready.mockRejectedValue(new Error('Secret storage unavailable'));
    expect((await coordinator.initialize()).restored).toBe(true);
    await coordinator.refreshNamedSession();
    expect(ready).not.toHaveBeenCalled();
    expect(coordinator.isCurrentCheckpointProtected()).toBe(false);
    expect(session.getExcerpt()?.text).toBe('Saved');
  });

  it.each(['new', 'update'] as const)('reports the successful %s named save separately from a failed cache copy and retries only the cache', async (mode) => {
    const { fs, store, session, coordinator } = setup();
    await coordinator.initialize();
    await coordinator.flush();
    const existing = mode === 'update' ? await coordinator.saveNamed('Existing') : undefined;
    session.setExcerpt({ text: 'Saved author work', source: { kind: 'manual' } });
    const statuses: Array<{ status: string; error?: string }> = [];
    coordinator.addSessionSaveStatusListener((status) => statuses.push(status));
    jest.spyOn(store, 'writeCurrent').mockRejectedValueOnce(new Error('disk full'));
    const saved = await coordinator.saveNamed('Saved', existing?.sessionId);
    const file = `${directory}/${saved.fileName}`;
    const savedBytes = fs.files.get(file);
    expect((await store.readNamed(saved.sessionId))?.workshop.excerpt?.text).toBe('Saved author work');
    expect(statuses.at(-1)?.error).toContain('current.json could not be updated');
    expect(coordinator.hasPendingWrite()).toBe(true);
    await coordinator.flush();
    expect(fs.files.get(file)).toBe(savedBytes);
    expect(coordinator.hasPendingWrite()).toBe(false);
    expect((await store.readCurrent())?.sessionId).toBe(saved.sessionId);
    expect(statuses.at(-1)?.status).toBe('saved');
    expect((await store.list()).sessions).toHaveLength(1);
  });

  it('keeps a protected original current file intact after rescue Save-as-new and flush', async () => {
    const { fs, store, coordinator } = setup();
    const unreadable = new TextEncoder().encode('{unreadable');
    fs.files.set(currentPath, unreadable);
    await coordinator.initialize();
    const saved = await coordinator.saveNamed('Rescued');
    expect(await store.readNamed(saved.sessionId)).toBeDefined();
    expect(coordinator.hasPendingWrite()).toBe(true);
    await coordinator.saveNamed('Rescued again', saved.sessionId);
    await coordinator.flush();
    expect(fs.files.get(currentPath)).toBe(unreadable);
    expect(coordinator.hasPendingWrite()).toBe(true);
    await coordinator.openNamed(saved.sessionId);
    expect(coordinator.hasPendingWrite()).toBe(false);
    expect((await store.readCurrent())?.sessionId).toBe(saved.sessionId);
  });

  it.each([false, true])('restores author-work eligibility after failed promotion (author dirty: %s)', async (dirty) => {
    const { fs, store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Saved'));
    await store.writeCurrent(checkpoint('named', 'Saved'));
    await coordinator.initialize();
    session.addContextAttachment({ kind: 'file', origin: 'wizard', label: 'ref.md',
      content: 'Old', words: 1, sourceUri: 'file:///workspace/ref.md' });
    coordinator.markDirty('attach reference');
    await coordinator.flush();
    const incoming = (await store.readNamed('named'))!;
    session.refreshContextFileAttachments([{ id: session.getContextAttachments()[0].id,
      content: 'Staged', words: 1, sourceUri: 'file:///workspace/ref.md', relativePath: 'ref.md' }]);
    incoming.workshop.excerpt!.text = 'Incoming';
    fs.setJson(`${directory}/${saved.fileName}`, incoming);
    if (dirty) {
      session.setExcerpt({ text: 'Unsaved author work', source: { kind: 'manual' } });
      coordinator.markDirty('edit');
      await coordinator.flush(); // Named conflict preserves local author work.
    }
    jest.spyOn(store, 'writeCurrent').mockRejectedValueOnce(new Error('cache failed'));
    await expect(coordinator.openNamed('named')).rejects.toThrow('cache failed');
    const afterFailure = (await store.list()).sessions.length;
    // Committed recovery files must be announced even when the load rolls back.
    expect(coordinator.consumeRecoveryNotices()).toHaveLength(dirty ? 1 : 0);
    await coordinator.openNamed('named');
    expect((await store.list()).sessions.length - afterFailure).toBe(dirty ? 1 : 0);
    expect(session.getExcerpt()?.text).toBe('Incoming');
    expect(coordinator.beginInteraction()?.artifact).toBe('session_resume');
  });

  it('persists one resume after an unavailable first message rolls back and does not mint another on retry', async () => {
    const { store, session, coordinator } = setup();
    await store.saveNamed(checkpoint('named', 'Saved'));
    await store.writeCurrent(checkpoint('named', 'Saved'));
    await coordinator.initialize();
    expect(coordinator.beginInteraction()?.artifact).toBe('session_resume');
    session.beginPersonaMessage('failed', 'Unavailable attempt');
    expect(session.rollbackMessageRun('failed')).toBeDefined();
    coordinator.markDirty('unavailable message rolled back');
    await coordinator.flush();
    const rolledBack = (await store.readNamed('named'))!;
    expect(rolledBack.workshop.turns.filter((turn) => turn.artifact === 'session_resume')).toHaveLength(1);
    expect(rolledBack.workshop.turns.some((turn) => turn.content === 'Unavailable attempt')).toBe(false);
    expect(coordinator.beginInteraction()).toBeUndefined();
    session.beginPersonaMessage('retry', 'Retry');
    session.completeRun('retry', 'Reply');
    coordinator.markDirty('completed retry');
    await coordinator.flush();
    expect((await store.readNamed('named'))?.workshop.turns.filter((turn) => turn.artifact === 'session_resume')).toHaveLength(1);
  });

  it('migrates a released V1 rolling session, preserves divergent content once, then establishes clean provenance', async () => {
    const { fs, store, coordinator } = setup();
    const legacy = require('@/__tests__/fixtures/workshop-session-v1-released.json');
    fs.setJson(currentPath, legacy);
    const decoded = decodeWorkshopPersistedSessionCheckpoint(legacy).session;
    const incoming = checkpoint(decoded.sessionId, 'Incoming named excerpt');
    await store.saveNamed(incoming);
    await coordinator.initialize();
    expect(coordinator.consumeRecoveryNotices().filter((notice) => notice.code === 'local-session-preserved')).toHaveLength(1);
    expect(isCleanRollingCheckpoint((await store.readCurrent())!)).toBe(true);
    const restarted = setup(fs);
    await restarted.coordinator.initialize();
    expect(restarted.coordinator.consumeRecoveryNotices().filter((notice) => notice.code === 'local-session-preserved')).toHaveLength(0);
    expect((await store.list()).sessions).toHaveLength(2);
  });

  it('keeps named bytes unchanged across load, discard, Git sync and restart without recovering a clean older cache', async () => {
    const { fs, store, coordinator } = setup();
    const old = checkpoint('named', 'Old committed excerpt');
    const saved = await store.saveNamed(old);
    await store.writeCurrent(old); // Legacy cache initially agrees with named.
    const file = `${directory}/${saved.fileName}`;
    const oldBytes = fs.files.get(file);
    await coordinator.initialize();
    await coordinator.flush();
    expect(fs.files.get(file)).toEqual(oldBytes);
    expect(isCleanRollingCheckpoint((await store.readCurrent())!)).toBe(true);

    // Discard tracked changes, then pull; ignored current.json remains older.
    fs.setJson(file, old);
    const incoming = checkpoint('named', 'Incoming committed excerpt');
    fs.setJson(file, incoming);
    const incomingBytes = fs.files.get(file);
    const restarted = setup(fs);
    await restarted.coordinator.initialize();
    await restarted.coordinator.refreshNamedSession();
    await restarted.coordinator.openNamed('named');
    await restarted.coordinator.flush();
    expect(restarted.session.getExcerpt()?.text).toBe('Incoming committed excerpt');
    expect(fs.files.get(file)).toEqual(incomingBytes);
    expect((await restarted.store.list()).sessions).toHaveLength(1);
    expect(restarted.coordinator.consumeRecoveryNotices()).toEqual([]);
    expect((await restarted.store.readCurrent())?.workshop.turns).toEqual(incoming.workshop.turns);
  });

  it('honors a Git revert of autosaved named work without recovering its clean cache', async () => {
    const { fs, store, session, coordinator } = setup();
    const original = checkpoint('named', 'Committed');
    const saved = await store.saveNamed(original);
    await store.writeCurrent(original);
    await coordinator.initialize();
    session.beginPersonaMessage('message', 'Author work later discarded through Git.');
    session.completeRun('message', 'Reply.');
    coordinator.markDirty('completed conversation');
    await coordinator.flush();
    expect(isCleanRollingCheckpoint((await store.readCurrent())!)).toBe(true);
    fs.setJson(`${directory}/${saved.fileName}`, original);
    const restarted = setup(fs);
    await restarted.coordinator.initialize();
    expect((await store.readCurrent())?.workshop.turns).toEqual(original.workshop.turns);
    expect(restarted.coordinator.consumeRecoveryNotices()).toEqual([]);
    expect((await store.list()).sessions).toHaveLength(1);
  });

  it('never retries an old clean mirror over newer local work after a named conflict', async () => {
    const { fs, store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Saved'));
    await store.writeCurrent(checkpoint('named', 'Saved'));
    jest.spyOn(store, 'writeCurrent').mockRejectedValueOnce(new Error('cache unavailable'));
    await coordinator.initialize();
    fs.setJson(`${directory}/${saved.fileName}`, checkpoint('named', 'Incoming'));
    session.setExcerpt({ text: 'Unsaved local work', source: { kind: 'manual' } });
    coordinator.markDirty('author edit');
    await coordinator.flush();
    await coordinator.flush();
    expect((await store.readCurrent())?.workshop.excerpt?.text).toBe('Unsaved local work');
    expect((await store.readCurrent())?.rollingCleanHash).toBeUndefined();
    expect((await store.readNamed('named'))?.workshop.excerpt?.text).toBe('Incoming');
  });

  it('rejects a clean marker whose rolling content was subsequently edited', async () => {
    const { fs, store, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Old'));
    await store.writeCurrent(checkpoint('named', 'Old'));
    await coordinator.initialize();
    const edited = (await store.readCurrent())!;
    edited.workshop.excerpt!.text = 'Unique local edit';
    fs.setJson(currentPath, edited); // Stale hash must not authorize dropping content.
    fs.setJson(`${directory}/${saved.fileName}`, checkpoint('named', 'Incoming'));
    expect(isCleanRollingCheckpoint((await store.readCurrent())!)).toBe(false);
    const restarted = setup(fs);
    await restarted.coordinator.initialize();
    const recovery = (await store.list()).sessions.find((entry) => entry.sessionId !== 'named')!;
    expect((await store.readNamed(recovery.sessionId))?.workshop.excerpt?.text).toBe('Unique local edit');
    expect((await store.readNamed(recovery.sessionId))?.rollingCleanHash).toBeUndefined();
  });

  it('retains author changes after a failed named save and recovers them on restart', async () => {
    const { fs, store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Old'));
    await store.writeCurrent(checkpoint('named', 'Old'));
    await coordinator.initialize();
    fs.setJson(`${directory}/${saved.fileName}`, checkpoint('named', 'Incoming'));
    session.setExcerpt({ text: 'Unsaved local edit', source: { kind: 'manual' } });
    coordinator.markDirty('author edit');
    await coordinator.flush();
    expect((await store.readCurrent())?.rollingCleanHash).toBeUndefined();
    const restarted = setup(fs);
    await restarted.coordinator.initialize();
    const recovery = (await store.list()).sessions.find((entry) => entry.sessionId !== 'named')!;
    expect((await store.readNamed(recovery.sessionId))?.workshop.excerpt?.text).toBe('Unsaved local edit');
    expect(restarted.session.getExcerpt()?.text).toBe('Incoming');
  });

  it('stages automatic context updates without writes and commits them with the first interaction', async () => {
    const { fs, store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Old'));
    await store.writeCurrent(checkpoint('named', 'Old'));
    await coordinator.initialize();
    session.addContextAttachment({ kind: 'file', origin: 'wizard', label: 'reference.md',
      content: 'Old reference', words: 2, sourceUri: 'file:///workspace/novel/reference.md' });
    coordinator.markDirty('author added context');
    await coordinator.flush();
    const file = `${directory}/${saved.fileName}`;
    const savedBytes = fs.files.get(file);
    const savedCurrent = fs.files.get(currentPath);
    const turnsBefore = session.exportCommittedState().turns;
    const attachment = session.getContextAttachments()[0];
    session.refreshContextFileAttachments([{ ...attachment, sourceUri: attachment.sourceUri!, relativePath: 'reference.md', content: 'Refreshed reference', words: 2 }]);
    await coordinator.flush();
    expect(fs.files.get(file)).toEqual(savedBytes);
    expect(fs.files.get(currentPath)).toEqual(savedCurrent);
    expect(session.exportCommittedState().turns).toEqual(turnsBefore);

    expect(coordinator.beginInteraction()?.artifact).toBe('session_resume');
    session.beginPersonaMessage('message', 'Use this reference.');
    session.completeRun('message', 'Understood.', undefined, false, 'host-runtime');
    coordinator.markDirty('persona turn completed');
    await coordinator.flush();
    const persisted = (await store.readNamed('named'))!;
    expect(persisted.workshop.contextAttachments[0].content).toBe('Refreshed reference');
    expect(persisted.workshop.turns.slice(-3).map((turn) => turn.artifact))
      .toEqual(['session_resume', 'persona_message', 'persona_message']);
    expect(persisted.rollingCleanHash).toBeUndefined();
    expect(isCleanRollingCheckpoint((await store.readCurrent())!)).toBe(true);
    expect(coordinator.beginInteraction()).toBeUndefined();
  });

  it('does not recover an automatically refreshed working set when Git replaces the named session', async () => {
    const { fs, store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Old'));
    await store.writeCurrent(checkpoint('named', 'Old'));
    await coordinator.initialize();
    session.addContextAttachment({ kind: 'file', origin: 'wizard', label: 'reference.md',
      content: 'Old reference', words: 2, sourceUri: 'file:///workspace/novel/reference.md' });
    coordinator.markDirty('author added context');
    await coordinator.flush();
    session.refreshContextFileAttachments([{ ...session.getContextAttachments()[0], sourceUri: 'file:///workspace/novel/reference.md', relativePath: 'reference.md', content: 'Automatic reread', words: 2 }]);
    fs.setJson(`${directory}/${saved.fileName}`, checkpoint('named', 'Incoming'));
    await coordinator.refreshNamedSession();
    expect((await store.list()).sessions).toHaveLength(1);
    expect(session.getExcerpt()?.text).toBe('Incoming');
    expect(coordinator.consumeRecoveryNotices()).toEqual([]);
  });

  it('does not create startup recovery for automatic resume notices and their bookkeeping', async () => {
    const { store, coordinator, session } = setup();
    const named = checkpoint('named', 'Initial');
    const local = JSON.parse(JSON.stringify(named)) as WorkshopPersistedSessionV2;
    addResumeNotice(local);
    addResumeNotice(local);
    // Recovery filtering must not relax the optimistic write guard.
    expect(hasSameWorkshopCheckpoint(local, named)).toBe(false);
    await store.saveNamed(named);
    await store.writeCurrent(local);
    await coordinator.initialize();
    await coordinator.flush();
    expect((await store.list()).sessions).toHaveLength(1);
    expect(coordinator.consumeRecoveryNotices()).toEqual([]);
    expect(session.exportCommittedState().turns.filter((turn) => turn.artifact === 'session_resume')).toHaveLength(0);
  });

  it.each(['excerpt', 'transcript', 'archive', 'noncanonical resume'])(
    'preserves startup local %s changes with a fresh identity before adopting named', async (kind) => {
      const { store, coordinator } = setup();
      const named = checkpoint('named', 'Incoming');
      const local = JSON.parse(JSON.stringify(named)) as WorkshopPersistedSessionV2;
      addResumeNotice(local);
      if (kind === 'excerpt') {
        local.workshop.excerpt!.text = 'Local work';
      } else if (kind === 'transcript') {
        local.workshop.turns.push({
          id: `turn-3-user-${now().getTime()}`, role: 'user', kind: 'message', participant: 'writer',
          artifact: 'persona_message',
          content: 'Keep this local thought.', timestamp: now().getTime(), excerptVersion: 1
        });
        local.workshop.counters.turn += 1;
      } else if (kind === 'archive') {
        local.conversations.push({
          key: 'host', toolName: 'workshop_persona_jill',
          messages: [{ role: 'assistant', content: 'Retained local history.' }],
          lastActivity: now().getTime(), contextSources: [], nextArtifactNumber: 0
        });
      } else {
        local.workshop.turns.at(-1)!.content = 'A user-authored note labeled as a resume';
      }
      await store.saveNamed(named);
      await store.writeCurrent(local);
      const durableLocal = await store.readCurrent();
      await coordinator.initialize();
      await coordinator.flush();
      const sessions = (await store.list()).sessions;
      const recovery = sessions.find((entry) => entry.sessionId !== 'named')!;
      expect(sessions).toHaveLength(2);
      expect(await store.readNamed(recovery.sessionId)).toMatchObject({
        title: 'named (local recovery)', workshop: durableLocal!.workshop,
        temporal: durableLocal!.temporal, conversations: durableLocal!.conversations
      });
      expect((await store.readCurrent())?.workshop.excerpt?.text).toBe('Incoming');
      expect(coordinator.consumeRecoveryNotices()).toEqual([expect.objectContaining({
        code: 'local-session-preserved', sessionId: recovery.sessionId, recoveryFileName: recovery.fileName
      })]);
    }
  );

  it('does not create recovery on reveal when only automatic resumes differ from the accepted baseline', async () => {
    const { fs, store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Original'));
    await store.writeCurrent(checkpoint('named', 'Original'));
    await coordinator.initialize();
    await coordinator.flush();
    session.recordSessionMarker('resume', 'Session resumed automatically.');
    fs.setJson(`${directory}/${saved.fileName}`, checkpoint('named', 'Incoming change'));
    await coordinator.refreshNamedSession();
    expect(session.getExcerpt()?.text).toBe('Incoming change');
    expect((await store.list()).sessions).toHaveLength(1);
    expect(coordinator.consumeRecoveryNotices()).toEqual([]);
  });

  it.each(['reveal', 'open'] as const)('preserves conflicting local work before same-session %s', async (action) => {
    const { fs, store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Original'));
    await store.writeCurrent(checkpoint('named', 'Original'));
    await coordinator.initialize();
    await coordinator.flush();
    session.setExcerpt({ text: 'Local work', source: { kind: 'manual' } });
    fs.setJson(`${directory}/${saved.fileName}`, checkpoint('named', 'Incoming change'));
    coordinator.markDirty('local edit after Git sync');
    await coordinator.flush();
    const local = await store.readCurrent();
    if (action === 'reveal') {
      await coordinator.refreshNamedSession();
    } else {
      await coordinator.openNamed('named');
    }
    const recovery = (await store.list()).sessions.find((entry) => entry.sessionId !== 'named')!;
    expect(await store.readNamed(recovery.sessionId)).toMatchObject({ workshop: local!.workshop });
    expect(session.getExcerpt()?.text).toBe('Incoming change');
    expect((await store.readCurrent())?.workshop.excerpt?.text).toBe('Incoming change');
    expect(coordinator.consumeRecoveryNotices()[0]).toMatchObject({ code: 'local-session-preserved' });
    await coordinator.refreshNamedSession();
    expect((await store.list()).sessions).toHaveLength(2);
  });

  it.each(['startup', 'reveal'] as const)('aborts %s replacement if the recovery copy cannot be saved', async (phase) => {
    const { fs, store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Original'));
    await store.writeCurrent(checkpoint('named', 'Original'));
    if (phase === 'reveal') {
      await coordinator.initialize();
      await coordinator.flush();
      session.setExcerpt({ text: 'Local work', source: { kind: 'manual' } });
    }
    await store.writeCurrent(checkpoint('named', 'Local work'));
    fs.setJson(`${directory}/${saved.fileName}`, checkpoint('named', 'Incoming'));
    if (phase === 'reveal') {
      coordinator.markDirty('local edit');
      await coordinator.flush();
    }
    const before = fs.json(currentPath);
    jest.spyOn(store, 'saveNamed').mockRejectedValueOnce(new Error('Recovery disk full'));
    if (phase === 'startup') {
      expect((await coordinator.initialize()).restored).toBe(false);
      expect(coordinator.isCurrentCheckpointProtected()).toBe(true);
    } else {
      await expect(coordinator.refreshNamedSession()).rejects.toThrow('Recovery disk full');
      expect(session.getExcerpt()?.text).toBe('Local work');
    }
    await coordinator.flush();
    expect(fs.json(currentPath)).toEqual(before);
    expect((await store.readNamed('named'))?.workshop.excerpt?.text).toBe('Incoming');
    expect(coordinator.consumeRecoveryNotices()).toEqual([]);
  });

  it('restores and keeps autosaving an unnamed room beside an unrelated conflicted file', async () => {
    const { fs, store, session, coordinator } = setup();
    await store.writeCurrent(checkpoint('unnamed', 'Local'));
    fs.files.set(`${directory}/unrelated.json`, new TextEncoder().encode('<<<<<<< merge conflict'));
    await coordinator.initialize();
    await coordinator.flush();
    expect(session.getExcerpt()?.text).toBe('Local');
    expect(coordinator.isCurrentCheckpointProtected()).toBe(false);
    const readsBeforeReveal = fs.readDirectoryCalls;
    await coordinator.refreshNamedSession();
    expect(fs.readDirectoryCalls).toBe(readsBeforeReveal);
    session.setExcerpt({ text: 'Still recoverable', source: { kind: 'manual' } });
    coordinator.markDirty('local edit');
    await coordinator.flush();
    expect(await store.readCurrent()).toMatchObject({ workshop: { excerpt: { text: 'Still recoverable' } } });
    expect(new TextDecoder().decode(fs.files.get(`${directory}/unrelated.json`))).toBe('<<<<<<< merge conflict');
  });

  it('round-trips named autosaves through decoding without false conflicts', async () => {
    const { store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Initial'));
    await store.writeCurrent(checkpoint('named', 'Initial'));
    await coordinator.initialize();
    await coordinator.flush();
    for (const text of ['Second', 'Third']) {
      session.setExcerpt({ text, source: { kind: 'manual' } });
      coordinator.markDirty('edit');
      await coordinator.flush();
      expect(coordinator.hasPendingWrite()).toBe(false);
      expect(await store.readNamed(saved.sessionId)).toMatchObject({ workshop: { excerpt: { text } } });
      expect(await store.readCurrent()).toMatchObject({ workshop: { excerpt: { text } } });
    }
  });

  it.each(['reveal', 'delete'] as const)('preserves edits after external deletion and detaches through %s', async (action) => {
    const { fs, store, session, coordinator } = setup();
    const saved = await store.saveNamed(checkpoint('named', 'Initial'));
    await store.writeCurrent(checkpoint('named', 'Initial'));
    await coordinator.initialize();
    await coordinator.flush();
    fs.files.delete(`${directory}/${saved.fileName}`);
    session.setExcerpt({ text: 'After deletion', source: { kind: 'manual' } });
    coordinator.markDirty('edit after deletion');
    await coordinator.flush();
    expect(coordinator.hasPendingWrite()).toBe(true);
    expect(await store.readCurrent()).toMatchObject({ workshop: { excerpt: { text: 'After deletion' } } });
    if (action === 'reveal') {
      await coordinator.refreshNamedSession();
    } else {
      await coordinator.deleteNamed(saved.sessionId);
    }
    expect(coordinator.consumeRecoveryNotices()).toEqual([expect.objectContaining({ code: 'named-session-missing' })]);
    session.setExcerpt({ text: 'Detached work', source: { kind: 'manual' } });
    coordinator.markDirty('detached edit');
    await coordinator.flush();
    expect(coordinator.hasPendingWrite()).toBe(false);
    expect(await store.readCurrent()).toMatchObject({ workshop: { excerpt: { text: 'Detached work' } } });
    // A deliberately detached room stays detached on reveal if Git restores it.
    fs.setJson(`${directory}/${saved.fileName}`, checkpoint('named', 'Returned by Git'));
    await coordinator.refreshNamedSession();
    expect(session.getExcerpt()?.text).toBe('Detached work');
  });

  it('rolls back when a named file changes during promotion and retains the prior write baseline', async () => {
    const { fs, store, session, coordinator } = setup();
    await store.saveNamed(checkpoint('old', 'Original'));
    const incoming = await store.saveNamed(checkpoint('incoming', 'First read'));
    await store.writeCurrent(checkpoint('old', 'Original'));
    await coordinator.initialize();
    await coordinator.flush();
    const previousCurrent = fs.json(currentPath);
    const replacement = checkpoint('incoming', 'Changed during hydration');
    const read = store.readNamedWithRecovery.bind(store);
    jest.spyOn(store, 'readNamedWithRecovery').mockImplementationOnce(async (id) => {
      const first = await read(id);
      fs.setJson(`${directory}/${incoming.fileName}`, replacement);
      return first;
    });

    await expect(coordinator.openNamed('incoming')).rejects.toThrow('changed on disk');
    expect(session.getExcerpt()?.text).toBe('Original');
    expect(fs.json(currentPath)).toEqual(previousCurrent);
    expect(fs.json(`${directory}/${incoming.fileName}`)).toEqual(replacement);
    coordinator.markDirty('continue original');
    await coordinator.flush();
    expect(coordinator.hasPendingWrite()).toBe(false);
    expect(await store.readNamed('old')).toMatchObject({ workshop: { excerpt: { text: 'Original' } } });
  });

  it('does not append extra resume markers for duplicate first-load requests', async () => {
    const { store, coordinator } = setup();
    await store.saveNamed(checkpoint('named', 'Initial'));
    await store.writeCurrent(checkpoint('named', 'Initial'));
    await Promise.all([
      coordinator.initialize(),
      coordinator.refreshNamedSession(),
      coordinator.refreshNamedSession()
    ]);
    await coordinator.flush();
    expect((await store.readCurrent())?.workshop.turns.filter((turn) => turn.artifact === 'session_resume'))
      .toHaveLength(0);
  });

  it('reports both failures if the named save and rolling recovery fail', async () => {
    const { fs, store, session, coordinator } = setup();
    await store.saveNamed(checkpoint('named', 'Initial'));
    await store.writeCurrent(checkpoint('named', 'Initial'));
    await coordinator.initialize();
    await coordinator.flush();
    const statuses: Array<{ error?: string }> = [];
    coordinator.addSessionSaveStatusListener((status) => statuses.push(status));
    jest.spyOn(fs, 'rename').mockRejectedValue(new Error('disk offline'));
    session.setExcerpt({ text: 'Not yet on disk', source: { kind: 'manual' } });
    coordinator.markDirty('edit');
    await coordinator.flush();
    expect(coordinator.hasPendingWrite()).toBe(true);
    expect(statuses.at(-1)?.error).toContain('disk offline');
    expect(statuses.at(-1)?.error).toContain('Local recovery also failed: disk offline');
    expect(session.getExcerpt()?.text).toBe('Not yet on disk');
  });

  it('holds the operation guard across context scanning and queues a second load', async () => {
    const { coordinator } = setup();
    await coordinator.initialize();
    await coordinator.flush();
    let finish!: () => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    const secondScan = jest.fn(async () => undefined);
    const first = coordinator.refreshNamedSession(async () => {
      started();
      await new Promise<void>((resolve) => { finish = resolve; });
    });
    await startedPromise;
    const second = coordinator.refreshNamedSession(secondScan);
    expect(coordinator.isSessionOperationPending()).toBe(true);
    expect(secondScan).not.toHaveBeenCalled();
    finish();
    await Promise.all([first, second]);
    expect(secondScan).toHaveBeenCalledTimes(1);
    expect(coordinator.isSessionOperationPending()).toBe(false);
  });
});
