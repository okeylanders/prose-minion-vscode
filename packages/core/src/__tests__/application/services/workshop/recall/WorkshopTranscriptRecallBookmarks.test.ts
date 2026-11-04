/**
 * Bookmarks never reach a persona (ADR 2026-11-03 D5, D10).
 *
 * Recall: a session saved with bookmarks, through the real aggregate,
 * coordinator and store, is recalled in every operation. Neither the
 * service's data nor the rendered text carries a bookmark's id, its label,
 * or a mark.
 *
 * Prompts: through the real router, handler and session, a room whose writer
 * bookmarked and named turns sends a host message, invites a guest (whose
 * catch-up is a room frame) and runs a tool. No request the assistant service
 * receives carries a bookmark.
 */

import { MessageType } from '@messages';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  renderWorkshopRecallCatalog,
  renderWorkshopRecallRead,
  renderWorkshopRecallSearch
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { renderWorkshopRecallTodos } from '@/application/services/workshop/recall/WorkshopRecallTodoList';
import { saveRecallRoom } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import {
  createWorkshopRouteTestHarness,
  message
} from '@/__tests__/application/handlers/domain/workshop/WorkshopRouteTestHarness';

const LABEL = 'BOOKMARK-LABEL-SENTINEL';
const NOW = Date.parse('2026-10-05T14:30:00.000Z');

describe('bookmarks never reach a persona', () => {
  it('session recall shows no bookmark, as data or as text', async () => {
    const bookmarkIds: string[] = [];
    const saved = await saveRecallRoom('Lighthouse keeper', (session, advance) => {
      session.setExcerpt({ text: 'The keeper climbs the stair.', source: { kind: 'manual' } });
      session.beginPersonaMessage('r-1', 'Why does the keeper climb?');
      advance(1_000);
      session.completeRun('r-1', 'Because the lamp is out.', undefined, false, 'host-conversation');
      const ledger = session.readRoomLedger();
      for (const turn of ledger.filter((candidate) => candidate.kind === 'message')) {
        session.setTurnBookmark(turn.id, true);
      }
      for (const bookmark of session.getSnapshot().bookmarks) {
        bookmarkIds.push(bookmark.id);
        session.renameBookmark(bookmark.id, LABEL);
      }
    });
    expect((await saved.store.readNamed(saved.savedSessionId))!.workshop.bookmarks).toHaveLength(2);

    const service = new WorkshopTranscriptRecallService(saved.store, saved.coordinator, saved.log);
    const catalog = await service.catalog({});
    const search = await service.search({ query: 'keeper' });
    // Words of the label, which is not in what recall reads, so nothing is found.
    const labelSearch = await service.search({ query: 'sentinel' });
    const read = await service.read({ sessions: [{ sessionId: saved.savedSessionId }] });
    const discussion = await service.read({ sessions: [{ sessionId: saved.savedSessionId }], detail: 'discussion' });
    const todos = await service.todos({ status: 'all' });

    const data = JSON.stringify([catalog, search, labelSearch, read, discussion, todos]);
    const text = [
      renderWorkshopRecallCatalog(catalog, { now: NOW }),
      renderWorkshopRecallSearch(search, { now: NOW }),
      renderWorkshopRecallSearch(labelSearch, { now: NOW }),
      renderWorkshopRecallRead(read, { now: NOW }).content,
      renderWorkshopRecallRead(discussion, { now: NOW }).content,
      renderWorkshopRecallTodos(todos, { now: NOW }).content
    ].join('\n');
    // The read did reach the turns the writer bookmarked.
    expect(text).toContain('Because the lamp is out.');
    expect(labelSearch.available && labelSearch.outcome === 'searched'
      ? labelSearch.search.matchedHits
      : undefined).toBe(0);
    for (const witness of [LABEL, ...bookmarkIds]) {
      expect(data).not.toContain(witness);
      expect(text).not.toContain(witness);
    }
    expect(data).not.toMatch(/bookmark/i);
    expect(text).not.toMatch(/bookmark/i);
  });

  it('no prompt, room frame or catch-up a persona or tool receives carries a bookmark', async () => {
    const harness = createWorkshopRouteTestHarness();
    await harness.pin();
    await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Open the room.' }) as never);
    const ids: string[] = [];
    for (const turn of harness.session.readRoomLedger().filter((candidate) => candidate.kind === 'message')) {
      await harness.router.route(message(MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId: turn.id, bookmarked: true }) as never);
    }
    for (const bookmark of harness.session.getSnapshot().bookmarks) {
      ids.push(bookmark.id);
      await harness.router.route(message(MessageType.WORKSHOP_RENAME_BOOKMARK, { bookmarkId: bookmark.id, label: LABEL }) as never);
    }
    expect(ids).toHaveLength(2);
    const calls = () => JSON.stringify([
      harness.service.continueConversation.mock.calls,
      harness.service.startWorkshopPersonaConversation.mock.calls,
      harness.service.startWorkshopGuestConversation.mock.calls,
      harness.service.analyzeProse.mock.calls
    ]);
    const before = calls().length;

    await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And now?' }) as never);
    await harness.router.route(message(
      MessageType.WORKSHOP_INVITE_GUEST,
      { personaId: 'margot', openingMessage: 'Join us.' }
    ) as never);
    await harness.runProse();

    const sent = calls();
    expect(sent.length).toBeGreaterThan(before);
    expect(harness.service.startWorkshopGuestConversation).toHaveBeenCalled();
    expect(sent).toContain('Open the room.');
    for (const witness of [LABEL, ...ids]) {
      expect(sent).not.toContain(witness);
    }
    expect(sent).not.toMatch(/bookmark/i);
  });
});
