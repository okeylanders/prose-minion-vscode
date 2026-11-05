/**
 * The room seed port's call sites (ADR 2026-11-04 D9), through the real
 * coordinator, aggregate and store, with a recording fake seed:
 *
 * - `carry` prepares 'new', `full-reset` prepares 'full-reset', `empty`
 *   calls nothing;
 * - the first room in a project prepares 'first';
 * - Open, Duplicate, Branch, Rewind and hydrate never call it;
 * - what `install` attaches is in the first checkpoint written;
 * - a failed replacement leaves the prior room as it was, and its plan is
 *   never installed later.
 */

import type {
  WorkshopRoomSeed,
  WorkshopRoomSeedKind,
  WorkshopRoomSeedPlan,
  WorkshopRoomSeedReport,
  WorkshopRoomSeedTarget
} from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import { ScriptedWorkshopRoom } from '../session/ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from '../session/WorkshopCoordinatorHarness';

interface RecordedPlan extends WorkshopRoomSeedPlan {
  serial: number;
}

/** A seed that attaches one made-up file per plan and records every call. */
class RecordingSeed implements WorkshopRoomSeed {
  readonly prepared: WorkshopRoomSeedKind[] = [];
  readonly installed: number[] = [];
  failNextPrepare = false;
  private serial = 0;

  async prepare(kind: WorkshopRoomSeedKind): Promise<WorkshopRoomSeedPlan> {
    this.prepared.push(kind);
    if (this.failNextPrepare) {
      this.failNextPrepare = false;
      throw new Error('seed read failed');
    }
    const plan: RecordedPlan = { kind, serial: ++this.serial };
    return plan;
  }

  install(plan: WorkshopRoomSeedPlan, room: WorkshopRoomSeedTarget): WorkshopRoomSeedReport {
    const { serial } = plan as RecordedPlan;
    this.installed.push(serial);
    const label = `alice-${plan.kind}-${serial}.md`;
    const added = room.addContextAttachment({
      kind: 'file',
      origin: 'writer',
      label,
      words: 4,
      content: 'Alice follows the Rabbit.',
      sourceUri: `file:///workspace/novel/${label}`,
      relativePath: label
    });
    return {
      pinnedCount: 1,
      attachedCount: added.ok ? 1 : 0,
      attachedWords: added.ok ? 4 : 0,
      leftOut: added.ok ? [] : [{ label, reason: 'over-budget' }]
    };
  }

  reset(): void {
    this.prepared.length = 0;
    this.installed.length = 0;
  }
}

const labels = (attachments: ReadonlyArray<{ label: string }>): string[] =>
  attachments.map((attachment) => attachment.label);

async function freshProject() {
  const seed = new RecordingSeed();
  const harness = setupCoordinator({ roomSeed: seed });
  await harness.coordinator.initialize();
  await harness.coordinator.flush();
  return { ...harness, seed };
}

describe('the room seed port, through the real coordinator (ADR 2026-11-04 D9)', () => {
  it('seeds the first room in a project, and that room\'s first checkpoint holds it', async () => {
    const { seed, session, store } = await freshProject();

    expect(seed.prepared).toEqual(['first']);
    expect(seed.installed).toEqual([1]);
    expect(labels(session.getContextAttachments())).toEqual(['alice-first-1.md']);
    const current = await store.readCurrent();
    expect(labels(current!.workshop.contextAttachments)).toEqual(['alice-first-1.md']);
  });

  it.each([
    ['carry', 'new'],
    ['full-reset', 'full-reset']
  ] as const)('%s prepares %s, and installs before the first checkpoint', async (start, kind) => {
    const { seed, coordinator, store, session } = await freshProject();
    seed.reset();

    const summary = await coordinator.resetSession({ start });

    expect(seed.prepared).toEqual([kind]);
    expect(seed.installed).toEqual([2]);
    expect(summary.seed).toEqual({ pinnedCount: 1, attachedCount: 1, attachedWords: 4, leftOut: [] });
    const expected = start === 'carry'
      ? ['alice-first-1.md', 'alice-new-2.md']
      : ['alice-full-reset-2.md'];
    expect(labels(session.getContextAttachments())).toEqual(expected);
    const current = await store.readCurrent();
    expect(labels(current!.workshop.contextAttachments)).toEqual(expected);
  });

  it('empty never calls the port, and starts with nothing attached', async () => {
    const { seed, coordinator, session, store } = await freshProject();
    seed.reset();

    const summary = await coordinator.resetSession({ start: 'empty' });

    expect(seed.prepared).toEqual([]);
    expect(seed.installed).toEqual([]);
    expect(summary.seed).toBeUndefined();
    expect(summary.attachmentLabels).toEqual(['alice-first-1.md']);
    expect(session.getContextAttachments()).toEqual([]);
    expect((await store.readCurrent())!.workshop.contextAttachments).toEqual([]);
  });

  it('a failed replacement keeps the prior room, and its plan is never installed later', async () => {
    const { seed, coordinator, session, store } = await freshProject();
    seed.reset();
    jest.spyOn(store, 'writeCurrent').mockRejectedValueOnce(new Error('promotion failed'));

    await expect(coordinator.resetSession({ start: 'full-reset' })).rejects.toThrow('promotion failed');

    expect(labels(session.getContextAttachments())).toEqual(['alice-first-1.md']);

    await coordinator.resetSession({ start: 'full-reset' });

    expect(seed.prepared).toEqual(['full-reset', 'full-reset']);
    expect(labels(session.getContextAttachments())).toEqual(['alice-full-reset-3.md']);
  });

  it('a plan that cannot be read starts nothing and changes nothing', async () => {
    const { seed, coordinator, session, store } = await freshProject();
    seed.reset();
    const before = await store.readCurrent();
    seed.failNextPrepare = true;

    await expect(coordinator.resetSession({ start: 'carry' })).rejects.toThrow('seed read failed');

    expect(seed.installed).toEqual([]);
    expect(labels(session.getContextAttachments())).toEqual(['alice-first-1.md']);
    expect((await store.readCurrent())!.sessionId).toBe(before!.sessionId);
  });

  it('never seeds a project whose current.json is reloaded', async () => {
    const seed = new RecordingSeed();
    const reloaded = setupCoordinator({ roomSeed: seed });
    await reloaded.store.writeCurrent(scriptedCheckpoint('rolling'));

    await reloaded.coordinator.initialize();

    expect(seed.prepared).toEqual([]);
    expect(seed.installed).toEqual([]);
  });

  it('never seeds Open, Duplicate, Rewind or Branch', async () => {
    const { seed, coordinator, store } = await freshProject();
    const room = new ScriptedWorkshopRoom().start();
    const replies = ['Where is the Rabbit?', 'Why the hole?'].map((text) => room.hostMessage(text));
    await store.saveNamed(scriptedCheckpoint('alice-saved', room));
    seed.reset();
    const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });

    await coordinator.openNamed('alice-saved');
    await coordinator.duplicateNamed('alice-saved', 'Alice again');
    await coordinator.rewindTo(after(replies[1].id), { origin: 'writer' });
    await coordinator.branchFrom(after(replies[0].id));

    expect(seed.prepared).toEqual([]);
    expect(seed.installed).toEqual([]);
  });
});
