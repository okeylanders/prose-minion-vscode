import {
  WorkshopSessionPersistenceCoordinator
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import {
  WorkshopPersistedSessionV1
} from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type {
  WorkshopSessionStore,
  WorkshopStoredSessionSummary
} from '@/infrastructure/storage/WorkshopSessionStore';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE
} from '@messages';
import type { LogSink } from '@/platform';

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const summary = (
  session: WorkshopPersistedSessionV1,
  fileName = 'saved.json'
): WorkshopStoredSessionSummary => ({
  sessionId: session.sessionId,
  title: session.title,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  savedAt: session.savedAt,
  startedAt: session.temporal.startedAt,
  timezone: session.temporal.timezone,
  hostPersonaId: session.summary.hostPersonaId,
  participantPersonaIds: [...session.summary.participantPersonaIds],
  turnCount: session.summary.turnCount,
  excerptWordCount: session.summary.excerptWordCount,
  excerptLabel: session.summary.excerptLabel,
  excerptIdentity: session.summary.excerptIdentity,
  preview: session.summary.preview,
  fileName
});

describe('WorkshopSessionPersistenceCoordinator', () => {
  let now: Date;
  let nextId: number;
  let current: WorkshopPersistedSessionV1 | undefined;
  let named: WorkshopPersistedSessionV1[];
  let session: WorkshopSessionService;
  let time: WorkshopSessionTimeService;
  let assistant: jest.Mocked<AssistantToolService>;
  let store: jest.Mocked<WorkshopSessionStore>;
  let settings: jest.Mocked<WorkshopConversationSettingsService>;
  let log: LogSink;

  const createCoordinator = (
    ensureAssistantReady: () => PromiseLike<unknown> = async () => undefined
  ): WorkshopSessionPersistenceCoordinator =>
    new WorkshopSessionPersistenceCoordinator(
      session,
      assistant,
      settings,
      time,
      store,
      log,
      {
        now: () => now,
        idFactory: () => `session-${++nextId}`,
        ensureAssistantReady
      }
    );

  const persistedSession = (
    id: string,
    title: string,
    excerpt: string
  ): WorkshopPersistedSessionV1 => {
    const source = new WorkshopSessionService(() => now.getTime());
    source.setExcerpt({ text: excerpt, source: { kind: 'manual' } });
    source.recordSessionMarker('start', 'Session started before restart.');
    const sourceTime = new WorkshopSessionTimeService({
      now: () => now,
      timezone: 'America/Chicago'
    });
    return {
      schemaVersion: 1,
      sessionId: id,
      title,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      temporal: sourceTime.exportState(),
      summary: {
        hostPersonaId: 'jill',
        participantPersonaIds: ['jill'],
        turnCount: 1,
        excerptWordCount: excerpt.split(/\s+/).length
      },
      workshop: source.exportCommittedState(),
      conversations: []
    };
  };

  beforeEach(() => {
    now = new Date('2026-07-23T14:00:00.000Z');
    nextId = 0;
    current = undefined;
    named = [];
    session = new WorkshopSessionService(() => now.getTime());
    time = new WorkshopSessionTimeService({
      now: () => now,
      timezone: 'America/Chicago'
    });
    assistant = {
      exportWorkshopConversationArchive: jest.fn().mockReturnValue([]),
      importWorkshopConversationArchive: jest.fn().mockResolvedValue([]),
      discardConversation: jest.fn()
    } as unknown as jest.Mocked<AssistantToolService>;
    settings = {
      getWriterProfile: jest.fn().mockReturnValue({
        ...DEFAULT_WORKSHOP_WRITER_PROFILE,
        enabled: true,
        preferredAddress: 'SECRET PROFILE NAME',
        bio: 'SECRET PROFILE BIO'
      })
    } as unknown as jest.Mocked<WorkshopConversationSettingsService>;
    store = {
      availability: jest.fn().mockReturnValue({
        available: true,
        rootPath: '/workspace',
        sessionsDirectory: '/workspace/prose-minion/sessions',
        currentPath: '/workspace/prose-minion/sessions/current.json'
      }),
      readCurrent: jest.fn(async () => current),
      writeCurrent: jest.fn(async (next: WorkshopPersistedSessionV1) => {
        current = JSON.parse(JSON.stringify(next)) as WorkshopPersistedSessionV1;
      }),
      saveNamed: jest.fn(async (next: WorkshopPersistedSessionV1) => {
        named.push(next);
        return summary(next);
      }),
      updateNamed: jest.fn(async (id: string, next: WorkshopPersistedSessionV1) => {
        const index = named.findIndex((entry) => entry.sessionId === id);
        if (index < 0) {
          throw new Error(`Named Workshop session ${id} was not found.`);
        }
        named[index] = next;
        return summary(next, `saved-${index}.json`);
      }),
      list: jest.fn(async () => ({
        current: current ? summary(current, 'current.json') : undefined,
        sessions: named.map((entry, index) => summary(entry, `saved-${index}.json`)),
        truncated: false,
        searchTruncated: false
      })),
      readNamed: jest.fn(async (id: string) =>
        named.find((entry) => entry.sessionId === id)
      ),
      renameNamed: jest.fn(),
      duplicateNamed: jest.fn(),
      deleteNamed: jest.fn(),
      resolveRevealPath: jest.fn()
    } as unknown as jest.Mocked<WorkshopSessionStore>;
    log = {
      appendLine: jest.fn(),
      show: jest.fn(),
      clear: jest.fn()
    };
  });

  it('creates a visible start boundary and atomically captures full product state', async () => {
    session.setExcerpt({ text: 'A complete pinned excerpt.', source: { kind: 'manual' } });
    const coordinator = createCoordinator();

    await coordinator.initialize();
    await coordinator.flush();

    expect(current?.workshop.excerpt?.text).toBe('A complete pinned excerpt.');
    expect(current?.workshop.turns.at(-1)?.artifact).toBe('session_start');
    expect(current?.summary.excerptWordCount).toBe(4);
    expect(JSON.stringify(current)).not.toContain('SECRET PROFILE');
    expect(store.writeCurrent).toHaveBeenCalled();
  });

  it('restores the actual aggregate, adds one resume boundary, and does not repeat it', async () => {
    const sourceSession = new WorkshopSessionService(() => now.getTime());
    sourceSession.setExcerpt({ text: 'The restored manuscript.', source: { kind: 'manual' } });
    sourceSession.recordSessionMarker('start', 'Session started before restart.');
    const sourceTime = new WorkshopSessionTimeService({
      now: () => now,
      timezone: 'America/Chicago'
    });
    current = {
      schemaVersion: 1,
      sessionId: 'persisted-id',
      title: 'Restored room',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      temporal: sourceTime.exportState(),
      summary: {
        hostPersonaId: 'jill',
        participantPersonaIds: ['jill'],
        turnCount: 1,
        excerptWordCount: 3
      },
      workshop: sourceSession.exportCommittedState(),
      conversations: []
    };
    const coordinator = createCoordinator();

    const first = await coordinator.initialize();
    const second = await coordinator.initialize();

    expect(first.restored).toBe(true);
    expect(second).toBe(first);
    expect(session.getExcerpt()?.text).toBe('The restored manuscript.');
    expect(session.getSnapshot().turns.map((turn) => turn.artifact))
      .toEqual(['session_start', 'session_resume']);
  });

  it('resumes the exact associated named checkpoint when current and named share an identity', async () => {
    current = persistedSession('named-current', 'Living room', 'The restored manuscript.');
    named.push(JSON.parse(JSON.stringify(current)) as WorkshopPersistedSessionV1);
    const statuses: string[] = [];
    const coordinator = createCoordinator();
    coordinator.addNamedSaveStatusListener((_sessionId, status) => statuses.push(status));

    await coordinator.initialize();
    await coordinator.flush();

    expect(store.updateNamed).toHaveBeenCalledWith(
      'named-current',
      expect.objectContaining({ sessionId: 'named-current', title: 'Living room' })
    );
    expect(named[0].workshop.turns.at(-1)?.artifact).toBe('session_resume');
    expect(statuses).toEqual(['saving', 'saved']);
  });

  it('preflights a malformed aggregate before importing any provider history', async () => {
    const valid = new WorkshopSessionService(() => now.getTime()).exportCommittedState();
    current = {
      schemaVersion: 1,
      sessionId: 'bad-product',
      title: 'Bad product state',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      temporal: time.exportState(),
      summary: {
        hostPersonaId: 'jill',
        participantPersonaIds: ['jill'],
        turnCount: 0,
        excerptWordCount: 0
      },
      workshop: {
        ...valid,
        counters: { ...valid.counters, turn: -1 }
      },
      conversations: [{
        key: 'host',
        toolName: 'workshop_persona_jill',
        messages: [],
        lastActivity: now.getTime(),
        contextSources: [],
        nextArtifactNumber: 0
      }]
    };

    const coordinator = createCoordinator();
    await coordinator.initialize();
    coordinator.markDirty('must not replace unreadable current');
    await coordinator.flush();

    expect(assistant.importWorkshopConversationArchive).not.toHaveBeenCalled();
    expect(session.getSnapshot().turns.at(-1)?.artifact).toBe('session_start');
    expect(store.writeCurrent).not.toHaveBeenCalled();
    expect(coordinator.isCurrentCheckpointProtected()).toBe(true);
  });

  it('allows a named rescue checkpoint while unreadable current autosave remains protected', async () => {
    store.readCurrent.mockRejectedValueOnce(new Error('current.json is malformed'));
    const coordinator = createCoordinator();
    await coordinator.initialize();

    session.setExcerpt({ text: 'Work recovered in memory.', source: { kind: 'manual' } });
    coordinator.markDirty('must remain in memory');
    const rescued = await coordinator.saveNamed('Recovered room');
    await coordinator.flush();

    expect(rescued.title).toBe('Recovered room');
    expect(named.at(-1)?.workshop.excerpt?.text).toBe('Work recovered in memory.');
    expect(store.writeCurrent).not.toHaveBeenCalled();
    expect(coordinator.isCurrentCheckpointProtected()).toBe(true);
  });

  it('resumes rolling autosave only after an explicit session replacement succeeds', async () => {
    store.readCurrent.mockRejectedValueOnce(new Error('current.json is malformed'));
    named.push(persistedSession('healthy-room', 'Healthy room', 'A recoverable checkpoint.'));
    const coordinator = createCoordinator();
    await coordinator.initialize();

    await coordinator.openNamed('healthy-room');
    session.setExcerpt({ text: 'Changed after repair.', source: { kind: 'manual' } });
    coordinator.markDirty('rolling recovery repaired');
    await coordinator.flush();

    expect(coordinator.isCurrentCheckpointProtected()).toBe(false);
    expect(current?.sessionId).toBe('healthy-room');
    expect(current?.workshop.excerpt?.text).toBe('Changed after repair.');
  });

  it('refuses to serialize the aggregate/provider seam while a run is active', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    await coordinator.flush();
    store.writeCurrent.mockClear();
    session.setExcerpt({ text: 'Pinned.', source: { kind: 'manual' } });
    session.beginPersonaMessage('request-1', 'An uncommitted writer turn.');

    coordinator.markDirty('should defer');
    await coordinator.flush();

    expect(store.writeCurrent).not.toHaveBeenCalled();
    expect(coordinator.hasPendingWrite()).toBe(true);
  });

  it('associates the live room with the first named checkpoint identity', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();

    const saved = await coordinator.saveNamed('My named workshop');
    await coordinator.flush();

    expect(saved.title).toBe('My named workshop');
    expect(named).toHaveLength(1);
    expect(named[0].sessionId).toBe(current?.sessionId);
    expect(named[0].savedAt).toBe(now.toISOString());
  });

  it('updates the associated named session after each committed autosave', async () => {
    const coordinator = createCoordinator();
    const statuses: Array<{ sessionId: string; status: string }> = [];
    coordinator.addNamedSaveStatusListener((sessionId, status) => {
      statuses.push({ sessionId, status });
    });
    await coordinator.initialize();
    const saved = await coordinator.saveNamed('Living room');
    await coordinator.flush();
    store.updateNamed.mockClear();
    statuses.length = 0;

    session.setExcerpt({ text: 'A named-room excerpt.', source: { kind: 'manual' } });
    session.beginPersonaMessage('turn-1', 'Keep this in the named room.');
    session.completeRun('turn-1', 'I will.', undefined, false, 'host-conversation');
    coordinator.markDirty('persona turn committed');
    await coordinator.flush();

    expect(store.updateNamed).toHaveBeenCalledWith(
      saved.sessionId,
      expect.objectContaining({
        sessionId: saved.sessionId,
        title: 'Living room',
        savedAt: now.toISOString()
      })
    );
    expect(named).toHaveLength(1);
    expect(named[0].workshop.turns.at(-1)?.content).toBe('I will.');
    expect(statuses[0]).toEqual({ sessionId: saved.sessionId, status: 'saving' });
    expect(statuses.at(-1)).toEqual({ sessionId: saved.sessionId, status: 'saved' });
  });

  it('does not report Saved while a newer named-room revision is still queued', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    const saved = await coordinator.saveNamed('Living room');
    await coordinator.flush();
    const statuses: string[] = [];
    coordinator.addNamedSaveStatusListener((_sessionId, status) => statuses.push(status));
    const firstWrite = deferred();
    store.writeCurrent.mockImplementationOnce(async () => firstWrite.promise);

    coordinator.markDirty('first queued mutation');
    coordinator.markDirty('newer queued mutation');
    await Promise.resolve();

    expect(statuses).toEqual(['saving', 'saving']);
    firstWrite.resolve();
    await coordinator.flush();

    expect(statuses).toEqual(['saving', 'saving', 'saved']);
    expect(named).toHaveLength(1);
    expect(named[0].sessionId).toBe(saved.sessionId);
  });

  it('updates an associated checkpoint by identity and never by matching title', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    const saved = await coordinator.saveNamed('Draft name');
    await coordinator.flush();
    store.writeCurrent.mockClear();
    store.updateNamed.mockClear();

    const updated = await coordinator.saveNamed('Deliberate name', saved.sessionId);
    await coordinator.flush();

    expect(updated).toMatchObject({
      sessionId: saved.sessionId,
      title: 'Deliberate name'
    });
    expect(named).toHaveLength(1);
    expect(named[0].title).toBe('Deliberate name');
    expect(store.writeCurrent.mock.invocationCallOrder[0])
      .toBeLessThan(store.updateNamed.mock.invocationCallOrder[0]);
    await expect(coordinator.saveNamed('Wrong target', 'some-other-id'))
      .rejects.toThrow('saved session changed');
  });

  it('keeps the newer current truth when an associated named mirror update fails', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    const saved = await coordinator.saveNamed('Before');
    await coordinator.flush();
    const statuses: string[] = [];
    coordinator.addNamedSaveStatusListener((_sessionId, status) => statuses.push(status));
    store.updateNamed.mockRejectedValueOnce(new Error('named mirror unavailable'));

    await expect(coordinator.saveNamed('After', saved.sessionId))
      .rejects.toThrow('named mirror unavailable');

    expect(current?.title).toBe('After');
    expect(named[0].title).toBe('Before');
    expect(statuses).toEqual(['saving', 'error']);

    coordinator.markDirty('repair named mirror');
    await coordinator.flush();

    expect(named[0].title).toBe('After');
    expect(statuses.at(-1)).toBe('saved');
  });

  it('renames an active named room through the same current-first snapshot update', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    const saved = await coordinator.saveNamed('Before');
    await coordinator.flush();
    store.writeCurrent.mockClear();
    store.updateNamed.mockClear();

    const renamed = await coordinator.renameNamed(saved.sessionId, 'After');

    expect(renamed.title).toBe('After');
    expect(store.renameNamed).not.toHaveBeenCalled();
    expect(store.writeCurrent.mock.invocationCallOrder[0])
      .toBeLessThan(store.updateNamed.mock.invocationCallOrder[0]);
    expect(current?.title).toBe('After');
    expect(named[0].title).toBe('After');
  });

  it('settles assistant readiness before reading either half of a coherent snapshot', async () => {
    let readiness: PromiseLike<unknown> = Promise.resolve();
    let onReadiness = (): void => undefined;
    const coordinator = createCoordinator(() => {
      onReadiness();
      return readiness;
    });
    await coordinator.initialize();
    await coordinator.flush();

    session.setExcerpt({ text: 'Initial pinned excerpt.', source: { kind: 'manual' } });
    session.beginPersonaMessage('host-run', 'Remember this.');
    session.completeRun('host-run', 'I will.', undefined, false, 'host-conversation');
    const ready = deferred();
    const readinessEntered = deferred();
    readiness = ready.promise;
    onReadiness = () => readinessEntered.resolve();
    const exportAggregate = jest.spyOn(session, 'exportCommittedState');
    const exportTemporal = jest.spyOn(time, 'exportState');
    assistant.exportWorkshopConversationArchive.mockImplementation(() => {
      expect(exportAggregate).toHaveBeenCalled();
      expect(exportTemporal).not.toHaveBeenCalled();
      return [];
    });

    coordinator.markDirty('coherent capture');
    await readinessEntered.promise;
    session.setExcerpt({ text: 'Changed before readiness settled.', source: { kind: 'manual' } });
    ready.resolve();
    await coordinator.flush();

    expect(current?.workshop.excerpt?.text).toBe('Changed before readiness settled.');
    expect(exportAggregate.mock.invocationCallOrder[0])
      .toBeLessThan(assistant.exportWorkshopConversationArchive.mock.invocationCallOrder[0]);
    expect(assistant.exportWorkshopConversationArchive.mock.invocationCallOrder[0])
      .toBeLessThan(exportTemporal.mock.invocationCallOrder[0]);
  });

  it('does not mutate the live title when a named save fails', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    await coordinator.flush();
    const originalTitle = current?.title;
    store.saveNamed.mockRejectedValueOnce(new Error('disk full'));

    await expect(coordinator.saveNamed('A title that must not leak')).rejects.toThrow('disk full');
    coordinator.markDirty('subsequent live mutation');
    await coordinator.flush();

    expect(current?.title).toBe(originalTitle);
  });

  it('uses the filtered list result as the sole source of the current summary', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    await coordinator.flush();
    store.readCurrent.mockClear();
    const filtered = persistedSession('filtered-current', 'Filtered current', 'Matched words.');
    store.list.mockResolvedValueOnce({
      current: summary(filtered, 'current.json'),
      sessions: [],
      truncated: false,
      searchTruncated: false
    });

    const result = await coordinator.list('matched');

    expect(store.list).toHaveBeenCalledWith('matched');
    expect(store.readCurrent).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({
      sessionId: 'filtered-current',
      title: 'Filtered current',
      kind: 'current',
      fileName: 'current.json'
    });
  });

  it('flushes a pending rolling checkpoint before listing sessions', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    await coordinator.flush();
    session.setExcerpt({
      text: 'The browser should see this immediately.',
      source: { kind: 'manual' }
    });
    coordinator.markDirty('immediate browser open');

    const result = await coordinator.list();

    expect(result.current?.excerptWordCount).toBe(6);
    expect(store.writeCurrent.mock.invocationCallOrder.at(-1))
      .toBeLessThan(store.list.mock.invocationCallOrder.at(-1)!);
  });

  it('never retargets a live room when the workspace root changes', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    await coordinator.flush();
    store.writeCurrent.mockClear();

    store.availability.mockReturnValue({
      available: false,
      reason: 'multi-root'
    });
    session.setExcerpt({ text: 'Still belongs to workspace A.', source: { kind: 'manual' } });
    coordinator.markDirty('workspace became multi-root');
    await coordinator.flush();

    store.availability.mockReturnValue({
      available: true,
      rootPath: '/workspace-b',
      sessionsDirectory: '/workspace-b/prose-minion/sessions',
      currentPath: '/workspace-b/prose-minion/sessions/current.json'
    });
    coordinator.markDirty('workspace became single-root B');
    await coordinator.flush();

    expect(store.writeCurrent).not.toHaveBeenCalled();
    expect(coordinator.isCurrentCheckpointProtected()).toBe(true);
    await expect(coordinator.saveNamed('Must not cross roots'))
      .rejects.toThrow('workspace changed');
    expect(store.saveNamed).not.toHaveBeenCalled();
  });

  it('rolls back an open whose durable current promotion fails without retiring old history', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    await coordinator.flush();
    session.setExcerpt({ text: 'The live room.', source: { kind: 'manual' } });
    session.beginPersonaMessage('old-run', 'Stay with this.');
    session.completeRun('old-run', 'Still here.', undefined, false, 'old-host');
    time.hydrate(time.exportState(), ['host']);
    named.push(persistedSession('other-room', 'Other room', 'A different room.'));
    store.writeCurrent.mockRejectedValueOnce(new Error('promotion failed'));

    await expect(coordinator.openNamed('other-room')).rejects.toThrow('promotion failed');

    expect(session.getExcerpt()?.text).toBe('The live room.');
    expect(session.getHostConversationId()).toBe('old-host');
    expect(assistant.discardConversation).not.toHaveBeenCalledWith('old-host');
    expect(time.prepareNotice('host')).toMatchObject({ reason: 'session_resume' });
  });

  it('retires prior histories only after an opened session is durably promoted', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    await coordinator.flush();
    session.setExcerpt({ text: 'The live room.', source: { kind: 'manual' } });
    session.beginPersonaMessage('old-run', 'Stay with this.');
    session.completeRun('old-run', 'Still here.', undefined, false, 'old-host');
    named.push(persistedSession('other-room', 'Other room', 'A different room.'));
    const writeStarted = deferred();
    const allowWrite = deferred();
    store.writeCurrent.mockImplementationOnce(async (next) => {
      writeStarted.resolve();
      await allowWrite.promise;
      current = JSON.parse(JSON.stringify(next)) as WorkshopPersistedSessionV1;
    });

    const opening = coordinator.openNamed('other-room');
    await writeStarted.promise;
    expect(assistant.discardConversation).not.toHaveBeenCalledWith('old-host');

    allowWrite.resolve();
    await opening;
    expect(assistant.discardConversation).toHaveBeenCalledWith('old-host');
  });

  it('rolls back New when durable current promotion fails', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    await coordinator.flush();
    session.setExcerpt({ text: 'Keep this workspace.', source: { kind: 'manual' } });
    session.beginPersonaMessage('old-run', 'Keep this thread.');
    session.completeRun('old-run', 'Kept.', undefined, false, 'old-host');
    store.writeCurrent.mockRejectedValueOnce(new Error('new promotion failed'));

    await expect(coordinator.resetSession()).rejects.toThrow('new promotion failed');

    expect(session.getExcerpt()?.text).toBe('Keep this workspace.');
    expect(session.getHostConversationId()).toBe('old-host');
    expect(assistant.discardConversation).not.toHaveBeenCalledWith('old-host');
  });

  it('waits for initialization before beginning a session mutation', async () => {
    const initialRead = deferred<WorkshopPersistedSessionV1 | undefined>();
    store.readCurrent.mockImplementationOnce(() => initialRead.promise);
    const coordinator = createCoordinator();

    const saving = coordinator.saveNamed('After initialization');
    expect(coordinator.isSessionOperationPending()).toBe(true);
    await Promise.resolve();
    expect(store.saveNamed).not.toHaveBeenCalled();

    initialRead.resolve(undefined);
    await saving;
    expect(coordinator.isSessionOperationPending()).toBe(false);
    expect(store.saveNamed).toHaveBeenCalledTimes(1);
  });

  it('serializes named and replacement operations against one another', async () => {
    const coordinator = createCoordinator();
    await coordinator.initialize();
    await coordinator.flush();
    named.push(persistedSession('other-room', 'Other room', 'A different room.'));
    const saveStarted = deferred();
    const allowSave = deferred();
    store.saveNamed.mockImplementationOnce(async (next) => {
      saveStarted.resolve();
      await allowSave.promise;
      return summary(next);
    });

    const saving = coordinator.saveNamed('First operation');
    await saveStarted.promise;
    const opening = coordinator.openNamed('other-room');
    await Promise.resolve();
    expect(store.readNamed).not.toHaveBeenCalled();

    allowSave.resolve();
    await saving;
    await opening;
    expect(store.readNamed).toHaveBeenCalledWith('other-room');
  });
});
