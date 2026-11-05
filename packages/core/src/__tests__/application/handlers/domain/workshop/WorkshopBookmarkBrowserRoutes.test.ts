/**
 * The Bookmarks screen's routes (ADR 2026-11-05 D8) through the real router,
 * slice composition, session and recall service, over an in-memory corpus:
 * - the open room's rows from the full ledger, in and out of the snapshot's
 *   window, each with the bookmark's own date and its whole message, and only
 *   for the room the request names (PR #214 F-03);
 * - saved pages by cursor, echoed by request id, cancelled, superseded, and
 *   refused once the room is another (PR #214 F-02);
 * - a saved turn's preview, projected, and refusals that name no content.
 * Logs carry ids and counts, never a label or a message.
 */

import { MessageType } from '@messages';
import { WORKSHOP_SNAPSHOT_TURN_WINDOW } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { WorkshopLiveRoomBookmarkReader } from '@/application/services/workshop/WorkshopLiveRoomBookmarkReader';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopRecallSessionSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { bookmarkedCheckpoint, bookmarkedRoom, BOOKMARK_LABEL } from '@/__tests__/application/services/workshop/recall/workshopBookmarkBrowserFixtures';
import { recallLog } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

const summaryOf = (session: WorkshopPersistedSessionV2): WorkshopRecallSessionSummary => ({
  sessionId: session.sessionId,
  title: session.title,
  updatedAt: session.updatedAt,
  timezone: session.temporal.timezone,
  hostPersonaId: session.summary.hostPersonaId,
  participantPersonaIds: session.summary.participantPersonaIds,
  turnCount: session.summary.turnCount
});

/** A corpus port over saved sessions, newest id first, paged by `limit`. */
function corpusOf(sessions: WorkshopPersistedSessionV2[]) {
  const gate: { hold?: Promise<void> } = {};
  const corpus = {
    availability: () => ({ available: true as const }),
    list: jest.fn(async () => ({ sessions: sessions.map(summaryOf), truncated: false })),
    readNamed: jest.fn(async (sessionId: string) => {
      await gate.hold;
      return sessions.find((session) => session.sessionId === sessionId);
    }),
    listPage: jest.fn(async (request: { after?: string; limit: number }) => {
      const ordered = [...sessions].sort((left, right) => right.sessionId.localeCompare(left.sessionId))
        .filter((session) => request.after === undefined || session.sessionId.localeCompare(request.after) < 0);
      const taken = ordered.slice(0, 2);
      return {
        entries: taken.map((session) => ({ cursor: session.sessionId, summary: summaryOf(session) })),
        ...(ordered.length > taken.length ? { next: taken[taken.length - 1].sessionId } : {}),
        remaining: ordered.length - taken.length
      };
    })
  };
  return { corpus, gate };
}

async function screenRoom(saved: WorkshopPersistedSessionV2[] = []) {
  let clock = 1_000;
  const { corpus, gate } = corpusOf(saved);
  const harness = createWorkshopRouteTestHarness({
    sessionNow: () => (clock += 1_000),
    bookmarkBrowser: (session) => new WorkshopTranscriptRecallService(
      corpus,
      { recallScope: () => harness.persistence.recallScope() },
      recallLog(),
      { liveRoom: new WorkshopLiveRoomBookmarkReader(session, () => 'UTC') }
    )
  });
  await harness.pin();
  await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Where does Alice go?' }) as never);
  harness.postMessage.mockClear();
  (harness.log.appendLine as jest.Mock).mockClear();
  return { ...harness, corpus, gate };
}

type Room = Awaited<ReturnType<typeof screenRoom>>;

const route = (room: Room, type: MessageType, payload: object) => room.router.route(message(type, payload) as never);
const answers = (room: Room, type: MessageType) => room.posted(type).map((entry) => entry.payload);
const logs = (room: Room) => (room.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).join('\n');

