/**
 * The Behavior tab's suggested-file-edits draft through Conversation
 * settings' apply (ADR 2026-11-05 D11; epic Slice 4c), as the memory mode's
 * (ADR 2026-11-04 D8; PR #202 F03): the draft is written to the writer's
 * global setting first, so the prompt rebuild sees it; an unchanged or
 * absent draft writes nothing; an unknown one is written `off`; a write VS
 * Code refuses is reported and leaves the mode as it was; an edit in VS
 * Code Settings is read back; a failed apply undoes only its own write.
 * Together, the round trip Settings overlay ↔ VS Code settings ↔ webview
 * state.
 */
import { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopWriterProfileService } from '@/application/services/workshop/WorkshopWriterProfileService';
import {
  WorkshopConversationSettingsPartialApplyError,
  workshopConversationSettingsPartialApplyWords
} from '@/application/services/workshop/WorkshopConversationSettingsPartialApply';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { LogSink, SettingsStore } from '@/platform';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS,
  WORKSHOP_FILE_EDITS_SETTING,
  type WorkshopConversationBehavior
} from '@messages';

const behavior: WorkshopConversationBehavior = {
  interactionMode: 'balanced',
  expressionLevel: 'full',
  relationalDepth: 'attuned',
  carryCuesThroughSession: true,
  proactiveAssistance: true
};

interface State {
  fileEdits: unknown;
  memory: string;
  refuse?: (key: string, value: unknown) => boolean;
}

function room(fileEdits: unknown, memory = 'off') {
  const state: State = { fileEdits, memory };
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
        case 'workshop.fileEdits': return state.fileEdits;
        default: return behavior;
      }
    }),
    update: jest.fn(async (_section: string, key: string, value: unknown) => {
      if (state.refuse?.(key, value)) {
        throw new Error('settings are read-only');
      }
      if (key === 'workshop.fileEdits') {
        state.fileEdits = value;
      } else if (key === 'workshop.projectMemory') {
        state.memory = value as string;
      }
    })
  } as unknown as jest.Mocked<SettingsStore>;
  const assistant = {
    replaceWorkshopConversationSettings: jest.fn().mockResolvedValue(undefined)
  } as unknown as jest.Mocked<AssistantToolService>;
  const log = { appendLine: jest.fn() } as unknown as jest.Mocked<LogSink>;
  const service = new WorkshopConversationSettingsService(session, assistant, settings, log, new WorkshopWriterProfileService(settings, log));
  const apply = (draft: unknown, memoryDraft: unknown = undefined, nextBehavior = behavior) =>
    service.applyFromWebview(nextBehavior, DEFAULT_WORKSHOP_WRITER_PROFILE, DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS, memoryDraft, draft);
  return { state, service, settings, assistant, session, log, apply };
}

const fileEditsWrites = (settings: jest.Mocked<SettingsStore>) =>
  settings.update.mock.calls.filter(([, key]) => key === WORKSHOP_FILE_EDITS_SETTING.key).map(([, , value]) => value);

