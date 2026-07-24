import {
  parseWorkshopPersistedSession,
  WorkshopPersistedSessionV1
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';

const persistedSession = (): WorkshopPersistedSessionV1 => {
  const workshop = new WorkshopSessionService(() => 1_000);
  workshop.setExcerpt({
    text: 'A defensive copy of the room.',
    source: { kind: 'manual' }
  });
  const temporal = new WorkshopSessionTimeService({
    now: () => new Date('2026-07-23T09:00:00.000Z'),
    timezone: 'America/Chicago'
  });
  return {
    schemaVersion: 1,
    sessionId: 'session-1',
    title: 'The room',
    createdAt: '2026-07-23T09:00:00Z',
    updatedAt: '2026-07-23T10:00:00Z',
    savedAt: '2026-07-23T10:05:00Z',
    temporal: temporal.exportState(),
    summary: {
      hostPersonaId: 'jill',
      participantPersonaIds: ['jill'],
      turnCount: 0,
      excerptWordCount: 6,
      preview: 'A defensive copy.'
    },
    workshop: workshop.exportCommittedState(),
    conversations: [{
      key: 'host',
      toolName: 'workshop_persona_jill',
      messages: [{ role: 'user', content: 'Remember the blue cup.' }],
      lastActivity: 1_000,
      contextSources: [],
      nextArtifactNumber: 2
    }]
  };
};

describe('parseWorkshopPersistedSession', () => {
  it('deep-validates and returns a normalized defensive clone', () => {
    const source = persistedSession();
    const parsed = parseWorkshopPersistedSession(source);

    expect(parsed).toEqual({
      ...source,
      createdAt: '2026-07-23T09:00:00.000Z',
      updatedAt: '2026-07-23T10:00:00.000Z',
      savedAt: '2026-07-23T10:05:00.000Z'
    });

    parsed.summary.participantPersonaIds.push('margot');
    parsed.workshop.excerpt!.text = 'Mutated product state.';
    parsed.temporal.personaNotices.push({
      conversationKey: 'host',
      notifiedAt: '2026-07-23T11:00:00.000Z'
    });
    parsed.conversations[0].messages[0].content = 'Mutated archive.';

    expect(source.summary.participantPersonaIds).toEqual(['jill']);
    expect(source.workshop.excerpt!.text).toBe('A defensive copy of the room.');
    expect(source.temporal.personaNotices).toEqual([]);
    expect(source.conversations[0].messages[0].content).toBe('Remember the blue cup.');
  });

  it('rejects malformed product and temporal state at the outer boundary', () => {
    const malformedProduct = persistedSession() as unknown as {
      workshop: { counters: { turn: unknown } };
    };
    malformedProduct.workshop.counters.turn = -1;
    expect(() => parseWorkshopPersistedSession(malformedProduct))
      .toThrow('turn counter must be a non-negative safe integer');

    const malformedTemporal = persistedSession() as unknown as {
      temporal: { timezone: unknown };
    };
    malformedTemporal.temporal.timezone = 'Middle Earth/Shire';
    expect(() => parseWorkshopPersistedSession(malformedTemporal))
      .toThrow('Invalid Workshop session timezone');
  });

  it('preserves malformed conversation entries for participant-local degradation', () => {
    const source = persistedSession() as unknown as {
      conversations: unknown[];
    };
    source.conversations = [
      null,
      {
        key: 'host',
        toolName: 'workshop_persona_jill',
        messages: 'not-an-array',
        futureDiagnostic: { retained: true }
      }
    ];

    const parsed = parseWorkshopPersistedSession(source);

    expect(parsed.conversations).toEqual(source.conversations);
    expect(parsed.conversations).not.toBe(source.conversations);
    expect(parsed.conversations[1]).not.toBe(source.conversations[1]);
  });

  it('rejects unknown envelope and summary extension fields', () => {
    const outer = persistedSession() as unknown as Record<string, unknown>;
    outer.extensions = { someday: true };
    expect(() => parseWorkshopPersistedSession(outer))
      .toThrow('Workshop session file contains unknown field extensions');

    const summary = persistedSession() as unknown as {
      summary: Record<string, unknown>;
    };
    summary.summary.extensionBag = {};
    expect(() => parseWorkshopPersistedSession(summary))
      .toThrow('Workshop session summary contains unknown field extensionBag');
  });
});
