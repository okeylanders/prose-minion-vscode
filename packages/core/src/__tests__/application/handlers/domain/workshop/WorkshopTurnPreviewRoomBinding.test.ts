/**
 * The turn preview answers only from the room it was asked in (PR #189 F-02),
 * through the real bookmark handler and router over the real persistence
 * coordinator, store and aggregate.
 *
 * Two saved rooms share turn ids (the scripted room numbers its turns the
 * same way each time) but say different things. A request made in one room
 * while an Open of the other is in flight must never be answered with the
 * other room's turn: the host waits out every replacement, then refuses once
 * the room it was asked in has gone. A failed Open leaves the room, and the
 * answer, as they were.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopBookmarkHandler } from '@handlers/domain/workshop/WorkshopBookmarkHandler';
import { MessageType, WorkshopTurnPreviewPayload } from '@messages';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import {
  scriptedCheckpoint,
  setupCoordinator
} from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';

const ROOM_CHANGED = 'The room changed before this message could be shown.';

/** A saved room whose only exchange is `question`, and its reply's id and content. */
const roomAsking = (question: string) => {
  const room = new ScriptedWorkshopRoom().start();
  const reply = room.hostMessage(question);
  return { room, reply };
};

async function setup() {
  const harness = setupCoordinator();
  const lantern = roomAsking('Does the lantern beat land?');
  const cup = roomAsking('Where is the cup?');
  // The precondition the finding needs: one turn id, two contents.
  expect(cup.reply.id).toBe(lantern.reply.id);
  expect(cup.reply.content).not.toBe(lantern.reply.content);
  await harness.store.saveNamed(scriptedCheckpoint('lantern', lantern.room));
  await harness.store.saveNamed(scriptedCheckpoint('cup', cup.room));
  await harness.coordinator.initialize();
  await harness.coordinator.openNamed('lantern');

  const postMessage = jest.fn();
  const handler = new WorkshopBookmarkHandler(
    harness.session,
    harness.log,
    { postSessionState: jest.fn(), markDirty: jest.fn(), reportError: jest.fn() },
    postMessage,
    harness.coordinator
  );
  const router = new MessageRouter();
  handler.registerRoutes(router, (type, route) => router.register(type, route as never));

  const turnId = lantern.reply.id;
  const request = (requestId: string, roomRevision = harness.session.readRoomRevision()) =>
    router.route({
      type: MessageType.WORKSHOP_REQUEST_TURN_PREVIEW,
      source: 'webview.workshop.bookmarks',
      payload: { requestId, turnId, roomRevision },
      timestamp: 1
    } as never);
  const answers = (): WorkshopTurnPreviewPayload[] => postMessage.mock.calls
    .map(([entry]) => entry)
    .filter((entry) => entry.type === MessageType.WORKSHOP_TURN_PREVIEW)
    .map((entry) => entry.payload);
  /** Holds an Open after its room is installed and before its operation ends. */
  const heldOpen = (sessionId: string) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const opening = harness.coordinator.openNamed(sessionId, () => held);
    return { opening, release };
  };
  return { ...harness, lantern, cup, turnId, request, answers, heldOpen };
}

const settle = async () => {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
};

describe('the turn preview is bound to the room it was asked in (PR #189 F-02)', () => {
  it('answers from the current room when nothing is replacing it', async () => {
    const { request, answers, lantern, session } = await setup();

    await request('r-1');

    expect(answers()).toEqual([expect.objectContaining({
      requestId: 'r-1',
      roomRevision: session.readRoomRevision(),
      turn: expect.objectContaining({ content: lantern.reply.content })
    })]);
  });

  it('refuses, never sending the other room\'s turn, when an Open lands while the request waits', async () => {
    const { request, answers, heldOpen, session, cup } = await setup();
    const askedIn = session.readRoomRevision();
    const open = heldOpen('cup');
    await settle();
    // The new room is already installed, and its operation is still pending.
    expect(session.readRoomRevision()).not.toBe(askedIn);

    const answered = request('r-2', askedIn);
    await settle();
    expect(answers()).toEqual([]);

    open.release();
    await open.opening;
    await answered;

    expect(answers()).toEqual([{ requestId: 'r-2', turnId: expect.any(String), roomRevision: askedIn, error: ROOM_CHANGED }]);
    expect(JSON.stringify(answers())).not.toContain(cup.reply.content);
  });

  it('refuses a request that arrives after the room was already replaced', async () => {
    const { request, answers, coordinator, session } = await setup();
    const askedIn = session.readRoomRevision();
    await coordinator.openNamed('cup');

    await request('r-3', askedIn);

    expect(answers()).toEqual([expect.objectContaining({ requestId: 'r-3', error: ROOM_CHANGED })]);
    expect(answers()[0].turn).toBeUndefined();
  });

  it('waits out a second replacement queued behind the first, then refuses', async () => {
    const { request, answers, heldOpen, session, cup, lantern } = await setup();
    const askedIn = session.readRoomRevision();
    const first = heldOpen('cup');
    await settle();
    const answered = request('r-4', askedIn);
    await settle();
    // Queued after the request began waiting, behind the first Open.
    const second = heldOpen('lantern');
    first.release();
    await first.opening;
    await settle();
    // The second Open still holds the gate: nothing may be read yet.
    expect(answers()).toEqual([]);

    second.release();
    await second.opening;
    await answered;

    expect(answers()).toEqual([expect.objectContaining({ requestId: 'r-4', error: ROOM_CHANGED })]);
    const sent = JSON.stringify(answers());
    expect(sent).not.toContain(cup.reply.content);
    expect(sent).not.toContain(lantern.reply.content);
  });

  it('answers from the same room when the Open fails and the room stays', async () => {
    const { request, answers, coordinator, session, lantern } = await setup();
    const askedIn = session.readRoomRevision();
    const failing = coordinator.openNamed('no-such-session');

    const answered = request('r-5', askedIn);
    await expect(failing).rejects.toThrow();
    await answered;

    expect(session.readRoomRevision()).toBe(askedIn);
    expect(answers()).toEqual([expect.objectContaining({
      requestId: 'r-5',
      turn: expect.objectContaining({ content: lantern.reply.content })
    })]);
  });
});
