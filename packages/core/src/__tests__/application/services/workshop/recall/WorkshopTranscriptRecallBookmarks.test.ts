/**
 * Bookmarks reach a persona only on request (ADR 2026-11-05 D1, D4, D7; PR
 * #214 F-01, F-05). This pins both halves of D1, rewriting Wayfinding's D10
 * pin, which kept bookmarks from personas entirely.
 *
 * Nothing automatic: through the real router, handler and session, a room
 * whose writer sets, renames and clears bookmarks sends every persona and
 * tool exactly what the same room without them sends. No frame, catch-up,
 * catalog frame or per-turn prompt changes.
 *
 * Requested evidence: saved-session catalogs, searches and to-dos still show
 * no bookmark; a read marks a bookmarked turn and `transcript.bookmarks`
 * lists them. A requested open-room result is retained and survives save
 * and reopen, and is published only as D7 allows: a result holding a turn
 * the room could not see never crosses to the host or another guest, before
 * or after reopening, while an all-public one is published.
 */

import { MessageType } from '@messages';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  renderWorkshopRecallCatalog,
  renderWorkshopRecallRead,
  renderWorkshopRecallSearch
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { renderWorkshopRecallTodos } from '@/application/services/workshop/recall/WorkshopRecallTodoList';
import { renderWorkshopRecallBookmarks } from '@/application/services/workshop/recall/WorkshopRecallBookmarkList';
import { workshopTurnAudience } from '@/application/services/workshop/WorkshopRoomAudience';
import { saveRecallRoom } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import { createRecallRunHarness, recallCall } from '@/__tests__/application/services/workshop/recall/workshopRecallRunHarness';
import {
  createWorkshopRouteTestHarness,
  message
} from '@/__tests__/application/handlers/domain/workshop/WorkshopRouteTestHarness';

const LABEL = 'BOOKMARK-LABEL-SENTINEL';
const PRIVATE = 'PRIVATE-BOOKMARK-SENTINEL';
const PUBLIC = 'PUBLIC-BOOKMARK-LABEL';
const NOW = Date.parse('2026-10-05T14:30:00.000Z');

describe('nothing about bookmarks reaches a persona of its own accord (D1, PR #214 F-01)', () => {
  /** One room's script; `mark` acts as the writer between steps. */
  const script = async (mark: (harness: ReturnType<typeof createWorkshopRouteTestHarness>) => Promise<void>) => {
    const harness = createWorkshopRouteTestHarness();
    await harness.pin();
    await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Open the room.' }) as never);
    await mark(harness);
    await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And now?' }) as never);
    await mark(harness);
    await harness.router.route(message(
      MessageType.WORKSHOP_INVITE_GUEST,
      { personaId: 'margot', openingMessage: 'Join us.' }
    ) as never);
    await mark(harness);
    await harness.runProse();
    return {
      harness,
      sent: JSON.stringify([
        harness.service.continueConversation.mock.calls,
        harness.service.startWorkshopPersonaConversation.mock.calls,
        harness.service.startWorkshopGuestConversation.mock.calls,
        harness.service.analyzeProse.mock.calls
      ])
    };
  };

  it('sends every persona and tool the same thing whether the writer sets, renames or clears bookmarks', async () => {
    const plain = await script(async () => undefined);
    const ids: string[] = [];
    const marked = await script(async (harness) => {
      for (const turn of harness.session.readRoomLedger().filter((candidate) => candidate.kind === 'message')) {
        const set = !harness.session.readBookmarkedTurnIds().has(turn.id);
        await harness.router.route(message(MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId: turn.id, bookmarked: set }) as never);
      }
      for (const bookmark of harness.session.getSnapshot().bookmarks) {
        ids.push(bookmark.id);
        await harness.router.route(message(MessageType.WORKSHOP_RENAME_BOOKMARK, { bookmarkId: bookmark.id, label: LABEL }) as never);
      }
    });

    expect(ids.length).toBeGreaterThan(0);
    expect(marked.harness.service.startWorkshopGuestConversation).toHaveBeenCalled();
    expect(marked.sent).toContain('Open the room.');
    expect(marked.sent).toBe(plain.sent);
    for (const witness of [LABEL, ...ids]) {
      expect(marked.sent).not.toContain(witness);
    }
    expect(marked.sent).not.toMatch(/bookmark/i);
  });
});

describe('a saved session’s bookmarks reach a persona only through a read’s marks and transcript.bookmarks', () => {
  it('shows none in a catalog, a search or the to-dos; marks them in a read; lists them on request', async () => {
    const bookmarkIds: string[] = [];
    const saved = await saveRecallRoom('Lighthouse keeper', (session, advance) => {
      session.setExcerpt({ text: 'The keeper climbs the stair.', source: { kind: 'manual' } });
      session.beginPersonaMessage('r-1', 'Why does the keeper climb?');
      advance(1_000);
      session.completeRun('r-1', 'Because the lamp is out.', undefined, false, 'host-conversation');
      for (const turn of session.readRoomLedger().filter((candidate) => candidate.kind === 'message')) {
        session.setTurnBookmark(turn.id, true);
      }
      for (const bookmark of session.getSnapshot().bookmarks) {
        bookmarkIds.push(bookmark.id);
        session.renameBookmark(bookmark.id, LABEL);
      }
    });
    const service = new WorkshopTranscriptRecallService(saved.store, saved.coordinator, saved.log);
    const catalog = await service.catalog({});
    const search = await service.search({ query: 'keeper' });
    // The label's words are not what search reads, so nothing is found.
    const labelSearch = await service.search({ query: 'sentinel' });
    const todos = await service.todos({ status: 'all' });
    const unasked = JSON.stringify([catalog, search, labelSearch, todos]) + [
      renderWorkshopRecallCatalog(catalog, { now: NOW }),
      renderWorkshopRecallSearch(search, { now: NOW }),
      renderWorkshopRecallSearch(labelSearch, { now: NOW }),
      renderWorkshopRecallTodos(todos, { now: NOW }).content
    ].join('\n');
    for (const witness of [LABEL, ...bookmarkIds]) {
      expect(unasked).not.toContain(witness);
    }
    expect(unasked).not.toMatch(/bookmark/i);

    const read = renderWorkshopRecallRead(await service.read({ sessions: [{ sessionId: saved.savedSessionId }] }), { now: NOW }).content;
    expect(read).toContain('Because the lamp is out.');
    expect(read.match(new RegExp(`bookmarked: "${LABEL}"`, 'g'))).toHaveLength(2);

    const listed = renderWorkshopRecallBookmarks(await service.bookmarks({ scope: 'saved' }), { now: NOW }).content;
    for (const id of bookmarkIds) {
      expect(listed).toContain(`${saved.savedSessionId}/${id}`);
    }
    expect(listed).toContain(LABEL);
  });
});

