/**
 * The pinned-context seed through the real coordinator, session store and
 * pinned-context store, on one memory folder (ADR 2026-11-04 D2, D9; Slice
 * 2b):
 *
 * - the first room, New and New session: full reset each write a first
 *   checkpoint that holds the pinned files; the empty start holds none;
 * - Open, Duplicate, Branch, Rewind and a reload never read the list;
 * - a failed replacement leaves the prior room as it was;
 * - no divider turn is minted at a room start;
 * - a list that throws at the first room never pauses rolling autosave.
 *
 * *Alice*, with made-up paths and text.
 */
import type { WorkshopSessionPersistenceCoordinator, WorkshopSessionRecallScope } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import { ScriptedWorkshopRoom } from '../session/ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from '../session/WorkshopCoordinatorHarness';
import { FolderFileSystem, seedHost } from './pinnedContextSeedHost';

const labels = (attachments: ReadonlyArray<{ label: string }> | undefined) => (attachments ?? []).map((attachment) => attachment.label);

/** A project with two pinned files, the coordinator's seed the real one. */
function project(arrange: (host: ReturnType<typeof seedHost>) => void = (host) => {
  host.write('Project/brief.md', 'A girl, a hole, a garden.');
  host.write('Characters/alice.md', 'Alice is seven.');
  host.pin('Project/brief.md', 'Characters/alice.md');
}) {
  const fileSystem = new FolderFileSystem();
  const live: { coordinator?: WorkshopSessionPersistenceCoordinator } = {};
  const pinned = seedHost({
    fileSystem,
    scope: (): WorkshopSessionRecallScope => live.coordinator?.recallScope() ?? { available: false, reason: 'not-ready' }
  });
  arrange(pinned);
  const harness = setupCoordinator({ roomSeed: pinned.seed, fileSystem });
  live.coordinator = harness.coordinator;
  const reads = jest.spyOn(pinned.library, 'readForSeed');
  return { ...harness, pinned, reads };
}

async function started(arrange?: Parameters<typeof project>[0]) {
  const harness = project(arrange);
  await harness.coordinator.initialize();
  await harness.coordinator.flush();
  return harness;
}

const contextChanges = (session: { readRoomLedger(): ReadonlyArray<{ artifact?: string }> }) =>
  session.readRoomLedger().filter((turn) => turn.artifact === 'context_change');

