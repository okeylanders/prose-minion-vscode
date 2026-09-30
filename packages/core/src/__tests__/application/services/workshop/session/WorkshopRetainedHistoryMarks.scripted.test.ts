import type {
  WorkshopConversationLogicalKey,
  WorkshopRetainedHistoryMarkV1,
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import type { ConversationArchiveEntryV1 } from '@orchestration/ConversationManager';
import {
  runCanonicalScriptedRoom,
  ScriptedRestPoint,
  ScriptedWorkshopRoom
} from './ScriptedWorkshopRoom';

/** What a mark would have to say to describe this participant right now. */
function liveParticipantFacts(
  state: WorkshopSessionStateV1,
  archive: readonly ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[]
): Map<WorkshopConversationLogicalKey, Omit<WorkshopRetainedHistoryMarkV1, 'turnId' | 'origin'>> {
  const facts = new Map<
    WorkshopConversationLogicalKey,
    Omit<WorkshopRetainedHistoryMarkV1, 'turnId' | 'origin'>
  >();
  for (const entry of archive) {
    const base = {
      conversationKey: entry.key,
      messageCount: entry.messages.length,
      contextSourceCount: entry.contextSources.length
    };
    if (entry.key === 'host') {
      facts.set(entry.key, {
        ...base,
        writerSourceCount: state.writerSources.host.length,
        lastSeenRoomTurnId: state.participants.host.lastSeenRoomTurnId
      });
    } else if (entry.key.startsWith('tool:')) {
      const toolId = entry.key.slice('tool:'.length) as keyof WorkshopSessionStateV1['writerSources']['tools'];
      facts.set(entry.key, {
        ...base,
        writerSourceCount: state.writerSources.tools[toolId]?.length ?? 0
      });
    } else {
      const personaId = entry.key.slice('guest:'.length);
      facts.set(entry.key, {
        ...base,
        writerSourceCount: state.writerSources.guests
          .find((guest) => guest.personaId === personaId)?.sources.length ?? 0,
        lastSeenRoomTurnId: state.participants.personaGuests
          .find((guest) => guest.personaId === personaId)?.lastSeenRoomTurnId
      });
    }
  }
  return facts;
}

const latestMarks = (point: ScriptedRestPoint) => {
  const latest = new Map<WorkshopConversationLogicalKey, WorkshopRetainedHistoryMarkV1>();
  for (const mark of point.workshop.retainedHistoryMarks ?? []) {
    latest.set(mark.conversationKey, mark);
  }
  return latest;
};

const withoutOffsetWhenAbsent = (mark: Omit<WorkshopRetainedHistoryMarkV1, 'turnId' | 'origin'>) =>
  mark.lastSeenRoomTurnId === undefined
    ? (({ lastSeenRoomTurnId: _offset, ...rest }) => rest)(mark)
    : mark;

describe('retained-history marks in a scripted room (ADR 2026-09-30 §3)', () => {
  let room: ScriptedWorkshopRoom;

  beforeAll(() => {
    room = runCanonicalScriptedRoom();
  });

  it('describes every live participant exactly at every rest point', () => {
    for (const point of room.restPoints) {
      const facts = liveParticipantFacts(point.workshop, point.archive);
      const latest = latestMarks(point);
      // Every retained history is marked, and nothing else is.
      expect({ point: point.label, keys: [...latest.keys()].sort() })
        .toEqual({ point: point.label, keys: [...facts.keys()].sort() });
      for (const [key, expected] of facts) {
        const mark = latest.get(key)!;
        const { turnId: _turnId, origin: _origin, ...recorded } = mark;
        expect({ point: point.label, key, recorded: withoutOffsetWhenAbsent(recorded) })
          .toEqual({ point: point.label, key, recorded: withoutOffsetWhenAbsent(expected) });
      }
    }
  });

  it('never rewrites a mark after its commit', () => {
    const final = room.restPoints.at(-1)!;
    for (const mark of final.workshop.retainedHistoryMarks ?? []) {
      const atCommit = room.restPoints.find((point) => point.headTurnId === mark.turnId);
      expect(atCommit).toBeDefined();
      expect(latestMarks(atCommit!).get(mark.conversationKey)).toEqual(mark);
    }
  });

  it('marks every commit type at its reply turn', () => {
    const final = room.restPoints.at(-1)!;
    const turns = new Map(final.workshop.turns.map((turn) => [turn.id, turn]));
    const everMarked = new Map<string, WorkshopRetainedHistoryMarkV1>();
    for (const point of room.restPoints) {
      for (const mark of point.workshop.retainedHistoryMarks ?? []) {
        everMarked.set(`${mark.conversationKey}@${mark.turnId}`, mark);
      }
    }
    const kinds = new Set([...everMarked.values()].map((mark) => {
      const turn = turns.get(mark.turnId)!;
      return `${mark.conversationKey.split(':')[0]}:${turn.participant}:${turn.artifact}`;
    }));

    expect([...kinds].sort()).toEqual([
      'guest:guest:persona_message',
      'host:host:persona_message',
      'host:host:persona_synthesis',
      'tool:tool:direct_tool_response',
      'tool:tool:tool_report'
    ]);
    // The guest's FIRST mark lands on its join reply, not the invitation.
    const joinReply = final.workshop.turns.find(
      (turn) => turn.participant === 'guest' && turn.content === 'margot joins.'
    )!;
    expect(everMarked.get(`guest:margot@${joinReply.id}`)).toMatchObject({ origin: 'commit' });
  });

  it('counts every capability round the host history committed', () => {
    const first = room.restPoints.find((point) => point.label === 'host reply: What is this scene doing?')!;
    // One exchange plus two request/evidence pairs; one manifest row per round.
    expect(latestMarks(first).get('host')).toMatchObject({ messageCount: 6, contextSourceCount: 2 });
  });

  it('prunes sidecar marks when an excerpt revision retires the sidecar', () => {
    const revised = room.restPoints.find((point) => point.label.startsWith('excerpt revised'))!;
    expect(revised.workshop.participants.toolSidecars).toEqual([]);
    expect((revised.workshop.retainedHistoryMarks ?? [])
      .filter((mark) => mark.conversationKey.startsWith('tool:'))).toEqual([]);
  });

  it('prunes a dismissed guest and never carries its marks into a re-invitation', () => {
    const dismissed = room.restPoints.find((point) => point.label === 'margot dismissed')!;
    const rejoined = room.restPoints.find((point) => point.label === 'margot joined'
      && point !== room.restPoints.find((candidate) => candidate.label === 'margot joined'))!;
    const guestMarks = (point: ScriptedRestPoint) => (point.workshop.retainedHistoryMarks ?? [])
      .filter((mark) => mark.conversationKey === 'guest:margot');

    expect(guestMarks(dismissed)).toEqual([]);
    expect(guestMarks(rejoined)).toEqual([
      expect.objectContaining({ turnId: rejoined.headTurnId, messageCount: 2 })
    ]);
  });

  it('records nothing for a cancelled writer turn', () => {
    const before = room.restPoints.find((point) => point.label === 'margot joined'
      && point !== room.restPoints.find((candidate) => candidate.label === 'margot joined'))!;
    const cancelled = room.restPoints.find((point) => point.label.startsWith('cancelled'))!;
    expect(cancelled.workshop.retainedHistoryMarks).toEqual(before.workshop.retainedHistoryMarks);
  });

  it('logs one diagnostic line per recorded mark and never message content', () => {
    const recorded = room.log.filter((line) => line.includes('Retained-history mark recorded'));
    const everMarked = new Set(room.restPoints.flatMap((point) =>
      (point.workshop.retainedHistoryMarks ?? []).map((mark) => `${mark.conversationKey}@${mark.turnId}`)
    ));
    expect(recorded).toHaveLength(everMarked.size);
    expect(room.log.join('\n')).not.toContain('Host reply to');
  });

  it('prunes every mark when the assistant generation is lost, and on reset', () => {
    const lost = runCanonicalScriptedRoom();
    lost.session.clearAllConversations();
    expect(lost.session.exportCommittedState().retainedHistoryMarks).toEqual([]);

    const reset = runCanonicalScriptedRoom();
    reset.session.reset();
    expect(reset.session.exportCommittedState().retainedHistoryMarks).toEqual([]);
  });
});
