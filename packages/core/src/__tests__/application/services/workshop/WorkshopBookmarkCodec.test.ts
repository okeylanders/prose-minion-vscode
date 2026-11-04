/**
 * Bookmarks in the persisted session (ADR 2026-11-03 D5, D9): an optional,
 * additive key. A session saved before Slice 4 reads and saves byte for byte,
 * with nothing added. A session carrying bookmarks round-trips. A malformed
 * entry is refused. A bookmark whose turn is gone is dropped on open with a
 * named, logged checkpoint normalization, and refused by the strict save path.
 *
 * The fixture is a room recorded by the real aggregate (the scripted room):
 * a start divider, a writer message, a persona-run analysis card, the host's
 * reply, a direct tool run's request and report, and the host's synthesis.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';
import { hasSameWorkshopRecoveryContent } from '@/application/services/workshop/WorkshopSessionRecoveryEquality';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR } from '@messages';
import { setupCoordinator } from './session/WorkshopCoordinatorHarness';

const fixtureText = (): string => JSON.stringify(
  require('../../../fixtures/workshop-session-v2-before-bookmarks.json')
);
const fixture = (): WorkshopPersistedSessionV2 => JSON.parse(fixtureText()) as WorkshopPersistedSessionV2;

const START = 'turn-1-system-1001';
const WRITER = 'turn-2-user-1004';
const CARD = 'turn-3-assistant-1006';
const REPLY = 'turn-4-assistant-1008';
const TOOL_REQUEST = 'turn-5-user-1010';
const REPORT = 'turn-6-assistant-1012';

type RawBookmark = Record<string, unknown>;

const withBookmarks = (bookmarks: RawBookmark[]): WorkshopPersistedSessionV2 => {
  const session = fixture() as unknown as { workshop: Record<string, unknown> };
  session.workshop.bookmarks = bookmarks;
  return session as unknown as WorkshopPersistedSessionV2;
};

const SAVED: RawBookmark[] = [
  { id: 'bookmark-1-2000', turnId: WRITER, createdAt: 2_000 },
  { id: 'bookmark-2-2001', turnId: CARD, label: 'The continuity card', createdAt: 2_001 },
  { id: 'bookmark-3-2002', turnId: REPORT, createdAt: 2_002 }
];

/** The raw boundary and the strict save path both refuse it. */
const expectRefused = (session: unknown, message: RegExp) => {
  expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(JSON.stringify(session)))).toThrow(message);
  expect(() => parseWorkshopPersistedSession(JSON.parse(JSON.stringify(session)))).toThrow(message);
};

