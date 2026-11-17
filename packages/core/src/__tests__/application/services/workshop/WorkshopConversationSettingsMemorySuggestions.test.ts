/**
 * How readily personas suggest notes, in the live room (Everyday
 * Conveniences, Round Two, item B): read live, Sparingly unless a known
 * level is set, and a change rebuilds every retained persona prompt, so the
 * new paragraph arrives with the writer's next message.
 *
 * - While project memory is off the prompts hold no proposals file, so a
 *   change rebuilds nothing; turning memory on then rebuilds once, with the
 *   level as it stands.
 * - A change during a response waits for it to settle.
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

const REBUILT = (level: string) => `[WorkshopConversationSettingsService] Memory suggestions ${level}; persona prompts rebuilt`;

function room(initial: { suggestions?: unknown; memory?: unknown } = {}) {
  const state: { suggestions: unknown; memory: unknown } = { suggestions: initial.suggestions, memory: initial.memory ?? 'ask' };
  const session = new WorkshopSessionService(() => 1, behavior);
  session.setExcerpt({ text: 'Alice falls.', source: { kind: 'manual' } });
  session.beginPersonaMessage('host-open', 'Start.');
  session.completeRun('host-open', 'Ready.', undefined, false, 'host-conv');
  const settings = {
    get: jest.fn((_section: string, key: string) => {
      switch (key) {
        case 'workshop.writerProfile': return DEFAULT_WORKSHOP_WRITER_PROFILE;
        case 'workshop.webResearch': return DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS;
        case 'workshop.projectMemory': return state.memory;
        case 'workshop.fileEdits': return 'ask';
        case 'workshop.reactions.personas': return true;
        case 'workshop.memory.suggestions': return state.suggestions;
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
  return { state, session, service, assistant, log };
}

describe('the memory-suggestion level in the live room', () => {
  it('is read live: unset and anything unknown are Sparingly', () => {
    const { state, service } = room();
    expect(service.memorySuggestionLevel()).toBe('sparingly');
    state.suggestions = 'readily';
    expect(service.memorySuggestionLevel()).toBe('readily');
    state.suggestions = 'aggressively';
    expect(service.memorySuggestionLevel()).toBe('aggressively');
    state.suggestions = 'always';
    expect(service.memorySuggestionLevel()).toBe('sparingly');
  });

  it('rebuilds the persona prompts mid-room when the level changes, once per change', async () => {
    const { state, service, assistant, log } = room();
    state.suggestions = 'readily';
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: true, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(1);
    expect(assistant.replaceWorkshopConversationSettings.mock.calls[0][0])
      .toEqual([{ conversationId: 'host-conv', personaId: 'jill', role: 'host' }]);
    expect(log.appendLine).toHaveBeenCalledWith(REBUILT('readily'));

    state.suggestions = 'aggressively';
    await service.syncFromSettings();
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(2);
    expect(log.appendLine).toHaveBeenCalledWith(REBUILT('aggressively'));

    state.suggestions = 'sparingly';
    await service.syncFromSettings();
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(3);
    expect(log.appendLine).toHaveBeenCalledWith(REBUILT('sparingly'));
  });

  it('rebuilds nothing when it did not change (unset, unknown and Sparingly are one)', async () => {
    const { state, service, assistant } = room();
    state.suggestions = 'sparingly';
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: false, deferred: false });
    state.suggestions = 'nonsense';
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: false, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
  });

  it('off stays off: with project memory off a change rebuilds nothing, and turning memory on rebuilds once', async () => {
    const { state, service, assistant, log } = room({ memory: 'off' });
    state.suggestions = 'aggressively';
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: false, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
    expect(log.appendLine).not.toHaveBeenCalledWith(REBUILT('aggressively'));

    state.memory = 'ask';
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: true, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(1);
    expect(log.appendLine).toHaveBeenCalledWith('[WorkshopConversationSettingsService] Project memory on; persona prompts rebuilt');
    // The level was already recorded, so the memory change alone is what rebuilt them.
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: false, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(1);
  });

  it('waits for a running response, then applies the latest level once', async () => {
    const { state, session, service, assistant } = room();
    session.beginPersonaMessage('host-next', 'And the rabbit?');
    state.suggestions = 'readily';
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: false, deferred: true });
    state.suggestions = 'aggressively';
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: false, deferred: true });
    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();

    session.completeRun('host-next', 'Late.', undefined, false, 'host-conv');
    await expect(service.flushDeferredSettingsSync()).resolves.toEqual({ changed: true, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(1);
    expect(service.memorySuggestionLevel()).toBe('aggressively');
  });

  it('keeps the old level on record when the rebuild fails, so the next sync tries again', async () => {
    const { state, service, assistant } = room();
    assistant.replaceWorkshopConversationSettings.mockRejectedValueOnce(new Error('prompt missing'));
    state.suggestions = 'readily';
    await expect(service.syncFromSettings()).rejects.toThrow('prompt missing');
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: true, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(2);
  });

  it('logs the level by its id only', async () => {
    const { state, service, log } = room();
    state.suggestions = 'readily';
    await service.syncFromSettings();
    const lines = log.appendLine.mock.calls.map(([line]) => String(line));
    expect(lines.filter((line) => line.includes('Memory suggestions'))).toEqual([REBUILT('readily')]);
  });
});
