import {
  decodeWorkshopPersistedSessionCheckpoint,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  parseWorkshopSessionStateV1,
  WorkshopConversationLogicalKey,
  WorkshopRetainedHistoryMarkV1,
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  validateWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1Integrity';
import {
  normalizeWorkshopSessionCheckpointForHydration
} from '@/application/services/workshop/WorkshopSessionCheckpointNormalization';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import { hasSameWorkshopRecoveryContent } from '@/application/services/workshop/WorkshopSessionRecoveryEquality';
import type {
  WorkshopImportedRetainedHistory
} from '@/application/services/workshop/session/WorkshopRetainedHistoryMarks';
import {
  ConversationArchiveEntryV1,
  ConversationManager
} from '@orchestration/ConversationManager';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR } from '@messages';
import { runCanonicalScriptedRoom, ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function persisted(room: ScriptedWorkshopRoom): WorkshopPersistedSessionV2 {
  const now = () => new Date('2026-09-30T12:00:00.000Z');
  const workshop = room.session.exportCommittedState();
  return clone({
    schemaVersion: 2,
    sessionId: 'scripted-room',
    title: 'Scripted room',
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
    temporal: new WorkshopSessionTimeService({ now }).exportState(),
    summary: {
      hostPersonaId: workshop.participants.host.personaId,
      participantPersonaIds: [workshop.participants.host.personaId],
      turnCount: workshop.turns.length,
      excerptWordCount: 0
    },
    workshop,
    conversations: room.archive()
  });
}

/** Open a decoded session the way the coordinator does: import, then hydrate. */
function open(session: WorkshopPersistedSessionV2) {
  const manager = new ConversationManager();
  const archive = session.conversations as ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[];
  const outcomes = manager.importConversations(
    archive.map((entry) => ({ entry, systemMessage: `${entry.toolName} system` }))
  );
  const bindings: Partial<Record<WorkshopConversationLogicalKey, string>> = {};
  const importedHistory: WorkshopImportedRetainedHistory = {};
  for (const outcome of outcomes) {
    if (outcome.status === 'imported') {
      bindings[outcome.key] = outcome.conversationId;
      const entry = archive.find((candidate) => candidate.key === outcome.key)!;
      importedHistory[outcome.key] = {
        messageCount: entry.messages.length,
        contextSourceCount: entry.contextSources.length
      };
    }
  }
  const live = new WorkshopSessionService(() => 5_000);
  const hydration = live.hydrateCommittedState(
    session.workshop,
    bindings,
    DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
    importedHistory
  );
  return { live, hydration, manager };
}

const marksOf = (state: WorkshopSessionStateV1): WorkshopRetainedHistoryMarkV1[] =>
  state.retainedHistoryMarks ?? [];

describe('retained-history mark persistence (ADR 2026-09-30 §3, §9)', () => {
  it('round-trips marks unchanged through save and open', () => {
    const room = runCanonicalScriptedRoom();
    const original = marksOf(room.session.exportCommittedState());
    expect(original.length).toBeGreaterThan(0);

    const decoded = decodeWorkshopPersistedSessionCheckpoint(persisted(room));
    expect(decoded.normalizations).toEqual([]);
    expect(marksOf(decoded.session.workshop)).toEqual(original);

    const { live, hydration } = open(decoded.session);
    expect(hydration.normalizations).toEqual([]);
    // Every live participant already had a mark: no baseline is invented.
    expect(marksOf(live.exportCommittedState())).toEqual(original);
  });

  it('opens a session saved before rewind support and records baselines at its head', () => {
    const room = runCanonicalScriptedRoom();
    const legacy = persisted(room);
    delete legacy.workshop.retainedHistoryMarks;

    const decoded = decodeWorkshopPersistedSessionCheckpoint(legacy);
    expect(decoded.normalizations).toEqual([]);
    const { live } = open(decoded.session);
    const state = live.exportCommittedState();
    const head = state.turns.at(-1)!.id;

    expect(marksOf(state)).toEqual(legacy.conversations.map((entry) => ({
      turnId: head,
      conversationKey: entry.key,
      messageCount: entry.messages.length,
      contextSourceCount: entry.contextSources.length,
      writerSourceCount: entry.key === 'host'
        ? state.writerSources.host.length
        : state.writerSources.guests.find((guest) => `guest:${guest.personaId}` === entry.key)!
          .sources.length,
      lastSeenRoomTurnId: entry.key === 'host'
        ? state.participants.host.lastSeenRoomTurnId
        : state.participants.personaGuests.find(
            (guest) => `guest:${guest.personaId}` === entry.key
          )!.lastSeenRoomTurnId,
      origin: 'baseline'
    })));
  });

  it.each([
    ['a mark claims more history than its archive holds', (session: WorkshopPersistedSessionV2) => {
      // The latest mark, so the key's own order stays valid and only the
      // archive can tell the claim is false.
      marksOf(session.workshop).filter((mark) => mark.conversationKey === 'host').at(-1)!
        .messageCount += 100;
    }],
    ['the archive grew past the latest mark (an unmarked commit)', (session: WorkshopPersistedSessionV2) => {
      const host = session.conversations.find((entry) => entry.key === 'host')!;
      host.messages.push({ role: 'user', content: 'Unmarked.' }, { role: 'assistant', content: 'Commit.' });
    }],
    ['the archive entry is missing', (session: WorkshopPersistedSessionV2) => {
      session.conversations = session.conversations.filter((entry) => entry.key !== 'host');
    }]
  ])('degrades rewindability, never the open, when %s', (_label, tamper) => {
    const room = runCanonicalScriptedRoom();
    const session = persisted(room);
    const guestMarks = marksOf(session.workshop)
      .filter((mark) => mark.conversationKey === 'guest:margot');
    tamper(session);

    const decoded = decodeWorkshopPersistedSessionCheckpoint(session);

    expect(decoded.normalizations).toEqual(['dropped-unverifiable-retained-history-marks']);
    expect(marksOf(decoded.session.workshop)).toEqual(guestMarks);
    const hostImported = session.conversations.some((entry) => entry.key === 'host');
    const { live } = open(decoded.session);
    // The host is re-baselined at the head from what was really imported.
    expect(marksOf(live.exportCommittedState()).filter((mark) => mark.conversationKey === 'host'))
      .toEqual(hostImported ? [expect.objectContaining({ origin: 'baseline' })] : []);
  });

  describe('grammar and integrity', () => {
    const scriptedState = (): WorkshopSessionStateV1 =>
      clone(runCanonicalScriptedRoom().session.exportCommittedState());

    it.each([
      ['an unknown field', (mark: Record<string, unknown>) => { mark.hash = 'abc'; }],
      ['a missing count', (mark: Record<string, unknown>) => { delete mark.messageCount; }],
      ['a non-numeric count', (mark: Record<string, unknown>) => { mark.contextSourceCount = '2'; }],
      ['an unknown origin', (mark: Record<string, unknown>) => { mark.origin = 'guess'; }]
    ])('refuses a malformed mark with %s, like any other malformed field', (_label, corrupt) => {
      const state = scriptedState() as unknown as { retainedHistoryMarks: Record<string, unknown>[] };
      corrupt(state.retainedHistoryMarks[0]);
      expect(() => parseWorkshopSessionStateV1(state)).toThrow(/retainedHistoryMarks/);
    });

    type Corruption = (marks: WorkshopRetainedHistoryMarkV1[]) => string;
    const hostMarks = (marks: WorkshopRetainedHistoryMarkV1[]) =>
      marks.filter((mark) => mark.conversationKey === 'host');
    it.each<[string, Corruption]>([
      ['an unknown turn', (marks) => {
        hostMarks(marks)[0].turnId = 'turn-999-assistant-1';
        return 'host';
      }],
      ['an odd message count', (marks) => {
        hostMarks(marks)[0].messageCount += 1;
        return 'host';
      }],
      ['a malformed key', (marks) => {
        hostMarks(marks)[0].conversationKey = 'tool:nonsense' as WorkshopConversationLogicalKey;
        return 'tool:nonsense';
      }],
      ['a shrinking history', (marks) => {
        hostMarks(marks).at(-1)!.messageCount = hostMarks(marks)[0].messageCount - 2;
        return 'host';
      }],
      ['a baseline after a commit', (marks) => {
        hostMarks(marks).at(-1)!.origin = 'baseline';
        return 'host';
      }],
      ['an offset beyond its own turn', (marks) => {
        hostMarks(marks)[0].lastSeenRoomTurnId = marks.at(-1)!.turnId;
        return 'host';
      }]
    ])('normalizes away a key whose marks carry %s, and strict integrity refuses it', (_label, corrupt) => {
      const state = scriptedState();
      const guestMarks = marksOf(state).filter((mark) => mark.conversationKey === 'guest:margot');
      const corruptedKey = corrupt(marksOf(state));

      expect(() => validateWorkshopSessionStateV1(state)).toThrow(/retained-history marks are inconsistent/);
      const normalized = normalizeWorkshopSessionCheckpointForHydration(
        parseWorkshopSessionStateV1(state)
      );

      expect(normalized.normalizations).toContain('dropped-inconsistent-retained-history-marks');
      expect(() => validateWorkshopSessionStateV1(normalized.state)).not.toThrow();
      expect(marksOf(normalized.state).filter((mark) => mark.conversationKey === corruptedKey))
        .toEqual([]);
      // A key is judged whole, and only the untrustworthy key pays.
      expect(marksOf(normalized.state).filter((mark) => mark.conversationKey === 'guest:margot'))
        .toEqual(guestMarks);
    });

    it('drops marks for a participant the state no longer retains', () => {
      const state = scriptedState();
      state.participants.personaGuests = state.participants.personaGuests.map((guest) => ({
        ...guest,
        liveness: 'disposed' as const,
        conversationKey: undefined
      }));
      state.participants.chatTarget = { kind: 'host' };

      const normalized = normalizeWorkshopSessionCheckpointForHydration(
        parseWorkshopSessionStateV1(state)
      );

      expect(normalized.normalizations).toContain('dropped-inconsistent-retained-history-marks');
      expect(marksOf(normalized.state).map((mark) => mark.conversationKey)).not.toContain('guest:margot');
    });
  });

  it('does not treat baselines recorded on open as unsaved local work', () => {
    const room = runCanonicalScriptedRoom();
    const legacy = persisted(room);
    delete legacy.workshop.retainedHistoryMarks;
    const { live } = open(decodeWorkshopPersistedSessionCheckpoint(legacy).session);
    const reopened: WorkshopPersistedSessionV2 = { ...legacy, workshop: clone(live.exportCommittedState()) };

    expect(marksOf(reopened.workshop).length).toBeGreaterThan(0);
    expect(hasSameWorkshopRecoveryContent(reopened, legacy)).toBe(true);
  });
});
