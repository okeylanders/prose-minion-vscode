/**
 * The project-memory delivery record across whole-room operations (ADR
 * 2026-11-04 D14), through the real coordinator and store over the
 * scripted room. The record lives on the writer turn that delivered it, so
 * every operation is right by construction:
 *
 * - Open loads it with the session; a session without it reads and saves
 *   unchanged.
 * - Rewind before a note cuts the note's record, so the note is sent again.
 * - Branch keeps the records up to the cut.
 * - A rolled-back, abandoned or cancelled writer turn takes its record.
 * - New starts with none.
 * - The codec refuses it on any turn but a writer turn.
 */

import type { WorkshopProjectMemoryDelivery } from '@messages';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import { rewindWorkshopSession } from '@/application/services/workshop/session/WorkshopSessionRewind';
import { projectMemoryDeliveredView } from '@/application/services/workshop/memory/ProjectMemoryDeliveredView';
import { parseWorkshopPersistedSession } from '@/application/services/workshop/WorkshopPersistedSession';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';

const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });
const before = (turnId: string): WorkshopRewindCut => ({ kind: 'beforeTurn', turnId });
const HOST = { kind: 'host' } as const;
const frame = (version: string): WorkshopProjectMemoryDelivery =>
  ({ participant: HOST, kind: 'frame', memories: [{ id: 'mem-7f3c2a', version }] });
const note = (version: string): WorkshopProjectMemoryDelivery =>
  ({ participant: HOST, kind: 'note', memories: [{ id: 'mem-7f3c2a', version }, { id: 'mem-1a9e04', version }] });
const viewOf = (turns: Parameters<typeof projectMemoryDeliveredView>[0]) =>
  [...projectMemoryDeliveredView(turns, HOST).memories].sort();

/** A frame on the first message, nothing on the second, a note on the third; saved and opened. */
async function openDeliveredRoom() {
  const room = new ScriptedWorkshopRoom().start();
  const replies = [
    room.hostMessage('What did we settle?', { projectMemory: frame('aaaaaaaaaaaa') }),
    room.hostMessage('And the Hatter?'),
    room.hostMessage('Anything new?', { projectMemory: note('bbbbbbbbbbbb') })
  ];
  const questions = room.session.readRoomLedger().filter((turn) => turn.participant === 'writer' && turn.kind === 'message');
  const harness = setupCoordinator();
  await harness.store.saveNamed(scriptedCheckpoint('delivered', room));
  await harness.coordinator.initialize();
  await harness.coordinator.openNamed('delivered');
  return { ...harness, room, replies, questions };
}

