/**
 * Reaction delivery across the room (ADR 2026-11-07 D4, D6, R2, R3), through
 * the scripted room's real conversation store and the real coordinator:
 *
 * - The frame rides only the persona's next user message; every earlier
 *   message in its retained conversation is byte-identical before and after.
 * - The record rides the reply that answered the frame, so Rewind cutting it
 *   makes the reaction arrive again, Branch keeps exactly the kept replies'
 *   records, and a rolled-back run records nothing.
 * - A guest is told exactly what it can see, by whose message; its join
 *   starts its own view.
 * - The codec reads the record strictly; a session without it is unchanged.
 */

import type { WorkshopReactionDelivery, WorkshopTurn } from '@messages';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import { rewindWorkshopSession } from '@/application/services/workshop/session/WorkshopSessionRewind';
import { planWorkshopReactionDelivery } from '@/application/services/workshop/reactions/WorkshopReactionDelivery';
import { renderWorkshopReactionInvite } from '@/application/services/workshop/reactions/WorkshopReactionInvite';
import { workshopReactionDeliveredView } from '@/application/services/workshop/reactions/WorkshopReactionDeliveredView';
import { parseWorkshopPersistedSession } from '@/application/services/workshop/WorkshopPersistedSession';
import {
  projectWorkshopTranscript,
  projectWorkshopTranscriptTurn
} from '@/application/services/workshop/transcript/WorkshopTranscript';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';

const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });
const HOST = { kind: 'host' } as const;

const hostHistory = (room: ScriptedWorkshopRoom) =>
  room.conversations.getMessages(room.session.getHostConversationId()!);

const owedTo = (
  turns: readonly WorkshopTurn[],
  reactions: Parameters<typeof planWorkshopReactionDelivery>[0]['reactions'],
  reader: Parameters<typeof planWorkshopReactionDelivery>[0]['reader'] = HOST
) => planWorkshopReactionDelivery({ turns, reactions, reader, hostPersonaId: 'jill', kind: 'update', holds: () => true }).listed;

/** Two exchanges; the writer reacts fire to the first reply; the third message delivers it. */
function deliveredRoom() {
  const room = new ScriptedWorkshopRoom().start();
  const first = room.hostMessage('Where did the rabbit go?');
  const second = room.hostMessage('Why the watch?');
  const before = JSON.stringify(hostHistory(room));
  expect(room.session.setWriterReaction(first.id, 'fire', true)).toBe('added');
  const third = room.hostMessage('Who is late?');
  return { room, first, second, third, before };
}

