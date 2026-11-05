/**
 * PR #188 F-01: no accepted bookmark id may make the ledger mint one the codec
 * refuses. Both parts of `bookmark-<n>-<ms>` are canonical decimals from 1 to
 * `Number.MAX_SAFE_INTEGER`; anything else is an invalid session at parse.
 * Hydration installs only a safe counter, and a set that would pass the
 * largest safe integer is refused with no change, while the room still
 * saves. Everything runs through the real parser, checkpoint decode,
 * aggregate hydration, set and strict save, and the last case through the
 * real coordinator and store.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  parseWorkshopBookmarkId,
  WorkshopBookmarkLedger
} from '@/application/services/workshop/session/WorkshopBookmarkLedger';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR } from '@messages';
import { setupCoordinator } from './session/WorkshopCoordinatorHarness';

const WRITER = 'turn-2-user-1004';
const REPLY = 'turn-4-assistant-1008';
const REPORT = 'turn-6-assistant-1012';
const MAX = Number.MAX_SAFE_INTEGER;

const fixture = (): WorkshopPersistedSessionV2 =>
  JSON.parse(JSON.stringify(require('../../../fixtures/workshop-session-v2-before-bookmarks.json')));

const withIds = (...ids: string[]): WorkshopPersistedSessionV2 => {
  const session = fixture();
  const turns = [WRITER, REPLY];
  session.workshop.bookmarks = ids.map((id, index) => ({ id, turnId: turns[index], createdAt: 2_000 }));
  return session;
};

/** Parse, decode, hydrate: the path Open takes. */
const hydrated = (session: WorkshopPersistedSessionV2, now = 3_000) => {
  const decoded = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(JSON.stringify(session))).session;
  const room = new WorkshopSessionService(() => now);
  room.hydrateCommittedState(decoded.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
  return room;
};

/** The strict save path: what the store runs before every write. */
const strictSave = (room: WorkshopSessionService) =>
  parseWorkshopPersistedSession({ ...fixture(), workshop: room.exportCommittedState() });

