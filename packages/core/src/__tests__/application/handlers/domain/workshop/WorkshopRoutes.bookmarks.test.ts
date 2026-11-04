/**
 * The bookmark routes (ADR 2026-11-03 D5) through the real router, the real
 * slice composition and the real session: a set, a clear and a rename reach
 * the ledger, inside the session-operation gate, and post the room's
 * snapshot. A refusal changes nothing and logs no content. Every snapshot the
 * webview hears carries the display summary only, never the stored entry.
 */

import { MessageType, WorkshopBookmarkSummary } from '@messages';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

const SUMMARY_KEYS = ['id', 'inWindow', 'label', 'participant', 'personaId', 'toolId', 'turnId'];

const roomWithReply = async () => {
  const harness = createWorkshopRouteTestHarness();
  await harness.pin();
  await harness.router.route(message(
    MessageType.WORKSHOP_SEND_MESSAGE,
    { text: 'Look at the lantern beat.' }
  ) as never);
  harness.session.recordSessionMarker('resume', 'Session resumed Tuesday after 49h');
  const turns = harness.session.readRoomLedger();
  const writer = turns.find((turn) => turn.participant === 'writer' && turn.kind === 'message')!;
  const reply = turns.find((turn) => turn.participant === 'host')!;
  const divider = turns.find((turn) => turn.kind === 'divider')!;
  harness.postMessage.mockClear();
  (harness.log.appendLine as jest.Mock).mockClear();
  harness.persistence.markDirty.mockClear();
  return { ...harness, writer, reply, divider };
};

type Harness = Awaited<ReturnType<typeof roomWithReply>>;

const setBookmark = (harness: Harness, turnId: unknown, bookmarked: unknown = true) =>
  harness.router.route(message(MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId, bookmarked }) as never);

const rename = (harness: Harness, bookmarkId: unknown, label: unknown) =>
  harness.router.route(message(MessageType.WORKSHOP_RENAME_BOOKMARK, { bookmarkId, label }) as never);

const lastBookmarks = (harness: Harness): WorkshopBookmarkSummary[] =>
  harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload.session.bookmarks;

const logLines = (harness: Harness): string =>
  (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).join('\n');

const errors = (harness: Harness) => harness.posted(MessageType.ERROR).map((entry) => entry.payload);

