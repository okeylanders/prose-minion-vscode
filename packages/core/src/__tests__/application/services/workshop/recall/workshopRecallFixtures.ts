/**
 * Session-recall fixtures: a REAL saved session full of hidden sentinels, and
 * a light builder for synthetic sessions that only exercise recall's own
 * rules (positions, ranking, rendering).
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import {
  WorkshopSessionPersistenceCoordinator
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { messageAttachmentSnapshot } from '@/application/services/workshop/WorkshopSessionRecords';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  WorkshopPersonaId,
  WorkshopSessionScope,
  WorkshopTurn
} from '@messages';
import type { LogSink, Workspace } from '@/platform';

/**
 * Every body the thread hides, one marker each. Recall output may contain
 * none of them; the labels in RECALL_VISIBLE_LABELS must survive.
 */
export const RECALL_SENTINELS = {
  /** A writer-message attachment's text: a host-private thread artifact. */
  threadArtifactBody: 'SENTINEL-THREAD-ARTIFACT-BODY',
  threadArtifactPath: 'SENTINEL-THREAD-ARTIFACT-PATH',
  /** Capability evidence persisted in a completed run's artifact turn. */
  evidenceBody: 'SENTINEL-EVIDENCE-BODY',
  /** The last turn's evidence, which the real summary copies into `preview`. */
  previewEvidence: 'SENTINEL-PREVIEW-EVIDENCE',
  /** The retained provider conversation. */
  conversationArchive: 'SENTINEL-CONVERSATION-ARCHIVE',
  contextFileBody: 'SENTINEL-CONTEXT-FILE-BODY',
  contextNoteBody: 'SENTINEL-CONTEXT-NOTE-BODY',
  excerptText: 'SENTINEL-EXCERPT-TEXT',
  /** The excerpt's path, which the real summary records as `excerptIdentity`. */
  excerptIdentity: 'SENTINEL-EXCERPT-IDENTITY'
} as const;

export const RECALL_VISIBLE_LABELS = {
  title: 'Lighthouse at dusk',
  attachment: 'letters.md',
  contextFile: 'keeper-notes.md',
  contextNote: 'Tide tables',
  excerpt: 'chapter-6.md',
  writerText: 'Read the letters before you answer about the lighthouse.',
  reply: 'The letters circle the lighthouse keeper and his mother.'
} as const;

export const RECALL_ROOT = '/workspace/novel';
export const RECALL_WORKSPACE: Workspace = {
  workspaceFolders: () => [{ name: 'novel', path: RECALL_ROOT }],
  extensionPath: '/extension',
  asRelativePath: (value) => value,
  findFiles: async () => []
};

export const recallLog = (): LogSink & { appendLine: jest.Mock } => ({
  appendLine: jest.fn(),
  clear: jest.fn(),
  show: jest.fn()
});

export interface SavedRecallRoom {
  fs: MemoryFileSystem;
  store: WorkshopSessionStore;
  coordinator: WorkshopSessionPersistenceCoordinator;
  log: LogSink & { appendLine: jest.Mock };
  savedSessionId: string;
}

/**
 * Build a room through the real aggregate, save it through the real
 * coordinator and store, then start a fresh live room so the saved one is
 * recallable. `populate` drives the aggregate; `advance` moves its clock.
 */
export async function saveRecallRoom(
  title: string,
  populate: (session: WorkshopSessionService, advance: (milliseconds: number) => void) => void,
  options: { workspace?: Workspace; fs?: MemoryFileSystem; idPrefix?: string } = {}
): Promise<SavedRecallRoom> {
  const fs = options.fs ?? new MemoryFileSystem();
  const log = recallLog();
  let clock = Date.parse('2026-10-03T19:00:00.000Z');
  const now = () => new Date(clock);
  const store = new WorkshopSessionStore(fs, options.workspace ?? RECALL_WORKSPACE, log, now);
  const session = new WorkshopSessionService(() => clock);
  const assistant = {
    exportWorkshopConversationArchive: jest.fn(() => [{
      key: 'host',
      toolName: 'workshop-persona',
      messages: [
        { role: 'user', content: `Context: ${RECALL_SENTINELS.conversationArchive}` },
        { role: 'assistant', content: `Noted ${RECALL_SENTINELS.conversationArchive}.` }
      ],
      lastActivity: clock,
      contextSources: [],
      nextArtifactNumber: 1
    }]),
    importWorkshopConversationArchive: jest.fn(async () => []),
    discardConversation: jest.fn()
  } as unknown as AssistantToolService;
  const settings = {
    getWriterProfile: () => DEFAULT_WORKSHOP_WRITER_PROFILE
  } as unknown as WorkshopConversationSettingsService;
  let nextId = 0;
  const coordinator = new WorkshopSessionPersistenceCoordinator(
    session,
    assistant,
    settings,
    new WorkshopSessionTimeService({ now, timezone: 'America/Chicago' }),
    store,
    log,
    {
      now,
      idFactory: () => `${options.idPrefix ?? 'room'}-${++nextId}`,
      ensureAssistantReady: async () => undefined
    }
  );
  await coordinator.initialize();
  populate(session, (milliseconds) => {
    clock += milliseconds;
  });
  const saved = await coordinator.saveNamed(title);
  clock += 60 * 60_000;
  await coordinator.resetSession({ clearWorkingSet: true });
  await coordinator.flush();
  return { fs, store, coordinator, log, savedSessionId: saved.sessionId };
}

