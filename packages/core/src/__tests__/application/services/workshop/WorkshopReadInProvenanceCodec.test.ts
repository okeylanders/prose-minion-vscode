/**
 * Read-in provenance in the persisted session (ADR 2026-11-03 D4, D9): a
 * manifest row's `turnId`, `lineRange` and host-private `sourceFingerprint`
 * are additive and optional. A row carrying them round-trips; a malformed one
 * is refused; a row stored before Slice 3 reads and writes byte for byte as it
 * was, with nothing added. The fingerprint never reaches the webview's rows.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { hasSameWorkshopCheckpoint } from '@/application/services/workshop/WorkshopSessionCheckpointEquality';
import { cloneSourceEntry } from '@/application/services/workshop/WorkshopSessionRecords';
import {
  ConversationArchiveEntryV1,
  ConversationManager
} from '@orchestration/ConversationManager';
import type { StoredContextSourceEntry } from '@orchestration/ContextSourceRecord';

const FINGERPRINT = 'a'.repeat(64);

const fixtureText = (): string => JSON.stringify(
  require('../../../fixtures/workshop-session-v2-read-in-before-provenance.json')
);

const fixture = (): WorkshopPersistedSessionV2 => JSON.parse(fixtureText()) as WorkshopPersistedSessionV2;

/** Imports one archive entry into a fresh manager; undefined when the entry is refused. */
const imported = (entry: ConversationArchiveEntryV1) => {
  const manager = new ConversationManager();
  const [outcome] = manager.importConversations([{ entry, systemMessage: 'You are Jill.' }]);
  return outcome.status === 'imported' ? { manager, conversationId: outcome.conversationId } : undefined;
};

const withProvenance = (): WorkshopPersistedSessionV2 => {
  const session = fixture();
  const rows = session.conversations[0].contextSources as StoredContextSourceEntry[];
  rows[1].turnId = 'turn-3-assistant-1793632500000';
  rows[4].turnId = 'turn-7-assistant-1793632680000';
  rows[4].lineRange = { start: 1, end: 64 };
  rows[4].sourceFingerprint = FINGERPRINT;
  return session;
};