describe('Workshop bookmark routes', () => {
  it('registers both routes', async () => {
    const { router } = await roomWithReply();

    expect(router.hasHandler(MessageType.WORKSHOP_SET_TURN_BOOKMARK)).toBe(true);
    expect(router.hasHandler(MessageType.WORKSHOP_RENAME_BOOKMARK)).toBe(true);
  });

  it('sets a bookmark, marks the room dirty, and posts the snapshot with its summary', async () => {
    const harness = await roomWithReply();

    await setBookmark(harness, harness.reply.id);

    expect(lastBookmarks(harness)).toEqual([{
      id: expect.stringMatching(/^bookmark-1-/),
      turnId: harness.reply.id,
      label: expect.stringMatching(/^Jill · /),
      participant: 'host',
      personaId: 'jill',
      inWindow: true
    }]);
    expect(harness.persistence.markDirty).toHaveBeenCalledWith('bookmark committed');
    expect(logLines(harness)).toContain(`Bookmark set set (turnId=${harness.reply.id}, source=webview.workshop)`);
  });

  it('posts again but saves nothing when a set changes nothing', async () => {
    const harness = await roomWithReply();
    await setBookmark(harness, harness.reply.id);
    harness.persistence.markDirty.mockClear();
    harness.postMessage.mockClear();

    await setBookmark(harness, harness.reply.id);

    expect(harness.persistence.markDirty).not.toHaveBeenCalled();
    expect(lastBookmarks(harness)).toHaveLength(1);
  });

  it('clears a bookmark', async () => {
    const harness = await roomWithReply();
    await setBookmark(harness, harness.reply.id);
    await setBookmark(harness, harness.writer.id);

    await setBookmark(harness, harness.reply.id, false);

    expect(lastBookmarks(harness).map((bookmark) => bookmark.turnId)).toEqual([harness.writer.id]);
    expect(harness.session.exportCommittedState().bookmarks?.map((bookmark) => bookmark.turnId))
      .toEqual([harness.writer.id]);
  });

  it('renames a bookmark and restores its default, never logging the label', async () => {
    const harness = await roomWithReply();
    await setBookmark(harness, harness.reply.id);
    const [bookmark] = lastBookmarks(harness);

    await rename(harness, bookmark.id, '  The late lantern  ');
    expect(lastBookmarks(harness)[0].label).toBe('The late lantern');

    await rename(harness, bookmark.id, null);
    expect(lastBookmarks(harness)[0].label).toBe(bookmark.label);
    expect(logLines(harness)).not.toContain('late lantern');
    expect(logLines(harness)).toContain(`Bookmark rename set (bookmarkId=${bookmark.id}, label=named`);
  });

  it('refuses a divider and logs the refusal without content, changing nothing', async () => {
    const harness = await roomWithReply();
    const before = harness.session.exportCommittedState();

    await setBookmark(harness, harness.divider.id);

    expect(harness.session.exportCommittedState()).toEqual(before);
    expect(harness.persistence.markDirty).not.toHaveBeenCalled();
    expect(errors(harness)).toEqual([expect.objectContaining({
      source: 'workshop.bookmark',
      message: 'Only replies, your messages, reports and capability cards can be bookmarked.'
    })]);
    const lines = logLines(harness);
    expect(lines).toContain(`Bookmark set refused (turnId=${harness.divider.id}, reason=ineligible-turn`);
    expect(lines).not.toContain(harness.divider.content);
    expect(lines).not.toContain('lantern beat');
  });

  it('refuses an unknown turn, an unknown bookmark and a bad label', async () => {
    const harness = await roomWithReply();
    await setBookmark(harness, harness.reply.id);
    const [bookmark] = lastBookmarks(harness);
    harness.persistence.markDirty.mockClear();

    await setBookmark(harness, 'turn-404-assistant-1');
    await rename(harness, 'bookmark-404-1', 'Name');
    await rename(harness, bookmark.id, 'two\nlines');
    await rename(harness, bookmark.id, 'x'.repeat(81));

    expect(errors(harness).map((error) => error.message)).toEqual([
      'That message is no longer in this session.',
      'That bookmark is no longer in this session.',
      "A bookmark's name is one line, with no tabs or line breaks.",
      "A bookmark's name is at most 80 characters."
    ]);
    expect(harness.persistence.markDirty).not.toHaveBeenCalled();
    expect(harness.session.getSnapshot().bookmarks).toEqual([bookmark]);
  });

  it.each<[string, MessageType, unknown]>([
    ['a set without a turn', MessageType.WORKSHOP_SET_TURN_BOOKMARK, { bookmarked: true }],
    ['a set with an empty turn', MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId: '', bookmarked: true }],
    ['a set without a boolean', MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId: 'turn-1', bookmarked: 'yes' }],
    ['a rename without an id', MessageType.WORKSHOP_RENAME_BOOKMARK, { label: 'Name' }],
    ['a rename with a numeric label', MessageType.WORKSHOP_RENAME_BOOKMARK, { bookmarkId: 'bookmark-1-1', label: 7 }],
    ['a rename with no label at all', MessageType.WORKSHOP_RENAME_BOOKMARK, { bookmarkId: 'bookmark-1-1' }],
    ['a missing payload', MessageType.WORKSHOP_SET_TURN_BOOKMARK, undefined]
  ])('refuses %s as malformed', async (_label, type, payload) => {
    const harness = await roomWithReply();

    await harness.router.route(message(type, payload) as never);

    expect(errors(harness)).toHaveLength(1);
    expect(harness.session.getSnapshot().bookmarks).toEqual([]);
    expect(harness.persistence.markDirty).not.toHaveBeenCalled();
  });

  it('waits behind the session-operation gate: nothing reaches the ledger while a replacement is pending', async () => {
    const harness = await roomWithReply();
    await setBookmark(harness, harness.writer.id);
    const [bookmark] = lastBookmarks(harness);
    harness.persistence.isSessionOperationPending.mockReturnValue(true);
    harness.persistence.markDirty.mockClear();

    await setBookmark(harness, harness.reply.id);
    await setBookmark(harness, harness.writer.id, false);
    await rename(harness, bookmark.id, 'Blocked');

    expect(harness.session.getSnapshot().bookmarks).toEqual([bookmark]);
    expect(harness.persistence.markDirty).not.toHaveBeenCalled();
    expect(errors(harness).map((error) => error.message)).toEqual(Array(3).fill(
      'Wait for the current session save or replacement to finish before changing the room.'
    ));
  });

  it('sends only display summaries on every snapshot path, never the stored entry', async () => {
    const harness = await roomWithReply();
    await setBookmark(harness, harness.reply.id);
    await rename(harness, lastBookmarks(harness)[0].id, 'Named');
    await harness.router.route(message(MessageType.WORKSHOP_REQUEST_SESSION, {}) as never);
    await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Again.' }) as never);
    await harness.router.route(message(MessageType.WORKSHOP_RESET_SESSION, {}) as never);

    const snapshots = harness.posted(MessageType.WORKSHOP_SESSION_STATE)
      .map((entry) => entry.payload.session);
    expect(snapshots.length).toBeGreaterThan(3);
    for (const snapshot of snapshots) {
      for (const summary of snapshot.bookmarks as Array<Record<string, unknown>>) {
        expect(Object.keys(summary).every((key) => SUMMARY_KEYS.includes(key))).toBe(true);
        expect(summary).not.toHaveProperty('createdAt');
      }
    }
    expect(snapshots.some((snapshot) => snapshot.bookmarks.length === 1)).toBe(true);
    // New clears them.
    expect(snapshots.at(-1).bookmarks).toEqual([]);
  });

  describe('turn preview (ADR 2026-11-03 D6)', () => {
    const requestPreview = (harness: Harness, payload: unknown) =>
      harness.router.route(message(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW, payload) as never);
    const previews = (harness: Harness) => harness.posted(MessageType.WORKSHOP_TURN_PREVIEW).map((entry) => entry.payload);

    it('registers the read directly, outside the mutation gate', async () => {
      const harness = await roomWithReply();

      expect(harness.router.hasHandler(MessageType.WORKSHOP_REQUEST_TURN_PREVIEW)).toBe(true);
    });

    it('answers with the projected turn under the echoed id and touches no session state', async () => {
      const harness = await roomWithReply();
      await setBookmark(harness, harness.reply.id);
      const before = harness.session.exportCommittedState();
      harness.postMessage.mockClear();
      harness.persistence.markDirty.mockClear();

      await requestPreview(harness, { requestId: 'ws-preview-a-1', turnId: harness.reply.id });

      expect(previews(harness)).toEqual([{
        requestId: 'ws-preview-a-1',
        turnId: harness.reply.id,
        turn: {
          kind: 'reply',
          speaker: 'Jill',
          content: harness.reply.content,
          timestamp: harness.reply.timestamp
        }
      }]);
      expect(harness.session.exportCommittedState()).toEqual(before);
      expect(harness.persistence.markDirty).not.toHaveBeenCalled();
      expect(harness.posted(MessageType.WORKSHOP_SESSION_STATE)).toEqual([]);
      expect(logLines(harness)).toContain(`Turn preview sent (turnId=${harness.reply.id})`);
      expect(logLines(harness)).not.toContain(harness.reply.content);
    });

    it('answers a writer message as the thread names it', async () => {
      const harness = await roomWithReply();

      await requestPreview(harness, { requestId: 'r-1', turnId: harness.writer.id });

      expect(previews(harness)[0].turn).toEqual({
        kind: 'writer',
        speaker: 'You',
        content: 'Look at the lantern beat.',
        timestamp: harness.writer.timestamp
      });
    });

    it('refuses an unknown turn with a reason that names no content', async () => {
      const harness = await roomWithReply();

      await requestPreview(harness, { requestId: 'r-2', turnId: 'turn-404-assistant-1' });

      expect(previews(harness)).toEqual([{
        requestId: 'r-2',
        turnId: 'turn-404-assistant-1',
        error: 'That message is no longer in this session.'
      }]);
      expect(logLines(harness)).toContain('Turn preview refused (turnId=turn-404-assistant-1, reason=unknown-turn)');
    });

    it('answers a malformed turn id under its request id, and reports a request with no id', async () => {
      const harness = await roomWithReply();

      await requestPreview(harness, { requestId: 'r-3', turnId: 7 });
      await requestPreview(harness, { turnId: harness.reply.id });
      await requestPreview(harness, { requestId: 'x'.repeat(129), turnId: harness.reply.id });

      expect(previews(harness)).toEqual([{ requestId: 'r-3', turnId: '', error: 'That message is no longer in this session.' }]);
      expect(errors(harness)).toEqual([
        expect.objectContaining({ source: 'workshop.bookmark', message: 'A turn preview must carry its request id' }),
        expect.objectContaining({ source: 'workshop.bookmark', message: 'A turn preview must carry its request id' })
      ]);
    });

    it('waits out a room replacement before reading, and never joins it', async () => {
      const harness = await roomWithReply();
      let release: () => void = () => undefined;
      harness.persistence.isSessionOperationPending.mockReturnValue(true);
      harness.persistence.waitForSessionOperations.mockReturnValue(new Promise<void>((resolve) => { release = resolve; }));

      const pending = requestPreview(harness, { requestId: 'r-4', turnId: harness.reply.id });
      await Promise.resolve();
      expect(previews(harness)).toEqual([]);
      expect(errors(harness)).toEqual([]);

      release();
      await pending;
      expect(previews(harness)).toEqual([expect.objectContaining({ requestId: 'r-4', turn: expect.any(Object) })]);
    });

    it('reads the turn from the full ledger, not the snapshot window', async () => {
      const harness = await roomWithReply();
      const ledgerSpy = jest.spyOn(harness.session, 'readRoomLedger');

      await requestPreview(harness, { requestId: 'r-5', turnId: harness.writer.id });

      expect(ledgerSpy).toHaveBeenCalled();
      expect(previews(harness)[0].turn).toBeDefined();
    });
  });
});
