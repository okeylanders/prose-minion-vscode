/**
 * Which open room the Workshop holds (PR #296 F3), through the real
 * persistence coordinator over session files in memory. Every replacement
 * is told as it lands, in the step that swaps the aggregate. Only a Rewind
 * keeps the instance; activation, Open, a reopen or reload of the same named
 * session (its id unchanged), Branch, New and a failed replacement's rollback
 * each open another. Made-up text: Alice.
 */

import { WorkshopOpenRoomInstance, type WorkshopRoomReplacement } from '@/application/services/workshop/WorkshopOpenRoomInstance';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';

async function openedRoom() {
  const scripted = new ScriptedWorkshopRoom().start('Alice was beginning to get very tired of sitting by her sister.');
  scripted.hostMessage('Does the opening hold?');
  scripted.hostMessage('And the rabbit-hole?');
  const writerTurns = scripted.session.readRoomLedger().filter((turn) => turn.participant === 'writer' && turn.role === 'user');
  const real = setupCoordinator();
  await real.store.saveNamed(scriptedCheckpoint('caterpillar', scripted));
  const told: Array<WorkshopRoomReplacement & { revision: number; turns: number }> = [];
  real.coordinator.onRoomReplaced((replacement) => told.push({
    ...replacement, revision: real.session.readRoomRevision(), turns: real.session.readRoomLedger().length
  }));
  await real.coordinator.initialize();
  await real.coordinator.openNamed('caterpillar');
  told.length = 0;
  return { real, told, writerTurns };
}

describe('the open room instance', () => {
  it('is told every replacement in the step that swaps the room, with the room it installed', async () => {
    const { real, told, writerTurns } = await openedRoom();
    const instance = real.coordinator.openRoomInstance();
    await real.coordinator.rewindTo({ kind: 'beforeTurn', turnId: writerTurns[1].id }, { origin: 'writer' });
    // The listener read the cut room: the revision and ledger were already the new room's.
    expect(told).toEqual([{ instance, rewound: true, revision: real.session.readRoomRevision(), turns: real.session.readRoomLedger().length }]);
    expect(real.coordinator.openRoomInstance()).toBe(instance);
  });

  it.each([
    ['a reopen of the same named session', (real: ReturnType<typeof setupCoordinator>) => real.coordinator.openNamed('caterpillar')],
    ['New', (real: ReturnType<typeof setupCoordinator>) => real.coordinator.resetSession({ start: 'carry' })],
    ['an empty start', (real: ReturnType<typeof setupCoordinator>) => real.coordinator.resetSession({ start: 'empty' })]
  ])('%s opens another instance', async (_name, replace) => {
    const { real, told } = await openedRoom();
    const instance = real.coordinator.openRoomInstance();
    await replace(real);
    expect(told.map(({ rewound }) => rewound)).toEqual([false]);
    expect(told[0].instance).toBe(real.coordinator.openRoomInstance());
    expect(real.coordinator.openRoomInstance()).not.toBe(instance);
  });

  it('Branch opens another instance', async () => {
    const { real, told, writerTurns } = await openedRoom();
    const instance = real.coordinator.openRoomInstance();
    await real.coordinator.branchFrom({ kind: 'beforeTurn', turnId: writerTurns[1].id });
    expect(told.length).toBeGreaterThan(0);
    expect(told.every(({ rewound }) => !rewound)).toBe(true);
    expect(real.coordinator.openRoomInstance()).not.toBe(instance);
  });

  it('a Rewind whose write fails is rolled back, and the restored room is another instance', async () => {
    const { real, told, writerTurns } = await openedRoom();
    const instance = real.coordinator.openRoomInstance();
    // A named room commits a Rewind to its own file.
    jest.spyOn(real.store, 'updateNamed').mockRejectedValueOnce(new Error('disk full'));
    await expect(real.coordinator.rewindTo({ kind: 'beforeTurn', turnId: writerTurns[1].id }, { origin: 'writer' })).rejects.toThrow();
    expect(told.map(({ rewound }) => rewound)).toEqual([true, false]);
    expect(real.coordinator.openRoomInstance()).not.toBe(instance);
  });

  it('a listener that throws is logged by kind, and the others are still told', () => {
    const lines: string[] = [];
    const room = new WorkshopOpenRoomInstance((line) => lines.push(line));
    const heard: number[] = [];
    room.subscribe(() => {
      throw new TypeError('the Hatter');
    });
    const stop = room.subscribe(({ instance }) => heard.push(instance));
    room.replaced();
    stop();
    room.replaced();
    expect(heard).toEqual([2]);
    expect(lines).toEqual(['[WorkshopOpenRoomInstance] A room-replacement listener failed (TypeError)', '[WorkshopOpenRoomInstance] A room-replacement listener failed (TypeError)']);
    expect(lines.join('\n')).not.toContain('Hatter');
  });
});
