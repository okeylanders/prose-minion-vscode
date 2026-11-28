/**
 * The persisted turn ledger is what session recall reads. These guards pin
 * what a saved turn may hold, on the load path (decode) and the save path
 * (the strict writer boundary every autosave runs).
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { projectWorkshopJoinSnapshotTurns, projectWorkshopRoomTurns } from '@/application/services/workshop/WorkshopRoomDeliveryService';
import { projectWorkshopTranscript, projectWorkshopTranscriptTurn } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { renderWorkshopTranscriptMarkdown } from '@/application/services/workshop/export/WorkshopTranscriptMarkdown';
import { renderWorkshopTranscriptHtml } from '@/application/services/workshop/export/WorkshopTranscriptHtml';
import { renderWorkshopTranscriptJson } from '@/application/services/workshop/export/WorkshopTranscriptJson';
import { workshopCapabilityResultLogSummary } from '@/application/services/workshop/WorkshopCapabilityResultLog';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { messageAttachmentSnapshot } from '@/application/services/workshop/WorkshopSessionRecords';
import {
  WORKSHOP_CAPABILITY_OPERATIONS,
  type WorkshopCapabilityOperation
} from '@shared/types/workshopCapabilities';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import type { WorkshopConversationLogicalKey } from '@/application/services/workshop/WorkshopSessionStateV1';
import { ConversationArchiveEntryV1, ConversationManager } from '@orchestration/ConversationManager';

const REQUEST = 'host-request';

/**
 * A saved room with one writer message (one attachment) and one capability
 * artifact, plus an artifact for each of `recalled`, recorded by the real
 * aggregate as the capability records it.
 */
const savedRoom = (
  recalled: readonly WorkshopCapabilityOperation[] = [],
  record?: (session: WorkshopSessionService) => void
): WorkshopPersistedSessionV2 => {
  const workshop = new WorkshopSessionService(() => Date.parse('2026-10-05T14:00:00.000Z'));
  workshop.setExcerpt({ text: 'The tide came in.', source: { kind: 'manual' } });
  const added = workshop.addMessageAttachment({
    label: 'letters.md',
    content: 'The full letters.',
    words: 3,
    relativePath: 'drafts/letters.md',
    sourceUri: 'file:///novel/drafts/letters.md'
  });
  if (!added.ok) {
    throw new Error(`fixture attachment refused: ${added.reason}`);
  }
  // The production send path strips the body before the turn sees it.
  workshop.beginPersonaMessage(REQUEST, 'Read the letters.', [messageAttachmentSnapshot(added.attachment)]);
  workshop.recordCapabilityArtifact({
    requestId: REQUEST,
    excerptVersion: workshop.getExcerptVersion(),
    details: {
      operation: 'resource.read',
      status: 'success',
      requestSummary: 'characters/raven.md',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' }
    },
    result: {
      capability: 'resource.read',
      status: 'success',
      requestSummary: 'characters/raven.md',
      content: 'Raven keeps the lighthouse.'
    }
  });
  for (const operation of recalled) {
    workshop.recordCapabilityArtifact({
      requestId: REQUEST,
      excerptVersion: workshop.getExcerptVersion(),
      details: {
        operation,
        status: 'success',
        requestSummary: '“Chapter 6.7” · turns 1-12',
        requestedByPersonaId: 'jill',
        invokedBy: { kind: 'host' }
      },
      result: { capability: operation, status: 'success', requestSummary: '“Chapter 6.7” · turns 1-12', content: 'Quoted record.' }
    });
  }
  record?.(workshop);
  workshop.completeRun(REQUEST, 'They are about the tide.', undefined, false, 'runtime-host');
  const state = workshop.exportCommittedState();
  const temporal = new WorkshopSessionTimeService({
    now: () => new Date('2026-10-05T13:00:00.000Z'),
    timezone: 'America/Chicago'
  });
  return {
    schemaVersion: 2,
    sessionId: 'session-1',
    title: 'Chapter 6-8',
    createdAt: '2026-10-05T13:00:00.000Z',
    updatedAt: '2026-10-05T14:00:00.000Z',
    temporal: temporal.exportState(),
    summary: {
      hostPersonaId: 'jill',
      participantPersonaIds: ['jill'],
      turnCount: state.turns.length,
      excerptWordCount: 4
    },
    workshop: state,
    conversations: []
  };
};

type MutableTurn = Record<string, unknown> & {
  capability?: Record<string, unknown>;
  messageAttachments?: Array<Record<string, unknown>>;
};

/** A JSON copy of the saved room with one turn edited, as a hand-edited file would be. */
const editedRoom = (edit: (turns: MutableTurn[]) => void): unknown => {
  const raw = JSON.parse(JSON.stringify(savedRoom())) as { workshop: { turns: MutableTurn[] } };
  edit(raw.workshop.turns);
  return raw;
};

const capabilityTurn = (turns: MutableTurn[]): MutableTurn =>
  turns.find((turn) => turn.capability !== undefined)!;

