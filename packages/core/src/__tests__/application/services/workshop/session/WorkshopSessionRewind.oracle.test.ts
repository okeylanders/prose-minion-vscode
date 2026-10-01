/**
 * The equivalence oracle (ADR 2026-09-30; Sprint 02 plan, "Tests").
 *
 * Rewinding the canonical scripted room from its final state to any rest
 * point must reproduce the room that point recorded, modulo the intended
 * differences `expectedRewoundRoom` applies by named rule. Anything else that
 * differs is a rewind bug. Branch's key proof reuses the same expected room.
 */

import { clonePersistedJson } from '@/application/services/workshop/persistedJson';
import {
  rewindWorkshopSession,
  WorkshopRewindRefusedError,
  WorkshopSessionRewindResult
} from '@/application/services/workshop/session/WorkshopSessionRewind';
import {
  runCanonicalScriptedRoom,
  ScriptedRestPoint,
  ScriptedWorkshopRoom
} from './ScriptedWorkshopRoom';
import { expectedRewoundRoom } from './WorkshopRewindOracle';

describe('the rewind equivalence oracle over the canonical scripted room', () => {
  let room: ScriptedWorkshopRoom;
  let final: ScriptedRestPoint;

  beforeAll(() => {
    room = runCanonicalScriptedRoom();
    final = room.restPoints.at(-1)!;
  });

  const rewindTo = (point: ScriptedRestPoint): WorkshopSessionRewindResult =>
    rewindWorkshopSession({
      workshop: final.workshop,
      conversations: final.archive,
      cut: { kind: 'afterTurn', turnId: point.headTurnId }
    });

  it('covers every commit type, discard and rest shape of the canonical room', () => {
    // A guard against the script shrinking under the oracle.
    expect(room.restPoints.length).toBeGreaterThanOrEqual(18);
  });

  it('reproduces every rest point after the directive floor, modulo the intended differences', () => {
    const floor = final.workshop.turns.findIndex((turn) => turn.artifact === 'standing_directive_change');
    const compared: string[] = [];
    for (const point of room.restPoints) {
      const index = final.workshop.turns.findIndex((turn) => turn.id === point.headTurnId);
      if (index < floor) {
        continue;
      }
      // The recorded ledger is a prefix of the final ledger.
      expect(final.workshop.turns.slice(0, index + 1).map((turn) => turn.id))
        .toEqual(point.workshop.turns.map((turn) => turn.id));

      const result = rewindTo(point);
      const expected = expectedRewoundRoom(point, final);

      expect({ point: point.label, workshop: result.workshop })
        .toEqual({ point: point.label, workshop: expected.workshop });
      expect({ point: point.label, archive: result.conversations })
        .toEqual({ point: point.label, archive: expected.archive });
      expect({ point: point.label, summary: result.summary }).toEqual({
        point: point.label,
        summary: {
          keptThroughTurnId: point.headTurnId,
          removedTurnCount: final.workshop.turns.length - point.workshop.turns.length,
          droppedConversationKeys: expected.droppedConversationKeys,
          removedTodoCount: 0,
          releasedWidgetConfigIds: expected.releasedWidgetConfigIds
        }
      });
      compared.push(point.label);
    }
    // Every rest point but the start, which precedes the directive change.
    expect(compared).toHaveLength(room.restPoints.length - 1);
  });

  it('refuses the rest point before the standing-directive change (the v1 floor)', () => {
    const start = room.restPoints.find((point) => point.label === 'start')!;
    let refusal: unknown;
    try {
      rewindTo(start);
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(WorkshopRewindRefusedError);
    expect((refusal as WorkshopRewindRefusedError).reason).toBe('before-directive-change');
  });

  it('exercises each intended difference at least once, so none of the rules is vacuous', () => {
    const differences = new Set<string>();
    for (const point of room.restPoints.slice(1)) {
      const expected = expectedRewoundRoom(point, final);
      const recorded = clonePersistedJson(point.workshop);
      if (JSON.stringify(expected.workshop.excerpt) !== JSON.stringify(recorded.excerpt)) {
        differences.add('excerpt stays current');
      }
      if (JSON.stringify(expected.workshop.contextAttachments) !== JSON.stringify(recorded.contextAttachments)) {
        differences.add('context stays current');
      }
      if (JSON.stringify(expected.workshop.counters) !== JSON.stringify(recorded.counters)) {
        differences.add('counters never lowered');
      }
      if (expected.workshop.revisions.pendingExcerpt !== recorded.revisions.pendingExcerpt) {
        differences.add('pending excerpt re-queued');
      }
      if (expected.workshop.revisions.pendingContext !== recorded.revisions.pendingContext) {
        differences.add('pending context re-queued');
      }
      if (JSON.stringify(expected.workshop.widgetConfigs) !== JSON.stringify(recorded.widgetConfigs)) {
        differences.add('widget configs stay current or release');
      }
      if (expected.droppedConversationKeys.length > 0) {
        differences.add('discarded memberships dropped');
      }
      if (JSON.stringify(expected.workshop.participants.chatTarget)
        !== JSON.stringify(recorded.participants.chatTarget)) {
        differences.add('chat target stays current');
      }
    }
    expect([...differences].sort()).toEqual([
      'chat target stays current',
      'context stays current',
      'counters never lowered',
      'discarded memberships dropped',
      'excerpt stays current',
      'pending context re-queued',
      'pending excerpt re-queued',
      'widget configs stay current or release'
    ]);
  });
});