describe('the delivery record across whole-room operations (ADR 2026-11-04 D14)', () => {
  it('rides the writer turn that delivered it, and Open loads it with the session', async () => {
    const { session, questions } = await openDeliveredRoom();
    const turns = session.readRoomLedger();
    expect(turns.find((turn) => turn.id === questions[0].id)?.projectMemoryDelivery).toEqual([frame('aaaaaaaaaaaa')]);
    expect(turns.find((turn) => turn.id === questions[1].id)?.projectMemoryDelivery).toBeUndefined();
    expect(viewOf(turns)).toEqual([['mem-1a9e04', 'bbbbbbbbbbbb'], ['mem-7f3c2a', 'bbbbbbbbbbbb']]);
  });

  it('Rewind before the note cuts its record, so the frame is the view again and the note is owed', async () => {
    const { coordinator, session, questions } = await openDeliveredRoom();
    await coordinator.rewindTo(before(questions[2].id), { origin: 'writer' });
    expect(viewOf(session.readRoomLedger())).toEqual([['mem-7f3c2a', 'aaaaaaaaaaaa']]);
  });

  it('Branch keeps the records up to the cut', async () => {
    const harness = await openDeliveredRoom();
    const outcome = await harness.coordinator.branchFrom(after(harness.replies[1].id));
    const branch = (await harness.store.readNamed(outcome.branch.sessionId))!;
    expect(viewOf(branch.workshop.turns)).toEqual([['mem-7f3c2a', 'aaaaaaaaaaaa']]);
    const source = (await harness.store.readNamed('delivered'))!;
    expect(viewOf(source.workshop.turns)).toEqual([['mem-1a9e04', 'bbbbbbbbbbbb'], ['mem-7f3c2a', 'bbbbbbbbbbbb']]);
  });

  it('New starts with none', async () => {
    const { coordinator, session, store } = await openDeliveredRoom();
    await coordinator.resetSession();
    expect(projectMemoryDeliveredView(session.readRoomLedger(), HOST).recorded).toBe(false);
    expect(JSON.stringify(await store.readCurrent())).not.toContain('projectMemoryDelivery');
  });

  it('cuts inside the rewind transform itself, the one code that cuts a room', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('What did we settle?', { projectMemory: frame('aaaaaaaaaaaa') });
    room.hostMessage('Anything new?', { projectMemory: note('bbbbbbbbbbbb') });
    const cut = rewindWorkshopSession({ workshop: room.session.exportCommittedState(), conversations: room.archive(), cut: after(first.id) });
    expect(viewOf(cut.workshop.turns)).toEqual([['mem-7f3c2a', 'aaaaaaaaaaaa']]);
  });

  it('is never written for a run that rolls back, is abandoned, or is overtaken', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('What did we settle?', { projectMemory: frame('aaaaaaaaaaaa') });
    const { session } = room;

    session.beginPersonaMessage('rolled-back', 'Anything new?');
    expect(session.stageProjectMemoryDelivery('rolled-back', note('bbbbbbbbbbbb'))).toBe(true);
    session.rollbackMessageRun('rolled-back');
    session.beginPersonaMessage('abandoned', 'Anything new?');
    session.stageProjectMemoryDelivery('abandoned', note('cccccccccccc'));
    session.abandonRun('abandoned');
    expect(session.stageProjectMemoryDelivery('abandoned', note('dddddddddddd'))).toBe(false);

    expect(viewOf(session.readRoomLedger())).toEqual([['mem-7f3c2a', 'aaaaaaaaaaaa']]);
  });

  it('keeps each participant\'s record apart: a guest\'s note is not the host\'s view', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('What did we settle?', {
      projectMemory: { participant: { kind: 'personaGuest', personaId: 'cliff' }, kind: 'note', memories: [{ id: 'mem-1a9e04', version: 'eeeeeeeeeeee' }] }
    });
    expect(projectMemoryDeliveredView(room.session.readRoomLedger(), HOST).recorded).toBe(false);
    expect([...projectMemoryDeliveredView(room.session.readRoomLedger(), { kind: 'personaGuest', personaId: 'cliff' }).memories])
      .toEqual([['mem-1a9e04', 'eeeeeeeeeeee']]);
  });

  it('saves a session without the field byte for byte, and refuses the field on any turn but a writer turn', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('What did we settle?');
    const checkpoint = scriptedCheckpoint('plain', room);
    const raw = JSON.stringify(checkpoint);
    expect(raw).not.toContain('projectMemoryDelivery');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(raw)))).toBe(raw);
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(raw)))).not.toContain('projectMemoryDelivery');

    const onReply = JSON.parse(raw);
    const reply = onReply.workshop.turns.find((turn: { role: string }) => turn.role === 'assistant');
    reply.projectMemoryDelivery = [frame('aaaaaaaaaaaa')];
    expect(() => parseWorkshopPersistedSession(onReply)).toThrow(/projectMemoryDelivery must be a record on a writer turn/);

    const badVersion = JSON.parse(raw);
    const writer = badVersion.workshop.turns.find((turn: { role: string }) => turn.role === 'user');
    writer.projectMemoryDelivery = [frame('not-a-version')];
    expect(() => parseWorkshopPersistedSession(badVersion)).toThrow(/version must be a memory version/);

    const twice = JSON.parse(raw);
    twice.workshop.turns.find((turn: { role: string }) => turn.role === 'user').projectMemoryDelivery = [frame('aaaaaaaaaaaa'), note('bbbbbbbbbbbb')];
    expect(() => parseWorkshopPersistedSession(twice)).toThrow(/each participant once per turn/);
  });
});
