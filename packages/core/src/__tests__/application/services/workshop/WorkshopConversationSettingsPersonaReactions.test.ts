/**
 * The persona-reactions setting in the live room (ADR 2026-11-07 Q8): read
 * live, on unless explicitly false, and a change rebuilds every retained
 * persona prompt, so the permission to react arrives or leaves with the
 * writer's next message. No change rebuilds nothing.
 */
import { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopWriterProfileService } from '@/application/services/workshop/WorkshopWriterProfileService';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { LogSink, SettingsStore } from '@/platform';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS,
  type WorkshopConversationBehavior
} from '@messages';

const behavior: WorkshopConversationBehavior = {
  interactionMode: 'balanced',
  expressionLevel: 'full',
  relationalDepth: 'attuned',
  carryCuesThroughSession: true,
  proactiveAssistance: true
};

function room(initial: unknown) {
  const state: { reactions: unknown } = { reactions: initial };
  const session = new WorkshopSessionService(() => 1, behavior);
  session.setExcerpt({ text: 'Alice falls.', source: { kind: 'manual' } });
  session.beginPersonaMessage('host-open', 'Start.');
  session.completeRun('host-open', 'Ready.', undefined, false, 'host-conv');
  const settings = {
    get: jest.fn((_section: string, key: string) => {
      switch (key) {
        case 'workshop.writerProfile': return DEFAULT_WORKSHOP_WRITER_PROFILE;
        case 'workshop.webResearch': return DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS;
        case 'workshop.projectMemory': return 'off';
        case 'workshop.fileEdits': return 'ask';
        case 'workshop.reactions.personas': return state.reactions;
        default: return behavior;
      }
    }),
    update: jest.fn().mockResolvedValue(undefined)
  } as unknown as SettingsStore;
  const assistant = {
    replaceWorkshopConversationSettings: jest.fn().mockResolvedValue(undefined)
  } as unknown as jest.Mocked<AssistantToolService>;
  const log = { appendLine: jest.fn() } as unknown as jest.Mocked<LogSink>;
  const service = new WorkshopConversationSettingsService(session, assistant, settings, log, new WorkshopWriterProfileService(settings, log));
  return { state, service, assistant, log };
}

describe('the persona-reactions setting in the live room', () => {
  it('is read live: unset and anything but false are on', () => {
    const { state, service } = room(undefined);
    expect(service.personaReactionsOpen()).toBe(true);
    state.reactions = false;
    expect(service.personaReactionsOpen()).toBe(false);
    state.reactions = 'no';
    expect(service.personaReactionsOpen()).toBe(true);
  });

  it('rebuilds the persona prompts when it turns off, and again when it turns on', async () => {
    const { state, service, assistant, log } = room(true);
    state.reactions = false;
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: true, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(1);
    expect(log.appendLine).toHaveBeenCalledWith('[WorkshopConversationSettingsService] Persona reactions off; persona prompts rebuilt');
    state.reactions = true;
    await service.syncFromSettings();
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(2);
    expect(log.appendLine).toHaveBeenCalledWith('[WorkshopConversationSettingsService] Persona reactions on; persona prompts rebuilt');
  });

  it('rebuilds nothing when it did not change (unset and true are one)', async () => {
    const { state, service, assistant } = room(undefined);
    state.reactions = true;
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: false, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
  });
});