describe('suggested file edits through Conversation settings', () => {
  it('writes the draft to the global setting before the rebuild, so the prompts see it', async () => {
    const { state, service, settings, assistant, apply } = room(undefined);
    assistant.replaceWorkshopConversationSettings.mockImplementationOnce(async () => {
      // The rebuild runs with the mode already written.
      expect(service.fileEditsOpen()).toBe(false);
    });
    await expect(apply('off')).resolves.toEqual({ changed: true, deferred: false });
    expect(settings.update.mock.calls.filter(([, key]) => key === WORKSHOP_FILE_EDITS_SETTING.key))
      .toEqual([[WORKSHOP_FILE_EDITS_SETTING.section, WORKSHOP_FILE_EDITS_SETTING.key, 'off']]);
    expect(state.fileEdits).toBe('off');
    expect(service.getFileEditsMode()).toBe('off');
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(1);
  });

  it('turned back on: written, and the prompts rebuilt again, with no reload', async () => {
    const { service, settings, assistant, apply } = room('off');
    await apply('ask');
    expect(fileEditsWrites(settings)).toEqual(['ask']);
    expect(service.fileEditsOpen()).toBe(true);
    expect(assistant.replaceWorkshopConversationSettings).toHaveBeenCalledTimes(1);
  });

  it('writes nothing for an unchanged draft (unset is ask) or none, and an unknown one is written off', async () => {
    const { settings, assistant, apply } = room(undefined);
    await apply('ask');
    await apply(undefined);
    expect(fileEditsWrites(settings)).toEqual([]);
    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
    await apply('auto');
    expect(fileEditsWrites(settings)).toEqual(['off']);
  });

  it('a write VS Code refuses is reported, and the mode stays as it was', async () => {
    const { state, service, assistant, apply } = room('ask');
    state.refuse = (key) => key === 'workshop.fileEdits';
    const result = await apply('off');
    expect(result.persistenceErrors).toEqual({ fileEdits: 'settings are read-only' });
    expect(service.getFileEditsMode()).toBe('ask');
    expect(assistant.replaceWorkshopConversationSettings).not.toHaveBeenCalled();
  });

  it('an edit in VS Code Settings is read back as the mode the webview gets', async () => {
    const { state, service } = room('ask');
    state.fileEdits = 'off';
    await service.syncFromSettings();
    expect(service.getFileEditsMode()).toBe('off');
  });

  describe('a failed apply undoes its own write, and only that', () => {
    const rejected = new Error('the retained prompts could not be replaced');

    it.each([['ask', 'off'], ['off', 'ask']])('from %s, a failed %s rolls back', async (from, to) => {
      const { service, settings, assistant, apply } = room(from);
      assistant.replaceWorkshopConversationSettings.mockRejectedValueOnce(rejected);
      await expect(apply(to)).rejects.toBe(rejected);
      expect(fileEditsWrites(settings)).toEqual([to, from]);
      expect(service.getFileEditsMode()).toBe(from);
      // The watcher then finds nothing to rebuild.
      expect((await service.syncFromSettings()).changed).toBe(false);
    });

    it('with the memory mode changed in the same apply, both are set back, the last written first', async () => {
      const { service, settings, assistant, apply } = room('ask', 'off');
      assistant.replaceWorkshopConversationSettings.mockRejectedValueOnce(rejected);
      await expect(apply('off', 'auto')).rejects.toBe(rejected);
      expect(settings.update.mock.calls.map(([, key, value]) => `${key}=${String(value)}`)).toEqual([
        'workshop.projectMemory=auto', 'workshop.fileEdits=off', 'workshop.fileEdits=ask', 'workshop.projectMemory=off'
      ]);
      expect(service.getFileEditsMode()).toBe('ask');
      expect(service.getProjectMemoryMode()).toBe('off');
    });

    it('a newer external choice stands', async () => {
      const host = room('ask');
      host.assistant.replaceWorkshopConversationSettings.mockImplementationOnce(async () => {
        host.state.fileEdits = 'ask';
        throw rejected;
      });
      await expect(host.apply('off')).rejects.toBe(rejected);
      expect(fileEditsWrites(host.settings)).toEqual(['off']);
      expect(host.service.getFileEditsMode()).toBe('ask');
    });

    it('a write VS Code refused is never rolled back', async () => {
      const host = room('ask');
      host.state.refuse = (key) => key === 'workshop.fileEdits';
      host.assistant.replaceWorkshopConversationSettings.mockRejectedValueOnce(rejected);
      await expect(host.apply('off', undefined, { ...behavior, interactionMode: 'analysis' })).rejects.toBe(rejected);
      expect(fileEditsWrites(host.settings)).toEqual(['off']);
      expect(host.service.getFileEditsMode()).toBe('ask');
    });

    it('a rollback VS Code refuses says the mode it left', async () => {
      const { state, service, assistant, apply } = room('ask');
      state.refuse = (key, value) => key === 'workshop.fileEdits' && value === 'ask';
      assistant.replaceWorkshopConversationSettings.mockRejectedValueOnce(rejected);
      const failure = await apply('off').catch((error: unknown) => error) as WorkshopConversationSettingsPartialApplyError;
      expect(failure).toBeInstanceOf(WorkshopConversationSettingsPartialApplyError);
      expect(failure.fileEdits).toBe('off');
      expect(failure.projectMemory).toBeUndefined();
      expect(service.getFileEditsMode()).toBe('off');
      expect(workshopConversationSettingsPartialApplyWords(failure)).toBe(
        'Could not change conversation settings. Suggested file edits are now Off: it couldn\'t be set back. Your other previous settings are still active.'
      );
    });

    it('both rollbacks refused: the error names both modes as they stand', async () => {
      const { state, assistant, apply } = room('ask', 'off');
      state.refuse = (key, value) => (key === 'workshop.fileEdits' && value === 'ask') || (key === 'workshop.projectMemory' && value === 'off');
      assistant.replaceWorkshopConversationSettings.mockRejectedValueOnce(rejected);
      const failure = await apply('off', 'ask').catch((error: unknown) => error) as WorkshopConversationSettingsPartialApplyError;
      expect(failure).toMatchObject({ projectMemory: 'ask', fileEdits: 'off' });
      expect(workshopConversationSettingsPartialApplyWords(failure)).toBe(
        'Could not change conversation settings. Project memory is now Ask first and suggested file edits are now Off: ' +
        'they couldn\'t be set back. Your other previous settings are still active.'
      );
    });
  });

  it('logs the mode it wrote, never anything else', async () => {
    const { log, apply } = room('ask');
    await apply('off');
    expect(log.appendLine).toHaveBeenCalledWith('[WorkshopConversationSettingsService] File edits mode set to off');
  });
});
