/**
 * The earlier-turns route (ADR 2026-11-17 D1, D2, D4) through the real
 * handler and router over the real persistence coordinator, store and
 * aggregate: a page is answered by request id from the room it was asked in,
 * its turns sent as the snapshot sends them; another room, an unknown turn
 * and a malformed request are refused in host words; nothing is written and
 * no log line holds a turn's text. *Alice*-style made-up lines.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import {
  WORKSHOP_EARLIER_TURNS_REFUSALS,
  WorkshopEarlierTurnsHandler
} from '@handlers/domain/workshop/WorkshopEarlierTurnsHandler';
import {
  workshopTurnForWebview,
  type WorkshopEditOfferRoomView
} from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';
import { MessageType, type WorkshopEarlierTurnsPayload } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { longScriptedRoom } from '@/__tests__/application/services/workshop/session/longScriptedRoom';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import {
  scriptedCheckpoint,
  setupCoordinator
} from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';

const FIXTURE_TEXT = 'does the White Rabbit run late';

async function setup() {
  const harness = setupCoordinator();
  // 213 turns: 13 outside the window.
  const long = longScriptedRoom(106);
  const other = new ScriptedWorkshopRoom().start();
  other.hostMessage('Where is the cup?');
  await harness.store.saveNamed(scriptedCheckpoint('long-room', long.room));
  await harness.store.saveNamed(scriptedCheckpoint('cup', other));
  await harness.coordinator.initialize();
  await harness.coordinator.openNamed('long-room');
  (harness.log.appendLine as jest.Mock).mockClear();

  const roomView = (): WorkshopEditOfferRoomView => ({
    fileEditsOpen: true,
    runActive: false,
    ledger: () => harness.session.readRoomLedger(),
    authorPresent: () => true
  });
  const postMessage = jest.fn();
  const handler = new WorkshopEarlierTurnsHandler(harness.session, harness.log, postMessage, harness.coordinator, roomView);
  const router = new MessageRouter();
  handler.registerRoutes(router);

  const request = (payload: Record<string, unknown>) => router.route({
    type: MessageType.WORKSHOP_REQUEST_EARLIER_TURNS,
    source: 'webview.workshop.earlierTurns',
    payload,
    timestamp: 1
  } as never);
  const answers = (): WorkshopEarlierTurnsPayload[] => postMessage.mock.calls
    .map(([entry]) => entry)
    .filter((entry) => entry.type === MessageType.WORKSHOP_EARLIER_TURNS)
    .map((entry) => entry.payload);
  const logLines = (): string[] => (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
  const windowFirst = () => harness.session.getSnapshot().turns[0].id;
  const revision = () => harness.session.readRoomRevision();
  /** Holds an Open after its room is installed and before its operation ends. */
  const heldOpen = (sessionId: string) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const opening = harness.coordinator.openNamed(sessionId, () => held);
    return { opening, release };
  };
  return { ...harness, roomView, request, answers, logLines, windowFirst, revision, heldOpen };
}

const settle = async () => {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
};

