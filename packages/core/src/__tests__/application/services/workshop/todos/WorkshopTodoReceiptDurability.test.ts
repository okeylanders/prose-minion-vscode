/**
 * The source receipt is durable before any saved session is written (ADR
 * 2026-11-19 D5; PR #289 review, finding 3), with the real store,
 * coordinator and saved-session port:
 *
 * - host and guest replies alike: when the port is asked to write the
 *   target, `current.json` on disk already holds the reply's receipt row
 *   `saving`;
 * - a checkpoint that cannot be made writes no saved session: the target
 *   keeps its to-do open and the rows read `receipt-not-saved`, in host
 *   words on the persona's next line.
 * *Alice*, made-up ids.
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WORKSHOP_NO_ROOM_SEED } from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { WorkshopSavedSessionTodoStore } from '@/application/services/workshop/todos/WorkshopSavedSessionTodoStore';
import { WorkshopTodoStatusWrites } from '@/application/services/workshop/todos/WorkshopTodoStatusWrites';
import { workshopTrailerOutcomesFrameFor } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerOutcomesFrame';
import { WORKSHOP_TODO_STATUS_WRITE_REFUSAL_WORDS } from '@shared/constants/workshopTrailerOutcomeWords';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import { DEFAULT_WORKSHOP_WRITER_PROFILE } from '@messages';
import type { LogSink, Workspace } from '@/platform';
import { replyWith, todoFrame } from './todoStatusFixtures';

const root = '/workspace/novel';
const clock = Date.parse('2026-11-19T12:00:00.000Z');
const now = () => new Date(clock);
const workspace: Workspace = { workspaceFolders: () => [{ name: 'novel', path: root }], extensionPath: '/extension', asRelativePath: (value) => value, findFiles: async () => [] };

function polishSession(): WorkshopPersistedSessionV2 {
  const session = new WorkshopSessionService(() => clock);
  session.setExcerpt({ text: 'Alice was beginning to get very tired.', source: { kind: 'manual' } });
  session.beginPersonaMessage('seed', 'What should I fix?');
  const reply = session.completeRun('seed', 'Here is my read.', undefined, false, undefined, [{ key: 'finding-1', text: 'Let the White Rabbit enter sooner.', ordinal: 1 }])!;
  session.addTodoFromFinding(reply.id, 'finding-1');
  return {
    schemaVersion: 2, sessionId: 'alice-polish', title: 'Polish 6.11',
    createdAt: now().toISOString(), updatedAt: now().toISOString(),
    temporal: new WorkshopSessionTimeService({ now }).exportState(),
    summary: { hostPersonaId: 'jill', participantPersonaIds: ['jill'], turnCount: 2, excerptWordCount: 6 },
    workshop: session.exportCommittedState(), conversations: []
  };
}

async function room() {
  const fs = new MemoryFileSystem();
  const log: LogSink & { appendLine: jest.Mock } = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
  const store = new WorkshopSessionStore(fs, workspace, log, now);
  const session = new WorkshopSessionService(() => clock);
  let next = 0;
  const assistant = {
    exportWorkshopConversationArchive: jest.fn(() => []),
    importWorkshopConversationArchive: jest.fn(async () => []),
    discardConversation: jest.fn()
  } as unknown as AssistantToolService;
  const settings = { getWriterProfile: () => DEFAULT_WORKSHOP_WRITER_PROFILE } as WorkshopConversationSettingsService;
  const coordinator = new WorkshopSessionPersistenceCoordinator(
    session, assistant, settings, new WorkshopSessionTimeService({ now }), store, WORKSHOP_NO_ROOM_SEED, log,
    { now, idFactory: () => `room-${++next}`, ensureAssistantReady: async () => undefined }
  );
  const saved = await store.saveNamed(polishSession());
  await coordinator.initialize();
  session.setExcerpt({ text: 'Alice, in the open room.', source: { kind: 'manual' } });
  const port = new WorkshopSavedSessionTodoStore(store, coordinator, log, now);
  const writes = new WorkshopTodoStatusWrites(session, port, coordinator, { settleRoom: (reason) => coordinator.markDirty(reason), log: (line) => log.appendLine(line) });
  const read = await port.read(saved.sessionId);
  if (read.kind !== 'read') {
    throw new Error(`read refused: ${read.reason}`);
  }
  return { store, session, coordinator, port, writes, todoId: read.todos[0].id, log };
}

describe('the receipt is saved before a saved session is written (D5)', () => {
  it.each([['host', undefined], ['guest', 'cliff']] as const)('%s reply: current.json holds the saving row when the target is written', async (_path, guest) => {
    const { store, session, port, writes, todoId } = await room();
    const content = todoFrame({ session: 'alice-polish', todo: todoId });
    const atWrite: Array<string | undefined> = [];
    const write = port.write.bind(port);
    jest.spyOn(port, 'write').mockImplementation(async (read, changes) => {
      const current = await store.readCurrent();
      atWrite.push(current?.workshop.turns.find((turn) => turn.todoStatusChanges?.length)?.todoStatusChanges?.[0].state);
      return write(read, changes);
    });
    const context = (await writes.context(content))!;
    const turn = replyWith(session, content, { todoStatus: context, ...(guest ? { guest } : {}) });
    await context.settled?.();
    expect(atWrite).toEqual(['saving']);
    expect((await store.readNamed('alice-polish'))!.workshop.todos[0].status).toBe('completed');
    expect(session.readRoomLedger().find((candidate) => candidate.id === turn.id)!.todoStatusChanges?.[0].state).toBe('applied');
  });

  it.each([['host', undefined], ['guest', 'cliff']] as const)('%s reply: a checkpoint that cannot be made writes no saved session', async (_path, guest) => {
    const { store, session, port, writes, todoId, log } = await room();
    const content = todoFrame({ session: 'alice-polish', todo: todoId });
    jest.spyOn(store, 'writeCurrent').mockRejectedValue(new Error('EIO'));
    const portWrite = jest.spyOn(port, 'write');
    const context = (await writes.context(content))!;
    const turn = replyWith(session, content, { todoStatus: context, ...(guest ? { guest } : {}) });
    await context.settled?.();
    expect(portWrite).not.toHaveBeenCalled();
    expect((await store.readNamed('alice-polish'))!.workshop.todos[0].status).toBe('open');
    expect(session.readRoomLedger().find((candidate) => candidate.id === turn.id)!.todoStatusChanges?.[0])
      .toMatchObject({ state: 'refused', reason: 'receipt-not-saved' });
    const reader = guest ? { kind: 'personaGuest' as const, personaId: guest } : { kind: 'host' as const };
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), reader))
      .toContain(`1 not written (${WORKSHOP_TODO_STATUS_WRITE_REFUSAL_WORDS['receipt-not-saved']})`);
    expect(log.appendLine.mock.calls.flat().join('\n')).toContain('reason=receipt-not-saved');
  });
});
