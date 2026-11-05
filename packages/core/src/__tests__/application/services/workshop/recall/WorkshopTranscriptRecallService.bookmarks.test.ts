/**
 * `transcript.bookmarks` through the real service, coordinator and store
 * (ADR 2026-11-05 D1, D2): which sources a scope reads, the open room only
 * through its port and only for this operation, refs that name their
 * source, and one bookmarked message read to its end by following its hints
 * through the real codec, as a caller that no longer holds the original.
 */

import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { WorkshopTranscriptRecallCapability } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import { WorkshopLiveRoomBookmarkReader } from '@/application/services/workshop/WorkshopLiveRoomBookmarkReader';
import { renderWorkshopRecallBookmarks } from '@/application/services/workshop/recall/WorkshopRecallBookmarkList';
import type { WorkshopRecallBookmarksResult } from '@/application/services/workshop/recall/WorkshopRecallBookmarkResults';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import type { WorkshopTranscriptRecallRequest } from '@shared/types/workshopCapabilities';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { createRecallRunHarness, recallCall } from '@/__tests__/application/services/workshop/recall/workshopRecallRunHarness';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import { scriptedCheckpoint } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';

const codec = new WorkshopCapabilityXmlCodec();
const NOW = Date.parse('2026-11-05T12:00:00.000Z');
const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });

type Room = ReturnType<typeof createRecallRunHarness>;
let room: Room;
afterEach(() => room?.dispose());

/** A saved session, scripted: its replies, the first bookmarked and named. */
async function saveScripted(sessionId: string, title: string, questions: string[], label: string) {
  const scripted = new ScriptedWorkshopRoom().start();
  const replies = questions.map((question) => scripted.hostMessage(question));
  scripted.session.setTurnBookmark(replies[0].id, true);
  scripted.session.renameBookmark(scripted.session.getSnapshot().bookmarks[0].id, label);
  await room.store.saveNamed({ ...scriptedCheckpoint(sessionId, scripted), title });
  return { replies, bookmarkId: scripted.session.getSnapshot().bookmarks[0].id };
}

/** A live room with one reply the writer bookmarked. */
async function liveRoom(reply = 'HOST-REPLY: Alice rows out at dawn.') {
  room = createRecallRunHarness();
  await room.coordinator.initialize();
  room.session.setSessionScope('open');
  const turn = await room.host('h-1', 'Where does the scene go?', [reply]);
  room.session.setTurnBookmark(turn.id, true);
  const bookmark = room.session.getSnapshot().bookmarks[0];
  const scope = room.coordinator.recallScope();
  return { turn, bookmark, liveSessionId: scope.available ? scope.liveSessionId : '' };
}

const listed = (result: WorkshopRecallBookmarksResult) => {
  if (!result.available || result.outcome !== 'bookmarks') {
    throw new Error(`expected a list, got ${JSON.stringify(result)}`);
  }
  return result;
};
const sources = (result: WorkshopRecallBookmarksResult) =>
  listed(result).groups.map((group) => (group.source.kind === 'current' ? 'current' : group.source.header.sessionId));