describe('reaction delivery across the room (ADR 2026-11-07 D4, D6)', () => {
  it('rides only the next user message; earlier retained messages are byte-identical', () => {
    const { room, before, third } = deliveredRoom();
    const history = hostHistory(room);
    const beforeMessages = JSON.parse(before) as unknown[];

    expect(JSON.stringify(history.slice(0, beforeMessages.length))).toBe(before);
    const delivered = history.slice(beforeMessages.length);
    expect(delivered.map((entry) => entry.role)).toEqual(['user', 'assistant']);
    expect(delivered[0].content).toMatch(/^<workshop-reactions>\n/);
    expect(delivered[0].content).toContain('- The writer reacted fire ("this is strong") to your reply that began "Host reply to \\"Where did the rabbit go?\\"."');
    expect(delivered[0].content).toContain('</workshop-reactions>\n[host] Who is late?');
    expect(third.reactionDelivery).toEqual([{
      participant: HOST, kind: 'update', reactions: [{ turnId: expect.any(String), author: { kind: 'writer' }, reaction: 'fire' }]
    }]);

    // Told once: the next message carries no frame, and no record.
    const fourth = room.hostMessage('And the Queen?');
    expect(hostHistory(room).at(-2)!.content).toBe('[host] And the Queen?');
    expect(fourth.reactionDelivery).toBeUndefined();
    expect(JSON.stringify(hostHistory(room).slice(0, beforeMessages.length))).toBe(before);
  });

  it('Slice 4a: with persona reactions on, the invite rides each new message after the frame; earlier messages stay byte-identical', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.reactionsOpen = true;
    const first = room.hostMessage('Where did the rabbit go?');
    room.hostMessage('Why the watch?');
    const before = JSON.stringify(hostHistory(room));
    room.session.setWriterReaction(first.id, 'confused', true);
    room.hostMessage('Who is late?');
    const history = hostHistory(room);
    const beforeMessages = JSON.parse(before) as unknown[];

    expect(JSON.stringify(history.slice(0, beforeMessages.length))).toBe(before);
    const userMessages = history.filter((entry) => entry.role === 'user').map((entry) => String(entry.content));
    expect(userMessages).toHaveLength(3);
    expect(userMessages.every((content) => content.split(`${renderWorkshopReactionInvite()}\n[host] `).length === 2)).toBe(true);
    const delivered = userMessages.at(-1)!;
    expect(delivered.indexOf('</workshop-reactions>')).toBeLessThan(delivered.indexOf(renderWorkshopReactionInvite()));

    room.hostMessage('And the Queen?');
    expect(JSON.stringify(hostHistory(room).slice(0, beforeMessages.length))).toBe(before);
  });

  it('writes the record only on the reply, never the writer turn', () => {
    const { room, third } = deliveredRoom();
    const writerTurns = room.session.readRoomLedger().filter((turn) => turn.participant === 'writer');
    expect(writerTurns.every((turn) => turn.reactionDelivery === undefined)).toBe(true);
    expect(room.session.readRoomLedger().find((turn) => turn.id === third.id)?.reactionDelivery).toHaveLength(1);
  });

  it('a rolled-back, abandoned or overtaken run records nothing, so the reaction arrives again', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('Where did the rabbit go?');
    room.session.setWriterReaction(first.id, 'heart', true);
    const record: WorkshopReactionDelivery = {
      participant: HOST, kind: 'update', reactions: [{ turnId: first.id, author: { kind: 'writer' }, reaction: 'heart' }]
    };
    const { session } = room;

    session.beginPersonaMessage('rolled-back', 'Anything new?');
    expect(session.stageReactionDelivery('rolled-back', record)).toBe(true);
    session.rollbackMessageRun('rolled-back');
    session.beginPersonaMessage('abandoned', 'Anything new?');
    session.stageReactionDelivery('abandoned', record);
    session.abandonRun('abandoned');
    expect(session.stageReactionDelivery('abandoned', record)).toBe(false);

    expect(workshopReactionDeliveredView(session.readRoomLedger(), HOST).recorded).toBe(false);
    expect(owedTo(session.readRoomLedger(), session.readRoomReactions())).toBe(1);
    const next = room.hostMessage('Anything new?');
    expect(hostHistory(room).at(-2)!.content).toContain('reacted heart');
    expect(next.reactionDelivery).toEqual([record]);
  });

  it('capability sub-turns inside a host run carry no record; the final reply does (PR #246 L5)', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('Where did the rabbit go?');
    room.session.setWriterReaction(first.id, 'fire', true);
    const before = room.session.readRoomLedger().length;
    const reply = room.hostMessage('Look it up.', { capabilityRounds: 2 });
    const added = room.session.readRoomLedger().slice(before);
    const capabilityTurns = added.filter((turn) => turn.capability);
    expect(capabilityTurns).toHaveLength(2);
    expect(capabilityTurns.every((turn) => turn.reactionDelivery === undefined)).toBe(true);
    expect(added.filter((turn) => turn.reactionDelivery).map((turn) => turn.id)).toEqual([reply.id]);
  });

  it('stages a record only for the conversation the run answers for', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.session.beginPersonaMessage('host-run', 'What did we settle?');
    expect(room.session.stageReactionDelivery('host-run', {
      participant: { kind: 'personaGuest', personaId: 'margot' }, kind: 'update',
      reactions: [{ turnId: 'turn-1', author: { kind: 'writer' }, reaction: 'fire' }]
    })).toBe(false);
  });
});