const writerTurnWithAttachment = (turns: MutableTurn[]): MutableTurn =>
  turns.find((turn) => (turn.messageAttachments?.length ?? 0) > 0)!;

describe('persisted Workshop turn guards', () => {
  it.each([
    ['success', { diagnosticCount: 2, shownCount: 2 }, '2 of 2 problems'],
    ['partial', { diagnosticCount: 4, shownCount: 1 }, '1 of 4 problems'],
    ['success', { diagnosticCount: 0, shownCount: 0 }, '0 of 0 problems'],
    ['failed', {}, 'file problems'],
    ['cancelled', {}, 'file problems'],
    ['rejected', { reason: 'context-window-exceeded' }, 'file problems']
  ] as const)('keeps only counts and status on a %s problems.read receipt, including after reopening', (status, counts, summary) => {
    const privateText = 'PRIVATE-DIAGNOSTIC-';
    const metadata = { ...counts, source: privateText + 'source', quote: privateText + 'live text', nextStart: 6 };
    const result = { capability: 'problems.read' as const, status, requestSummary: privateText + 'file',
      content: privateText + 'message', error: privateText + 'failure', metadata };
    const saved = savedRoom([], session => {
      session.recordCapabilityArtifact({
        requestId: REQUEST, excerptVersion: session.getExcerptVersion(), result,
        details: { operation: result.capability, status, requestSummary: result.requestSummary,
          invokedBy: { kind: 'host' }, requestedByPersonaId: 'jill', metadata }
      });
    });
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(JSON.stringify(parseWorkshopPersistedSession(saved)))).session;
    const turns = reopened.workshop.turns;
    const receipt = turns.find(turn => turn.artifact === 'problems_read')!;
    expect(receipt.toolLabel).toBe('File Problems');
    expect(receipt.capability).toMatchObject({ status, requestSummary: summary });
    expect(receipt.capability?.metadata).toEqual('shownCount' in counts ? counts : undefined);
    expect(receipt.capability?.publishedWithTurnId).toBeUndefined();
    if ('reason' in counts) {
      expect(receipt.content).toContain('did not fit');
    }
    const guest = { kind: 'personaGuest' as const, personaId: 'cliff' as const };
    expect(projectWorkshopJoinSnapshotTurns(turns, guest).map(turn => turn.id)).not.toContain(receipt.id);
    expect(projectWorkshopRoomTurns(turns, guest).map(turn => turn.id)).not.toContain(receipt.id);
    expect(projectWorkshopTranscriptTurn(receipt)).toMatchObject({ kind: 'event', text: expect.stringContaining(summary) });
    const transcript = projectWorkshopTranscript(turns, { title: saved.title, exportedAt: 0 });
    for (const text of [JSON.stringify(saved), JSON.stringify(reopened), renderWorkshopTranscriptMarkdown(transcript),
      renderWorkshopTranscriptHtml(transcript), renderWorkshopTranscriptJson(transcript), workshopCapabilityResultLogSummary(result)]) {
      expect(text).not.toContain(privateText);
    }
  });

  it('accepts the unedited room on load and save', () => {
    const raw = editedRoom(() => undefined);

    expect(decodeWorkshopPersistedSessionCheckpoint(raw).session.workshop.turns).toHaveLength(3);
    expect(parseWorkshopPersistedSession(raw).workshop.turns).toHaveLength(3);
  });

  it.each(WORKSHOP_CAPABILITY_OPERATIONS)('accepts the listed operation %s on load and save', (operation) => {
    const raw = editedRoom((turns) => {
      const capability = capabilityTurn(turns).capability!;
      capability.operation = operation;
      // Catalog and search are never published, so an unpublished (private)
      // artifact keeps this about the operation list, not publication.
      delete capability.publishedWithTurnId;
    });

    expect(() => decodeWorkshopPersistedSessionCheckpoint(raw)).not.toThrow();
    expect(() => parseWorkshopPersistedSession(raw)).not.toThrow();
  });

  it('saves and reopens every session-recall operation, artifact, and Past session row (ADR 2026-10-05 §10)', () => {
    const recall = [
      ['transcript.catalog', 'transcript_catalog'],
      ['transcript.search', 'transcript_search'],
      ['transcript.read', 'transcript_read'],
      ['transcript.todos', 'transcript_todos'],
      // ADR 2026-11-05 D6: a bookmarks card persists like every recall card.
      ['transcript.bookmarks', 'transcript_bookmarks']
    ] as const;
    const raw = JSON.parse(JSON.stringify(savedRoom(recall.map(([operation]) => operation)))) as {
      workshop: { turns: MutableTurn[] };
      conversations: ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[];
    };
    // Archive kinds are checked only at reopen (ADR 2026-10-05 Consequences): every participant carries a row.
    const row = (deliveredAt: number) => ({
      kind: 'transcript' as const,
      origin: 'host' as const,
      label: '“Chapter 6.7” · turns 1-12',
      sizeChars: 14_000,
      isEstimate: true,
      deliveredAt
    });
    raw.conversations = (['host', 'guest:cliff'] as const).map((key, index) => ({
      key,
      toolName: key === 'host' ? 'workshop-persona' : 'workshop-guest',
      messages: [
        { role: 'user', content: 'Pick up the 6.7 chats.' },
        { role: 'assistant', content: 'Here is what we decided.' }
      ],
      lastActivity: 10 + index,
      contextSources: [row(20 + index)],
      nextArtifactNumber: 2
    }));

    const saved = parseWorkshopPersistedSession(raw);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(JSON.stringify(saved))).session;
    expect(reopened.workshop.turns.map((turn) => turn.artifact)).toEqual(expect.arrayContaining(recall.map(([, artifact]) => artifact)));
    expect(reopened.workshop.turns.filter((turn) => turn.toolLabel === 'Session Recall')).toHaveLength(5);
    expect(reopened.workshop.turns.map((turn) => turn.capability?.operation))
      .toEqual(expect.arrayContaining(recall.map(([operation]) => operation)));
    const imported = new ConversationManager().importConversations(
      (reopened.conversations as ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[])
        .map((entry) => ({ entry, systemMessage: `${entry.toolName} system` }))
    );
    expect(imported.map((outcome) => [outcome.key, outcome.status])).toEqual([['host', 'imported'], ['guest:cliff', 'imported']]);
  });

  it('saves and reopens every project-memory operation, artifact, and Project note row (ADR 2026-11-04 D12)', () => {
    const memory = [
      ['memory.catalog', 'memory_catalog'],
      ['memory.search', 'memory_search'],
      ['memory.read', 'memory_read']
    ] as const;
    const raw = JSON.parse(JSON.stringify(savedRoom(memory.map(([operation]) => operation)))) as {
      workshop: { turns: MutableTurn[] };
      conversations: ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[];
    };
    const row = (deliveredAt: number) => ({
      kind: 'memory' as const,
      origin: 'host' as const,
      label: 'The Rabbit\'s watch runs backward',
      sizeChars: 400,
      isEstimate: true,
      deliveredAt
    });
    raw.conversations = (['host', 'guest:cliff'] as const).map((key, index) => ({
      key,
      toolName: key === 'host' ? 'workshop-persona' : 'workshop-guest',
      messages: [
        { role: 'user', content: 'What did we settle about the watch?' },
        { role: 'assistant', content: 'The saved note says it runs backward.' }
      ],
      lastActivity: 10 + index,
      contextSources: [row(20 + index)],
      nextArtifactNumber: 2
    }));

    const saved = parseWorkshopPersistedSession(raw);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(JSON.stringify(saved))).session;
    expect(reopened.workshop.turns.map((turn) => turn.artifact)).toEqual(expect.arrayContaining(memory.map(([, artifact]) => artifact)));
    expect(reopened.workshop.turns.filter((turn) => turn.toolLabel === 'Project Memory')).toHaveLength(3);
    expect(reopened.workshop.turns.map((turn) => turn.capability?.operation))
      .toEqual(expect.arrayContaining(memory.map(([operation]) => operation)));
    const imported = new ConversationManager().importConversations(
      (reopened.conversations as ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[])
        .map((entry) => ({ entry, systemMessage: `${entry.toolName} system` }))
    );
    expect(imported.map((outcome) => [outcome.key, outcome.status])).toEqual([['host', 'imported'], ['guest:cliff', 'imported']]);
  });

  it('rejects a capability operation outside the closed list on load and save', () => {
    const raw = editedRoom((turns) => {
      // `memory.*` is read-only (ADR 2026-11-04 D1): no write operation is listed.
      capabilityTurn(turns).capability!.operation = 'memory.save';
    });

    expect(() => decodeWorkshopPersistedSessionCheckpoint(raw)).toThrow(/capability\.operation must be/);
    expect(() => parseWorkshopPersistedSession(raw)).toThrow(/capability\.operation must be/);
  });

  it('rejects a turn artifact outside the closed list on load and save', () => {
    const raw = editedRoom((turns) => {
      // `memory.*` is read-only (ADR 2026-11-04 D1): no write artifact is listed.
      capabilityTurn(turns).artifact = 'memory_save';
    });

    expect(() => decodeWorkshopPersistedSessionCheckpoint(raw)).toThrow(/artifact must be/);
    expect(() => parseWorkshopPersistedSession(raw)).toThrow(/artifact must be/);
  });

  it('refuses an attachment body on a saved turn: bodies live only in thread artifacts', () => {
    const raw = editedRoom((turns) => {
      writerTurnWithAttachment(turns).messageAttachments![0].content = 'The full letters.';
    });

    expect(() => decodeWorkshopPersistedSessionCheckpoint(raw)).toThrow(/unknown field/);
    expect(() => parseWorkshopPersistedSession(raw)).toThrow(/unknown field/);
  });
});