describe('which sources a scope reads', () => {
  it('reads the open room first, then saved sessions newest first; current and saved read one each', async () => {
    await liveRoom();
    await saveScripted('saved-a', 'Tea party', ['Where is the cup?'], 'Alice\'s cup');
    expect(sources(await room.recall.bookmarks({}))).toEqual(['current', 'saved-a']);
    expect(sources(await room.recall.bookmarks({ scope: 'all' }))).toEqual(['current', 'saved-a']);
    expect(sources(await room.recall.bookmarks({ scope: 'current' }))).toEqual(['current']);
    const saved = listed(await room.recall.bookmarks({ scope: 'saved' }));
    expect(sources(saved)).toEqual(['saved-a']);
    expect(saved.bounds.openRoom).toBe('not-asked');
    const current = listed(await room.recall.bookmarks({ scope: 'current' }));
    expect(current.bounds).toMatchObject({ openRoom: 'read', sessionsScanned: 0, corpusSessions: 0 });
  });

  it('reports the open room unavailable where no port was wired', async () => {
    await liveRoom();
    const unwired = new WorkshopTranscriptRecallService(room.store, room.coordinator, room.log);
    expect(listed(await unwired.bookmarks({ scope: 'current' }))).toMatchObject({ groups: [], bounds: { openRoom: 'unavailable' } });
  });

  it('gives an unknown <session> the shared copy', async () => {
    const { liveSessionId } = await liveRoom();
    const unknown = await room.recall.bookmarks({ sessionIds: ['nope'] });
    expect(unknown).toEqual({ available: true, outcome: 'unknown-session', sessionId: 'nope', liveSession: false });
    expect(renderWorkshopRecallBookmarks(unknown, { now: NOW }).content).toContain('No saved session in this workspace has id nope.');
    expect(await room.recall.bookmarks({ sessionIds: [liveSessionId] })).toMatchObject({ outcome: 'unknown-session', liveSession: true });
  });

  it('reuses cached documents', async () => {
    await liveRoom();
    await saveScripted('saved-a', 'Tea party', ['Where is the cup?'], 'Alice\'s cup');
    expect(listed(await room.recall.bookmarks({ scope: 'saved' })).bounds.cacheHits).toBe(0);
    expect(listed(await room.recall.bookmarks({ scope: 'saved' })).bounds.cacheHits).toBe(1);
  });
});

describe('the open room, and only for bookmarks', () => {
  it('never reads the open room for catalog, search, read or to-dos', async () => {
    await liveRoom();
    await saveScripted('saved-a', 'Tea party', ['Where is the cup?'], 'Alice\'s cup');
    const reader = new WorkshopLiveRoomBookmarkReader(room.session, () => 'UTC');
    const port = { readLiveRoomBookmarks: jest.fn((asker: Parameters<typeof reader.readLiveRoomBookmarks>[0]) => reader.readLiveRoomBookmarks(asker)) };
    const recall = new WorkshopTranscriptRecallService(room.store, room.coordinator, room.log, { liveRoom: port });
    await recall.catalog({});
    await recall.search({ query: 'cup' });
    await recall.read({ sessions: [{ sessionId: 'saved-a' }] });
    await recall.todos({});
    expect(port.readLiveRoomBookmarks).not.toHaveBeenCalled();
    await recall.bookmarks({ scope: 'saved' });
    expect(port.readLiveRoomBookmarks).not.toHaveBeenCalled();
    await recall.bookmarks({});
    expect(port.readLiveRoomBookmarks).toHaveBeenCalledTimes(1);
  });

  it('refuses a guest a bookmark on a turn it could not see, and shows the host its own', async () => {
    await liveRoom();
    await room.host('h-2', 'Look something up.', [recallCall('transcript.catalog', ''), 'HOST-FINAL: done.']);
    const card = room.session.readRoomLedger().find((turn) => turn.artifact === 'transcript_catalog')!;
    room.session.setTurnBookmark(card.id, true);
    const bookmark = room.session.getSnapshot().bookmarks.find((candidate) => candidate.turnId === card.id)!;
    const scope = room.coordinator.recallScope();
    const ref = { source: 'current' as const, liveSessionId: scope.available ? scope.liveSessionId : '', bookmarkId: bookmark.id };

    const guest = { kind: 'personaGuest' as const, personaId: 'cliff' as const };
    expect(await room.recall.bookmarks({ bookmark: ref, reader: guest })).toEqual({ available: true, outcome: 'unknown-bookmark', ref });
    expect(listed(await room.recall.bookmarks({ scope: 'current', reader: guest })).groups[0].bookmarks.map((row) => row.id))
      .not.toContain(bookmark.id);
    const host = await room.recall.bookmarks({ bookmark: ref, reader: { kind: 'host' } });
    expect(host).toMatchObject({ outcome: 'bookmark', withheld: { reason: 'open-room-private-turn', bookmarkIds: [bookmark.id] } });
  });
});

