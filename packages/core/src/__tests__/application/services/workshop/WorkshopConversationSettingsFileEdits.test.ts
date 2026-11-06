/**
 * The file-edits setting in the live room (ADR 2026-11-05 D9): read live,
 * and a change between off and ask rebuilds every retained persona prompt,
 * as the memory mode's does, so the trailer's teaching arrives on the
 * writer's next message and leaves with it. No change rebuilds nothing.
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
  const state: { fileEdits: unknown } = { fileEdits: initial };
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
        case 'workshop.fileEdits': return state.fileEdits;
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

describe('the file-edits setting in the live room', () => {
  it('is read live: unset is ask, off is off, anything unknown off', () => {
    const { state, service } = room(undefined);
    expect(service.getFileEditsMode()).toBe('ask');
    expect(service.fileEditsOpen()).toBe(true);
    state.fileEdits = 'off';
    expect(service.fileEditsOpen()).toBe(false);
    state.fileEdits = 'sometimes';
    expect(service.getFileEditsMode()).toBe('off');
  });

  it('rebuilds the persona prompts when it turns off, and again when it turns on', async () => {
    const { state, service, assistant, log } = room('ask');
    state.fileEdits = 'off';
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: true, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(1);
    expect(log.appendLine).toHaveBeenCalledWith('[WorkshopConversationSettingsService] File edits off; persona prompts rebuilt');
    state.fileEdits = 'ask';
    await service.syncFromSettings();
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(2);
    expect(log.appendLine).toHaveBeenCalledWith('[WorkshopConversationSettingsService] File edits on; persona prompts rebuilt');
  });

  it('rebuilds nothing when it did not change (unset and ask are one)', async () => {
    const { state, service, assistant } = room(undefined);
    state.fileEdits = 'ask';
    await expect(service.syncFromSettings()).resolves.toEqual({ changed: false, deferred: false });
    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
  });
});