describe('Read-in provenance in the session codec', () => {
  describe('a session stored before Slice 3', () => {
    it('reads and saves byte for byte unchanged', () => {
      const text = fixtureText();

      const saved = parseWorkshopPersistedSession(JSON.parse(text));
      const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));

      expect(JSON.stringify(saved)).toBe(text);
      expect(JSON.stringify(reopened.session)).toBe(text);
      expect(reopened.migrations).toEqual([]);
      expect(reopened.normalizations).toEqual([]);
    });

    it('imports and exports its archive rows unchanged, with no provenance added', () => {
      const entry = fixture().conversations[0];
      const restored = imported(entry)!;

      const [exported] = restored.manager.exportConversations([
        { key: entry.key, conversationId: restored.conversationId }
      ]);

      expect(JSON.stringify(exported.contextSources)).toBe(JSON.stringify(entry.contextSources));
      for (const row of restored.manager.getContextSources(restored.conversationId)) {
        expect(row).not.toHaveProperty('turnId');
        expect(row).not.toHaveProperty('lineRange');
        expect(row).not.toHaveProperty('sourceFingerprint');
      }
    });
  });

  describe('a session carrying provenance', () => {
    it('round-trips every field through save, reopen, and the archive', () => {
      const session = withProvenance();
      const text = JSON.stringify(session);

      expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
      expect(JSON.stringify(decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text)).session)).toBe(text);

      const entry = session.conversations[0];
      const restored = imported(entry)!;
      const [exported] = restored.manager.exportConversations([
        { key: entry.key, conversationId: restored.conversationId }
      ]);
      expect(exported.contextSources).toEqual(entry.contextSources);
    });

    it('projects the rows for the webview without the fingerprint', () => {
      const entry = withProvenance().conversations[0];
      const restored = imported(entry)!;

      const rows = restored.manager.getContextSources(restored.conversationId);

      expect(rows[1]).toMatchObject({ kind: 'tool-evidence', turnId: 'turn-3-assistant-1793632500000' });
      expect(rows[4]).toMatchObject({
        kind: 'resource',
        turnId: 'turn-7-assistant-1793632680000',
        lineRange: { start: 1, end: 64 }
      });
      expect(rows.every((row) => !('sourceFingerprint' in row))).toBe(true);
      expect(JSON.stringify(rows)).not.toContain(FINGERPRINT);
    });

    it('treats a changed fingerprint as a different checkpoint', () => {
      const left = withProvenance();
      const right = withProvenance();
      (right.conversations[0].contextSources[4] as StoredContextSourceEntry).sourceFingerprint = 'b'.repeat(64);

      expect(hasSameWorkshopCheckpoint(left, withProvenance())).toBe(true);
      expect(hasSameWorkshopCheckpoint(left, right)).toBe(false);
    });
  });

  describe('malformed provenance on an archive row', () => {
    it.each<[string, Partial<Record<'turnId' | 'lineRange' | 'sourceFingerprint', unknown>>]>([
      ['an empty turn id', { turnId: '' }],
      ['a numeric turn id', { turnId: 7 }],
      ['a line range starting at zero', { lineRange: { start: 0, end: 4 } }],
      ['a reversed line range', { lineRange: { start: 9, end: 4 } }],
      ['a fractional line', { lineRange: { start: 1.5, end: 4 } }],
      ['a line range with an extra field', { lineRange: { start: 1, end: 4, total: 9 } }],
      ['a line range as a pair', { lineRange: [1, 4] }],
      ['a short fingerprint', { sourceFingerprint: 'a'.repeat(63) }],
      ['an upper-case fingerprint', { sourceFingerprint: 'A'.repeat(64) }],
      ['a non-hex fingerprint', { sourceFingerprint: 'g'.repeat(64) }]
    ])('refuses %s on import', (_label, fields) => {
      const entry = fixture().conversations[0];
      Object.assign(entry.contextSources[4], fields);

      expect(imported(entry)).toBeUndefined();
    });
  });

  describe('writer rows (assertContextSource)', () => {
    const writerRow = (extra: Record<string, unknown>) => {
      const session = fixture() as unknown as { workshop: { writerSources: { host: unknown[] } } };
      session.workshop.writerSources.host = [{
        kind: 'attachment',
        origin: 'writer',
        label: 'Rabbit notes',
        sizeChars: 120,
        isEstimate: true,
        deliveredAt: 1_793_632_440_000,
        ...extra
      }];
      return session;
    };

    it('accepts the display-safe keys when well formed', () => {
      const raw = writerRow({ turnId: 'turn-1', lineRange: { start: 2, end: 2 } });

      expect(parseWorkshopPersistedSession(raw).workshop.writerSources.host[0]).toMatchObject({
        turnId: 'turn-1',
        lineRange: { start: 2, end: 2 }
      });
    });

    it.each([
      [{ turnId: '' }, /writerSources\.host\[0\]\.turnId must be a non-empty string/],
      [{ lineRange: { start: 3, end: 1 } }, /writerSources\.host\[0\]\.lineRange must be positive integer lines/],
      // Only a fetched row in a conversation archive may carry the host-private
      // fingerprint; a writer row never does (PR #187 F-02).
      [{ sourceFingerprint: FINGERPRINT }, /writerSources\.host\[0\] contains unknown field sourceFingerprint/],
      [{ sourceFingerprint: 'abc' }, /writerSources\.host\[0\] contains unknown field sourceFingerprint/]
    ])('rejects %p on load and save', (extra, message) => {
      const raw = writerRow(extra);

      expect(() => parseWorkshopPersistedSession(raw)).toThrow(message);
      expect(() => decodeWorkshopPersistedSessionCheckpoint(raw)).toThrow(message);
    });

    it.each([
      ['a tool', (sources: Record<string, unknown>, row: unknown) => { sources.tools = { prose: [row] }; }, /writerSources\.tools\.prose\[0\] contains unknown field sourceFingerprint/],
      ['a guest', (sources: Record<string, unknown>, row: unknown) => { sources.guests = [{ personaId: 'margot', sources: [row] }]; }, /writerSources\.guests\[0\]\.sources\[0\] contains unknown field sourceFingerprint/]
    ])('refuses a fingerprint on %s writer row too', (_label, place, message) => {
      const raw = fixture() as unknown as { workshop: { writerSources: Record<string, unknown> } };
      place(raw.workshop.writerSources, {
        kind: 'attachment', origin: 'writer', label: 'Rabbit notes', sizeChars: 120, isEstimate: true,
        deliveredAt: 1_793_632_440_000, sourceFingerprint: FINGERPRINT
      });

      expect(() => parseWorkshopPersistedSession(raw)).toThrow(message);
    });

    it('clones a row deeply, so a later edit to the copy never reaches the original', () => {
      const original = {
        kind: 'resource' as const,
        origin: 'host' as const,
        label: 'characters/rabbit.md',
        configuredResource: { group: 'characters' as const, path: 'characters/rabbit.md' },
        sizeChars: 10,
        isEstimate: true,
        deliveredAt: 1,
        lineRange: { start: 1, end: 2 }
      };
      const copy = cloneSourceEntry(original);
      copy.lineRange!.end = 99;

      expect(original.lineRange.end).toBe(2);
      expect(cloneSourceEntry({ ...original, lineRange: undefined })).not.toHaveProperty('lineRange', expect.anything());
    });
  });
});
