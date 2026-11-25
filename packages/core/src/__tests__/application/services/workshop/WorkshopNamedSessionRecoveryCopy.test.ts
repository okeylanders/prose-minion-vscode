/**
 * A refused room keeps its work in its own recovery session (ADR 2026-11-19
 * D6c; PR #286 re-review, finding 2): two coordinators over one folder hold
 * one named session; B's named write wins; A's save is refused and A's
 * recovery session is created at once; a third write replaces
 * `current.json`; A reloads. The named file holds B's checkpoint, and A's
 * edits are in A's recovery session, whole. One recovery session per
 * refusal episode, told once, and no duplicate on reload. *Alice*.
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WORKSHOP_NO_ROOM_SEED } from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import { DEFAULT_WORKSHOP_WRITER_PROFILE } from '@messages';
import type { LogSink, Workspace } from '@/platform';

const root = '/workspace/novel';
let clock = Date.parse('2026-11-19T12:00:00.000Z');
const now = () => new Date(clock);
const workspace: Workspace = { workspaceFolders: () => [{ name: 'novel', path: root }], extensionPath: '/extension', asRelativePath: (value) => value, findFiles: async () => [] };

function window(fs: MemoryFileSystem, id: string) {
  const log: LogSink = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
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
  return { store, session, coordinator };
}

function polish(): WorkshopPersistedSessionV2 {
  const session = new WorkshopSessionService(() => clock);
  session.setExcerpt({ text: 'Alice was beginning to get very tired.', source: { kind: 'manual' } });
  session.recordSessionMarker('start', 'Session started.');
  return {
    schemaVersion: 2, sessionId: 'alice-polish', title: 'Polish 6.11',
    createdAt: now().toISOString(), updatedAt: now().toISOString(),
    temporal: new WorkshopSessionTimeService({ now }).exportState(),
    summary: { hostPersonaId: 'jill', participantPersonaIds: ['jill'], turnCount: 1, excerptWordCount: 6 },
    workshop: session.exportCommittedState(), conversations: []
  };
}

async function edit(room: ReturnType<typeof window>, text: string): Promise<void> {
  clock += 60_000;
  room.session.replaceExcerpt({ text, source: { kind: 'manual' } });
  room.coordinator.markDirty('excerpt changed');
  await room.coordinator.flush().catch(() => undefined);
}

describe('a refused room keeps its work in its own recovery session (D6c)', () => {
  it('B wins; A is refused and kept at once; current.json is replaced; A reloads with both intact', async () => {
    const fs = new MemoryFileSystem();
    const a = window(fs, 'a');
    const b = window(fs, 'b');
    const saved = await a.store.saveNamed(polish());
    await a.coordinator.initialize();
    await a.coordinator.openNamed(saved.sessionId);
    await b.coordinator.initialize();
    await b.coordinator.openNamed(saved.sessionId);

    await edit(b, 'Alice, as the other window saved her.');
    await edit(a, 'Alice, as this window edited her.');
    const recoveries = async () => (await a.store.list()).sessions.filter((entry) => entry.title === 'Polish 6.11 (local recovery)');
    expect(await recoveries()).toHaveLength(1);
    const notices = a.coordinator.consumeRecoveryNotices();
    expect(notices).toEqual([expect.objectContaining({
      code: 'local-session-preserved',
      message: 'Couldn\'t save to Polish 6.11: it changed in another window. Your work is kept as "Polish 6.11 (local recovery)" in Sessions.'
    })]);

    // A second refusal in the same episode updates that recovery session; it is told once.
    await edit(a, 'Alice, as this window edited her again.');
    expect(await recoveries()).toHaveLength(1);
    expect(a.coordinator.consumeRecoveryNotices()).toEqual([]);
    const kept = (await a.store.readNamed((await recoveries())[0].sessionId))!;
    expect(kept.workshop.excerpt?.text).toBe('Alice, as this window edited her again.');

    // A third writer observes and replaces the rolling file. A's stale view cannot overwrite it.
    const third = window(fs, 'third');
    await third.store.readCurrent();
    await third.store.writeCurrent({ ...polish(), sessionId: 'someone-else', title: 'Elsewhere' });
    await expect(a.coordinator.refreshNamedSession()).rejects.toMatchObject({ name: 'WorkshopRollingCheckpointConflictError' });
    expect((await third.store.readCurrent())?.title).toBe('Elsewhere');

    const reloaded = window(fs, 'reloaded');
    await reloaded.coordinator.initialize();
    expect((await reloaded.coordinator.openNamed(saved.sessionId)).restored).toBe(true);
    const named = (await a.store.readNamed(saved.sessionId))!;
    expect(named.workshop.excerpt?.text).toBe('Alice, as the other window saved her.');
    expect(reloaded.session.getExcerpt()?.text).toBe('Alice, as the other window saved her.');
    // No duplicate on reload: the episode's copy remains in the library.
    expect(await recoveries()).toHaveLength(1);
    expect((await a.store.readNamed((await recoveries())[0].sessionId))!.workshop).toEqual(kept.workshop);
  });
  it('preserves the newest refused named edit after a different window changes its recovery and rolling files', async () => {
    const fs = new MemoryFileSystem();
    const a = window(fs, 'a');
    const b = window(fs, 'b');
    const original = await a.store.saveNamed(polish());
    await a.coordinator.openNamed(original.sessionId);
    await b.coordinator.openNamed(original.sessionId);
    await edit(b, 'Winning named and rolling content');
    await edit(a, 'Local version one');
    const first = (await b.store.list()).sessions.find(row => row.sessionId !== original.sessionId)!;
    await b.store.renameNamed(first.sessionId, 'Externally renamed recovery');
    await edit(a, 'Local version two');
    const kept = await a.coordinator.flushForClose();
    expect(kept).toMatchObject({ kind: 'preserved-session' });
    if (!kept) { throw new Error('Expected the newest local recovery'); }
    expect(kept.sessionId).not.toBe(first.sessionId);
    const fresh = window(fs, 'fresh').store;
    expect((await fresh.readNamed(original.sessionId))?.workshop.excerpt?.text).toBe('Winning named and rolling content');
    expect((await fresh.readCurrent())?.workshop.excerpt?.text).toBe('Winning named and rolling content');
    expect((await fresh.readNamed(first.sessionId))?.workshop.excerpt?.text).toBe('Local version one');
    expect((await fresh.readNamed(kept.sessionId))?.workshop.excerpt?.text).toBe('Local version two');
  });

});
