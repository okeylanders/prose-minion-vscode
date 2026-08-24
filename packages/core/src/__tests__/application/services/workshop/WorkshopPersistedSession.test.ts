import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';

const persistedSession = (): WorkshopPersistedSessionV2 => {
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
    schemaVersion: 2,
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
  it('migrates the frozen released V1 pre-widget fixture to current V2 defaults', () => {
    const releasedV1 = require('../../../fixtures/workshop-session-v1-released.json') as unknown;

    const decoded = decodeWorkshopPersistedSessionCheckpoint(releasedV1);

    expect(decoded.migrations).toEqual(['v1-to-v2']);
    // Public schema migration and pre-release/current-checkpoint normalization
    // remain separately observable even when both apply during one read.
    expect(decoded.normalizations).toEqual(['inferred-missing-scope']);
    expect(decoded.session).toMatchObject({
      schemaVersion: 2,
      sessionId: 'released-v1-session',
      workshop: {
        counters: {
          widgetConfig: 0,
          standingDirective: 0
        },
        widgetConfigs: [],
        standingDirectives: [],
        threadArtifacts: []
      }
    });
    expect((releasedV1 as { schemaVersion: number }).schemaVersion).toBe(1);
    expect((releasedV1 as { workshop: Record<string, unknown> }).workshop)
      .not.toHaveProperty('widgetConfigs');
  });

  it('accepts only V2 at the strict current writer boundary', () => {
    const current = persistedSession();
    expect(parseWorkshopPersistedSession(current).schemaVersion).toBe(2);

    expect(() => parseWorkshopPersistedSession({ ...current, schemaVersion: 1 }))
      .toThrow('Unsupported Workshop session schema: 1');
  });

  it.each([0, 3])('rejects unsupported schema version %s', (schemaVersion) => {
    expect(() => decodeWorkshopPersistedSessionCheckpoint({
      ...persistedSession(),
      schemaVersion
    })).toThrow(`Unsupported Workshop session schema: ${schemaVersion}`);
  });

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

  it.each([
    ['widgetConfig', -1],
    ['widgetConfig', 0.5],
    ['widgetConfig', Number.MAX_SAFE_INTEGER + 1],
    ['standingDirective', -1],
    ['standingDirective', 0.5],
    ['standingDirective', Number.MAX_SAFE_INTEGER + 1]
  ] as const)('rejects an invalid %s counter value of %s', (counter, value) => {
    const source = persistedSession();
    source.workshop.counters[counter] = value;

    expect(() => parseWorkshopPersistedSession(source)).toThrow(
      new RegExp(`${counter === 'widgetConfig' ? 'widget-config' : 'standing-directive'} counter must be a non-negative safe integer`)
    );
  });

  it('accepts zero counters but rejects missing widget state from a claimed V2 file', () => {
    const zero = persistedSession();
    zero.workshop.counters.widgetConfig = 0;
    zero.workshop.counters.standingDirective = 0;
    expect(() => parseWorkshopPersistedSession(zero)).not.toThrow();

    const missing = persistedSession();
    delete missing.workshop.counters.widgetConfig;
    delete missing.workshop.counters.standingDirective;
    delete missing.workshop.widgetConfigs;
    delete missing.workshop.standingDirectives;
    delete missing.workshop.threadArtifacts;
    expect(() => parseWorkshopPersistedSession(missing))
      .toThrow('Workshop session schema V2 is missing persisted widget state.');
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

  it('drops undefined optional archive members before strict JSON persistence', () => {
    const source = persistedSession();
    source.conversations[0].contextSources = [{
      kind: 'resource',
      origin: 'host',
      label: 'chapters/one.md',
      configuredResource: undefined,
      sizeChars: 120,
      isEstimate: true,
      deliveredAt: 10
    }];

    const parsed = parseWorkshopPersistedSession(source);

    expect(parsed.conversations[0].contextSources[0]).not.toHaveProperty(
      'configuredResource'
    );
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
