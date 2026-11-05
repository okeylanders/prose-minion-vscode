/**
 * A whole-room operation that fails after it installed the new room rolls
 * back to the room it left, under a new room revision (the revision only
 * moves forward). The webview must hear that restored room, or every preview
 * it asks for names a revision the host no longer has and is refused as
 * "the room changed" (PR #189 F-04).
 *
 * Through the production session and bookmark handlers on one router, over
 * the real persistence coordinator, store and aggregate. "The webview" here
 * is the last `WORKSHOP_SESSION_STATE` the host posted: its revision is the
 * one the next preview names. F-02's binding stays as it was: after a
 * successful Open, the old room's revision is still refused.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopBookmarkHandler } from '@handlers/domain/workshop/WorkshopBookmarkHandler';
import { WorkshopSessionMessageHandler } from '@handlers/domain/workshop/WorkshopSessionMessageHandler';
import type { ShellService } from '@/platform';
import { MessageType, WorkshopTurnPreviewPayload } from '@messages';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import {
  scriptedCheckpoint,
  setupCoordinator
} from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';

const ROOM_CHANGED = 'The room changed before this message could be shown.';

const roomAsking = (questions: string[]) => {
  const room = new ScriptedWorkshopRoom().start();
  const replies = questions.map((question) => room.hostMessage(question));
  return { room, replies };
};

async function setup() {
  const harness = setupCoordinator();
  const lantern = roomAsking(['Does the lantern beat land?', 'And the father?']);
  const cup = roomAsking(['Where is the cup?', 'Who moved it?']);
  expect(cup.replies[0].id).toBe(lantern.replies[0].id);
  await harness.store.saveNamed(scriptedCheckpoint('lantern', lantern.room));
  await harness.store.saveNamed(scriptedCheckpoint('cup', cup.room));
  await harness.coordinator.initialize();
  await harness.coordinator.openNamed('lantern');

  const postMessage = jest.fn();
  const postSessionState = () => postMessage({
    type: MessageType.WORKSHOP_SESSION_STATE,
    source: 'extension.workshop',
    payload: { session: harness.session.getSnapshot() },
    timestamp: 1
  });
  const router = new MessageRouter();
  const register = (type: MessageType, route: (message: never) => Promise<void>) =>
    router.register(type, route as never);
  new WorkshopSessionMessageHandler(
    harness.coordinator,
    postMessage,
    {} as ShellService,
    harness.log,
    {
      postSessionState,
      refreshContextFiles: async () => undefined,
      flushDeferredConversationSettings: async () => undefined,
      reportError: jest.fn(),
      activeRunLabel: () => undefined,
      rewindCutForBubble: (turnId) => harness.session.rewindCutForBubble(turnId)
    }
  ).registerRoutes(router, register);
  new WorkshopBookmarkHandler(
    harness.session,
    harness.log,
    { postSessionState, markDirty: jest.fn(), reportError: jest.fn() },
    postMessage,
    harness.coordinator
  ).registerRoutes(router, register);
  postSessionState();

  const route = (type: MessageType, payload: unknown) =>
    router.route({ type, source: 'webview.workshop', payload, timestamp: 1 } as never);
  /** The revision the webview holds: the last snapshot the host posted. */
  const webviewRevision = (): number => postMessage.mock.calls
    .map(([entry]) => entry)
    .filter((entry) => entry.type === MessageType.WORKSHOP_SESSION_STATE)
    .at(-1).payload.session.roomRevision;
  let requests = 0;
  /** Asks for the first reply's turn as the webview would, and returns the answer. */
  const preview = async (roomRevision = webviewRevision()): Promise<WorkshopTurnPreviewPayload> => {
    const requestId = `r-${++requests}`;
    await route(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW, { requestId, turnId: lantern.replies[0].id, roomRevision });
    return postMessage.mock.calls
      .map(([entry]) => entry)
      .filter((entry) => entry.type === MessageType.WORKSHOP_TURN_PREVIEW)
      .map((entry) => entry.payload)
      .find((payload) => payload.requestId === requestId);
  };
  const failNextCurrentWrite = () =>
    jest.spyOn(harness.store, 'writeCurrent').mockRejectedValueOnce(new Error('The disk is full.'));
  const failNextNamedWrite = () =>
    jest.spyOn(harness.store, 'updateNamed').mockRejectedValueOnce(new Error('The disk is full.'));
  const actionResults = () => postMessage.mock.calls
    .map(([entry]) => entry)
    .filter((entry) => entry.type === MessageType.WORKSHOP_SESSION_ACTION_RESULT)
    .map((entry) => entry.payload);
  return { ...harness, lantern, cup, route, webviewRevision, preview, failNextCurrentWrite, failNextNamedWrite, actionResults };
}

