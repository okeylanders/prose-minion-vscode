/**
 * The room seed's await crosses the workspace boundary (PR #203 F01). A room
 * belongs to the workspace accepted at load; a switch while the seed reads, or
 * while the new room is captured and promoted, must refuse the start and leave
 * the live room and both projects' checkpoints as they were.
 */

import type {
  WorkshopRoomSeed,
  WorkshopRoomSeedKind
} from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';
import { scriptedCheckpoint, setupCoordinator } from '../session/WorkshopCoordinatorHarness';

const B_ROOT = '/workspace/other';
const B_CURRENT = `${B_ROOT}/prose-minion/sessions/current.json`;
const B_AVAILABLE = {
  available: true as const,
  rootPath: B_ROOT,
  sessionsDirectory: `${B_ROOT}/prose-minion/sessions`,
  currentPath: B_CURRENT
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

/** A seed that waits on `release` for the kinds it holds, and installs nothing. */
function heldSeed(holds: (kind: WorkshopRoomSeedKind) => boolean) {
  const entered = deferred();
  const release = deferred();
  const seed: WorkshopRoomSeed = {
    prepare: async (kind) => {
      if (holds(kind)) {
        entered.resolve();
        await release.promise;
      }
      return { kind };
    },
    install: jest.fn(() => ({ pinnedCount: 0, attachedCount: 0, attachedWords: 0, leftOut: [] }))
  };
  return { seed, entered, release };
}

/** Project A's room with a made-up excerpt, saved; project B holds its own room. */
async function twoProjects(seed: WorkshopRoomSeed) {
  const harness = setupCoordinator({ roomSeed: seed });
  await harness.coordinator.initialize();
  harness.session.setExcerpt({ text: 'Alice follows the Rabbit in project A.', source: { kind: 'manual' } });
  harness.coordinator.markDirty('fixture');
  await harness.coordinator.flush();
  harness.fs.setJson(B_CURRENT, scriptedCheckpoint('project-b-room'));
  return {
    ...harness,
    roomBefore: harness.session.exportCommittedState(),
    aBefore: JSON.stringify(await harness.store.readCurrent()),
    bBefore: harness.fs.files.get(B_CURRENT)
  };
}

describe('room starts stay in the accepted workspace (PR #203 F01)', () => {
  it.each(['carry', 'full-reset'] as const)(
    'refuses %s when the workspace changes while the seed reads',
    async (start) => {
      const { seed, entered, release } = heldSeed((kind) => kind !== 'first');
      const project = await twoProjects(seed);
      jest.mocked(seed.install).mockClear();

      const resetting = project.coordinator.resetSession({ start });
      await entered.promise;
      const switched = jest.spyOn(project.store, 'availability').mockReturnValue(B_AVAILABLE);
      release.resolve();

      await expect(resetting).rejects.toThrow('workspace changed');
      // Refused before the room is replaced: the plan is never installed.
      expect(seed.install).not.toHaveBeenCalled();
      expect(project.fs.files.get(B_CURRENT)).toEqual(project.bBefore);
      expect(project.session.exportCommittedState()).toEqual(project.roomBefore);
      switched.mockRestore();
      expect(JSON.stringify(await project.store.readCurrent())).toBe(project.aBefore);
    }
  );

  it.each(['carry', 'full-reset'] as const)(
    'refuses %s when the workspace changes before the new room is promoted',
    async (start) => {
      const project = await twoProjects(heldSeed(() => false).seed);
      const held = deferred();
      const writing = deferred();
      const write = project.store.writeCurrent.bind(project.store);
      jest.spyOn(project.store, 'writeCurrent').mockImplementationOnce(async (checkpoint, options) => {
        writing.resolve();
        await held.promise;
        return write(checkpoint, options);
      });

      const resetting = project.coordinator.resetSession({ start });
      await writing.promise;
      const switched = jest.spyOn(project.store, 'availability').mockReturnValue(B_AVAILABLE);
      held.resolve();

      await expect(resetting).rejects.toThrow('workspace changed');
      expect(project.fs.files.get(B_CURRENT)).toEqual(project.bBefore);
      expect(project.session.exportCommittedState()).toEqual(project.roomBefore);
      switched.mockRestore();
      expect(JSON.stringify(await project.store.readCurrent())).toBe(project.aBefore);
    }
  );

  it('writes nothing to the new workspace when it changes while the first room is seeded', async () => {
    const { seed, entered, release } = heldSeed((kind) => kind === 'first');
    const harness = setupCoordinator({ roomSeed: seed });
    harness.fs.setJson(B_CURRENT, scriptedCheckpoint('project-b-room'));
    const bBefore = harness.fs.files.get(B_CURRENT);

    const initializing = harness.coordinator.initialize();
    await entered.promise;
    jest.spyOn(harness.store, 'availability').mockReturnValue(B_AVAILABLE);
    release.resolve();
    await initializing;
    await harness.coordinator.flush().catch(() => undefined);

    expect(harness.fs.files.get(B_CURRENT)).toEqual(bBefore);
  });
});
