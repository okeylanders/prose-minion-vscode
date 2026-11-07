/**
 * A persona's reaction committed with its reply (ADR 2026-11-07 D5, R1, R3),
 * through the real run completion and session aggregate (the scripted room).
 *
 * - The trailer becomes a `WorkshopTurnReaction` on the writer message the
 *   reply answers, authored by the persona, `viaTurnId` the reply, written
 *   through the ledger in the reply's commit, so Slice 1's integrity rule
 *   holds by construction.
 * - A reaction-only reply holds the host's line and `reactionOnly`; the
 *   writer cannot react to it (Q10), and integrity accepts it as a carrier.
 * - A cut that removes the reply takes the reaction with it.
 * - Another persona hears it (Q3); its author is never told it back.
 */

import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import { rewindWorkshopSession } from '@/application/services/workshop/session/WorkshopSessionRewind';
import { assertWorkshopReactionIntegrity } from '@/application/services/workshop/session/WorkshopReactionRecords';
import { validateWorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1Integrity';
import { parseWorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import { projectWorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { isWorkshopReactableTurn } from '@shared/constants/workshopReactions';
import { ScriptedWorkshopRoom } from './session/ScriptedWorkshopRoom';

const trailer = (id: string) => `<prose-minion-reaction>${id}</prose-minion-reaction>`;
const before = (turnId: string): WorkshopRewindCut => ({ kind: 'beforeTurn', turnId });

const room = (open = true) => {
  const scripted = new ScriptedWorkshopRoom().start();
  scripted.reactionsOpen = open;
  return scripted;
};

const writerMessageBefore = (scripted: ScriptedWorkshopRoom, replyId: string) => {
  const turns = scripted.session.readRoomLedger();
  const index = turns.findIndex((turn) => turn.id === replyId);
  return turns.slice(0, index).reverse().find((turn) => turn.role === 'user')!;
};

describe('a persona\'s reaction, committed with its reply (ADR 2026-11-07 D5)', () => {
  it('lands on the writer message the reply answers, by the persona, via the reply; the prose stays', () => {
    const scripted = room();
    const reply = scripted.hostMessage('Alice follows the rabbit. Does it land?', {
      reply: `It lands: the chase earns the fall.\n\n${trailer('fire')}`
    });
    const writer = writerMessageBefore(scripted, reply.id);

    expect(reply.content).toBe('It lands: the chase earns the fall.');
    expect(reply.reactionOnly).toBeUndefined();
    expect(scripted.session.readRoomReactions()).toEqual([{
      turnId: writer.id, reaction: 'fire', author: { kind: 'host' }, viaTurnId: reply.id, createdAt: expect.any(Number)
    }]);
    expect(scripted.log).toContain('Persona reaction kept (reaction=fire; Jill)');
    const state = scripted.session.exportCommittedState();
    expect(() => assertWorkshopReactionIntegrity(state.reactions, state.turns)).not.toThrow();
    expect(() => validateWorkshopSessionStateV1(parseWorkshopSessionStateV1(state))).not.toThrow();
    expect(scripted.session.getSnapshot().reactions).toEqual([
      expect.objectContaining({ turnId: writer.id, reaction: 'fire', label: 'Jill', viaTurnId: reply.id })
    ]);
  });

  it('R1: a reaction-only reply holds the host line and its mark; the writer cannot react to it (Q10)', () => {
    const scripted = room();
    const reply = scripted.hostMessage('Thanks, Jill!', { reply: trailer('heart') });

    expect(reply.content).toBe('Reacted with heart.');
    expect(reply.reactionOnly).toBe('heart');
    expect(reply.model).toBeUndefined();
    expect(isWorkshopReactableTurn(reply, { kind: 'writer' })).toBe(false);
    expect(() => scripted.session.setWriterReaction(reply.id, 'heart', true)).toThrow('Only a persona\'s reply can take a reaction.');
    const state = scripted.session.exportCommittedState();
    expect(() => validateWorkshopSessionStateV1(parseWorkshopSessionStateV1(state))).not.toThrow();
    expect(state.retainedHistoryMarks?.some((mark) => mark.turnId === reply.id)).toBe(true);
    // The transcript projects it as its host line (D7), and no reaction.
    const projected = JSON.stringify(projectWorkshopTranscript(scripted.session.readRoomLedger(), { title: 'Alice', exportedAt: 0 }));
    expect(projected).toContain('Reacted with heart.');
    expect(projected).not.toContain('reactionOnly');
  });

  it('with cards beside it, the reply is a reply: the line names both, and it takes reactions', () => {
    const scripted = room();
    scripted.memoryContext = undefined;
    const reply = scripted.hostMessage('Note that Alice is seven.', {
      reply: `<prose-minion-memory-proposal>\n<title>Alice</title>\n</prose-minion-memory-proposal>\n${trailer('thumbs-up')}`
    });
    expect(reply.content).toBe('Proposed a project memory and reacted with thumbs up.');
    expect(reply.reactionOnly).toBeUndefined();
    expect(scripted.session.readRoomReactions()).toHaveLength(1);
  });

  it('off (Q8): dropped as reactions-off, stored nowhere, the line still the host\'s', () => {
    const scripted = room(false);
    const reply = scripted.hostMessage('Thanks!', { reply: trailer('heart') });
    expect(scripted.session.readRoomReactions()).toEqual([]);
    expect(reply.reactionOnly).toBeUndefined();
    expect(reply.content).toBe('Reacted with heart.');
    expect(scripted.log).toContain('Persona reaction dropped (reason=reactions-off; reaction=heart) (Jill)');
  });

  it('a second frame is over-cap and an unknown id is dropped; logs carry ids and reasons, never text', () => {
    const scripted = room();
    scripted.hostMessage('Alice, again.', { reply: `Secret prose.\n${trailer('clapping')}\n${trailer('eyes')}\n${trailer('fire')}` });
    expect(scripted.session.readRoomReactions().map((entry) => entry.reaction)).toEqual(['eyes']);
    const lines = scripted.log.filter((line) => line.includes('Persona reaction'));
    expect(lines).toEqual([
      'Persona reaction dropped (reason=unknown) (Jill)',
      'Persona reaction dropped (reason=over-cap; reaction=fire) (Jill)',
      'Persona reaction kept (reaction=eyes; Jill)'
    ]);
    expect(lines.join('\n')).not.toMatch(/Secret|clapping/);
  });

  it('a tool report\'s synthesis answers no writer message: no-target', () => {
    const scripted = room();
    scripted.hostMessage('Alice, first.');
    const { synthesis } = scripted.toolRun('prose');
    expect(synthesis.artifact).toBe('persona_synthesis');
    // The scripted synthesis has fixed content; the session's rule is what decides the target.
    expect(scripted.session.readRoomReactions()).toEqual([]);
  });

  it('a guest reacts to the opening message it answers', () => {
    const scripted = room();
    scripted.hostMessage('Alice, first.');
    const join = scripted.inviteGuest('margot', 'Read this with us.');
    // The scripted join replies "margot joins."; the target rule is the session's.
    expect(join.reactionOnly).toBeUndefined();
    const opening = writerMessageBefore(scripted, join.id);
    expect(opening.content).toBe('Read this with us.');
    expect(isWorkshopReactableTurn(opening, { kind: 'personaGuest', personaId: 'margot' })).toBe(true);
  });

  it('R3: a cut that removes the reply takes the reaction, and the rest of the room still validates', () => {
    const scripted = room();
    scripted.hostMessage('Alice, first.');
    const reply = scripted.hostMessage('Thanks, Jill!', { reply: trailer('heart') });
    const writer = writerMessageBefore(scripted, reply.id);
    const cut = rewindWorkshopSession({
      workshop: scripted.session.exportCommittedState(),
      conversations: scripted.archive(),
      cut: before(writer.id)
    });
    expect(cut.workshop.reactions).toBeUndefined();
    expect(cut.workshop.turns.some((turn) => turn.id === reply.id)).toBe(false);
  });

  it('Q3: another persona hears it on its join, by the reacting persona\'s name; the host is not told its own', () => {
    const scripted = room();
    scripted.hostMessage('Alice follows the rabbit.', { reply: `Yes.\n\n${trailer('mind-blown')}` });
    scripted.inviteGuest('margot', 'Read this with us.');
    const joinHistory = JSON.stringify(scripted.archive());
    expect(joinHistory).toMatch(/- Jill reacted mind-blown \(\\"hadn't thought of that\\"\) to the writer's message that began/);

    scripted.session.setChatTarget({ kind: 'host' });
    const next = scripted.hostMessage('And the falling?');
    expect(next.reactionDelivery).toBeUndefined();
  });
});

describe('reactionOnly in the session codec (ADR 2026-11-07 R1; additive)', () => {
  const reactionOnlyRoom = () => {
    const scripted = room();
    const reply = scripted.hostMessage('Thanks, Jill!', { reply: trailer('heart') });
    return { state: scripted.session.exportCommittedState(), reply };
  };
  const withTurn = (state: ReturnType<typeof reactionOnlyRoom>['state'], id: string, patch: Record<string, unknown>) => ({
    ...state,
    turns: state.turns.map((turn) => turn.id === id ? { ...turn, ...patch } : turn)
  });

  it('round-trips, and a reply whose reaction was hidden (Q6) still reads', () => {
    const { state, reply } = reactionOnlyRoom();
    expect(parseWorkshopSessionStateV1(JSON.parse(JSON.stringify(state))).turns.find((turn) => turn.id === reply.id)!.reactionOnly).toBe('heart');
    expect(() => validateWorkshopSessionStateV1(parseWorkshopSessionStateV1({ ...state, reactions: undefined }))).not.toThrow();
  });

  it('is refused on anything but a persona reply, or with an unknown id', () => {
    const { state, reply } = reactionOnlyRoom();
    const writer = state.turns.filter((turn) => turn.role === 'user').at(-1)!;
    expect(() => parseWorkshopSessionStateV1(withTurn(state, writer.id, { reactionOnly: 'heart' }))).toThrow(/reactionOnly/);
    expect(() => parseWorkshopSessionStateV1(withTurn(state, reply.id, { reactionOnly: 'clapping' }))).toThrow(/reactionOnly/);
    expect(() => parseWorkshopSessionStateV1(withTurn(state, reply.id, { reactionOnly: '❤️' }))).toThrow(/reactionOnly/);
  });

  it('integrity refuses a writer reaction on it, and accepts its persona reaction (Q10, PR #245 N3)', () => {
    const { state, reply } = reactionOnlyRoom();
    expect(() => assertWorkshopReactionIntegrity(state.reactions, state.turns)).not.toThrow();
    expect(() => assertWorkshopReactionIntegrity(
      [...state.reactions!, { turnId: reply.id, reaction: 'fire', author: { kind: 'writer' }, createdAt: 1 }],
      state.turns
    )).toThrow('is on a turn its author cannot react to');
  });
});