describe('the open room\'s rows (PR #214 F-03)', () => {
  it('reads every bookmark from the full ledger, in and out of the window, each with its own date and whole message', async () => {
    const room = await screenRoom();
    const reply = room.session.readRoomLedger().find((turn) => turn.participant === 'host')!;
    await route(room, MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId: reply.id, bookmarked: true });
    for (let index = 0; index < WORKSHOP_SNAPSHOT_TURN_WINDOW; index += 1) {
      room.session.recordSessionMarker('resume', `Session resumed, pass ${index}`);
    }
    // A session marker carries no bookmark: a second reply does.
    await route(room, MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And after that?' });
    const late = room.session.readRoomLedger().filter((turn) => turn.participant === 'host').at(-1)!;
    await route(room, MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId: late.id, bookmarked: true });
    expect(room.session.getSnapshot().bookmarks.map((bookmark) => bookmark.inWindow)).toEqual([false, true]);

    await route(room, MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS, { requestId: 'live-1', roomRevision: room.session.readRoomRevision() });
    const [answer] = answers(room, MessageType.WORKSHOP_LIVE_BOOKMARKS);
    expect(answer.requestId).toBe('live-1');
    expect(answer.bookmarks.map((row: { turnId: string }) => row.turnId)).toEqual([reply.id, late.id]);
    const [early, recent] = answer.bookmarks;
    // The bookmark's own date: set after the turn, so never the turn's timestamp.
    expect(early.createdAt).toBeGreaterThan(reply.timestamp);
    expect(recent.createdAt).toBeGreaterThan(late.timestamp);
    // The whole message, as the preview shows it, for search and an out-of-window preview.
    expect(early.message).toEqual({ kind: 'reply', speaker: expect.any(String), content: reply.content, timestamp: reply.timestamp });
    expect(early).toMatchObject({ speaker: expect.any(String), identity: expect.any(String) });
    expect(logs(room)).toContain('Live bookmarks sent (requestId=live-1, count=2)');
    expect(logs(room)).not.toContain(reply.content);
  });

  it('answers only for the room the request names, waiting out a replacement first', async () => {
    const room = await screenRoom();
    const revision = room.session.readRoomRevision();
    await route(room, MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS, { requestId: 'old', roomRevision: revision - 1 });

    // A replacement in flight: the request waits, then finds another room.
    let release!: () => void;
    room.persistence.isSessionOperationPending.mockReturnValue(true);
    room.persistence.waitForSessionOperations.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    const waiting = route(room, MessageType.WORKSHOP_REQUEST_LIVE_BOOKMARKS, { requestId: 'mid', roomRevision: revision });
    await Promise.resolve();
    expect(answers(room, MessageType.WORKSHOP_LIVE_BOOKMARKS).map((entry) => entry.requestId)).toEqual(['old']);
    room.session.reset();
    room.persistence.isSessionOperationPending.mockReturnValue(false);
    release();
    await waiting;

    expect(answers(room, MessageType.WORKSHOP_LIVE_BOOKMARKS)).toEqual([
      { requestId: 'old', roomRevision: revision - 1, error: 'The room changed before the bookmarks could be shown.' },
      { requestId: 'mid', roomRevision: revision, error: 'The room changed before the bookmarks could be shown.' }
    ]);
  });
});