describe('a requested open-room result is ordinary evidence, published only as D7 allows (PR #214 F-05)', () => {
  let room: ReturnType<typeof createRecallRunHarness>;
  afterEach(() => room.dispose());

  it('keeps a result with a private row from the host and another guest, through commitment and reopen; publishes an all-public one', async () => {
    room = createRecallRunHarness();
    const { session, coordinator, delivery } = room;
    await coordinator.initialize();
    session.setSessionScope('open');
    // A public reply the writer bookmarks.
    const reply = await room.host('h-1', 'Where does the lighthouse scene go?', ['HOST-REPLY: the keeper rows out at dawn.']);
    session.setTurnBookmark(reply.id, true);
    session.renameBookmark(session.getSnapshot().bookmarks[0].id, PUBLIC);

    // Cliff joins and looks something up privately; mid-run the writer bookmarks that private card.
    await room.join('cliff', 'j-cliff', 'What do you make of the lighthouse?', [
      recallCall('transcript.catalog', '<match>lighthouse</match>'),
      () => {
        const card = session.readRoomLedger().find((turn) => turn.artifact === 'transcript_catalog')!;
        expect(workshopTurnAudience(card)).toEqual({ kind: 'private', principal: { kind: 'personaGuest', personaId: 'cliff' } });
        session.setTurnBookmark(card.id, true);
        const bookmark = session.getSnapshot().bookmarks.find((candidate) => candidate.turnId === card.id)!;
        session.renameBookmark(bookmark.id, PRIVATE);
        return recallCall('transcript.bookmarks', '<scope>current</scope>');
      },
      'GUEST-FINAL: the dawn image repeats.'
    ]);

    const cliffCard = () => session.readRoomLedger().find((turn) =>
      turn.artifact === 'transcript_bookmarks' && turn.capability!.invokedBy.kind === 'personaGuest')!;
    // Cliff saw both rows: the result is its own, retained, and never published.
    expect(cliffCard().content).toContain(PRIVATE);
    expect(cliffCard().content).toContain(PUBLIC);
    expect(cliffCard().capability!.metadata).toMatchObject({ publicationWithheld: 'open-room-private-turn' });
    expect(cliffCard().capability!.publishedWithTurnId).toBeUndefined();
    expect(workshopTurnAudience(cliffCard())).toEqual({ kind: 'private', principal: { kind: 'personaGuest', personaId: 'cliff' } });
    expect(room.log.appendLine).toHaveBeenCalledWith(expect.stringMatching(/withheld=open-room-private-turn bookmarks=bookmark-\d+-\d+/));

    const crossings = () => JSON.stringify([
      delivery.prepare({ kind: 'host' }),
      delivery.prepareJoinSnapshot({ kind: 'personaGuest', personaId: 'margot' }, 'none')
    ]);
    expect(crossings()).not.toContain(PRIVATE);

    // The host asks too: it could not see Cliff's card, so it gets the public row alone, published with its reply.
    const sentBefore = room.sent.length;
    await room.host('h-2', 'What did I bookmark?', [
      recallCall('transcript.bookmarks', '<scope>current</scope>'),
      'HOST-FINAL: you bookmarked the dawn crossing.'
    ]);
    const hostCard = session.readRoomLedger().find((turn) =>
      turn.artifact === 'transcript_bookmarks' && turn.capability!.invokedBy.kind === 'host')!;
    expect(hostCard.content).toContain(PUBLIC);
    expect(hostCard.content).not.toContain(PRIVATE);
    expect(hostCard.capability!.metadata).not.toHaveProperty('publicationWithheld');
    expect(hostCard.capability!.publishedWithTurnId).toBeDefined();
    expect(workshopTurnAudience(hostCard)).toEqual({ kind: 'room' });
    expect(room.sent.slice(sentBefore).join('\n')).not.toContain(PRIVATE);
    expect(crossings()).not.toContain(PRIVATE);

    // Saved and reopened, the record stands as it was.
    const saved = await coordinator.saveNamed('Bookmarked room');
    await coordinator.resetSession({ start: 'full-reset' });
    await coordinator.openNamed(saved.sessionId);
    expect(cliffCard().content).toContain(PRIVATE);
    expect(cliffCard().capability!.publishedWithTurnId).toBeUndefined();
    expect(cliffCard().capability!.metadata).toMatchObject({ publicationWithheld: 'open-room-private-turn' });
    expect(crossings()).not.toContain(PRIVATE);
    expect(JSON.stringify(delivery.prepare({ kind: 'host' }))).not.toContain(PRIVATE);
  });
});
