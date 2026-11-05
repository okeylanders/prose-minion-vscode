/**
 * Project memory's mode in the live room (ADR 2026-11-04 D8): a change
 * between off and on rebuilds every retained persona prompt, as any
 * Conversation settings change does, so the grammar arrives on the writer's
 * next message and leaves with it. A change between the two on modes, or
 * none at all, rebuilds nothing. Slice 2a's interim: the whole-catalog
 * update note is Slice 2b's.
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

function room(initialMode: string) {
  const state = { mode: initialMode };
  const session = new WorkshopSessionService(() => 1, behavior);
  session.setExcerpt({ text: 'Alice falls.', source: { kind: 'manual' } });
  session.beginPersonaMessage('host-open', 'Start.');
  session.completeRun('host-open', 'Ready.', undefined, false, 'host-conv');
  const settings = {
    get: jest.fn((_section: string, key: string) => {
      if (key === 'workshop.writerProfile') {
        return DEFAULT_WORKSHOP_WRITER_PROFILE;
      }
      if (key === 'workshop.webResearch') {
        return DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS;
      }
      if (key === 'workshop.projectMemory') {
        return state.mode;
      }
      return behavior;
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

describe('project memory mode in the live room', () => {
  it('rebuilds the persona prompts when memory turns on, and again when it turns off', async () => {
    const { state, service, assistant, log } = room('off');
    state.mode = 'ask';
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: true, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(1);
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledWith(
      [{ conversationId: 'host-conv', personaId: 'jill', role: 'host' }], behavior, DEFAULT_WORKSHOP_WRITER_PROFILE, []
    );

    state.mode = 'off';
    await service.syncFromSettings();
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(2);
    expect(log.appendLine).toHaveBeenCalledWith('[WorkshopConversationSettingsService] Project memory off; persona prompts rebuilt');
  });

  it('rebuilds nothing between the two on modes, or when nothing changed', async () => {
    const { state, service, assistant } = room('ask');
    state.mode = 'auto';
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: false, deferred: false });
    await service.syncFromSettings();
    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
  });

  it('reads an unknown mode as off', async () => {
    const { state, service, assistant } = room('ask');
    state.mode = 'whenever';
    await service.syncFromSettings();
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(1);
  });
});
