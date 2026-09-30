import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import type {
  WorkshopConversationExportTarget,
  WorkshopConversationImportTarget,
  AssistantToolService
} from '@services/analysis/AssistantToolService';
import { ConversationManager } from '@orchestration/ConversationManager';
import { DEFAULT_WORKSHOP_WRITER_PROFILE } from '@messages';
import type { LogSink, Workspace } from '@/platform';
import type { WorkshopConversationLogicalKey } from '@/application/services/workshop/WorkshopSessionStateV1';
import { runCanonicalScriptedRoom } from './ScriptedWorkshopRoom';

const root = '/workspace/novel';
const now = () => new Date('2026-09-30T12:00:00.000Z');
const workspace: Workspace = {
  workspaceFolders: () => [{ name: 'novel', path: root }],
  extensionPath: '/extension',
  asRelativePath: (value) => value,
  findFiles: async () => []
};

function scriptedCheckpoint(sessionId: string): WorkshopPersistedSessionV2 {
  const room = runCanonicalScriptedRoom();
  const workshop = room.session.exportCommittedState();
  return JSON.parse(JSON.stringify({
    schemaVersion: 2,
    sessionId,
    title: 'Scripted room',
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
    temporal: new WorkshopSessionTimeService({ now }).exportState(),
    summary: {
      hostPersonaId: workshop.participants.host.personaId,
      participantPersonaIds: [workshop.participants.host.personaId],
      turnCount: workshop.turns.length,
      excerptWordCount: 0
    },
    workshop,
    conversations: room.archive()
  })) as WorkshopPersistedSessionV2;
}

function setup() {
  const fs = new MemoryFileSystem();
  const log: LogSink = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
  const store = new WorkshopSessionStore(fs, workspace, log, now);
  const session = new WorkshopSessionService(() => now().getTime());
  const manager = new ConversationManager();
  const assistant = {
    exportWorkshopConversationArchive: jest.fn(
      (targets: WorkshopConversationExportTarget<WorkshopConversationLogicalKey>[]) =>
        manager.exportConversations(targets.map(({ key, conversationId }) => ({ key, conversationId })))
    ),
    importWorkshopConversationArchive: jest.fn(
      async (targets: WorkshopConversationImportTarget<WorkshopConversationLogicalKey>[]) =>
        manager.importConversations(
          targets.map(({ entry }) => ({ entry, systemMessage: `${entry.toolName} system` }))
        )
    ),
    discardConversation: jest.fn((id: string) => manager.deleteConversation(id)),
    readWorkshopRetainedHistory: jest.fn((id: string) => manager.getCommittedHistoryCounts(id))
  } as unknown as AssistantToolService;
  const settings = {
    getWriterProfile: () => DEFAULT_WORKSHOP_WRITER_PROFILE
  } as WorkshopConversationSettingsService;
  let nextId = 0;
  const coordinator = new WorkshopSessionPersistenceCoordinator(
    session,
    assistant,
    settings,
    new WorkshopSessionTimeService({ now }),
    store,
    log,
    { now, idFactory: () => `room-${++nextId}`, ensureAssistantReady: async () => undefined }
  );
  return { store, session, coordinator, log };
}

describe('retained-history marks through the persistence coordinator (ADR 2026-09-30 §3)', () => {
  it('opens a saved session with its marks exactly as written', async () => {
    const { store, session, coordinator } = setup();
    const checkpoint = scriptedCheckpoint('scripted');
    await store.saveNamed(checkpoint);
    await coordinator.initialize();

    await coordinator.openNamed('scripted');

    expect(session.exportCommittedState().retainedHistoryMarks)
      .toEqual(checkpoint.workshop.retainedHistoryMarks);
  });

  it('baselines a session saved before rewind support from the archive it imported', async () => {
    const { store, session, coordinator } = setup();
    const legacy = scriptedCheckpoint('legacy');
    delete legacy.workshop.retainedHistoryMarks;
    await store.saveNamed(legacy);
    await coordinator.initialize();

    await coordinator.openNamed('legacy');

    const head = legacy.workshop.turns.at(-1)!.id;
    expect(session.exportCommittedState().retainedHistoryMarks).toEqual(
      legacy.conversations.map((entry) => expect.objectContaining({
        turnId: head,
        conversationKey: entry.key,
        messageCount: entry.messages.length,
        contextSourceCount: entry.contextSources.length,
        origin: 'baseline'
      }))
    );
  });

  it('does not preserve a "local recovery" copy when baselines are the only difference', async () => {
    const { store, coordinator } = setup();
    const legacy = scriptedCheckpoint('shared-id');
    delete legacy.workshop.retainedHistoryMarks;
    // Restored from current.json alone: the room carries unsaved-work status
    // and freshly recorded baselines.
    await store.writeCurrent(legacy);
    await coordinator.initialize();
    // The same session then arrives as a named file (for example, Git sync).
    await store.saveNamed(legacy);

    await coordinator.openNamed('shared-id');

    const listed = await coordinator.list();
    expect(listed.sessions.map((summary) => summary.title))
      .not.toContainEqual(expect.stringContaining('(local recovery)'));
    expect(coordinator.consumeRecoveryNotices()).toEqual([]);
  });
});
