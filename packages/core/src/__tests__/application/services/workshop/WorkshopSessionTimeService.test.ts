import {
  WorkshopSessionTemporalStateV1,
  WorkshopSessionTimeService,
  workshopGuestConversationKey
} from '@/application/services/workshop/WorkshopSessionTimeService';

const instant = (value: string): Date => new Date(value);

describe('WorkshopSessionTimeService', () => {
  let now = instant('2026-07-23T14:00:00.000Z');
  beforeEach(() => {
    now = instant('2026-07-23T14:00:00.000Z');
  });

  const createService = (): WorkshopSessionTimeService =>
    new WorkshopSessionTimeService({
      now: () => now,
      timezone: 'America/Chicago'
    });

  it('announces session start on a persona first turn and waits an hour thereafter', () => {
    const service = createService();

    const first = service.prepareNotice('host');
    expect(first).toMatchObject({
      conversationKey: 'host',
      reason: 'session_start',
      observedAt: '2026-07-23T14:00:00.000Z'
    });
    expect(first?.frame).toContain('<workshop-time-context reason="session-start">');
    expect(first?.frame).toContain('Timezone: America/Chicago');
    service.commitNotice(first!);

    now = instant('2026-07-23T14:59:59.999Z');
    expect(service.prepareNotice('host')).toBeUndefined();

    now = instant('2026-07-23T15:00:00.000Z');
    expect(service.prepareNotice('host')).toMatchObject({ reason: 'hourly' });
  });

  it('does not consume a prepared notice until a successful turn commits it', () => {
    const service = createService();

    const abandoned = service.prepareNotice('host');
    expect(abandoned?.reason).toBe('session_start');

    now = instant('2026-07-23T14:05:00.000Z');
    expect(service.prepareNotice('host')).toMatchObject({
      reason: 'session_start',
      observedAt: '2026-07-23T14:05:00.000Z'
    });
  });

  it('queues a resume notice independently for every restored persona conversation', () => {
    const service = createService();
    const persisted: WorkshopSessionTemporalStateV1 = {
      schemaVersion: 1,
      startedAt: '2026-07-22T13:00:00.000Z',
      timezone: 'America/Chicago',
      lastActivityAt: '2026-07-22T15:00:00.000Z',
      personaNotices: [
        { conversationKey: 'host', notifiedAt: '2026-07-22T15:00:00.000Z' },
        {
          conversationKey: workshopGuestConversationKey('agnes'),
          notifiedAt: '2026-07-22T14:30:00.000Z'
        }
      ]
    };

    service.hydrate(persisted, ['host', workshopGuestConversationKey('agnes')]);

    expect(service.prepareNotice('host')).toMatchObject({ reason: 'session_resume' });
    expect(service.prepareNotice(workshopGuestConversationKey('agnes'))).toMatchObject({
      reason: 'session_resume'
    });
  });

  it('deep-copies exports and rejects invalid persisted keys and timestamps', () => {
    const service = createService();
    const first = service.prepareNotice('host')!;
    service.commitNotice(first);

    const exported = service.exportState();
    exported.personaNotices[0].notifiedAt = '2000-01-01T00:00:00.000Z';
    expect(service.exportState().personaNotices[0].notifiedAt)
      .toBe('2026-07-23T14:00:00.000Z');

    expect(() => service.hydrate({
      ...service.exportState(),
      startedAt: 'not-a-date'
    }, ['host'])).toThrow('startedAt');
    expect(() => service.hydrate({
      ...service.exportState(),
      personaNotices: [{ conversationKey: 'guest:not-real', notifiedAt: now.toISOString() }]
    }, ['host'])).toThrow('persona notice');
    expect(() => service.hydrate({
      ...service.exportState(),
      speculativeField: true
    }, ['host'])).toThrow('unknown field speculativeField');
    expect(() => service.hydrate({
      ...service.exportState(),
      personaNotices: [{
        conversationKey: 'host',
        notifiedAt: now.toISOString(),
        speculativeField: true
      }]
    }, ['host'])).toThrow('unknown field speculativeField');
  });

  it('round-trips queued resume delivery across an in-memory transaction rollback', () => {
    const service = createService();
    service.hydrate(service.exportState(), ['host', workshopGuestConversationKey('agnes')]);
    const rollback = service.exportRuntimeState();

    service.reset();
    expect(service.prepareNotice('host')).toMatchObject({ reason: 'session_start' });

    service.restoreRuntimeState(rollback);
    expect(service.prepareNotice('host')).toMatchObject({ reason: 'session_resume' });
    expect(service.prepareNotice(workshopGuestConversationKey('agnes')))
      .toMatchObject({ reason: 'session_resume' });
  });

  describe('notices end with their conversation (ADR 2026-09-30, Sprint 03 kickoff decision 2)', () => {
    const agnes = workshopGuestConversationKey('agnes');

    it('gives a fresh conversation under a forgotten key its own session-start frame', () => {
      const service = createService();
      service.commitNotice(service.prepareNotice('host')!);
      service.commitNotice(service.prepareNotice(agnes)!);
      now = instant('2026-07-23T14:10:00.000Z');
      expect(service.prepareNotice('host')).toBeUndefined();

      service.forgetNotices(['host']);

      expect(service.prepareNotice('host')).toMatchObject({ reason: 'session_start' });
      // A surviving conversation keeps its hour.
      expect(service.prepareNotice(agnes)).toBeUndefined();
      expect(service.exportState().personaNotices.map((notice) => notice.conversationKey))
        .toEqual([agnes]);
    });

    it('drops a forgotten key\'s pending resume notice too', () => {
      const service = createService();
      service.hydrate(service.exportState(), ['host', agnes]);

      service.forgetNotices([agnes]);

      expect(service.prepareNotice(agnes)).toMatchObject({ reason: 'session_start' });
      expect(service.prepareNotice('host')).toMatchObject({ reason: 'session_resume' });
      expect(service.exportRuntimeState().pendingResumeKeys).toEqual(['host']);
    });

    it('forgets every persona after a generation loss, keeping the session clock', () => {
      const service = createService();
      service.commitNotice(service.prepareNotice('host')!);
      service.hydrate(service.exportState(), [agnes]);
      const { startedAt, timezone } = service.exportState();

      service.forgetAllNotices();

      expect(service.exportRuntimeState()).toEqual({
        temporal: expect.objectContaining({ startedAt, timezone, personaNotices: [] }),
        pendingResumeKeys: []
      });
      expect(service.prepareNotice('host')).toMatchObject({ reason: 'session_start' });
      expect(service.prepareNotice(agnes)).toMatchObject({ reason: 'session_start' });
    });

    it('is undone by a transaction rollback', () => {
      const service = createService();
      service.commitNotice(service.prepareNotice('host')!);
      const rollback = service.exportRuntimeState();

      service.forgetNotices(['host']);
      service.restoreRuntimeState(rollback);

      expect(service.prepareNotice('host')).toBeUndefined();
      expect(service.exportRuntimeState()).toEqual(rollback);
    });
  });
});