/** One sentinel-laden room: a marker in every body the thread hides. */
export function saveSentinelCorpus(): Promise<SavedRecallRoom> {
  return saveRecallRoom(RECALL_VISIBLE_LABELS.title, (session, advance) => {
    session.setExcerpt({
      text: `The tide came in. ${RECALL_SENTINELS.excerptText}`,
      source: {
        kind: 'file',
        sourceUri: `file://${RECALL_ROOT}/drafts/${RECALL_SENTINELS.excerptIdentity}/chapter-6.md`,
        relativePath: `drafts/${RECALL_SENTINELS.excerptIdentity}/${RECALL_VISIBLE_LABELS.excerpt}`
      }
    });
    session.addContextAttachment({
      kind: 'file',
      origin: 'wizard',
      label: RECALL_VISIBLE_LABELS.contextFile,
      content: `The keeper rows out at dawn. ${RECALL_SENTINELS.contextFileBody}`,
      words: 7,
      sourceUri: `file://${RECALL_ROOT}/notes/keeper-notes.md`,
      relativePath: 'notes/keeper-notes.md'
    });
    session.addContextAttachment({
      kind: 'text',
      origin: 'writer',
      label: RECALL_VISIBLE_LABELS.contextNote,
      content: `Tide tables for the cove. ${RECALL_SENTINELS.contextNoteBody}`,
      words: 6
    });

    // A completed run: writer message with an attachment, persisted evidence, reply.
    const attached = session.addMessageAttachment({
      label: RECALL_VISIBLE_LABELS.attachment,
      content: `Dear mother, ${RECALL_SENTINELS.threadArtifactBody}`,
      words: 3,
      relativePath: `drafts/${RECALL_SENTINELS.threadArtifactPath}/letters.md`,
      sourceUri: `file://${RECALL_ROOT}/drafts/letters.md`
    });
    if (!attached.ok) {
      throw new Error(`fixture attachment refused: ${attached.reason}`);
    }
    advance(60_000);
    session.beginPersonaMessage(
      'run-1',
      RECALL_VISIBLE_LABELS.writerText,
      [messageAttachmentSnapshot(attached.attachment)]
    );
    recordEvidence(session, 'run-1', RECALL_SENTINELS.evidenceBody);
    advance(60_000);
    session.completeRun('run-1', RECALL_VISIBLE_LABELS.reply, undefined, false, 'runtime-host');

    // A failed run: rollback removes the writer turn but keeps its evidence,
    // so the real summary's `preview` is that evidence (runway F6).
    advance(60_000);
    session.beginPersonaMessage('run-2', 'Check the keeper profile.');
    recordEvidence(session, 'run-2', RECALL_SENTINELS.previewEvidence);
    session.rollbackMessageRun('run-2');
  });
}

function recordEvidence(session: WorkshopSessionService, requestId: string, body: string): void {
  session.recordCapabilityArtifact({
    requestId,
    excerptVersion: session.getExcerptVersion(),
    details: {
      operation: 'resource.read',
      status: 'success',
      requestSummary: 'characters/keeper.md',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' },
      metadata: { path: 'characters/keeper.md' }
    },
    result: {
      capability: 'resource.read',
      status: 'success',
      requestSummary: 'characters/keeper.md',
      content: `${body} The keeper's profile, in full.`
    }
  });
}

export interface RecallSessionInput {
  sessionId: string;
  title?: string;
  updatedAt?: string;
  savedAt?: string;
  timezone?: string;
  hostPersonaId?: WorkshopPersonaId;
  participantPersonaIds?: WorkshopPersonaId[];
  excerptLabel?: string;
  scope?: WorkshopSessionScope;
  contextLabels?: string[];
  turns: WorkshopTurn[];
}

/** A synthetic saved session: enough envelope for recall, not a codec fixture. */
export function recallSession(input: RecallSessionInput): WorkshopPersistedSessionV2 {
  const updatedAt = input.updatedAt ?? '2026-10-04T02:00:00.000Z';
  const state = new WorkshopSessionService(() => Date.parse(updatedAt)).exportCommittedState();
  const hostPersonaId = input.hostPersonaId ?? 'jill';
  return {
    schemaVersion: 2,
    sessionId: input.sessionId,
    title: input.title ?? input.sessionId,
    createdAt: '2026-10-01T15:00:00.000Z',
    updatedAt,
    ...(input.savedAt ? { savedAt: input.savedAt } : {}),
    temporal: {
      schemaVersion: 1,
      startedAt: '2026-10-01T15:00:00.000Z',
      timezone: input.timezone ?? 'America/Chicago',
      lastActivityAt: updatedAt,
      personaNotices: []
    },
    summary: {
      hostPersonaId,
      participantPersonaIds: input.participantPersonaIds ?? [hostPersonaId],
      turnCount: input.turns.length,
      excerptWordCount: 0,
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.excerptLabel ? { excerptLabel: input.excerptLabel } : {}),
      excerptIdentity: 'SYNTHETIC-EXCERPT-IDENTITY',
      preview: 'SYNTHETIC-PREVIEW'
    },
    workshop: {
      ...state,
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      contextAttachments: (input.contextLabels ?? []).map((label, index) => ({
        id: `ctx-${index + 1}`,
        kind: 'text' as const,
        origin: 'writer' as const,
        label,
        words: 1,
        content: `SYNTHETIC-CONTEXT-BODY ${label}`,
        addedAt: 0
      })),
      turns: input.turns
    },
    conversations: []
  };
}
