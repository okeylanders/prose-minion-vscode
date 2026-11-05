/**
 * "Remember this" on a saved session's bookmark, through the real session
 * coordinator, store, recall service and Project Memory library (PR #219
 * review, Astra's witnesses as regressions):
 *
 * - **F-01.** A bookmarked capability card is eligible (the bubbles' rule),
 *   though its transcript projection is an event: it saves, with the safe
 *   projected summary as the prefill the row carries. A divider or session
 *   marker is still refused, and the screen offers it nothing.
 * - **F-02.** The save belongs to the room it was asked in. A same-id
 *   reopen or a Rewind while the source is read refuses it with nothing
 *   written (no memory, no receipt); a different live id is refused too.
 *
 * *Alice*, made-up text.
 */

import { WorkshopSavedTurnMemoryHandler } from '@handlers/domain/workshop/WorkshopSavedTurnMemoryHandler';
import { WorkshopProjectMemoryHandler } from '@handlers/domain/workshop/WorkshopProjectMemoryHandler';
import { WORKSHOP_MEMORY_ROOM_CHANGED } from '@handlers/domain/workshop/WorkshopProjectMemoryRefusals';
import { workshopBookmarkBrowserPage } from '@handlers/domain/workshop/WorkshopBookmarkBrowserRows';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { ProjectMemoryLibrary } from '@/application/services/workshop/memory/ProjectMemoryLibrary';
import { ProjectMemoryStore } from '@/infrastructure/storage/ProjectMemoryStore';
import { setupCoordinator, scriptedCheckpoint } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import { RECALL_WORKSPACE } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import { createFakeSettings } from '@/__tests__/mocks/platform';
import { holdOnce } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { isWorkshopBookmarkableTurn } from '@shared/constants/workshopBookmarks';
import { MessageType, type WorkshopMemoryWriteResultPayload } from '@messages';

async function setup() {
  const room = setupCoordinator();
  await room.coordinator.initialize();
  const scripted = new ScriptedWorkshopRoom().start();
  const reply = scripted.hostMessage('What does Alice remember?', { capabilityRounds: 1, reply: 'The Rabbit has a watch.' });
  const capability = scripted.session.readRoomLedger().find((turn) => turn.capability)!;
  scripted.session.setTurnBookmark(capability.id, true);
  scripted.session.recordSessionMarker('resume', 'Session resumed');
  const marker = scripted.session.readRoomLedger().find((turn) => turn.participant === 'session')!;
  scripted.hostMessage('What happens next?', { reply: 'Alice follows the Rabbit.' });
  await room.store.saveNamed(scriptedCheckpoint('saved-source', scripted));
  await room.store.saveNamed(scriptedCheckpoint('live-room', scripted));
  await room.coordinator.openNamed('live-room');
  const recall = new WorkshopTranscriptRecallService(room.store, room.coordinator, room.log);
  const memoryStore = new ProjectMemoryStore(room.fs, RECALL_WORKSPACE, room.log);
  const library = new ProjectMemoryLibrary(memoryStore, room.coordinator, recall, createFakeSettings(), room.log);
  const posted: Array<{ type: MessageType; payload: WorkshopMemoryWriteResultPayload }> = [];
  const post = async (value: unknown) => { posted.push(value as (typeof posted)[number]); };
  const memoryHandler = new WorkshopProjectMemoryHandler(room.session, library, {
    isRoomRunActive: () => false,
    isSessionOperationPending: () => room.coordinator.isSessionOperationPending(),
    waitForSessionOperations: () => room.coordinator.waitForSessionOperations(),
    liveSessionId: () => {
      const scope = room.coordinator.recallScope();
      return scope.available ? scope.liveSessionId : undefined;
    }
  }, { postSessionState: () => undefined, markDirty: () => undefined, reportError: jest.fn() }, post, room.log);
  const handler = new WorkshopSavedTurnMemoryHandler(recall, memoryHandler, room.session, post, room.log, jest.fn());
  const save = (turnId: string) => handler.handleSaveSavedTurn({
    type: MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY,
    source: 'webview.workshop',
    timestamp: 1,
    payload: {
      requestId: 'save-1',
      sessionId: 'saved-source',
      turnId,
      draft: { title: 'The Rabbit', kind: 'canon', summary: 'The Rabbit has a watch.', body: '', supersedes: [], pinned: false }
    }
  });
  const receipts = () => room.session.readRoomLedger().filter((turn) => turn.projectMemoryReceipt);
  const memories = async () => {
    const listing = await memoryStore.list();
    return listing.kind === 'listed' ? listing.memories.map((entry) => entry.memory) : [];
  };
  return { ...room, recall, posted, save, reply, capability, marker, receipts, memories };
}

