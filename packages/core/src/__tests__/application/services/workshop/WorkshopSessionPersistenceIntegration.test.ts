import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';
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

function setup() {
  const fs = new MemoryFileSystem();
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
    expect(session.exportCommittedState().turns.filter((turn) => turn.artifact === 'session_resume')).toHaveLength(1);
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
    const { fs, store, session, coordinator, ready } = setup();
    await store.saveNamed(checkpoint('old', 'Original'));
    const incoming = await store.saveNamed(checkpoint('incoming', 'First read'));
    await store.writeCurrent(checkpoint('old', 'Original'));
    await coordinator.initialize();
    await coordinator.flush();
    const previousCurrent = fs.json(currentPath);
    const replacement = checkpoint('incoming', 'Changed during hydration');
    ready.mockImplementationOnce(async () => { fs.setJson(`${directory}/${incoming.fileName}`, replacement); });

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
      .toHaveLength(1);
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
