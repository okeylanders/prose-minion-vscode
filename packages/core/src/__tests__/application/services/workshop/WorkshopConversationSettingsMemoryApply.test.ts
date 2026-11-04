/**
 * The Memory tab's mode draft through Conversation settings' apply (epic
 * Slice 4b; ADR 2026-11-04 D8): the draft is written to the writer's global
 * setting first, so the prompt rebuild sees it; an unchanged draft writes
 * nothing; a write VS Code refuses is reported and leaves the mode as it
 * was; an edit in VS Code Settings is read back. Together, the round trip
 * Settings overlay ↔ VS Code settings ↔ webview state.
 */
import { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopWriterProfileService } from '@/application/services/workshop/WorkshopWriterProfileService';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { LogSink, SettingsStore } from '@/platform';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS,
  WORKSHOP_PROJECT_MEMORY_SETTING,
  type WorkshopConversationBehavior
} from '@messages';

const behavior: WorkshopConversationBehavior = {
  interactionMode: 'balanced',
  expressionLevel: 'full',
  relationalDepth: 'attuned',
  carryCuesThroughSession: true,
  proactiveAssistance: true
};

function room(initialMode: string, refuseWrite = false) {
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
    update: jest.fn(async (_section: string, key: string, value: unknown) => {
      if (key === 'workshop.projectMemory') {
        if (refuseWrite) {
          throw new Error('settings are read-only');
        }
        state.mode = value as string;
      }
    })
  } as unknown as jest.Mocked<SettingsStore>;
  const assistant = {
    replaceWorkshopConversationSettings: jest.fn().mockResolvedValue(undefined)
  } as unknown as jest.Mocked<AssistantToolService>;
  const log = { appendLine: jest.fn() } as unknown as jest.Mocked<LogSink>;
  const service = new WorkshopConversationSettingsService(session, assistant, settings, log, new WorkshopWriterProfileService(settings, log));
  return { state, service, settings, assistant };
}

const memoryWrites = (settings: jest.Mocked<SettingsStore>) =>
  settings.update.mock.calls.filter(([, key]) => key === WORKSHOP_PROJECT_MEMORY_SETTING.key);

describe('the Memory tab\'s mode through Conversation settings', () => {
  it('writes the draft to the global setting before the rebuild, so the prompts see it', async () => {
    const { state, service, settings, assistant } = room('off');
    const result = await service.applyFromWebview(behavior, DEFAULT_WORKSHOP_WRITER_PROFILE, DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS, 'ask');
    expect(memoryWrites(settings)).toEqual([[WORKSHOP_PROJECT_MEMORY_SETTING.section, WORKSHOP_PROJECT_MEMORY_SETTING.key, 'ask']]);
    expect(state.mode).toBe('ask');
    expect(service.getProjectMemoryMode()).toBe('ask');
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ changed: true, deferred: false });
  });

  it('writes nothing for an unchanged draft or none, and coerces an unknown one to off', async () => {
    const { service, settings } = room('ask');
    await service.applyFromWebview(behavior, DEFAULT_WORKSHOP_WRITER_PROFILE, DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS, 'ask');
    await service.applyFromWebview(behavior, DEFAULT_WORKSHOP_WRITER_PROFILE, DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS);
    expect(memoryWrites(settings)).toEqual([]);
    await service.applyFromWebview(behavior, DEFAULT_WORKSHOP_WRITER_PROFILE, DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS, 'whenever');
    expect(memoryWrites(settings).map(([, , value]) => value)).toEqual(['off']);
  });

  it('between the two on modes: written, and nothing rebuilt', async () => {
    const { service, settings, assistant } = room('ask');
    await service.applyFromWebview(behavior, DEFAULT_WORKSHOP_WRITER_PROFILE, DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS, 'auto');
    expect(memoryWrites(settings).map(([, , value]) => value)).toEqual(['auto']);
    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
    expect(service.getProjectMemoryMode()).toBe('auto');
  });

  it('a write VS Code refuses is reported, and the mode stays as it was', async () => {
    const { service, assistant } = room('off', true);
    const result = await service.applyFromWebview(behavior, DEFAULT_WORKSHOP_WRITER_PROFILE, DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS, 'ask');
    expect(result.persistenceErrors).toEqual({ projectMemory: 'settings are read-only' });
    expect(service.getProjectMemoryMode()).toBe('off');
    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
  });

  it('an edit in VS Code Settings is read back as the mode the webview gets', async () => {
    const { state, service } = room('off');
    state.mode = 'auto';
    await service.syncFromSettings();
    expect(service.getProjectMemoryMode()).toBe('auto');
  });
});
