/**
 * Reactions across whole-room operations (ADR 2026-11-07 D2, D3, D7),
 * through the real coordinator and store over the scripted room:
 *
 * - Open loads them with the session (they survive save, open and reload).
 * - New clears them.
 * - Rewind, Branch and a Side Quest's End go through the one transform that
 *   cuts a room: a reaction goes with its turn, and a persona's with the
 *   reply that carried it, even when the writer message it sits on survives.
 * - The shared transcript projection omits them.
 */

import type { WorkshopTurn, WorkshopTurnReaction } from '@messages';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import { rewindWorkshopSession } from '@/application/services/workshop/session/WorkshopSessionRewind';
import {
  projectWorkshopTranscript,
  projectWorkshopTranscriptTurn
} from '@/application/services/workshop/transcript/WorkshopTranscript';
import { WORKSHOP_REACTIONS } from '@shared/constants/workshopReactions';
import type { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';

const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });
const before = (turnId: string): WorkshopRewindCut => ({ kind: 'beforeTurn', turnId });

const textOf = async (fs: MemoryFileSystem, filePath: string): Promise<string> =>
  new TextDecoder().decode(await fs.readFile(filePath));

const writerMessages = (room: ScriptedWorkshopRoom): WorkshopTurn[] => room.session.readRoomLedger()
  .filter((turn) => turn.participant === 'writer' && turn.kind === 'message');

/**
 * Three exchanges with the host, saved as a named session and opened. The
 * writer reacted to every reply; the host's third reply carried a reaction
 * to the writer's second question (as Slice 3 will write one; the codec
 * asks only for a later reply of the same persona).
 */
async function openReactedRoom() {
  const room = new ScriptedWorkshopRoom().start();
  const replies = ['Where did the rabbit go?', 'Why the watch?', 'Who is late?']
    .map((text) => room.hostMessage(text));
  const questions = writerMessages(room);
  expect(room.session.setWriterReaction(replies[0].id, 'fire', true)).toBe('added');
  expect(room.session.setWriterReaction(replies[1].id, 'heart', true)).toBe('added');
  expect(room.session.setWriterReaction(replies[2].id, 'thinking', true)).toBe('added');

  const harness = setupCoordinator();
  const checkpoint = scriptedCheckpoint('reacted', room);
  const persona: WorkshopTurnReaction = {
    turnId: questions[1].id,
    reaction: 'mind-blown',
    author: { kind: 'host' },
    viaTurnId: replies[2].id,
    createdAt: 9
  };
  checkpoint.workshop.reactions = [...checkpoint.workshop.reactions!, persona];
  await harness.store.saveNamed(checkpoint);
  await harness.coordinator.initialize();
  await harness.coordinator.openNamed('reacted');
  const sourcePath = await harness.store.resolveRevealPath('reacted');
  return { ...harness, room, replies, questions, persona, sourcePath };
}

const reactedTurns = (reactions: readonly Pick<WorkshopTurnReaction, 'turnId' | 'reaction'>[] | undefined) =>
  (reactions ?? []).map((reaction) => `${reaction.turnId}:${reaction.reaction}`);

