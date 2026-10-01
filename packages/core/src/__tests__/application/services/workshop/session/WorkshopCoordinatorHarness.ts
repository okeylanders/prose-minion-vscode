/**
 * A persistence coordinator over real collaborators, for retained-history and
 * rewind tests: an in-memory workspace store, the real aggregate, a real
 * ConversationManager behind the assistant seam, and the real time service.
 */

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
import { runCanonicalScriptedRoom, ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';

export const HARNESS_ROOT = '/workspace/novel';
export const harnessNow = () => new Date('2026-09-30T12:00:00.000Z');

const workspaceWith = (folders: Array<{ name: string; path: string }>): Workspace => ({
  workspaceFolders: () => folders,
  extensionPath: '/extension',
  asRelativePath: (value) => value,
  findFiles: async () => []
});

/** A scripted room as the persisted checkpoint a session file would hold. */
export function scriptedCheckpoint(
  sessionId: string,
  room: ScriptedWorkshopRoom = runCanonicalScriptedRoom()
): WorkshopPersistedSessionV2 {
  const workshop = room.session.exportCommittedState();
  return JSON.parse(JSON.stringify({
    schemaVersion: 2,
    sessionId,
    title: 'Scripted room',
    createdAt: harnessNow().toISOString(),
    updatedAt: harnessNow().toISOString(),
    temporal: new WorkshopSessionTimeService({ now: harnessNow }).exportState(),
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

export function setupCoordinator(options: { workspace?: 'single' | 'none' } = {}) {
  const fs = new MemoryFileSystem();
  const log: LogSink = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
  const workspace = workspaceWith(
    options.workspace === 'none' ? [] : [{ name: 'novel', path: HARNESS_ROOT }]
  );
  const store = new WorkshopSessionStore(fs, workspace, log, harnessNow);
  const session = new WorkshopSessionService(() => harnessNow().getTime());
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
  };
  const settings = {
    getWriterProfile: () => DEFAULT_WORKSHOP_WRITER_PROFILE
  } as WorkshopConversationSettingsService;
  const time = new WorkshopSessionTimeService({ now: harnessNow });
  let nextId = 0;
  const coordinator = new WorkshopSessionPersistenceCoordinator(
    session,
    assistant as unknown as AssistantToolService,
    settings,
    time,
    store,
    log,
    { now: harnessNow, idFactory: () => `room-${++nextId}`, ensureAssistantReady: async () => undefined }
  );
  return { fs, store, session, manager, assistant, time, coordinator, log };
}