describe('bookmarks in the session codec', () => {
  describe('a session saved before Slice 4', () => {
    it('reads and saves byte for byte, with no bookmarks and no normalization', () => {
      const text = fixtureText();

      const saved = parseWorkshopPersistedSession(JSON.parse(text));
      const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));

      expect(text).not.toContain('"bookmarks"');
      expect(JSON.stringify(saved)).toBe(text);
      expect(JSON.stringify(reopened.session)).toBe(text);
      expect(reopened.migrations).toEqual([]);
      expect(reopened.normalizations).toEqual([]);
    });

    it('hydrates with no bookmarks and exports without the key', () => {
      const session = new WorkshopSessionService(() => 3_000);
      session.hydrateCommittedState(
        decodeWorkshopPersistedSessionCheckpoint(fixture()).session.workshop,
        { host: 'host-conversation' },
        DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
      );

      expect(session.getSnapshot().bookmarks).toEqual([]);
      expect(JSON.stringify(session.exportCommittedState())).not.toContain('"bookmarks"');
    });
  });

  describe('a session carrying bookmarks', () => {
    it('round-trips every entry through save and reopen', () => {
      const text = JSON.stringify(withBookmarks(SAVED));

      expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
      const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
      expect(JSON.stringify(reopened.session)).toBe(text);
      expect(reopened.normalizations).toEqual([]);
    });

    it('hydrates them, resolves labels, and writes them back as they were', () => {
      const decoded = decodeWorkshopPersistedSessionCheckpoint(withBookmarks(SAVED)).session;
      const session = new WorkshopSessionService(() => 3_000);
      session.hydrateCommittedState(decoded.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);

      expect(session.getSnapshot().bookmarks.map(({ turnId, label }) => ({ turnId, label }))).toEqual([
        { turnId: WRITER, label: 'You · Why does the jar matter?' },
        { turnId: CARD, label: 'The continuity card' },
        { turnId: REPORT, label: 'Prose · prose report.' }
      ]);
      expect(session.exportCommittedState().bookmarks).toEqual(SAVED);
    });

    it('reads an empty list as none', () => {
      const decoded = decodeWorkshopPersistedSessionCheckpoint(withBookmarks([])).session;
      const session = new WorkshopSessionService(() => 3_000);
      session.hydrateCommittedState(decoded.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);

      expect(JSON.stringify(session.exportCommittedState())).not.toContain('"bookmarks"');
    });

    it('is a different checkpoint, and different recovery content, when a bookmark changes', () => {
      const left = withBookmarks(SAVED);
      const renamed = withBookmarks([SAVED[0], { ...SAVED[1], label: 'Another name' }, SAVED[2]]);

      expect(hasSameWorkshopCheckpoint(left, withBookmarks(SAVED))).toBe(true);
      expect(hasSameWorkshopCheckpoint(left, renamed)).toBe(false);
      expect(hasSameWorkshopCheckpoint(left, fixture())).toBe(false);
      expect(hasSameWorkshopRecoveryContent(left, withBookmarks(SAVED))).toBe(true);
      expect(hasSameWorkshopRecoveryContent(left, renamed)).toBe(false);
      expect(hasSameWorkshopRecoveryContent(left, fixture())).toBe(false);
    });
  });

  describe('a malformed entry', () => {
    const entry = (fields: RawBookmark): RawBookmark[] => [{ ...SAVED[0], ...fields }];

    it.each<[string, unknown, RegExp]>([
      ['a list that is not an array', { 0: SAVED[0] }, /bookmarks must be array/],
      ['an unknown field', entry({ note: 'x' }), /unknown field note/],
      ['a missing createdAt', [{ id: 'bookmark-1-2000', turnId: WRITER }], /missing required field createdAt/],
      ['an id the ledger never mints', entry({ id: 'b-1' }), /\.id must be a bookmark id/],
      ['a numeric id', entry({ id: 1 }), /\.id must be a bookmark id/],
      ['an empty turn id', entry({ turnId: '' }), /\.turnId must be non-empty string/],
      ['a label with edge spaces', entry({ label: ' Late ' }), /\.label must be/],
      ['an empty label', entry({ label: '' }), /\.label must be/],
      ['a two-line label', entry({ label: 'two\nlines' }), /\.label must be/],
      ['a label past 80 characters', entry({ label: 'x'.repeat(81) }), /\.label must be/],
      ['a null label', entry({ label: null }), /\.label must be/],
      ['a negative createdAt', entry({ createdAt: -1 }), /\.createdAt must be/],
      ['a fractional createdAt', entry({ createdAt: 1.5 }), /\.createdAt must be/],
      ['a repeated id', [SAVED[0], { ...SAVED[2], id: SAVED[0].id }], /not already used/],
      ['two bookmarks on one turn', [SAVED[0], { ...SAVED[2], turnId: WRITER }], /a turn no other bookmark marks/],
      ['a bookmark on the start divider', entry({ turnId: START }), /cannot be bookmarked/],
      ['a bookmark on a tool-run request', entry({ turnId: TOOL_REQUEST }), /cannot be bookmarked/]
    ])('refuses %s', (_label, bookmarks, message) => {
      const session = fixture() as unknown as { workshop: Record<string, unknown> };
      session.workshop.bookmarks = bookmarks;
      expectRefused(session, message);
    });

    it('accepts a label exactly at the limit', () => {
      const session = withBookmarks(entry({ label: 'x'.repeat(80) }));
      expect(parseWorkshopPersistedSession(session).workshop.bookmarks?.[0].label).toHaveLength(80);
    });
  });

  describe('a bookmark whose turn is gone', () => {
    const dangling = () => withBookmarks([
      SAVED[0],
      { id: 'bookmark-4-2003', turnId: 'turn-99-assistant-9', createdAt: 2_003 },
      SAVED[2]
    ]);

    it('is dropped on open with a named normalization, keeping the rest', () => {
      const reopened = decodeWorkshopPersistedSessionCheckpoint(dangling());

      expect(reopened.normalizations).toEqual(['dropped-dangling-bookmarks']);
      expect(reopened.session.workshop.bookmarks).toEqual([SAVED[0], SAVED[2]]);
    });

    it('drops the key when it was the only one', () => {
      const reopened = decodeWorkshopPersistedSessionCheckpoint(withBookmarks([
        { id: 'bookmark-4-2003', turnId: 'turn-99-assistant-9', createdAt: 2_003 }
      ]));

      expect(reopened.normalizations).toEqual(['dropped-dangling-bookmarks']);
      expect(JSON.stringify(reopened.session)).not.toContain('"bookmarks"');
    });

    it('is refused by the strict save path', () => {
      expect(() => parseWorkshopPersistedSession(dangling())).toThrow(/references an unknown turn/);
    });

    it('is logged by name, without content, when the coordinator opens the session', async () => {
      const harness = setupCoordinator();
      const session = dangling();
      session.sessionId = 'dangling';
      session.workshop.bookmarks![0] = { ...session.workshop.bookmarks![0], label: 'Writer words' };
      // The store's save is strict, so the drift is written behind its back,
      // the way an earlier development build could have left it.
      await harness.store.saveNamed({ ...session, workshop: { ...session.workshop, bookmarks: undefined } });
      const filePath = await harness.store.resolveRevealPath('dangling');
      const saved = JSON.parse(new TextDecoder().decode(await harness.fs.readFile(filePath)));
      saved.workshop.bookmarks = session.workshop.bookmarks;
      await harness.fs.writeFile(filePath, new TextEncoder().encode(JSON.stringify(saved)));
      await harness.coordinator.initialize();
      await harness.coordinator.openNamed('dangling');

      const lines = (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
      expect(lines.some((line) => line.includes('dropped-dangling-bookmarks'))).toBe(true);
      expect(lines.join('\n')).not.toContain('Writer words');
      expect(lines.join('\n')).not.toContain('Why does the jar matter');
      expect(harness.session.getSnapshot().bookmarks.map((bookmark) => bookmark.turnId)).toEqual([WRITER, REPORT]);
    });
  });
});
