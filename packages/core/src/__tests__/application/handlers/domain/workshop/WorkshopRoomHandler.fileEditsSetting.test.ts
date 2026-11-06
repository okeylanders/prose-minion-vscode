/**
 * The Suggested file edits row through the room's routes (ADR 2026-11-05
 * D11; epic Slice 4c): every session state names the mode, the apply writes
 * the draft and the snapshot reads it back with no reload, and an apply
 * that fails and cannot set it back says which mode stands. Through the
 * real router and room handler, as the memory mode's (PR #202 F03). *Alice*.
 */
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, MessageType } from '@messages';
import type { SettingsStore } from '@/platform';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

function room(initial: unknown, options: { failApply?: boolean; refuseRollback?: boolean; refuseWrite?: boolean; refuseMemory?: boolean } = {}) {
  const harness = createWorkshopRouteTestHarness();
  const state = { mode: initial };
  const get = harness.settings.get.bind(harness.settings);
  (harness.settings as { get: SettingsStore['get'] }).get = ((section: string, key: string, fallback?: unknown) =>
    key === 'workshop.fileEdits' ? state.mode : get(section, key, fallback)) as SettingsStore['get'];
  (harness.settings.update as jest.Mock).mockImplementation(async (_section: string, key: string, value: unknown) => {
    if (key === 'workshop.projectMemory' && options.refuseMemory) {
      throw new Error('memory is read-only');
    }
    if (key === 'workshop.fileEdits') {
      if (options.refuseWrite || (options.refuseRollback && value === initial)) {
        throw new Error('settings are read-only');
      }
      state.mode = value;
    }
  });
  if (options.failApply) {
    harness.service.replaceWorkshopConversationSettings.mockRejectedValueOnce(new Error('prompt missing'));
  }
  return { harness, state };
}

const apply = (harness: ReturnType<typeof createWorkshopRouteTestHarness>, fileEdits: unknown, extra: Record<string, unknown> = {}) =>
  harness.router.route(message(
    MessageType.WORKSHOP_SET_CONVERSATION_SETTINGS,
    { behavior: DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, projectMemory: 'off', fileEdits, ...extra }
  ) as never);

const lastState = (harness: ReturnType<typeof createWorkshopRouteTestHarness>) =>
  harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload;

async function opened(harness: ReturnType<typeof createWorkshopRouteTestHarness>) {
  await harness.pin();
  await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Open the room.' }) as never);
}

describe('the Suggested file edits setting through the room', () => {
  it.each([[undefined, 'ask'], ['off', 'off'], ['sometimes', 'off']])('the session state names the mode: %s reads %s', async (stored, mode) => {
    const { harness } = room(stored);
    await opened(harness);
    expect(lastState(harness).fileEdits).toBe(mode);
  });

  it('an apply writes the draft, and the snapshot reads it back with no reload', async () => {
    const { harness, state } = room('ask');
    await opened(harness);
    await apply(harness, 'off');
    expect(state.mode).toBe('off');
    expect(lastState(harness).fileEdits).toBe('off');
    expect(harness.posted(MessageType.ERROR)).toEqual([]);
  });

  it('a failed apply sets it back: the previous settings are still active', async () => {
    const { harness, state } = room('ask', { failApply: true });
    await opened(harness);
    await apply(harness, 'off');
    expect(state.mode).toBe('ask');
    expect(harness.posted(MessageType.ERROR).at(-1).payload.message).toBe('Could not change conversation settings. The previous settings are still active.');
    expect(lastState(harness).fileEdits).toBe('ask');
  });

  it('not set back: the message names the mode that stands, and the snapshot reads it', async () => {
    const { harness, state } = room('ask', { failApply: true, refuseRollback: true });
    await opened(harness);
    await apply(harness, 'off');
    expect(state.mode).toBe('off');
    expect(harness.posted(MessageType.ERROR).at(-1).payload.message).toBe(
      'Could not change conversation settings. Suggested file edits are now Off: it couldn\'t be set back. Your other previous settings are still active.'
    );
    expect(lastState(harness).fileEdits).toBe('off');
  });

  describe('a mode VS Code refuses to change is never called active (PR #236 F-01)', () => {
    it('a refused Off: the snapshot still says Ask first, and the room says so (Astra\'s witness)', async () => {
      const { harness } = room('ask', { refuseWrite: true });
      await opened(harness);
      await apply(harness, 'off');
      expect(lastState(harness).fileEdits).toBe('ask');
      const error = harness.posted(MessageType.ERROR).at(-1).payload;
      expect(error.details).toContain('file edits: settings are read-only');
      expect(error.message).not.toContain('changed for this session');
      expect(error.message).toBe('VS Code could not change suggested file edits, so they are still Ask first.');
    });

    it('mixed: a Behavior change applied beside a refused Off says both truthfully', async () => {
      const { harness } = room('ask', { refuseWrite: true });
      await opened(harness);
      await apply(harness, 'off', { behavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, interactionMode: 'analysis' } });
      expect(lastState(harness).session.conversationBehavior.interactionMode).toBe('analysis');
      expect(lastState(harness).fileEdits).toBe('ask');
      expect(harness.posted(MessageType.ERROR).at(-1).payload.message).toBe(
        'VS Code could not change suggested file edits, so they are still Ask first. Your other conversation settings were applied.'
      );
    });

    it('the memory mode the same way: a refused Ask first says it is still Off', async () => {
      const { harness } = room('ask', { refuseMemory: true });
      await opened(harness);
      await apply(harness, 'ask', { projectMemory: 'ask' });
      expect(lastState(harness).projectMemory).toBe('off');
      const error = harness.posted(MessageType.ERROR).at(-1).payload;
      expect(error.message).toBe('VS Code could not change project memory, so it is still Off.');
      expect(error.details).toContain('project memory: memory is read-only');
    });
  });
});
