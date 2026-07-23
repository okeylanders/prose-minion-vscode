import { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopWriterProfileService } from '@/application/services/workshop/WorkshopWriterProfileService';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { LogSink, SettingsStore } from '@/platform';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  type WorkshopConversationBehavior,
  type WorkshopWriterProfile
} from '@messages';

const balanced: WorkshopConversationBehavior = {
  interactionMode: 'balanced',
  expressionLevel: 'full',
  relationalDepth: 'attuned',
  carryCuesThroughSession: true
};

const analysis: WorkshopConversationBehavior = {
  ...balanced,
  interactionMode: 'analysis',
  expressionLevel: 'subtle'
};

const conversational: WorkshopConversationBehavior = {
  ...balanced,
  interactionMode: 'conversational',
  expressionLevel: 'amplified'
};

describe('WorkshopConversationSettingsService', () => {
  let session: WorkshopSessionService;
  let configured: WorkshopConversationBehavior;
  let configuredProfile: WorkshopWriterProfile;
  let settings: jest.Mocked<SettingsStore>;
  let assistant: jest.Mocked<AssistantToolService>;
  let log: jest.Mocked<LogSink>;
  let service: WorkshopConversationSettingsService;

  beforeEach(() => {
    session = new WorkshopSessionService(() => 1, balanced);
    configured = analysis;
    configuredProfile = { ...DEFAULT_WORKSHOP_WRITER_PROFILE };
    settings = {
      get: jest.fn((_section: string, key: string) =>
        key === 'workshop.writerProfile' ? configuredProfile : configured
      ),
      update: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<SettingsStore>;
    assistant = {
      replaceWorkshopConversationSettings: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<AssistantToolService>;
    log = { appendLine: jest.fn() } as unknown as jest.Mocked<LogSink>;
    service = new WorkshopConversationSettingsService(
      session,
      assistant,
      settings,
      log,
      new WorkshopWriterProfileService(settings, log)
    );
  });

  it('applies an external setting to the live host and guests without writing it back', async () => {
    session.setExcerpt({ text: 'Excerpt', source: { kind: 'manual' } });
    session.beginPersonaMessage('host-open', 'Start.');
    session.completeRun('host-open', 'Ready.', undefined, false, 'host-conv');
    session.adoptPersonaGuest('margot', 'guest-conv');

    await expect(service.syncFromSettings()).resolves.toEqual({
      changed: true,
      deferred: false
    });

    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledWith(
      [
        { conversationId: 'host-conv', personaId: 'jill', role: 'host' },
        { conversationId: 'guest-conv', personaId: 'margot', role: 'guest' }
      ],
      analysis,
      DEFAULT_WORKSHOP_WRITER_PROFILE
    );
    expect(session.getConversationBehavior()).toEqual(analysis);
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('serializes duplicate handlers and rapid external edits in configuration order', async () => {
    session.setExcerpt({ text: 'Excerpt', source: { kind: 'manual' } });
    session.beginPersonaMessage('host-open', 'Start.');
    session.completeRun('host-open', 'Ready.', undefined, false, 'host-conv');

    let releaseFirst!: () => void;
    assistant.replaceWorkshopConversationSettings.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        releaseFirst = resolve;
      })
    );

    const first = service.syncFromSettings();
    await Promise.resolve();
    configured = conversational;
    const second = service.syncFromSettings();
    releaseFirst();

    await Promise.all([first, second]);
    expect(session.getConversationBehavior()).toEqual(conversational);
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenNthCalledWith(
      1,
      [{ conversationId: 'host-conv', personaId: 'jill', role: 'host' }],
      analysis,
      DEFAULT_WORKSHOP_WRITER_PROFILE
    );
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenNthCalledWith(
      2,
      [{ conversationId: 'host-conv', personaId: 'jill', role: 'host' }],
      conversational,
      DEFAULT_WORKSHOP_WRITER_PROFILE
    );

    await service.syncFromSettings();
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(2);
  });

  it('defers an external setting during a run and applies the latest value after settlement', async () => {
    session.setExcerpt({ text: 'Excerpt', source: { kind: 'manual' } });
    session.beginPersonaMessage('active', 'Still running.');

    await expect(service.syncFromSettings()).resolves.toEqual({
      changed: false,
      deferred: true
    });
    expect(session.getConversationBehavior()).toEqual(balanced);

    configured = conversational;
    session.abandonRun('active');
    await expect(service.flushDeferredSettingsSync()).resolves.toEqual({
      changed: true,
      deferred: false
    });
    expect(session.getConversationBehavior()).toEqual(conversational);
  });

  it('keeps an applied modal choice live while reporting a persistence failure', async () => {
    settings.update.mockRejectedValueOnce(new Error('disk full'));

    await expect(service.applyFromWebview(analysis, DEFAULT_WORKSHOP_WRITER_PROFILE)).resolves.toEqual({
      changed: true,
      deferred: false,
      persistenceErrors: { behavior: 'disk full' }
    });
    expect(session.getConversationBehavior()).toEqual(analysis);
  });

  it('keeps a profile-only live commit active when persistence fails', async () => {
    configured = balanced;
    const profile = {
      enabled: true,
      preferredAddress: 'Okey',
      bio: 'I write fiction.'
    };
    settings.update.mockRejectedValueOnce(new Error('profile is read-only'));

    await expect(service.applyFromWebview(balanced, profile)).resolves.toEqual({
      changed: true,
      deferred: false,
      persistenceErrors: { writerProfile: 'profile is read-only' }
    });
    await expect(service.syncFromSettings()).resolves.toEqual({
      changed: false,
      deferred: false
    });

    expect(service.getWriterProfile()).toEqual(profile);
  });

  it('does not let a successful behavior echo revert a profile whose persistence failed', async () => {
    const profile = {
      enabled: true,
      preferredAddress: 'Okey',
      bio: 'I write fiction.'
    };
    settings.update.mockImplementation(async (_section, key, value) => {
      if (key === 'workshop.writerProfile') {
        throw new Error('profile is read-only');
      }
      configured = value as WorkshopConversationBehavior;
    });

    await expect(service.applyFromWebview(analysis, profile)).resolves.toEqual({
      changed: true,
      deferred: false,
      persistenceErrors: { writerProfile: 'profile is read-only' }
    });
    assistant.replaceWorkshopConversationSettings.mockClear();

    await expect(service.syncFromSettings()).resolves.toEqual({
      changed: false,
      deferred: false
    });

    expect(session.getConversationBehavior()).toEqual(analysis);
    expect(service.getWriterProfile()).toEqual(profile);
    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
  });

  it('reports both persistence failures while retaining both live values', async () => {
    const profile = {
      enabled: true,
      preferredAddress: 'Okey',
      bio: 'I write fiction.'
    };
    settings.update
      .mockRejectedValueOnce(new Error('behavior is read-only'))
      .mockRejectedValueOnce(new Error('profile is read-only'));

    await expect(service.applyFromWebview(analysis, profile)).resolves.toEqual({
      changed: true,
      deferred: false,
      persistenceErrors: {
        behavior: 'behavior is read-only',
        writerProfile: 'profile is read-only'
      }
    });

    expect(session.getConversationBehavior()).toEqual(analysis);
    expect(service.getWriterProfile()).toEqual(profile);
  });

  it('replaces live persona prompts when only relational depth changes', async () => {
    session.setExcerpt({ text: 'Excerpt', source: { kind: 'manual' } });
    session.beginPersonaMessage('host-open', 'Start.');
    session.completeRun('host-open', 'Ready.', undefined, false, 'host-conv');
    const reflective: WorkshopConversationBehavior = {
      ...balanced,
      relationalDepth: 'reflective'
    };

    await expect(service.applyFromWebview(reflective, DEFAULT_WORKSHOP_WRITER_PROFILE)).resolves.toEqual({
      changed: true,
      deferred: false
    });

    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledWith(
      [{ conversationId: 'host-conv', personaId: 'jill', role: 'host' }],
      reflective,
      DEFAULT_WORKSHOP_WRITER_PROFILE
    );
  });

  it('does not rebuild persona prompts when only carry-cues continuity changes', async () => {
    const withoutCarry: WorkshopConversationBehavior = {
      ...balanced,
      carryCuesThroughSession: false
    };

    await expect(service.applyFromWebview(withoutCarry, DEFAULT_WORKSHOP_WRITER_PROFILE)).resolves.toEqual({
      changed: true,
      deferred: false
    });

    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
    expect(session.getConversationBehavior()).toEqual(withoutCarry);
  });

  it('does not rebuild persona prompts when an empty profile is enabled', async () => {
    await expect(service.applyFromWebview(balanced, {
      enabled: true,
      preferredAddress: '',
      bio: ''
    })).resolves.toEqual({
      changed: true,
      deferred: false
    });

    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
    expect(service.getWriterProfile()).toEqual({
      enabled: true,
      preferredAddress: '',
      bio: ''
    });
  });

  it('replaces persona prompts once and persists separately when only the profile changes', async () => {
    session.setExcerpt({ text: 'Excerpt', source: { kind: 'manual' } });
    session.beginPersonaMessage('host-open', 'Start.');
    session.completeRun('host-open', 'Ready.', undefined, false, 'host-conv');
    const profile = {
      enabled: true,
      preferredAddress: 'Okey',
      bio: 'I write fiction.'
    };

    await expect(service.applyFromWebview(balanced, profile)).resolves.toEqual({
      changed: true,
      deferred: false
    });

    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledWith(
      [{ conversationId: 'host-conv', personaId: 'jill', role: 'host' }],
      balanced,
      profile
    );
    expect(settings.update).toHaveBeenCalledTimes(1);
    expect(settings.update).toHaveBeenCalledWith(
      'proseMinion',
      'workshop.writerProfile',
      profile
    );
    expect(service.getWriterProfile()).toEqual(profile);
    expect(JSON.stringify(session.getSnapshot())).not.toContain('Okey');
    expect(JSON.stringify(session.getSnapshot())).not.toContain('I write fiction.');
  });

  it('removes an active profile through the guarded prompt-replacement path', async () => {
    const profile = {
      enabled: true,
      preferredAddress: 'Okey',
      bio: 'I write fiction.'
    };
    await service.applyFromWebview(balanced, profile);
    assistant.replaceWorkshopConversationSettings.mockClear();

    await expect(
      service.applyFromWebview(balanced, DEFAULT_WORKSHOP_WRITER_PROFILE)
    ).resolves.toEqual({
      changed: true,
      deferred: false
    });

    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledWith(
      [],
      balanced,
      DEFAULT_WORKSHOP_WRITER_PROFILE
    );
    expect(service.getWriterProfile()).toEqual(DEFAULT_WORKSHOP_WRITER_PROFILE);
  });
});