describe('one bookmark in full (PR #214 F-07)', () => {
  it('reads an open-room message over the cap to its end by following its hints, as fresh callers', async () => {
    const message = `HOST-REPLY: Alice rows out. ${'The keeper climbs the stair and counts the steps. '.repeat(200)}`.trimEnd();
    expect(message.length).toBeGreaterThan(2 * PROMPT_BUDGETS.workshopTranscriptRecall.bookmarkMessageCharacters);
    await liveRoom(message);
    const fulfill = async (request: WorkshopTranscriptRecallRequest) =>
      // A new capability each time: no caller holds the message, or any earlier window.
      new WorkshopTranscriptRecallCapability(room.recall, room.log, {
        requestId: `r-${Math.random()}`,
        personaId: 'jill',
        owner: { kind: 'host' },
        signal: new AbortController().signal
      }).fulfill(request);
    const decode = (body: string): WorkshopTranscriptRecallRequest => {
      const inspection = codec.inspect(recallCall('transcript.bookmarks', body));
      if (inspection.kind !== 'request') {
        throw new Error(`refused: ${JSON.stringify(inspection)}`);
      }
      return inspection.request as WorkshopTranscriptRecallRequest;
    };

    const list = await fulfill(decode('<scope>current</scope>'));
    let hint = /read the rest with (<bookmark>[^<]+<\/bookmark> <from>\d+<\/from>)\]/.exec(list.content!)?.[1];
    expect(hint).toMatch(/^<bookmark>current@/);
    let text = /\n(HOST-REPLY[^\n]*)\n\[message cut/.exec(list.content!)![1];
    for (let window = 0; hint && window < 10; window += 1) {
      const read = await fulfill(decode(hint));
      expect(read.status).toBe('success');
      text += /Characters [\d,]+–[\d,]+ of [\d,]+:\n([\s\S]*?)\n(?:Continue with|This is the end)/.exec(read.content!)![1];
      hint = /Continue with (<bookmark>[^<]+<\/bookmark> <from>\d+<\/from>)\./.exec(read.content!)?.[1];
    }
    expect(hint).toBeUndefined();
    expect(text).toBe(message);
  });

  it('keeps two saved sessions with the same bookmark id apart: one branched from the other, and two on the same clock', async () => {
    await liveRoom();
    const a = await saveScripted('saved-a', 'Tea party', ['Where is the cup?', 'Who moved it?'], 'Alice\'s cup');
    // The same script on the same clock mints the same bookmark id.
    const b = await saveScripted('saved-b', 'Croquet', ['Where is the mallet?', 'Who has it?'], 'The Queen\'s mallet');
    expect(b.bookmarkId).toBe(a.bookmarkId);
    // Open A, branch it at its first reply, rename the branch's bookmark, and save the branch.
    await room.coordinator.openNamed('saved-a');
    await room.coordinator.branchFrom(after(a.replies[0].id), { title: 'Tea party branch' });
    const branchBookmark = room.session.getSnapshot().bookmarks[0];
    expect(branchBookmark.id).toBe(a.bookmarkId);
    room.session.renameBookmark(branchBookmark.id, 'The branch\'s cup');
    const branch = await room.coordinator.saveNamed('Tea party branch');
    await room.coordinator.resetSession({ start: 'full-reset' });

    const read = async (sessionId: string) => {
      const result = await room.recall.bookmarks({ bookmark: { source: 'saved', sessionId, bookmarkId: a.bookmarkId } });
      return result.available && result.outcome === 'bookmark'
        ? [result.source.kind === 'saved' ? result.source.header.sessionId : 'current', result.bookmark.displayLabel]
        : result;
    };
    expect(await read('saved-a')).toEqual(['saved-a', 'Alice\'s cup']);
    expect(await read('saved-b')).toEqual(['saved-b', 'The Queen\'s mallet']);
    expect(await read(branch.sessionId)).toEqual([branch.sessionId, 'The branch\'s cup']);
  });

  it('keeps the open room and a saved session with the same bookmark id apart', async () => {
    const { turn, bookmark } = await liveRoom();
    room.session.renameBookmark(bookmark.id, 'Alice\'s cup');
    // Saved, then branched: the saved session and the open branch hold the same bookmark id.
    const saved = await room.coordinator.saveNamed('Tea party');
    await room.coordinator.branchFrom(after(turn.id));
    const scope = room.coordinator.recallScope();
    const liveSessionId = scope.available ? scope.liveSessionId : '';
    expect(liveSessionId).not.toBe(saved.sessionId);
    expect(room.session.getSnapshot().bookmarks[0].id).toBe(bookmark.id);
    room.session.renameBookmark(bookmark.id, 'The open room\'s mark');

    const current = await room.recall.bookmarks({ bookmark: { source: 'current', liveSessionId, bookmarkId: bookmark.id } });
    const other = await room.recall.bookmarks({ bookmark: { source: 'saved', sessionId: saved.sessionId, bookmarkId: bookmark.id } });
    expect(current).toMatchObject({ outcome: 'bookmark', source: { kind: 'current' }, bookmark: { displayLabel: 'The open room\'s mark' } });
    expect(other).toMatchObject({ outcome: 'bookmark', source: { kind: 'saved' }, bookmark: { displayLabel: 'Alice\'s cup' } });
    // A list holds both, each under its own ref.
    const refs = listed(await room.recall.bookmarks({})).groups.flatMap((group) => group.bookmarks.map((row) => row.ref));
    expect(refs).toEqual([
      { source: 'current', liveSessionId, bookmarkId: bookmark.id },
      { source: 'saved', sessionId: saved.sessionId, bookmarkId: bookmark.id }
    ]);
  });

  it.each(['New', 'Open', 'Branch'] as const)('refuses an open-room ref as stale after %s, never retargeting it', async (operation) => {
    const { turn, bookmark, liveSessionId } = await liveRoom();
    await saveScripted('saved-a', 'Tea party', ['Where is the cup?'], 'Alice\'s cup');
    const ref = { source: 'current' as const, liveSessionId, bookmarkId: bookmark.id };
    if (operation === 'New') {
      await room.coordinator.resetSession({ start: 'full-reset' });
    } else if (operation === 'Open') {
      await room.coordinator.openNamed('saved-a');
    } else {
      await room.coordinator.saveNamed('Live room');
      await room.coordinator.branchFrom(after(turn.id));
    }
    const scope = room.coordinator.recallScope();
    expect(scope.available && scope.liveSessionId).not.toBe(liveSessionId);
    expect(await room.recall.bookmarks({ bookmark: ref })).toEqual({ available: true, outcome: 'stale-bookmark-ref', ref, why: 'room-replaced' });
    const refused = await new WorkshopTranscriptRecallCapability(room.recall, room.log, {
      requestId: 'stale', personaId: 'jill', owner: { kind: 'host' }, signal: new AbortController().signal
    }).fulfill({ capability: 'transcript.bookmarks', bookmark: ref });
    expect(refused).toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'stale-bookmark-ref', why: 'room-replaced' } });
  });

  it('refuses a saved ref to a session that is now open, or that is not saved', async () => {
    await liveRoom();
    const saved = await saveScripted('saved-a', 'Tea party', ['Where is the cup?'], 'Alice\'s cup');
    await room.coordinator.openNamed('saved-a');
    const ref = { source: 'saved' as const, sessionId: 'saved-a', bookmarkId: saved.bookmarkId };
    expect(await room.recall.bookmarks({ bookmark: ref })).toMatchObject({ outcome: 'stale-bookmark-ref', why: 'now-open' });
    const missing = { ...ref, sessionId: 'never-saved' };
    expect(await room.recall.bookmarks({ bookmark: missing })).toMatchObject({ outcome: 'stale-bookmark-ref', why: 'no-session' });
  });
});