describe('the pinned-context seed, through the real coordinator and stores (Slice 2b)', () => {
  it('the first room in a project starts with the pinned files, and its first checkpoint holds them', async () => {
    const { session, store, pinned } = await started();

    expect(labels(session.getContextAttachments())).toEqual(['brief.md', 'alice.md']);
    expect(labels((await store.readCurrent())!.workshop.contextAttachments)).toEqual(['brief.md', 'alice.md']);
    expect(pinned.seed.takeFirstRoomReport()).toEqual({ pinnedCount: 2, attachedCount: 2, attachedWords: 9, leftOut: [] });
    expect(contextChanges(session)).toEqual([]);
  });

  it.each([
    ['carry', ['notes.md', 'brief.md', 'alice.md']],
    ['full-reset', ['brief.md', 'alice.md']]
  ] as const)('%s writes a first checkpoint that holds the pinned files', async (start, expected) => {
    const { coordinator, session, store, pinned } = await started((host) => {
      host.write('Characters/alice.md', 'Alice is seven.');
      host.write('Project/brief.md', 'A girl, a hole, a garden.');
      host.write('Research/notes.md', 'Notes on the hole.');
    });
    session.addContextAttachment({
      kind: 'file', origin: 'writer', label: 'notes.md', content: 'Notes on the hole.', words: 4,
      sourceUri: 'file:///workspace/novel/Research/notes.md', relativePath: 'Research/notes.md'
    });
    pinned.pin('Project/brief.md', 'Characters/alice.md');

    const summary = await coordinator.resetSession({ start });

    expect(labels(session.getContextAttachments())).toEqual(expected);
    expect(labels((await store.readCurrent())!.workshop.contextAttachments)).toEqual(expected);
    expect(summary.seed).toEqual({ pinnedCount: 2, attachedCount: 2, attachedWords: 9, leftOut: [] });
    expect(contextChanges(session)).toEqual([]);
  });

  it('the empty start reads nothing and holds nothing', async () => {
    const { coordinator, session, store, reads } = await started();
    reads.mockClear();

    const summary = await coordinator.resetSession({ start: 'empty' });

    expect(reads).not.toHaveBeenCalled();
    expect(summary.seed).toBeUndefined();
    expect(session.getContextAttachments()).toEqual([]);
    expect((await store.readCurrent())!.workshop.contextAttachments).toEqual([]);
  });

  it('a room started over a conversation mints no divider turn', async () => {
    const harness = await started();
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('Where is the Rabbit?');
    await harness.store.saveNamed(scriptedCheckpoint('alice-saved', room));
    await harness.coordinator.openNamed('alice-saved');

    await harness.coordinator.resetSession({ start: 'carry' });

    expect(labels(harness.session.getContextAttachments())).toEqual(expect.arrayContaining(['brief.md', 'alice.md']));
    expect(contextChanges(harness.session)).toEqual([]);
  });

  it('a failed replacement leaves the prior room as it was', async () => {
    const { coordinator, session, store, pinned } = await started();
    pinned.write('Characters/the-hatter.md', 'The Hatter keeps six o’clock.');
    pinned.pin('Characters/the-hatter.md');
    const before = await store.readCurrent();
    jest.spyOn(store, 'writeCurrent').mockRejectedValueOnce(new Error('promotion failed'));

    await expect(coordinator.resetSession({ start: 'full-reset' })).rejects.toThrow('promotion failed');

    expect(labels(session.getContextAttachments())).toEqual(['brief.md', 'alice.md']);
    expect((await store.readCurrent())!.sessionId).toBe(before!.sessionId);
  });

  it('never reads the list for a reload, Open, Duplicate, Rewind or Branch', async () => {
    const reloaded = project();
    await reloaded.store.writeCurrent(scriptedCheckpoint('rolling'));
    await reloaded.coordinator.initialize();
    expect(reloaded.reads).not.toHaveBeenCalled();
    expect(reloaded.session.getContextAttachments().map((attachment) => attachment.label)).not.toContain('brief.md');

    const { coordinator, store, reads } = await started();
    const room = new ScriptedWorkshopRoom().start();
    const replies = ['Where is the Rabbit?', 'Why the hole?'].map((text) => room.hostMessage(text));
    await store.saveNamed(scriptedCheckpoint('alice-saved', room));
    reads.mockClear();
    const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });

    await coordinator.openNamed('alice-saved');
    await coordinator.duplicateNamed('alice-saved', 'Alice again');
    await coordinator.rewindTo(after(replies[1].id), { origin: 'writer' });
    await coordinator.branchFrom(after(replies[0].id));

    expect(reads).not.toHaveBeenCalled();
  });

  it('a list that throws at the first room starts the room and keeps rolling autosave on', async () => {
    const harness = project();
    jest.spyOn(harness.pinned.store, 'read').mockRejectedValue(new Error('EIO'));

    await harness.coordinator.initialize();
    await harness.coordinator.flush();

    expect(harness.coordinator.getCurrentCheckpointError()).toBeUndefined();
    expect(await harness.store.readCurrent()).toBeDefined();
    expect(harness.session.getContextAttachments()).toEqual([]);
    expect(harness.pinned.seed.takeFirstRoomReport()?.leftOut).toEqual([{ label: 'pinned-context.json', reason: 'unreadable' }]);
    expect((harness.log.appendLine as jest.Mock).mock.calls.flat().join('\n')).not.toContain('rolling autosave paused');
  });
});