describe('reactions across whole-room operations (ADR 2026-11-07 D3)', () => {
  it('Open loads them with the session, the writer\'s and the persona\'s, in thread order', async () => {
    const { session, replies, questions } = await openReactedRoom();

    expect(reactedTurns(session.getSnapshot().reactions)).toEqual([
      `${replies[0].id}:fire`,
      `${questions[1].id}:mind-blown`,
      `${replies[1].id}:heart`,
      `${replies[2].id}:thinking`
    ]);
    expect(session.getSnapshot().reactions[1]).toMatchObject({ author: { kind: 'host' }, label: 'Jill' });
  });

  it('Open writes them to current.json, the file a reload reads', async () => {
    const { store, persona } = await openReactedRoom();

    const current = await store.readCurrent();
    expect(current?.workshop.reactions?.map((reaction) => reaction.reaction))
      .toEqual(['fire', 'heart', 'thinking', 'mind-blown']);
    expect(current?.workshop.reactions?.[3]).toEqual(persona);
  });

  it('New clears them, and the fresh current.json holds none', async () => {
    const { coordinator, session, store } = await openReactedRoom();

    await coordinator.resetSession({ start: 'carry' });

    expect(session.getSnapshot().reactions).toEqual([]);
    expect((await store.readCurrent())?.workshop.reactions).toBeUndefined();
  });

  it('Rewind to the first reply drops the reactions after it and writes what survives', async () => {
    const { coordinator, session, store, replies } = await openReactedRoom();

    await coordinator.rewindTo(after(replies[0].id), { origin: 'writer' });

    expect(reactedTurns(session.readRoomReactions())).toEqual([`${replies[0].id}:fire`]);
    expect(reactedTurns((await store.readCurrent())?.workshop.reactions)).toEqual([`${replies[0].id}:fire`]);
  });

  it('a persona\'s reaction goes with the reply that carried it, though its writer message stays', async () => {
    const { coordinator, session, replies, questions } = await openReactedRoom();

    // Cut after the host's second reply: the question it reacted to is kept,
    // the third reply that carried the reaction is not.
    await coordinator.rewindTo(after(replies[1].id), { origin: 'writer' });

    const kept = session.readRoomLedger().map((turn) => turn.id);
    expect(kept).toContain(questions[1].id);
    expect(kept).not.toContain(replies[2].id);
    expect(reactedTurns(session.readRoomReactions())).toEqual([`${replies[0].id}:fire`, `${replies[1].id}:heart`]);
  });

  it('Rewind past every reaction leaves the room with no reactions key', async () => {
    const { coordinator, session, store, questions } = await openReactedRoom();

    await coordinator.rewindTo(before(questions[0].id), { origin: 'writer' });

    expect(session.getSnapshot().reactions).toEqual([]);
    expect(JSON.stringify(await store.readCurrent())).not.toContain('"reactions"');
  });

  it('a Side Quest\'s End goes through the same transform', async () => {
    const { coordinator, session, replies } = await openReactedRoom();

    await coordinator.rewindTo(after(replies[0].id), { origin: 'sideQuestEnd' });

    expect(reactedTurns(session.readRoomReactions())).toEqual([`${replies[0].id}:fire`]);
  });

  it('Branch keeps the reactions up to the cut and never writes the source file', async () => {
    const harness = await openReactedRoom();
    const sourceBefore = await textOf(harness.fs, harness.sourcePath);

    const outcome = await harness.coordinator.branchFrom(after(harness.replies[1].id));

    const branch = (await harness.store.readNamed(outcome.branch.sessionId))!;
    expect(reactedTurns(branch.workshop.reactions)).toEqual([
      `${harness.replies[0].id}:fire`,
      `${harness.replies[1].id}:heart`
    ]);
    expect(await textOf(harness.fs, harness.sourcePath)).toBe(sourceBefore);
    expect((await harness.store.readNamed('reacted'))!.workshop.reactions).toHaveLength(4);
  });

  it('drops them inside the rewind transform itself, the one code that cuts a room', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('Where did the rabbit go?');
    const second = room.hostMessage('Why the watch?');
    room.session.setWriterReaction(first.id, 'fire', true);
    room.session.setWriterReaction(second.id, 'sad', true);

    const cut = rewindWorkshopSession({
      workshop: room.session.exportCommittedState(),
      conversations: room.archive(),
      cut: after(first.id)
    });

    expect(reactedTurns(cut.workshop.reactions)).toEqual([`${first.id}:fire`]);
  });
});

describe('the shared transcript projection omits reactions (ADR 2026-11-07 D7)', () => {
  it('projects a reacted room exactly as the same room without reactions', () => {
    const room = new ScriptedWorkshopRoom().start();
    const reply = room.hostMessage('Where did the rabbit go?');
    const turns = room.session.readRoomLedger();
    const meta = { title: 'Rabbit hole', exportedAt: 0 };
    const plain = projectWorkshopTranscript(turns, meta);
    const plainTurn = projectWorkshopTranscriptTurn(reply);

    for (const reaction of WORKSHOP_REACTIONS) {
      room.session.setWriterReaction(reply.id, reaction.id, true);
    }
    const reacted = room.session.readRoomLedger();

    expect(projectWorkshopTranscript(reacted, meta)).toEqual(plain);
    expect(projectWorkshopTranscriptTurn(reacted.find((turn) => turn.id === reply.id)!)).toEqual(plainTurn);
    const text = JSON.stringify(projectWorkshopTranscript(reacted, meta));
    for (const reaction of WORKSHOP_REACTIONS) {
      expect(text).not.toContain(reaction.glyph);
      expect(text).not.toContain(`"${reaction.id}"`);
    }
  });
});