describe('saved pages (PR #214 F-02)', () => {
  const saved = () => ['alice-1', 'alice-2', 'alice-3'].map((id) => bookmarkedCheckpoint(id, `Tea party ${id}`));

  it('pages by the host\'s cursor, echoing each request, until every session is read', async () => {
    const room = await screenRoom(saved());
    const revision = room.session.readRoomRevision();
    await route(room, MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE, { requestId: 'p-1', roomRevision: revision });
    const [first] = answers(room, MessageType.WORKSHOP_BOOKMARK_PAGE);
    expect(first.page).toMatchObject({ read: 2, unreadable: 0, unreadableSessions: [], remaining: 1, next: 'alice-2' });
    expect(first.page.sessions.map((session: { sessionId: string }) => session.sessionId)).toEqual(['alice-3', 'alice-2']);
    expect(first.page.sessions[0]).toMatchObject({
      title: 'Tea party alice-3',
      bookmarks: [{ turnId: bookmarkedRoom().replyId, label: BOOKMARK_LABEL, message: { kind: 'reply' } }]
    });

    await route(room, MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE, { requestId: 'p-2', roomRevision: revision, after: first.page.next });
    const second = answers(room, MessageType.WORKSHOP_BOOKMARK_PAGE)[1];
    expect(second).toMatchObject({ requestId: 'p-2', page: { read: 1, remaining: 0 } });
    expect(second.page.next).toBeUndefined();
    expect(logs(room)).not.toContain('Tea party');
    expect(logs(room)).not.toContain(BOOKMARK_LABEL);
  });

  it('answers nothing for a cancelled page, or one a newer request superseded', async () => {
    const room = await screenRoom(saved());
    const revision = room.session.readRoomRevision();
    let release!: () => void;
    room.gate.hold = new Promise<void>((resolve) => { release = resolve; });
    const cancelled = route(room, MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE, { requestId: 'p-1', roomRevision: revision });
    await new Promise((resolve) => setImmediate(resolve));
    await route(room, MessageType.WORKSHOP_CANCEL_BOOKMARK_PAGE, { requestId: 'p-1' });
    const superseded = route(room, MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE, { requestId: 'p-2', roomRevision: revision });
    const current = route(room, MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE, { requestId: 'p-3', roomRevision: revision });
    release();
    room.gate.hold = undefined;
    await Promise.all([cancelled, superseded, current]);

    expect(answers(room, MessageType.WORKSHOP_BOOKMARK_PAGE).map((entry) => entry.requestId)).toEqual(['p-3']);
    expect(logs(room)).toContain('Bookmarks page cancelled (requestId=p-1)');
  });

  it('refuses a page once the room is another, and a cursor that was never one', async () => {
    const room = await screenRoom(saved());
    const revision = room.session.readRoomRevision();
    let release!: () => void;
    room.gate.hold = new Promise<void>((resolve) => { release = resolve; });
    const reading = route(room, MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE, { requestId: 'p-1', roomRevision: revision });
    await new Promise((resolve) => setImmediate(resolve));
    room.session.reset();
    release();
    await reading;
    await route(room, MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE, { requestId: 'p-2', roomRevision: room.session.readRoomRevision(), after: 'x'.repeat(600) });

    expect(answers(room, MessageType.WORKSHOP_BOOKMARK_PAGE)).toEqual([
      { requestId: 'p-1', roomRevision: revision, error: 'The room changed before the bookmarks could be shown.' },
      { requestId: 'p-2', roomRevision: room.session.readRoomRevision(), error: 'That request could not be read.' }
    ]);
  });

  it('says why when saved sessions cannot be read here', async () => {
    const room = await screenRoom(saved());
    room.persistence.recallScope.mockReturnValue({ available: false, reason: 'no-workspace' });
    await route(room, MessageType.WORKSHOP_REQUEST_BOOKMARK_PAGE, { requestId: 'p-1', roomRevision: room.session.readRoomRevision() });
    expect(answers(room, MessageType.WORKSHOP_BOOKMARK_PAGE)[0].error)
      .toBe('Saved sessions need an open folder. Open a single folder to browse their bookmarks.');
  });
});

describe('a saved turn\'s preview', () => {
  it('sends the turn as the preview shows it, and refuses an unknown session or turn naming no content', async () => {
    const room = await screenRoom([bookmarkedCheckpoint('alice-1', 'Tea party')]);
    const replyId = bookmarkedRoom().replyId;
    await route(room, MessageType.WORKSHOP_REQUEST_SAVED_TURN_PREVIEW, { requestId: 's-1', sessionId: 'alice-1', turnId: replyId });
    await route(room, MessageType.WORKSHOP_REQUEST_SAVED_TURN_PREVIEW, { requestId: 's-2', sessionId: 'nobody', turnId: replyId });
    await route(room, MessageType.WORKSHOP_REQUEST_SAVED_TURN_PREVIEW, { requestId: 's-3', sessionId: 'alice-1', turnId: 'turn-999' });
    await route(room, MessageType.WORKSHOP_REQUEST_SAVED_TURN_PREVIEW, { requestId: 's-4', sessionId: 'alice-1' });

    const [shown, unknownSession, unknownTurn, malformed] = answers(room, MessageType.WORKSHOP_SAVED_TURN_PREVIEW);
    expect(shown).toEqual({
      requestId: 's-1',
      sessionId: 'alice-1',
      turnId: replyId,
      turn: { kind: 'reply', speaker: expect.any(String), content: 'HOST-REPLY: Alice opens the little door.', timestamp: expect.any(Number) }
    });
    expect(unknownSession.error).toBe('That saved session is no longer there.');
    expect(unknownTurn.error).toBe('That message is no longer in its saved session.');
    expect(malformed.error).toBe('That request could not be read.');
    expect(logs(room)).not.toContain('Alice opens');
  });
});