describe('bookmark id bounds (PR #188 F-01)', () => {
  describe('the grammar', () => {
    it.each<[string, string]>([
      ['a 400-digit counter (Infinity)', `bookmark-${'9'.repeat(400)}-2000`],
      ['a counter of 10^21 (exponent notation)', 'bookmark-1000000000000000000000-2000'],
      ['a counter one past the largest safe integer', `bookmark-${MAX + 1}-2000`],
      ['a counter with a leading zero', 'bookmark-01-2000'],
      ['a zero counter', 'bookmark-0-2000'],
      ['a 400-digit time', `bookmark-1-${'9'.repeat(400)}`],
      ['a time of 10^21', 'bookmark-1-1000000000000000000000'],
      ['a time one past the largest safe integer', `bookmark-1-${MAX + 1}`],
      ['a time with a leading zero', 'bookmark-1-02000'],
      ['a zero time', 'bookmark-1-0'],
      ['a signed part', 'bookmark-+1-2000'],
      ['a fractional part', 'bookmark-1.5-2000']
    ])('refuses %s at parse, on open and on save', (_label, id) => {
      expect(parseWorkshopBookmarkId(id)).toBeUndefined();
      expect(() => decodeWorkshopPersistedSessionCheckpoint(withIds(id))).toThrow(/\.id must be a bookmark id/);
      expect(() => parseWorkshopPersistedSession(withIds(id))).toThrow(/\.id must be a bookmark id/);
    });

    it('accepts both parts at exactly the largest safe integer', () => {
      expect(parseWorkshopBookmarkId(`bookmark-${MAX}-${MAX}`)).toEqual({ counter: MAX, createdMs: MAX });
      expect(parseWorkshopPersistedSession(withIds(`bookmark-${MAX}-${MAX}`)).workshop.bookmarks).toHaveLength(1);
    });
  });

  it('resumes numbering past an ordinary id, and the room saves', () => {
    const room = hydrated(withIds('bookmark-41-2000'));

    expect(room.setTurnBookmark(REPORT, true)).toBe('set');
    expect(strictSave(room).workshop.bookmarks?.map((bookmark) => bookmark.id))
      .toEqual(['bookmark-41-2000', 'bookmark-42-3000']);
  });

  it('refuses the next set at the largest safe counter with no change, and the room still saves', () => {
    const room = hydrated(withIds(`bookmark-${MAX}-2000`));
    const before = room.exportCommittedState();

    expect(() => room.setTurnBookmark(REPORT, true)).toThrow(expect.objectContaining({ reason: 'ids-exhausted' }));
    expect(room.exportCommittedState()).toEqual(before);
    expect(strictSave(room).workshop.bookmarks).toEqual([{ id: `bookmark-${MAX}-2000`, turnId: WRITER, createdAt: 2_000 }]);
    // Clearing and renaming still work.
    expect(room.setTurnBookmark(WRITER, false)).toBe('cleared');
    expect(() => strictSave(room)).not.toThrow();
  });

  it('refuses a set whose clock would make an id the grammar refuses, with no change', () => {
    const room = hydrated(withIds('bookmark-1-2000'), 0);

    expect(() => room.setTurnBookmark(REPORT, true)).toThrow(expect.objectContaining({ reason: 'ids-exhausted' }));
    expect(room.getSnapshot().bookmarks).toHaveLength(1);
    expect(() => strictSave(room)).not.toThrow();
  });

  it('installs only a safe counter, even from ids behind the codec\'s back', () => {
    const ledger = new WorkshopBookmarkLedger(() => 3_000);
    ledger.installPreparedState(ledger.prepareState([
      { id: `bookmark-${'9'.repeat(400)}-2000`, turnId: WRITER, createdAt: 2_000 },
      { id: 'bookmark-1000000000000000000000-2000', turnId: REPLY, createdAt: 2_000 }
    ]));

    expect(ledger.exportState().counter).toBe(0);
  });

  it('after a bad checkpoint is refused, New and a clean Open in the same aggregate set and save normally', async () => {
    const harness = setupCoordinator();
    const clean = fixture();
    clean.sessionId = 'clean';
    await harness.store.saveNamed(clean);
    const bad = fixture();
    bad.sessionId = 'bad';
    await harness.store.saveNamed(bad);
    // An earlier build's accepted id, written behind the strict save.
    const badPath = await harness.store.resolveRevealPath('bad');
    const written = JSON.parse(new TextDecoder().decode(await harness.fs.readFile(badPath)));
    written.workshop.bookmarks = [{ id: `bookmark-${'9'.repeat(400)}-2000`, turnId: WRITER, createdAt: 2_000 }];
    await harness.fs.writeFile(badPath, new TextEncoder().encode(JSON.stringify(written)));
    await harness.coordinator.initialize();

    await expect(harness.coordinator.openNamed('bad')).rejects.toThrow();
    expect(harness.session.getSnapshot().bookmarks).toEqual([]);

    await harness.coordinator.resetSession({ start: 'carry' });
    harness.session.setExcerpt({ text: 'The first cup waits on the sill.', source: { kind: 'manual' } });
    const conversationId = harness.manager.startConversation('workshop_persona_jill', 'You are Jill.');
    harness.manager.addMessages(conversationId, [
      { role: 'user', content: 'Where is the cup?' },
      { role: 'assistant', content: 'On the sill.' }
    ]);
    harness.session.beginPersonaMessage('r-1', 'Where is the cup?');
    harness.session.completeRun('r-1', 'On the sill.', undefined, false, conversationId);
    const reply = harness.session.readRoomLedger().at(-1)!;
    expect(harness.session.setTurnBookmark(reply.id, true)).toBe('set');
    const fresh = await harness.coordinator.saveNamed('Fresh room');
    expect((await harness.store.readNamed(fresh.sessionId))!.workshop.bookmarks?.[0].id)
      .toMatch(/^bookmark-1-\d+$/);

    await harness.coordinator.openNamed('clean');
    expect(harness.session.setTurnBookmark(REPLY, true)).toBe('set');
    const reopened = await harness.coordinator.saveNamed('Clean, bookmarked');
    expect((await harness.store.readNamed(reopened.sessionId))!.workshop.bookmarks?.map((bookmark) => bookmark.id))
      .toEqual([expect.stringMatching(/^bookmark-2-\d+$/)]);
  });
});