describe('previews after a whole-room operation fails (PR #189 F-04)', () => {
  it('a failed Open, after hydrating the new room, publishes the restored room, so previews answer again', async () => {
    const { route, preview, webviewRevision, failNextCurrentWrite, session, lantern, actionResults } = await setup();
    const before = webviewRevision();
    failNextCurrentWrite();

    await route(MessageType.WORKSHOP_OPEN_SESSION, { sessionId: 'cup' });

    expect(actionResults().at(-1)).toMatchObject({ action: 'open', ok: false });
    // The room is the one left, under a revision that only moved forward.
    expect(session.readRoomLedger().find((turn) => turn.id === lantern.replies[0].id)?.content)
      .toBe(lantern.replies[0].content);
    expect(session.readRoomRevision()).toBeGreaterThan(before);
    expect(webviewRevision()).toBe(session.readRoomRevision());

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const answer = await preview();
      expect(answer.error).toBeUndefined();
      expect(answer.turn?.content).toBe(lantern.replies[0].content);
    }
  });

  it('control: a successful Open still refuses the old room\'s revision, and answers the new one\'s', async () => {
    const { route, preview, webviewRevision, cup } = await setup();
    const oldRoom = webviewRevision();

    await route(MessageType.WORKSHOP_OPEN_SESSION, { sessionId: 'cup' });

    expect(await preview(oldRoom)).toMatchObject({ error: ROOM_CHANGED });
    expect((await preview()).turn?.content).toBe(cup.replies[0].content);
  });

  it('control: an Open that fails before replacing anything leaves the room and its previews as they were', async () => {
    const { route, preview, webviewRevision, session, lantern } = await setup();
    const before = webviewRevision();

    await route(MessageType.WORKSHOP_OPEN_SESSION, { sessionId: 'no-such-session' });

    expect(session.readRoomRevision()).toBe(before);
    expect((await preview(before)).turn?.content).toBe(lantern.replies[0].content);
  });

  it('a failed Rewind, after installing the cut room, publishes the restored room too', async () => {
    const { route, preview, webviewRevision, failNextNamedWrite, session, lantern, actionResults } = await setup();
    const before = webviewRevision();
    // The opened room is a named session: a Rewind writes it in place.
    failNextNamedWrite();

    await route(MessageType.WORKSHOP_REWIND_SESSION, { turnId: lantern.replies[0].id });

    expect(actionResults().at(-1)).toMatchObject({ action: 'rewind', ok: false });
    expect(session.readRoomRevision()).toBeGreaterThan(before);
    expect(webviewRevision()).toBe(session.readRoomRevision());
    expect((await preview()).turn?.content).toBe(lantern.replies[0].content);
  });

  it('a failed New publishes the restored room too', async () => {
    const { route, preview, webviewRevision, failNextCurrentWrite, session, lantern, actionResults } = await setup();
    failNextCurrentWrite();

    await route(MessageType.WORKSHOP_RESET_SESSION, { start: 'carry' });

    expect(actionResults().at(-1)).toMatchObject({ action: 'new', ok: false });
    expect(webviewRevision()).toBe(session.readRoomRevision());
    expect((await preview()).turn?.content).toBe(lantern.replies[0].content);
  });
});
