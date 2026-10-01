import { MessageType } from '@messages';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

/**
 * ADR 2026-09-30 §3 through the real routes: each commit path's handler
 * settles delivery, host updates, and shipped attachments before completion
 * records its mark, so every latest mark describes its participant exactly.
 */
describe('Workshop routes record settled retained-history marks', () => {
  it('marks the report, synthesis, host reply, and guest join at their settled rest points', async () => {
    const { session, router, pin, runProse } = createWorkshopRouteTestHarness();
    await pin();
    await runProse();
    session.addMessageAttachment({ label: 'notes.md', words: 1, content: 'Notes.' });
    await router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Open the room.' }) as any);
    await router.route(message(
      MessageType.WORKSHOP_INVITE_GUEST,
      { personaId: 'margot', openingMessage: 'Join us.' }
    ) as any);

    const state = session.exportCommittedState();
    const turns = new Map(state.turns.map((turn) => [turn.id, turn]));
    const marks = state.retainedHistoryMarks ?? [];
    expect(marks.map((mark) => [mark.conversationKey, turns.get(mark.turnId)?.artifact])).toEqual([
      ['tool:prose', 'tool_report'],
      ['host', 'persona_synthesis'],
      ['host', 'persona_message'],
      ['guest:margot', 'persona_message']
    ]);
    const latest = (key: string) => marks.filter((mark) => mark.conversationKey === key).at(-1)!;
    expect(latest('host')).toMatchObject({
      messageCount: 4,
      // Pin plus the attachment shipped during settlement.
      writerSourceCount: state.writerSources.host.length,
      lastSeenRoomTurnId: state.participants.host.lastSeenRoomTurnId
    });
    expect(state.writerSources.host.some((entry) => entry.label === 'notes.md')).toBe(true);
    expect(latest('guest:margot')).toMatchObject({
      messageCount: 2,
      writerSourceCount: state.writerSources.guests[0].sources.length,
      lastSeenRoomTurnId: state.participants.personaGuests[0].lastSeenRoomTurnId
    });
    expect(latest('tool:prose')).toMatchObject({
      writerSourceCount: state.writerSources.tools.prose?.length
    });
    expect(latest('tool:prose')).not.toHaveProperty('lastSeenRoomTurnId');
  });
});