describe('the earlier-turns route', () => {
  it('answers the page before the turn named, echoing the request, with the turns as the snapshot sends them', async () => {
    const { request, answers, session, roomView, windowFirst, revision } = await setup();
    const beforeTurnId = windowFirst();
    const hidden = session.getSnapshot().truncatedTurns;

    await request({ requestId: 'r-1', roomRevision: revision(), beforeTurnId });

    const [answer] = answers();
    expect(answer).toMatchObject({ requestId: 'r-1', roomRevision: revision(), beforeTurnId });
    expect(answer.error).toBeUndefined();
    const read = session.readEarlierTurns(beforeTurnId)!;
    expect(answer.page).toEqual({ ...read, turns: read.turns.map((turn) => workshopTurnForWebview(turn, roomView())) });
    expect(answer.page!.turns).toHaveLength(hidden);
    expect(answer.page!.remainingBefore).toBe(0);
    // Host bookkeeping never leaves the host, as in a session state.
    expect(JSON.stringify(answer)).not.toContain('reactionDelivery');
    expect(JSON.stringify(answer)).not.toContain('documentUri');
  });

  it('bounds a page by the thread\'s budget', async () => {
    const { request, answers, session, revision } = await setup();
    const newest = session.readRoomLedger().at(-1)!.id;

    await request({ requestId: 'r-1', roomRevision: revision(), beforeTurnId: newest });

    expect(answers()[0].page!.turns).toHaveLength(PROMPT_BUDGETS.workshopThread.pageTurns);
    expect(answers()[0].page!.remainingBefore).toBe(session.readRoomLedger().length - 1 - PROMPT_BUDGETS.workshopThread.pageTurns);
  });

  it('writes nothing: the room, its revision and its files are as they were', async () => {
    const { request, session, fs, store, windowFirst, revision } = await setup();
    const before = JSON.stringify(session.exportCommittedState());
    const currentPath = (await store.availability() as { currentPath: string }).currentPath;
    const fileBefore = new TextDecoder().decode(await fs.readFile(currentPath));
    const askedIn = revision();

    await request({ requestId: 'r-1', roomRevision: askedIn, beforeTurnId: windowFirst() });
    await settle();

    expect(JSON.stringify(session.exportCommittedState())).toBe(before);
    expect(revision()).toBe(askedIn);
    expect(new TextDecoder().decode(await fs.readFile(currentPath))).toBe(fileBefore);
  });

  it('refuses a request naming another room', async () => {
    const { request, answers, windowFirst, revision } = await setup();

    await request({ requestId: 'r-1', roomRevision: revision() + 1, beforeTurnId: windowFirst() });

    expect(answers()).toEqual([{
      requestId: 'r-1',
      roomRevision: revision() + 1,
      beforeTurnId: windowFirst(),
      error: WORKSHOP_EARLIER_TURNS_REFUSALS.roomChanged
    }]);
  });

  it('refuses a turn the room does not hold', async () => {
    const { request, answers, revision } = await setup();

    await request({ requestId: 'r-1', roomRevision: revision(), beforeTurnId: 'turn-9999-user-1' });

    expect(answers()).toEqual([{
      requestId: 'r-1',
      roomRevision: revision(),
      beforeTurnId: 'turn-9999-user-1',
      error: WORKSHOP_EARLIER_TURNS_REFUSALS.unknownTurn
    }]);
  });

  it.each([
    ['no turn', { beforeTurnId: undefined }],
    ['an empty turn id', { beforeTurnId: '' }],
    ['a turn id that is not text', { beforeTurnId: 7 }],
    ['a turn id past its bound', { beforeTurnId: 'x'.repeat(300) }],
    ['a revision that is not a number', { roomRevision: 'now' }]
  ])('refuses a malformed request (%s) by its id', async (_name, change) => {
    const { request, answers, windowFirst, revision } = await setup();

    await request({ requestId: 'r-1', roomRevision: revision(), beforeTurnId: windowFirst(), ...change });

    expect(answers()).toHaveLength(1);
    expect(answers()[0]).toMatchObject({ requestId: 'r-1', error: WORKSHOP_EARLIER_TURNS_REFUSALS.malformed });
    expect(answers()[0].page).toBeUndefined();
  });

  it('answers nothing to a request with no id to echo', async () => {
    const { request, answers, windowFirst, revision } = await setup();

    await request({ roomRevision: revision(), beforeTurnId: windowFirst() });
    await request({ requestId: 'x'.repeat(200), roomRevision: revision(), beforeTurnId: windowFirst() });

    expect(answers()).toEqual([]);
  });

  it('waits out an Open that lands while the request waits, then refuses: never the other room\'s turns', async () => {
    const { request, answers, heldOpen, session, windowFirst, revision } = await setup();
    const askedIn = revision();
    const beforeTurnId = windowFirst();
    const open = heldOpen('cup');
    await settle();
    expect(session.readRoomRevision()).not.toBe(askedIn);

    const answered = request({ requestId: 'r-2', roomRevision: askedIn, beforeTurnId });
    await settle();
    expect(answers()).toEqual([]);

    open.release();
    await open.opening;
    await answered;

    expect(answers()).toEqual([{
      requestId: 'r-2', roomRevision: askedIn, beforeTurnId, error: WORKSHOP_EARLIER_TURNS_REFUSALS.roomChanged
    }]);
  });

  it('logs ids, outcomes and counts, never a turn\'s text', async () => {
    const { request, logLines, windowFirst, revision } = await setup();

    await request({ requestId: 'r-1', roomRevision: revision(), beforeTurnId: windowFirst() });
    await request({ requestId: 'r-2', roomRevision: revision() + 1, beforeTurnId: windowFirst() });
    await request({ requestId: 'r-3', roomRevision: revision(), beforeTurnId: 'turn-9999-user-1' });

    const lines = logLines().filter((line) => line.includes('[WorkshopEarlierTurnsHandler]'));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/Earlier turns sent \(requestId=r-1, beforeTurnId=\S+, turns=13, bytes=\d+, remainingBefore=0\)/);
    expect(lines[1]).toContain('reason=room-changed');
    expect(lines[2]).toContain('reason=unknown-turn');
    expect(lines.join('\n')).not.toContain(FIXTURE_TEXT);
    expect(lines.join('\n')).not.toContain('Question');
  });
});
