/**
 * Bookmarks across whole-room operations (ADR 2026-11-03 D6), through the
 * real coordinator and store over the scripted room:
 *
 * - New clears them, and current.json holds none.
 * - Open loads them with the session.
 * - Rewind prunes those on cut turns, inside the one transform that cuts a
 *   room, and writes what survives.
 * - Branch keeps those up to the cut and never writes the source file.
 *
 * Every operation goes through the coordinator's room-replacement
 * transaction; none is hand-rolled here.
 */

import type { WorkshopTurn } from '@messages';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import { rewindWorkshopSession } from '@/application/services/workshop/session/WorkshopSessionRewind';
import type { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';

const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });
const before = (turnId: string): WorkshopRewindCut => ({ kind: 'beforeTurn', turnId });

const textOf = async (fs: MemoryFileSystem, filePath: string): Promise<string> =>
  new TextDecoder().decode(await fs.readFile(filePath));

/**
 * Three exchanges with the host, saved as a named session and opened. The
 * writer bookmarked every reply and the last question before saving.
 */
async function openBookmarkedRoom() {
  const room = new ScriptedWorkshopRoom().start();
  const replies = ['Where is the cup?', 'Who moved it?', 'Why the sill?']
    .map((text) => room.hostMessage(text));
  const questions = room.session.readRoomLedger()
    .filter((turn) => turn.participant === 'writer' && turn.kind === 'message');
  for (const turn of [...replies, questions[2]]) {
    expect(room.session.setTurnBookmark(turn.id, true)).toBe('set');
  }
  room.session.renameBookmark(room.session.getSnapshot().bookmarks[0].id, 'First answer');

  const harness = setupCoordinator();
  const checkpoint = scriptedCheckpoint('bookmarked', room);
  await harness.store.saveNamed(checkpoint);
  await harness.coordinator.initialize();
  await harness.coordinator.openNamed('bookmarked');
  const sourcePath = await harness.store.resolveRevealPath('bookmarked');
  return { ...harness, room, replies, questions, checkpoint, sourcePath };
}

const markedTurns = (turns: readonly Pick<WorkshopTurn, 'id'>[]) => turns.map((turn) => turn.id);

describe('bookmarks across whole-room operations (ADR 2026-11-03 D6)', () => {
  it('Open loads them with the session, labels and order intact', async () => {
    const { session, replies, questions } = await openBookmarkedRoom();

    const bookmarks = session.getSnapshot().bookmarks;
    expect(bookmarks.map((bookmark) => bookmark.turnId))
      .toEqual(markedTurns([replies[0], replies[1], questions[2], replies[2]]));
    expect(bookmarks[0].label).toBe('First answer');
    expect(bookmarks[1].label).toBe('Jill · Host reply to "Who moved it?".');
  });

  it('New clears them, and the fresh current.json holds none', async () => {
    const { coordinator, session, store } = await openBookmarkedRoom();

    await coordinator.resetSession();

    expect(session.getSnapshot().bookmarks).toEqual([]);
    const current = await store.readCurrent();
    expect(current?.workshop.bookmarks).toBeUndefined();
  });

  it('Rewind to a reply prunes the bookmarks after it and writes what survives', async () => {
    const { coordinator, session, store, replies } = await openBookmarkedRoom();

    await coordinator.rewindTo(after(replies[1].id), { origin: 'writer' });

    expect(session.getSnapshot().bookmarks.map((bookmark) => bookmark.turnId))
      .toEqual(markedTurns([replies[0], replies[1]]));
    const current = await store.readCurrent();
    expect(current?.workshop.bookmarks?.map((bookmark) => bookmark.turnId))
      .toEqual(markedTurns([replies[0], replies[1]]));
    expect(current?.workshop.bookmarks?.[0].label).toBe('First answer');
  });

  it('Rewind to a writer message drops that message\'s own bookmark', async () => {
    const { coordinator, session, replies, questions } = await openBookmarkedRoom();

    const outcome = await coordinator.rewindTo(before(questions[2].id), { origin: 'writer' });

    expect(outcome.composerRestore?.text).toBe('Why the sill?');
    expect(session.getSnapshot().bookmarks.map((bookmark) => bookmark.turnId))
      .toEqual(markedTurns([replies[0], replies[1]]));
  });

  it('Rewind past every bookmark leaves the room with no bookmarks key', async () => {
    const { coordinator, session, store, questions } = await openBookmarkedRoom();

    await coordinator.rewindTo(before(questions[0].id), { origin: 'writer' });

    expect(session.getSnapshot().bookmarks).toEqual([]);
    expect(JSON.stringify(await store.readCurrent())).not.toContain('"bookmarks"');
  });

  it('Branch keeps the bookmarks up to the cut and never writes the source file', async () => {
    const harness = await openBookmarkedRoom();
    const sourceBefore = await textOf(harness.fs, harness.sourcePath);

    const outcome = await harness.coordinator.branchFrom(after(harness.replies[0].id));

    const branch = (await harness.store.readNamed(outcome.branch.sessionId))!;
    expect(branch.workshop.bookmarks).toEqual([expect.objectContaining({
      turnId: harness.replies[0].id,
      label: 'First answer'
    })]);
    expect(harness.session.getSnapshot().bookmarks.map((bookmark) => bookmark.turnId))
      .toEqual(markedTurns([harness.replies[0]]));
    expect(await textOf(harness.fs, harness.sourcePath)).toBe(sourceBefore);
    const source = (await harness.store.readNamed('bookmarked'))!;
    expect(source.workshop.bookmarks).toHaveLength(4);
  });

  it('prunes inside the rewind transform itself, the one code that cuts a room', () => {
    const room = new ScriptedWorkshopRoom().start();
    const first = room.hostMessage('Where is the cup?');
    const second = room.hostMessage('Who moved it?');
    room.session.setTurnBookmark(first.id, true);
    room.session.setTurnBookmark(second.id, true);

    const cut = rewindWorkshopSession({
      workshop: room.session.exportCommittedState(),
      conversations: room.archive(),
      cut: after(first.id)
    });

    expect(cut.workshop.bookmarks?.map((bookmark) => bookmark.turnId)).toEqual([first.id]);
  });
});
