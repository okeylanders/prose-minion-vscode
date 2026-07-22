import { WorkshopConversationBehaviorService } from '@/application/services/workshop/WorkshopConversationBehaviorService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { LogSink, SettingsStore } from '@/platform';
import type { WorkshopConversationBehavior } from '@messages';

const balanced: WorkshopConversationBehavior = {
  interactionMode: 'balanced',
  expressionLevel: 'full',
  reactToCurrentMessage: true,
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

describe('WorkshopConversationBehaviorService', () => {
  let session: WorkshopSessionService;
  let configured: WorkshopConversationBehavior;
  let settings: jest.Mocked<SettingsStore>;
  let assistant: jest.Mocked<AssistantToolService>;
  let service: WorkshopConversationBehaviorService;

  beforeEach(() => {
    session = new WorkshopSessionService(() => 1, balanced);
    configured = analysis;
    settings = {
      get: jest.fn(() => configured),
      update: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<SettingsStore>;
    assistant = {
      replaceWorkshopConversationBehavior: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<AssistantToolService>;
    service = new WorkshopConversationBehaviorService(
      session,
      assistant,
      settings,
      { appendLine: jest.fn() } as unknown as LogSink
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

    expect(assistant.replaceWorkshopConversationBehavior).toHaveBeenCalledWith(
      [
        { conversationId: 'host-conv', personaId: 'jill', role: 'host' },
        { conversationId: 'guest-conv', personaId: 'margot', role: 'guest' }
      ],
      analysis
    );
    expect(session.getConversationBehavior()).toEqual(analysis);
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('serializes duplicate handlers and rapid external edits in configuration order', async () => {
    session.setExcerpt({ text: 'Excerpt', source: { kind: 'manual' } });
    session.beginPersonaMessage('host-open', 'Start.');
    session.completeRun('host-open', 'Ready.', undefined, false, 'host-conv');

    let releaseFirst!: () => void;
    assistant.replaceWorkshopConversationBehavior.mockImplementationOnce(
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
    expect(assistant.replaceWorkshopConversationBehavior).toHaveBeenNthCalledWith(
      1,
      [{ conversationId: 'host-conv', personaId: 'jill', role: 'host' }],
      analysis
    );
    expect(assistant.replaceWorkshopConversationBehavior).toHaveBeenNthCalledWith(
      2,
      [{ conversationId: 'host-conv', personaId: 'jill', role: 'host' }],
      conversational
    );

    await service.syncFromSettings();
    expect(assistant.replaceWorkshopConversationBehavior).toHaveBeenCalledTimes(2);
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

    await expect(service.applyFromWebview(analysis)).resolves.toEqual({
      changed: true,
      deferred: false,
      persistenceError: 'disk full'
    });
    expect(session.getConversationBehavior()).toEqual(analysis);
  });
});
