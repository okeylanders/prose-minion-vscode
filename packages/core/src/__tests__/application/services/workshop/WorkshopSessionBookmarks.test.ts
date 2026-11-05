/**
 * Bookmarks on the aggregate (ADR 2026-11-03 D5): the session checks which
 * turns may carry one, projects the summaries in thread order with the
 * snapshot's own window, prunes a bookmark whose provisional turn rolls back,
 * clears them on a fresh room, and writes the key only when it holds one.
 */

import {
  WORKSHOP_SNAPSHOT_TURN_WINDOW,
  WorkshopSessionService
} from '@/application/services/workshop/WorkshopSessionService';

const roomWithReplies = (exchanges: number) => {
  let now = 1_000;
  const session = new WorkshopSessionService(() => ++now);
  session.setExcerpt({ text: 'She lifted the lantern.', source: { kind: 'manual' } });
  for (let index = 0; index < exchanges; index += 1) {
    session.beginPersonaMessage(`request-${index}`, `Message ${index}`);
    session.completeRun(`request-${index}`, `Reply ${index}`, undefined, false, 'host-conversation');
  }
  return session;
};

describe('bookmarks on the Workshop session', () => {
  it('sets, renames and clears a bookmark on a reply and a writer message', () => {
    const session = roomWithReplies(1);
    const [writer, reply] = session.readRoomLedger().filter((turn) => turn.kind === 'message');

    expect(session.setTurnBookmark(reply.id, true)).toBe('set');
    expect(session.setTurnBookmark(writer.id, true)).toBe('set');
    const [first] = session.getSnapshot().bookmarks;
    expect(session.renameBookmark(first.id, 'My question')).toBe('set');

    expect(session.getSnapshot().bookmarks.map(({ turnId, label }) => ({ turnId, label }))).toEqual([
      { turnId: writer.id, label: 'My question' },
      { turnId: reply.id, label: 'Jill · Reply 0' }
    ]);
    expect(session.setTurnBookmark(reply.id, false)).toBe('cleared');
    expect(session.getSnapshot().bookmarks.map((bookmark) => bookmark.turnId)).toEqual([writer.id]);
  });

  it('refuses a divider, an excerpt revision, and an unknown turn, and changes nothing', () => {
    const session = roomWithReplies(1);
    const marker = session.recordSessionMarker('resume', 'Session resumed');
    const before = session.exportCommittedState();
    const dividers = session.readRoomLedger().filter((turn) => turn.kind === 'divider');
    expect(dividers.map((turn) => turn.id)).toContain(marker.id);

    for (const divider of dividers) {
      expect(() => session.setTurnBookmark(divider.id, true))
        .toThrow(expect.objectContaining({ reason: 'ineligible-turn' }));
    }
    expect(() => session.setTurnBookmark('turn-404-assistant-1', true))
      .toThrow(expect.objectContaining({ reason: 'unknown-turn' }));
    expect(session.getSnapshot().bookmarks).toEqual([]);
    expect(session.exportCommittedState()).toEqual(before);
  });

  it('lists every bookmark in thread order, marking those outside the window', () => {
    const session = roomWithReplies(WORKSHOP_SNAPSHOT_TURN_WINDOW / 2 + 5);
    const ledger = session.readRoomLedger();
    const firstReply = ledger.find((turn) => turn.role === 'assistant')!;
    const lastReply = ledger.at(-1)!;
    session.setTurnBookmark(lastReply.id, true);
    session.setTurnBookmark(firstReply.id, true);

    const snapshot = session.getSnapshot();
    const inWindow = new Set(snapshot.turns.map((turn) => turn.id));

    expect(snapshot.truncatedTurns).toBeGreaterThan(0);
    expect(snapshot.bookmarks.map((bookmark) => bookmark.turnId)).toEqual([firstReply.id, lastReply.id]);
    expect(snapshot.bookmarks.map((bookmark) => bookmark.inWindow)).toEqual([false, true]);
    for (const bookmark of snapshot.bookmarks) {
      expect(bookmark.inWindow).toBe(inWindow.has(bookmark.turnId));
    }
    expect(snapshot.bookmarks[0]).toEqual({
      id: expect.stringMatching(/^bookmark-2-/),
      turnId: firstReply.id,
      label: 'Jill · Reply 0',
      participant: 'host',
      personaId: 'jill',
      inWindow: false
    });
  });

  it('drops a bookmark on a writer turn that rolls back', () => {
    const session = roomWithReplies(0);
    const writer = session.beginPersonaMessage('request-x', 'Will this send?');
    session.setTurnBookmark(writer.id, true);
    expect(session.getSnapshot().bookmarks).toHaveLength(1);

    session.rollbackMessageRun('request-x');

    expect(session.getSnapshot().bookmarks).toEqual([]);
    expect(JSON.stringify(session.exportCommittedState())).not.toContain('"bookmarks"');
  });

  it('clears bookmarks on a fresh room', () => {
    const session = roomWithReplies(1);
    session.setTurnBookmark(session.readRoomLedger().at(-1)!.id, true);

    session.reset();

    expect(session.getSnapshot().bookmarks).toEqual([]);
    expect(session.readBookmarkedTurnIds().size).toBe(0);
  });

  it('writes the key only when the room holds a bookmark, and hydrates it back', () => {
    const session = roomWithReplies(1);
    expect(JSON.stringify(session.exportCommittedState())).not.toContain('"bookmarks"');

    const reply = session.readRoomLedger().at(-1)!;
    session.setTurnBookmark(reply.id, true);
    const state = session.exportCommittedState();
    expect(state.bookmarks).toEqual([{ id: expect.any(String), turnId: reply.id, createdAt: expect.any(Number) }]);

    const reopened = new WorkshopSessionService(() => 5_000);
    reopened.hydrateCommittedState(state, { host: 'host-conversation' }, session.getSnapshot().conversationBehavior);
    expect(reopened.getSnapshot().bookmarks.map((bookmark) => bookmark.turnId)).toEqual([reply.id]);
    expect(reopened.exportCommittedState().bookmarks).toEqual(state.bookmarks);
  });
});