describe('Rewind, Branch and the transform keep delivery honest (R3)', () => {
  it('the transform cutting the reply that recorded a delivery makes the reaction owed again', () => {
    const { room, second, third } = deliveredRoom();
    const state = room.session.exportCommittedState();
    expect(owedTo(state.turns, state.reactions ?? [])).toBe(0);

    const cut = rewindWorkshopSession({ workshop: state, conversations: room.archive(), cut: after(second.id) });
    expect(cut.workshop.turns.some((turn) => turn.id === third.id)).toBe(false);
    expect(cut.workshop.reactions).toHaveLength(1);
    expect(owedTo(cut.workshop.turns, cut.workshop.reactions ?? [])).toBe(1);
  });

  it('Rewind through the coordinator: the reaction arrives again on the next turn', async () => {
    const { room, second } = deliveredRoom();
    const harness = setupCoordinator();
    await harness.store.saveNamed(scriptedCheckpoint('delivered', room));
    await harness.coordinator.initialize();
    await harness.coordinator.openNamed('delivered');
    expect(owedTo(harness.session.readRoomLedger(), harness.session.readRoomReactions())).toBe(0);

    await harness.coordinator.rewindTo(after(second.id), { origin: 'writer' });
    expect(harness.session.readRoomReactions()).toHaveLength(1);
    expect(owedTo(harness.session.readRoomLedger(), harness.session.readRoomReactions())).toBe(1);
  });

  it('Branch carries exactly the kept replies\' records, and never writes its source', async () => {
    const { room, second, third } = deliveredRoom();
    const harness = setupCoordinator();
    await harness.store.saveNamed(scriptedCheckpoint('delivered', room));
    await harness.coordinator.initialize();
    await harness.coordinator.openNamed('delivered');

    const kept = await harness.coordinator.branchFrom(after(third.id));
    const keptTurns = (await harness.store.readNamed(kept.branch.sessionId))!.workshop.turns;
    expect(keptTurns.filter((turn) => turn.reactionDelivery)).toHaveLength(1);

    const cut = await harness.coordinator.branchFrom(after(second.id));
    const branch = (await harness.store.readNamed(cut.branch.sessionId))!.workshop;
    expect(branch.turns.some((turn) => turn.reactionDelivery)).toBe(false);
    expect(owedTo(branch.turns, branch.reactions ?? [])).toBe(1);

    const source = (await harness.store.readNamed('delivered'))!.workshop;
    expect(source.turns.filter((turn) => turn.reactionDelivery)).toHaveLength(1);
  });

  it('Open loads the record with the session, and New starts with none', async () => {
    const { room } = deliveredRoom();
    const harness = setupCoordinator();
    await harness.store.saveNamed(scriptedCheckpoint('delivered', room));
    await harness.coordinator.initialize();
    await harness.coordinator.openNamed('delivered');
    expect(workshopReactionDeliveredView(harness.session.readRoomLedger(), HOST).reactions.size).toBe(1);

    await harness.coordinator.resetSession({ start: 'carry' });
    expect(JSON.stringify(await harness.store.readCurrent())).not.toContain('reactionDelivery');
  });
});

describe('guests (R2) and their own views (D6)', () => {
  it('a guest is told what it can see, by whose message; its join starts its view; a re-invite starts again', () => {
    const room = new ScriptedWorkshopRoom().start();
    const hostReply = room.hostMessage('Where did the rabbit go?');
    room.session.setWriterReaction(hostReply.id, 'fire', true);

    const join = room.inviteGuest('margot', 'Margot, read this with us.');
    const guestId = room.session.getPersonaGuestConversationId('margot')!;
    const joinMessage = room.conversations.getMessages(guestId).find((entry) => entry.role === 'user')!;
    expect(joinMessage.content).toContain('Reactions on messages in the room so far.');
    expect(joinMessage.content).toContain('- The writer reacted fire ("this is strong") to Jill\'s reply that began');
    expect(join.reactionDelivery?.[0]).toMatchObject({ participant: { kind: 'personaGuest', personaId: 'margot' }, kind: 'start' });

    const margot = room.guestMessage('margot', 'How does the voice sound?');
    expect(room.conversations.getMessages(guestId).at(-2)!.content).toBe('[guest margot] How does the voice sound?');
    room.session.setWriterReaction(margot.id, 'heart', true);
    room.guestMessage('margot', 'And the ending?');
    expect(room.conversations.getMessages(guestId).at(-2)!.content).toContain('reacted heart ("love this") to your reply');

    // The host has had no turn since either reaction: it hears both, the guest's reply by name.
    room.hostMessage('What did Margot say?');
    const hostMessage = hostHistory(room).at(-2)!.content;
    expect(hostMessage).toContain('reacted heart ("love this") to Margot\'s reply');
    expect(hostMessage).toContain('reacted fire ("this is strong") to your reply');

    room.dismissGuest('margot');
    room.inviteGuest('margot', 'Margot, back for another look?');
    const rejoined = room.conversations.getMessages(room.session.getPersonaGuestConversationId('margot')!)
      .find((entry) => entry.role === 'user')!.content;
    expect(rejoined).toContain('Reactions on messages in the room so far.');
    expect(rejoined).toContain('reacted heart ("love this") to your reply');
    expect(rejoined).toContain('reacted fire ("this is strong") to Jill\'s reply');
  });
});

