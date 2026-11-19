/**
 * The context tally follows Rewind as the manifest does (ADR 2026-11-18 D6):
 * `rewindWorkshopSession`, the one transform that cuts a room, keeps exactly
 * the tally entries of the messages it keeps, by the mark's own message
 * count. An archive from before the tally rewinds as it always did.
 */

import { rewindWorkshopSession } from '@/application/services/workshop/session/WorkshopSessionRewind';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';

/** Tally the host's latest turn as the engine would: at its opening message. */
const tallyLatestHostTurn = (room: ScriptedWorkshopRoom, pieces: Record<string, number>): void => {
  const id = room.session.getHostConversationId()!;
  const count = room.conversations.getCommittedHistoryCounts(id)!.messageCount;
  expect(room.conversations.appendContextTally(id, { messageIndex: count - 2, pieces })).toBe(true);
};

describe('context tally through Rewind (ADR 2026-11-18 D6)', () => {
  it('a cut removes the tallies of the messages it removes', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('What does Alice want here?');
    tallyLatestHostTurn(room, { 'memory.start': 300, 'tool-use.contract': 900 });
    room.hostMessage('And the Queen?');
    tallyLatestHostTurn(room, { 'room.time': 12 });
    room.hostMessage('And the Hatter?');
    tallyLatestHostTurn(room, { 'todos.snapshot': 44 });

    const archive = room.archive();
    expect(archive.find((entry) => entry.key === 'host')?.contextTally).toHaveLength(3);

    const result = rewindWorkshopSession({
      workshop: room.session.exportCommittedState(),
      conversations: archive,
      cut: { kind: 'afterTurn', turnId: first.id }
    });
    const host = result.conversations.find((entry) => entry.key === 'host')!;
    expect(host.messages).toHaveLength(2);
    expect(host.contextTally).toEqual([{ messageIndex: 0, pieces: { 'memory.start': 300, 'tool-use.contract': 900 } }]);
  });

  it('an archive with no tally rewinds without one', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('What does Alice want here?');
    room.hostMessage('And the Queen?');
    const result = rewindWorkshopSession({
      workshop: room.session.exportCommittedState(),
      conversations: room.archive(),
      cut: { kind: 'afterTurn', turnId: first.id }
    });
    expect('contextTally' in result.conversations.find((entry) => entry.key === 'host')!).toBe(false);
  });
});
