/**
 * The Bookmarks screen's reads through the real recall service, store and
 * coordinator (ADR 2026-11-05 D8; PR #214 F-02, F-03):
 * - saved sessions page by page past 200, and past the byte budget, with
 *   every session read, unreadable or still to read, and the open room out;
 * - read-only (no write, no flush, no initialize), cached, cancellable;
 * - the open room's rows from its full ledger, every one, for the writer;
 * - one saved turn, projected, with nothing host-private.
 */

import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { WorkshopLiveRoomBookmarkReader } from '@/application/services/workshop/WorkshopLiveRoomBookmarkReader';
import type { WorkshopRecallBookmarkPage } from '@/application/services/workshop/recall/WorkshopRecallBookmarkPage';
import { WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import { workshopTurnPreviewOfEntry } from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import { setupCoordinator, harnessNow } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';
import {
  RECALL_SENTINELS,
  RECALL_WORKSPACE,
  recallLog,
  saveSentinelCorpus
} from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import {
  BOOKMARK_LABEL,
  bookmarkedRoom,
  saveBookmarkedSessions
} from '@/__tests__/application/services/workshop/recall/workshopBookmarkBrowserFixtures';

type Page = WorkshopRecallBookmarkPage;

/** A live room over a fresh workspace, a store paging with `pageLimits`, and recall over both. */
async function workspace(pageLimits?: { bookmarkBrowserSessions: number; bookmarkBrowserBytes: number }) {
  const harness = setupCoordinator();
  await harness.coordinator.initialize();
  const pages = new WorkshopSessionStore(harness.fs, RECALL_WORKSPACE, harness.log, harnessNow, undefined, pageLimits);
  const recall = new WorkshopTranscriptRecallService(pages, harness.coordinator, recallLog(), {
    liveRoom: new WorkshopLiveRoomBookmarkReader(harness.session, () => 'UTC')
  });
  return { ...harness, pages, recall };
}

const paged = (result: Awaited<ReturnType<WorkshopTranscriptRecallService['bookmarkPage']>>): Page => {
  if (!result.available) {
    throw new Error(`expected a page, got ${JSON.stringify(result)}`);
  }
  return result;
};

/** Every page from the start. */
async function walk(recall: WorkshopTranscriptRecallService): Promise<Page[]> {
  const pages: Page[] = [];
  let after: string | undefined;
  do {
    const page = paged(await recall.bookmarkPage(after !== undefined ? { after } : {}));
    pages.push(page);
    after = page.next;
  } while (after !== undefined);
  return pages;
}

const sessionIds = (pages: readonly Page[]) => pages.flatMap((page) => page.sessions.map((session) => session.sessionId));

describe('saved sessions, a page at a time (PR #214 F-02)', () => {
  it('reaches all of 205 saved sessions\' bookmarks page by page, and leaves the open room out', async () => {
    const room = await workspace();
    const ids = await saveBookmarkedSessions(room.store, 205);
    // The open room saved under a name: its file is in the walk, but never in a page.
    const live = await room.coordinator.saveNamed('The open room');

    const pages = await walk(room.recall);
    expect(pages).toHaveLength(9);
    expect(new Set(sessionIds(pages))).toEqual(new Set(ids));
    expect(sessionIds(pages)).not.toContain(live.sessionId);
    expect(pages.reduce((total, page) => total + page.read, 0)).toBe(205);
    expect(pages.every((page) => page.unreadable === 0)).toBe(true);
    // Counts move with the cursor: what is left shrinks to none.
    expect(pages[0].remaining).toBe(206 - 25);
    expect(pages.at(-1)!.remaining).toBe(0);
    // Each row is the saved bookmark, field by field, its message projected.
    const row = pages[0].sessions[0].bookmarks[0];
    expect(row).toMatchObject({ turnId: bookmarkedRoom().replyId, displayLabel: BOOKMARK_LABEL });
    expect(row.entry).toMatchObject({ kind: 'reply', content: 'HOST-REPLY: Alice opens the little door.' });
  });

  it('pages a cold corpus past the byte budget without omitting an earlier session', async () => {
    const room = await workspace({ bookmarkBrowserSessions: 25, bookmarkBrowserBytes: 1 });
    const ids = await saveBookmarkedSessions(room.store, 5);

    const pages = await walk(room.recall);
    expect(pages.map((page) => page.read)).toEqual([1, 1, 1, 1, 1]);
    expect(pages.map((page) => page.remaining)).toEqual([4, 3, 2, 1, 0]);
    expect(sessionIds(pages).sort()).toEqual([...ids].sort());
  });

  it('reads without writing, flushing or initializing, and reuses its cached documents', async () => {
    const room = await workspace();
    await saveBookmarkedSessions(room.store, 3);
    const touched = [
      jest.spyOn(room.fs, 'writeFile'),
      jest.spyOn(room.fs, 'rename'),
      jest.spyOn(room.fs, 'delete'),
      jest.spyOn(room.coordinator, 'flush'),
      jest.spyOn(room.coordinator, 'initialize')
    ];
    const readPaged = jest.spyOn(room.pages, 'readPagedSession');
    const readNamed = jest.spyOn(room.pages, 'readNamed');
    const list = jest.spyOn(room.pages, 'list');

    const first = paged(await room.recall.bookmarkPage({}));
    expect(first).toMatchObject({ read: 3, cacheHits: 0 });
    const second = paged(await room.recall.bookmarkPage({}));
    expect(second).toMatchObject({ read: 3, cacheHits: 3 });
    expect(readPaged).toHaveBeenCalledTimes(3);
    // Page-local reads only: never the exact-read path (PR #216 F-01).
    expect(readNamed).not.toHaveBeenCalled();
    touched.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    // Never the browser's capped, query-capable listing.
    expect(list).not.toHaveBeenCalled();
  });

  it('skips and names a session it cannot read, and counts a file it cannot even summarize', async () => {
    const room = await workspace();
    await saveBookmarkedSessions(room.store, 3);
    const files = [...room.fs.files.keys()].filter((key) => key.includes('/sessions/') && !key.endsWith('current.json'));
    const full = files.filter((key) => !key.endsWith('.summary.json')).sort();
    // alice-2's full file is corrupt, but its search index still names it.
    const second = full.find((key) => room.fs.files.get(key)!.length > 0 && new TextDecoder().decode(room.fs.files.get(key)!).includes('"alice-2"'))!;
    room.fs.files.set(second, new TextEncoder().encode('{ not json'));
    // A stray file with no index and no readable body.
    room.fs.files.set('/workspace/novel/prose-minion/sessions/9999-stray.json', new TextEncoder().encode('{ nope'));

    const page = paged(await room.recall.bookmarkPage({}));
    expect(page.read).toBe(2);
    expect(page.unreadable).toBe(2);
    expect(page.unreadableSessions).toEqual([{ sessionId: 'alice-2', title: 'Alice alice 2' }]);
    expect(page.sessions.map((session) => session.sessionId).sort()).toEqual(['alice-1', 'alice-3']);
  });

  it('stops when cancelled, before or during a page', async () => {
    const room = await workspace();
    await saveBookmarkedSessions(room.store, 3);
    const before = new AbortController();
    before.abort();
    await expect(room.recall.bookmarkPage({}, before.signal)).rejects.toMatchObject({ name: 'AbortError' });

    const during = new AbortController();
    const readPaged = room.pages.readPagedSession.bind(room.pages);
    jest.spyOn(room.pages, 'readPagedSession').mockImplementation(async (cursor, sessionId) => {
      during.abort();
      return readPaged(cursor, sessionId);
    });
    await expect(room.recall.bookmarkPage({}, during.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('refuses once the open room is another, and discards what it read', async () => {
    const room = await workspace();
    await saveBookmarkedSessions(room.store, 2);
    const readPaged = room.pages.readPagedSession.bind(room.pages);
    jest.spyOn(room.pages, 'readPagedSession').mockImplementation(async (cursor, sessionId) => {
      jest.spyOn(room.coordinator, 'recallScope').mockReturnValue({ available: true, liveSessionId: 'another-room' });
      return readPaged(cursor, sessionId);
    });
    expect(await room.recall.bookmarkPage({})).toEqual({ available: false, reason: 'not-ready' });
  });
});

describe('the open room, for the writer (PR #214 F-03)', () => {
  it('shows every bookmark from the full ledger, with its own date and message', async () => {
    const room = await workspace();
    const ledger = new WorkshopLiveRoomBookmarkReader(bookmarkedRoom().scripted.session, () => 'UTC');
    const writer = ledger.readWriterBookmarks();
    expect(writer.bookmarks).toHaveLength(1);
    const [row] = writer.bookmarks;
    const turn = bookmarkedRoom().scripted.session.readRoomLedger().find((candidate) => candidate.id === row.turnId)!;
    // The bookmark's own date, not its turn's.
    expect(row.createdAt).not.toBe(turn.timestamp);
    expect(row.entry).toMatchObject({ content: 'HOST-REPLY: Alice opens the little door.' });
    // Through the service, only from its live port.
    expect(room.recall.liveRoomBookmarks()).toEqual(new WorkshopLiveRoomBookmarkReader(room.session, () => 'UTC').readWriterBookmarks());
    const unwired = new WorkshopTranscriptRecallService(room.pages, room.coordinator, recallLog());
    expect(unwired.liveRoomBookmarks()).toBeUndefined();
  });

  it('includes a bookmark on a private exchange, which a persona\'s room-wide read leaves out', () => {
    const scripted = new ScriptedWorkshopRoom().start();
    scripted.hostMessage('Where does Alice go next?');
    scripted.toolRun('prose');
    const aside = scripted.directToolMessage('prose', 'Which sentence drags?');
    scripted.session.setTurnBookmark(aside.id, true);
    const reader = new WorkshopLiveRoomBookmarkReader(scripted.session, () => 'UTC');
    expect(reader.readLiveRoomBookmarks(undefined).bookmarks).toEqual([]);
    expect(reader.readWriterBookmarks().bookmarks.map((row) => [row.turnId, row.roomVisible])).toEqual([[aside.id, false]]);
  });
});

describe('one saved turn, projected', () => {
  it('previews each turn of a saved session as the transcript shows it, with nothing host-private', async () => {
    const saved = await saveSentinelCorpus();
    const recall = new WorkshopTranscriptRecallService(saved.store, saved.coordinator, recallLog());
    const session = await saved.store.readNamed(saved.savedSessionId);
    let shown = 0;
    for (const turn of session!.workshop.turns) {
      const result = await recall.savedTurn(saved.savedSessionId, turn.id);
      if ('kind' in result && result.kind === 'turn') {
        shown += 1;
        const preview = workshopTurnPreviewOfEntry(result.entry);
        const wire = JSON.stringify(preview);
        Object.values(RECALL_SENTINELS).forEach((sentinel) => expect(wire).not.toContain(sentinel));
        expect(Object.keys(preview).sort()).toEqual(expect.arrayContaining(['content', 'kind', 'speaker', 'timestamp']));
      } else {
        expect(result).toEqual({ kind: 'unknown-turn' });
      }
    }
    expect(shown).toBeGreaterThanOrEqual(3);
  });

  it('refuses an unknown session, an unknown turn, and the open room', async () => {
    const saved = await saveSentinelCorpus();
    const recall = new WorkshopTranscriptRecallService(saved.store, saved.coordinator, recallLog());
    expect(await recall.savedTurn('no-such-session', 'turn-1')).toEqual({ kind: 'unknown-session' });
    expect(await recall.savedTurn(saved.savedSessionId, 'turn-999')).toEqual({ kind: 'unknown-turn' });
    const scope = saved.coordinator.recallScope();
    const liveSessionId = scope.available ? scope.liveSessionId : '';
    expect(await recall.savedTurn(liveSessionId, 'turn-1')).toEqual({ kind: 'live-session' });
  });
});