describe('the record in the codec and the projections (D6, D7)', () => {
  it('a session without the field reads and saves byte for byte', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('Where did the rabbit go?');
    const raw = JSON.stringify(scriptedCheckpoint('plain', room));
    expect(raw).not.toContain('reactionDelivery');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(raw)))).toBe(raw);
  });

  it('round-trips a delivered room, and refuses a malformed record', () => {
    const { room } = deliveredRoom();
    const raw = JSON.stringify(scriptedCheckpoint('delivered', room));
    expect(raw).toContain('reactionDelivery');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(raw)))).toBe(raw);

    type RawTurn = { role: string; participant: string; reactionDelivery?: Array<Record<string, any>> };
    const variant = (change: (reply: RawTurn, turns: RawTurn[]) => void) => {
      const state = JSON.parse(raw);
      const turns = state.workshop.turns as RawTurn[];
      change(turns.find((turn) => turn.reactionDelivery)!, turns);
      return () => parseWorkshopPersistedSession(state);
    };
    expect(variant((reply, turns) => {
      turns.find((turn) => turn.role === 'user')!.reactionDelivery = reply.reactionDelivery;
    })).toThrow(/reactionDelivery must be a record on a persona reply/);
    expect(variant((reply) => { reply.reactionDelivery![0].participant = { kind: 'personaGuest', personaId: 'margot' }; }))
      .toThrow(/participant must be the reply's own participant/);
    expect(variant((reply) => { reply.reactionDelivery = [reply.reactionDelivery![0], reply.reactionDelivery![0]]; }))
      .toThrow(/one, the reply's own/);
    expect(variant((reply) => { reply.reactionDelivery![0].kind = 'frame'; })).toThrow(/kind must be/);
    expect(variant((reply) => { reply.reactionDelivery![0].reactions = []; })).toThrow(/at least one reaction on an update/);
    expect(variant((reply) => { reply.reactionDelivery![0].reactions[0].reaction = 'clapping'; })).toThrow(/known Workshop reaction id/);
    expect(variant((reply) => { reply.reactionDelivery![0].reactions[0].author = { kind: 'host' }; }))
      .toThrow(/another participant than the reply's own/);
    expect(variant((reply) => {
      const [entry] = reply.reactionDelivery![0].reactions;
      reply.reactionDelivery![0].reactions = [entry, { ...entry }];
    })).toThrow(/each reaction once per record/);
    expect(variant((reply) => { reply.reactionDelivery![0].reactions[0].createdAt = 1; })).toThrow(/createdAt/);
    // A triple whose turn is gone is inert and kept, as a Project Memory record keeps a gone memory id.
    expect(variant((reply) => { reply.reactionDelivery![0].reactions[0].turnId = 'turn-gone'; })).not.toThrow();
    // An empty start is how a re-invited conversation begins its view.
    expect(variant((reply) => { reply.reactionDelivery![0] = { ...reply.reactionDelivery![0], kind: 'start', reactions: [] }; }))
      .not.toThrow();
  });

  it('the shared transcript projection omits the record: a delivered room projects as one without it', () => {
    const { room } = deliveredRoom();
    const turns = room.session.readRoomLedger();
    const stripped = turns.map(({ reactionDelivery: _record, ...turn }) => turn);
    const meta = { title: 'Rabbit hole', exportedAt: 0 };
    expect(turns.some((turn) => turn.reactionDelivery)).toBe(true);
    expect(projectWorkshopTranscript(turns, meta)).toEqual(projectWorkshopTranscript(stripped, meta));
    turns.forEach((turn, index) => expect(projectWorkshopTranscriptTurn(turn)).toEqual(projectWorkshopTranscriptTurn(stripped[index])));
    expect(JSON.stringify(projectWorkshopTranscript(turns, meta))).not.toContain('workshop-reactions');
  });
});
