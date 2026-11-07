/**
 * Reactions in the persisted session (ADR 2026-11-07 D2): an optional,
 * additive key, with no `schemaVersion` bump. A session saved before Slice 1
 * reads and saves byte for byte. A session carrying reactions round-trips,
 * the persona author kinds and `viaTurnId` included, though nothing writes
 * those until Slice 3. A malformed entry is refused. A reaction whose turn is
 * gone is dropped on open with a named, logged normalization, and refused by
 * the strict save path.
 *
 * The fixture is a room recorded by the real aggregate: a start divider, a
 * writer message, a persona-run analysis card, the host's reply, a direct
 * tool run's request and report, and the host's synthesis.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { setupCoordinator } from './session/WorkshopCoordinatorHarness';

const fixtureText = (): string => JSON.stringify(
  require('../../../fixtures/workshop-session-v2-before-bookmarks.json')
);
const fixture = (): WorkshopPersistedSessionV2 => JSON.parse(fixtureText()) as WorkshopPersistedSessionV2;

const START = 'turn-1-system-1001';
const WRITER = 'turn-2-user-1004';
const CARD = 'turn-3-assistant-1006';
const REPLY = 'turn-4-assistant-1008';
const REPORT = 'turn-6-assistant-1012';
const SYNTHESIS = 'turn-7-assistant-1014';

type RawReaction = Record<string, unknown>;

const withReactions = (reactions: unknown): WorkshopPersistedSessionV2 => {
  const session = fixture() as unknown as { workshop: Record<string, unknown> };
  session.workshop.reactions = reactions;
  return session as unknown as WorkshopPersistedSessionV2;
};

const SAVED: RawReaction[] = [
  { turnId: REPLY, reaction: 'fire', author: { kind: 'writer' }, createdAt: 2_000 },
  { turnId: REPLY, reaction: 'heart', author: { kind: 'writer' }, createdAt: 2_001 },
  { turnId: SYNTHESIS, reaction: 'thinking', author: { kind: 'writer' }, createdAt: 2_002 },
  // A persona's: written from Slice 3, read and validated now.
  { turnId: WRITER, reaction: 'mind-blown', author: { kind: 'host' }, viaTurnId: REPLY, createdAt: 2_003 }
];

const hydrate = (session: WorkshopPersistedSessionV2): WorkshopSessionService => {
  const service = new WorkshopSessionService(() => 3_000);
  service.hydrateCommittedState(
    decodeWorkshopPersistedSessionCheckpoint(session).session.workshop,
    { host: 'host-conversation' },
    DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
  );
  return service;
};

const expectRefused = (session: unknown, message: RegExp) => {
  expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(JSON.stringify(session)))).toThrow(message);
  expect(() => parseWorkshopPersistedSession(JSON.parse(JSON.stringify(session)))).toThrow(message);
};

describe('reactions in the session codec (ADR 2026-11-07 D2)', () => {
  it('reads and saves a session from before Slice 1 byte for byte, with no reactions key', () => {
    const text = fixtureText();
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));

    expect(text).not.toContain('"reactions"');
    expect(JSON.stringify(reopened.session)).toBe(text);
    expect(reopened.normalizations).toEqual([]);
    expect(hydrate(fixture()).getSnapshot().reactions).toEqual([]);
    expect(JSON.stringify(hydrate(fixture()).exportCommittedState())).not.toContain('"reactions"');
  });

  it('round-trips every entry, writer and persona alike, with the same schema version', () => {
    const text = JSON.stringify(withReactions(SAVED));

    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    expect(JSON.stringify(reopened.session)).toBe(text);
    expect(reopened.session.schemaVersion).toBe(fixture().schemaVersion);
    expect(reopened.normalizations).toEqual([]);
    expect(hydrate(withReactions(SAVED)).exportCommittedState().reactions).toEqual(SAVED);
  });

  it('shows them in the snapshot per turn, the writer\'s first, and names the persona', () => {
    const snapshot = hydrate(withReactions(SAVED)).getSnapshot();

    expect(snapshot.reactions).toEqual([
      { turnId: WRITER, reaction: 'mind-blown', author: { kind: 'host' }, label: 'Jill' },
      { turnId: REPLY, reaction: 'fire', author: { kind: 'writer' }, label: 'You' },
      { turnId: REPLY, reaction: 'heart', author: { kind: 'writer' }, label: 'You' },
      { turnId: SYNTHESIS, reaction: 'thinking', author: { kind: 'writer' }, label: 'You' }
    ]);
  });

  it('reads an empty list as none and writes no key', () => {
    expect(JSON.stringify(hydrate(withReactions([])).exportCommittedState())).not.toContain('"reactions"');
  });

  it('is a different checkpoint when a reaction changes', () => {
    expect(hasSameWorkshopCheckpoint(withReactions(SAVED), withReactions(SAVED))).toBe(true);
    expect(hasSameWorkshopCheckpoint(withReactions(SAVED), withReactions(SAVED.slice(1)))).toBe(false);
    expect(hasSameWorkshopCheckpoint(withReactions(SAVED), fixture())).toBe(false);
  });

  describe('a malformed entry', () => {
    const entry = (fields: RawReaction): RawReaction[] => [{ ...SAVED[0], ...fields }];
    const guest = { kind: 'personaGuest', personaId: 'margot' };

    it.each<[string, unknown, RegExp]>([
      ['a list that is not an array', { only: SAVED[0] }, /reactions must be an array of at most/],
      ['an unknown field', entry({ note: 'x' }), /unknown field note/],
      ['a minted id', entry({ id: 'reaction-1' }), /unknown field id/],
      ['a missing createdAt', [{ turnId: REPLY, reaction: 'fire', author: { kind: 'writer' } }], /missing required field createdAt/],
      ['an unknown reaction', entry({ reaction: 'clapping' }), /\.reaction must be a known Workshop reaction id/],
      ['a glyph for an id', entry({ reaction: '\u{1F525}' }), /\.reaction must be a known Workshop reaction id/],
      ['an unknown author kind', entry({ author: { kind: 'tool' } }), /\.author\.kind must be/],
      ['an author with an extra field', entry({ author: { kind: 'writer', name: 'Alice' } }), /unknown field name/],
      ['a writer with a persona id', entry({ author: { kind: 'writer', personaId: 'jill' } }), /\.author\.personaId must be absent/],
      ['a guest without a known persona', entry({ author: { kind: 'personaGuest', personaId: 'alice' }, viaTurnId: REPLY }), /\.author\.personaId must be a known/],
      ['a writer reaction with a viaTurnId', entry({ viaTurnId: REPLY }), /\.viaTurnId must be absent/],
      ['a persona reaction without a viaTurnId', entry({ turnId: WRITER, author: { kind: 'host' } }), /\.viaTurnId must be the non-empty id/],
      ['a negative createdAt', entry({ createdAt: -1 }), /\.createdAt must be/],
      ['an empty turn id', entry({ turnId: '' }), /\.turnId must be non-empty string/],
      ['the same reaction twice', [SAVED[0], { ...SAVED[0], createdAt: 2_009 }], /a reaction no other entry already gives/],
      ['the writer reacting to their own message', entry({ turnId: WRITER }), /cannot react to/],
      ['the writer reacting to a tool report', entry({ turnId: REPORT }), /cannot react to/],
      ['the writer reacting to a capability card', entry({ turnId: CARD }), /cannot react to/],
      ['the writer reacting to a divider', entry({ turnId: START }), /cannot react to/],
      ['a persona reacting to a reply', [{ ...SAVED[3], turnId: REPLY, viaTurnId: SYNTHESIS }], /cannot react to/],
      ['a persona reaction carried by another persona\'s reply', [{ ...SAVED[3], author: guest }], /does not name a later reply of its persona/],
      ['a persona reaction carried by a synthesis', [{ ...SAVED[3], viaTurnId: SYNTHESIS }], /does not name a later reply of its persona/],
      ['a persona reaction carried by the turn it is on', [{ ...SAVED[3], viaTurnId: WRITER }], /does not name a later reply of its persona/]
    ])('refuses %s', (_label, reactions, message) => {
      expectRefused(withReactions(reactions), message);
    });

    it('refuses a list past the session bound', () => {
      const many = Array.from({ length: PROMPT_BUDGETS.workshopReactions.perSession + 1 }, (_, index) => ({
        turnId: `turn-${index}`,
        reaction: 'fire',
        author: { kind: 'writer' },
        createdAt: index
      }));
      expectRefused(withReactions(many), /reactions must be an array of at most 5000 reactions/);
    });
  });

  describe('a reaction whose turn is gone', () => {
    const GONE = { turnId: 'turn-99-assistant-9', reaction: 'sad', author: { kind: 'writer' }, createdAt: 2_004 };
    const VIA_GONE = { ...SAVED[3], reaction: 'eyes', viaTurnId: 'turn-98-assistant-9' };

    it('is dropped on open with a named normalization, keeping the rest', () => {
      const reopened = decodeWorkshopPersistedSessionCheckpoint(withReactions([...SAVED, GONE, VIA_GONE]));

      expect(reopened.normalizations).toEqual(['dropped-dangling-reactions']);
      expect(reopened.session.workshop.reactions).toEqual(SAVED);
    });

    it('drops the key when it was the only one', () => {
      const reopened = decodeWorkshopPersistedSessionCheckpoint(withReactions([GONE]));

      expect(reopened.normalizations).toEqual(['dropped-dangling-reactions']);
      expect(JSON.stringify(reopened.session)).not.toContain('"reactions"');
    });

    it('is refused by the strict save path', () => {
      expect(() => parseWorkshopPersistedSession(withReactions([...SAVED, GONE]))).toThrow(/references an unknown turn/);
    });

    it('is logged by name, without content, when the coordinator opens the session', async () => {
      const harness = setupCoordinator();
      const session = withReactions([...SAVED, GONE]);
      session.sessionId = 'dangling';
      // The store's save is strict, so the drift is written behind its back.
      await harness.store.saveNamed({ ...session, workshop: { ...session.workshop, reactions: undefined } });
      const filePath = await harness.store.resolveRevealPath('dangling');
      const saved = JSON.parse(new TextDecoder().decode(await harness.fs.readFile(filePath)));
      saved.workshop.reactions = session.workshop.reactions;
      await harness.fs.writeFile(filePath, new TextEncoder().encode(JSON.stringify(saved)));
      await harness.coordinator.initialize();
      await harness.coordinator.openNamed('dangling');

      const lines = (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
      expect(lines.some((line) => line.includes('dropped-dangling-reactions'))).toBe(true);
      expect(lines.join('\n')).not.toContain('Why does the jar matter');
      expect(harness.session.readRoomReactions()).toEqual(SAVED);
    });
  });
});
