/**
 * A rolled-back run takes its reactions with it (ADR 2026-11-07 D2; PR #245
 * L5), at the aggregate: `rollbackMessageRun` and `rollbackToolRun` prune
 * the reaction ledger with the turns they remove, keep every other
 * reaction, and leave a room that exports through strict validation.
 *
 * Neither provisional turn can take a reaction through a route today (a
 * writer's message and a tool request are not persona replies, and a
 * persona's reaction rides a reply that has not committed), so each test
 * puts one there through the ledger itself, to witness the prune.
 */

import type { WorkshopReactionLedger } from '@/application/services/workshop/session/WorkshopReactionLedger';
import { validateWorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1Integrity';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';

const ledgerOf = (room: ScriptedWorkshopRoom): WorkshopReactionLedger =>
  (room.session as unknown as { reactionLedger: WorkshopReactionLedger }).reactionLedger;

function reactedRoom() {
  const room = new ScriptedWorkshopRoom().start();
  const reply = room.hostMessage('Where did the rabbit go?');
  expect(room.session.setWriterReaction(reply.id, 'fire', true)).toBe('added');
  return { room, reply };
}

describe('rollback prunes reactions with its turns', () => {
  it('a rolled-back message run drops a reaction on its writer turn and keeps the rest', () => {
    const { room, reply } = reactedRoom();
    const writer = room.session.beginPersonaMessage('offline-run', 'Alice, are you there?', []);
    ledgerOf(room).add({ turnId: writer.id, reaction: 'eyes', author: { kind: 'host' }, viaTurnId: 'turn-later' }, writer);
    expect(room.session.readRoomReactions()).toHaveLength(2);

    expect(room.session.rollbackMessageRun('offline-run')).toEqual(writer);

    expect(room.session.readRoomReactions()).toEqual([
      expect.objectContaining({ turnId: reply.id, reaction: 'fire' })
    ]);
    expect(() => validateWorkshopSessionStateV1(room.session.exportCommittedState())).not.toThrow();
  });

  it('a rolled-back tool run drops a reaction on its request and keeps the rest', () => {
    const { room, reply } = reactedRoom();
    const request = room.session.beginToolRun('prose', 'tool-run');
    ledgerOf(room).add({ turnId: request.id, reaction: 'eyes', author: { kind: 'writer' } }, {
      ...request,
      // A tool request is not reactable; the ledger is shown a reply's facts so the entry lands.
      ...reply,
      id: request.id
    });
    expect(room.session.readRoomReactions()).toHaveLength(2);

    room.session.rollbackToolRun('tool-run');

    expect(room.session.readRoomReactions()).toEqual([
      expect.objectContaining({ turnId: reply.id, reaction: 'fire' })
    ]);
  });
});