describe('Remember this from a saved session (PR #219 F-01): eligibility is the original turn\'s', () => {
  it('saves a bookmarked capability card, whose projection is an event', async () => {
    const r = await setup();
    expect(isWorkshopBookmarkableTurn(r.capability)).toBe(true);
    const read = await r.recall.savedTurn('saved-source', r.capability.id);
    expect(read).toMatchObject({ kind: 'turn', bookmarkable: true, entry: { kind: 'event' } });

    await r.save(r.capability.id);
    expect(r.posted.at(-1)!.payload).toMatchObject({ requestId: 'save-1', ok: true });
    expect(await r.memories()).toEqual([expect.objectContaining({ sourceSession: 'saved-source', sourceTurns: [r.capability.id] })]);
    expect(r.receipts()).toHaveLength(1);
  });

  it('the screen offers it: the row carries the safe projected summary and is rememberable', async () => {
    const r = await setup();
    const page = await r.recall.bookmarkPage({});
    if (!('sessions' in page)) {
      throw new Error('expected a page');
    }
    const [row] = workshopBookmarkBrowserPage(page).sessions.find((session) => session.sessionId === 'saved-source')!.bookmarks;
    expect(row).toMatchObject({ turnId: r.capability.id, rememberable: true, message: { kind: 'event' } });
    // The row is the projection's: the card's private evidence never reaches it.
    expect(JSON.stringify(row)).not.toContain('evidence');
  });

  it('still refuses a session marker, with nothing written', async () => {
    const r = await setup();
    expect(isWorkshopBookmarkableTurn(r.marker)).toBe(false);
    expect(await r.recall.savedTurn('saved-source', r.marker.id)).toMatchObject({ kind: 'turn', bookmarkable: false });

    await r.save(r.marker.id);
    expect(r.posted.at(-1)!.payload).toMatchObject({ ok: false, error: 'That message can\'t be saved to memory.' });
    expect(await r.memories()).toEqual([]);
    expect(r.receipts()).toEqual([]);
  });
});

describe('Remember this from a saved session (PR #219 F-02): the save belongs to the room it was asked in', () => {
  it.each(['reopen', 'rewind'] as const)('refuses, writing nothing, after a same-id %s while the source is read', async (operation) => {
    const r = await setup();
    const before = r.session.readRoomRevision();
    const hold = holdOnce(r.store as never, 'readNamed', (id: string) => id === 'saved-source');
    const pending = r.save(r.reply.id);
    await hold.arrived;
    if (operation === 'reopen') {
      await r.coordinator.openNamed('live-room');
    } else {
      await r.coordinator.rewindTo({ kind: 'afterTurn', turnId: r.reply.id }, { origin: 'writer' });
    }
    expect(r.session.readRoomRevision()).not.toBe(before);
    expect(r.coordinator.recallScope()).toMatchObject({ liveSessionId: 'live-room' });
    hold.release();
    await pending;

    expect(r.posted.at(-1)!.payload).toEqual({ requestId: 'save-1', ok: false, error: WORKSHOP_MEMORY_ROOM_CHANGED });
    expect(await r.memories()).toEqual([]);
    expect(r.receipts()).toEqual([]);
  });

  it('control: refuses when the saved source becomes the live room during the read', async () => {
    const r = await setup();
    const hold = holdOnce(r.store as never, 'readNamed', (id: string) => id === 'saved-source');
    const pending = r.save(r.reply.id);
    await hold.arrived;
    await r.coordinator.openNamed('saved-source');
    hold.release();
    await pending;
    expect(r.posted.at(-1)!.payload).toMatchObject({ ok: false });
    expect(await r.memories()).toEqual([]);
    expect(r.receipts()).toEqual([]);
  });

  it('control: with the room unchanged it saves, and its receipt is that room\'s', async () => {
    const r = await setup();
    const before = r.session.readRoomRevision();
    await r.save(r.reply.id);
    expect(r.posted.at(-1)!.payload).toMatchObject({ ok: true });
    expect(r.posted.at(-1)!.payload).not.toHaveProperty('error');
    expect(r.receipts()).toHaveLength(1);
    expect(r.session.readRoomRevision()).toBe(before);
  });
});
