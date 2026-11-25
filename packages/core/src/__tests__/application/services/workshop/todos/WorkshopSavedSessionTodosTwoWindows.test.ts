/**
 * The saved-session write port with the real store and coordinators (ADR
 * 2026-11-19 D6, D6a, D8a):
 *
 * - the persona's write lands: the file holds the change, stamped with its
 *   operation id, and `updatedAt` moved, so recall reads it closed;
 * - **the other window:** two coordinators over one folder hold one named
 *   session; the port changes a to-do from the first; the second's later
 *   autosave is refused with `WorkshopNamedSessionChangedError`, the file
 *   keeps the change, the second room's work is in `current.json`, and
 *   reloading it promotes the file and keeps its local work as a recovery
 *   session.
 * *Alice*, made-up ids.
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WORKSHOP_NO_ROOM_SEED } from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { WorkshopSavedSessionTodoStore } from '@/application/services/workshop/todos/WorkshopSavedSessionTodoStore';
import { buildWorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import { DEFAULT_WORKSHOP_WRITER_PROFILE } from '@messages';
import type { LogSink, Workspace } from '@/platform';

const root = '/workspace/novel';
const directory = `${root}/prose-minion/sessions`;
let clock = Date.parse('2026-11-19T12:00:00.000Z');
const now = () => new Date(clock);
const workspace: Workspace = { workspaceFolders: () => [{ name: 'novel', path: root }], extensionPath: '/extension', asRelativePath: (value) => value, findFiles: async () => [] };

function window(fs: MemoryFileSystem, id: string) {
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
    { now, idFactory: () => `${id}-${++next}`, ensureAssistantReady: async () => undefined }
  );
  return { store, session, coordinator, log, port: new WorkshopSavedSessionTodoStore(store, coordinator, log, now) };
}

function polishSession(): WorkshopPersistedSessionV2 {
  const session = new WorkshopSessionService(() => clock);
  session.setExcerpt({ text: 'Alice was beginning to get very tired.', source: { kind: 'manual' } });
  session.recordSessionMarker('start', 'Session started.');
  session.beginPersonaMessage('seed', 'What should I fix?');
  const reply = session.completeRun('seed', 'Here is my read.', undefined, false, undefined, [{ key: 'finding-1', text: 'Let the White Rabbit enter sooner.', ordinal: 1 }])!;
  session.addTodoFromFinding(reply.id, 'finding-1');
  return {
    schemaVersion: 2, sessionId: 'alice-polish', title: 'Polish 6.11',
    createdAt: now().toISOString(), updatedAt: now().toISOString(),
    temporal: new WorkshopSessionTimeService({ now }).exportState(),
    summary: { hostPersonaId: 'jill', participantPersonaIds: ['jill'], turnCount: 3, excerptWordCount: 6 },
    workshop: session.exportCommittedState(), conversations: []
  };
}

const closedBy = (operationId: string) => ({
  personaId: 'jill' as const, personaLabel: 'Jill', sessionId: 'left-1', sessionTitle: 'Polish', turnId: 'turn-9-assistant-1', at: clock, operationId
});

describe('the saved-session write port, with the real store (D6)', () => {
  it('writes the change, stamped, with updatedAt moved, so recall reads it closed', async () => {
    const fs = new MemoryFileSystem();
    const left = window(fs, 'left');
    const saved = await left.store.saveNamed(polishSession());
    await left.coordinator.initialize();
    const read = await left.port.read(saved.sessionId);
    if (read.kind !== 'read') {
      throw new Error(`read refused: ${read.reason}`);
    }
    clock += 60_000;
    const todoId = read.todos[0].id;
    expect(await left.port.write(read, [{ todoId, status: 'completed', closedBy: closedBy('op-alice-1') }])).toEqual({ kind: 'written' });
    const after = (await left.store.readNamed(saved.sessionId))!;
    expect(after.workshop.todos[0]).toMatchObject({ status: 'completed', closedBy: { operationId: 'op-alice-1' } });
    expect(Date.parse(after.updatedAt)).toBeGreaterThan(Date.parse(read.session.updatedAt));
    expect(buildWorkshopRecallDocument(after).todos[0]).toMatchObject({ status: 'completed', closedBy: { personaLabel: 'Jill', sessionTitle: 'Polish' } });
    // The open room is never a saved session.
    expect(await left.port.read(left.coordinator.openRoomIdentity().sessionId)).toEqual({ kind: 'refused', reason: 'unknown-session' });
  });

  it("the other window's later autosave is refused, its work goes to current.json, and a reload keeps both", async () => {
    const fs = new MemoryFileSystem();
    const left = window(fs, 'left');
    const right = window(fs, 'right');
    const saved = await left.store.saveNamed(polishSession());
    await left.coordinator.initialize();
    await left.coordinator.flushForClose();
    await right.coordinator.initialize();
    await right.coordinator.openNamed(saved.sessionId);

    const read = await left.port.read(saved.sessionId);
    if (read.kind !== 'read') {
      throw new Error(`read refused: ${read.reason}`);
    }
    clock += 60_000;
    expect(await left.port.write(read, [{ todoId: read.todos[0].id, status: 'completed', closedBy: closedBy('op-alice-2') }])).toEqual({ kind: 'written' });

    // The right window's room still holds the session as it opened it; its autosave runs against that.
    const statuses: Array<{ status: string; error?: string }> = [];
    right.coordinator.addSessionSaveStatusListener((status) => statuses.push(status));
    right.session.setExcerpt({ text: 'Alice, edited in the other window.', source: { kind: 'manual' } });
    right.coordinator.markDirty('excerpt changed');
    await right.coordinator.flush().catch(() => undefined);
    expect(statuses.at(-1)?.status).toBe('error');
    expect(statuses.at(-1)?.error).toMatch(/changed on disk/);
    const named = (await left.store.readNamed(saved.sessionId))!;
    expect(named.workshop.todos[0]).toMatchObject({ status: 'completed', closedBy: { operationId: 'op-alice-2' } });
    expect(named.workshop.excerpt?.text).toBe('Alice was beginning to get very tired.');
    expect((await right.store.readCurrent())?.workshop.excerpt?.text).toBe('Alice, edited in the other window.');

    // Reloading the right window promotes the file and keeps its local work as a recovery session.
    expect(await right.coordinator.refreshNamedSession()).toBe(true);
    expect(right.session.getSnapshot().todos[0]).toMatchObject({ status: 'completed' });
    const sessions = (await right.store.list()).sessions;
    expect(sessions.map((entry) => entry.title).sort()).toEqual(['Polish 6.11', 'Polish 6.11 (local recovery)']);
    expect(right.coordinator.consumeRecoveryNotices()).toEqual([expect.objectContaining({ code: 'local-session-preserved' })]);
  });
});
