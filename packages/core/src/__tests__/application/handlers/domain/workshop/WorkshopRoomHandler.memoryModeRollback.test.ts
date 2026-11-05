/**
 * Conversation settings' apply, failed after it wrote the project-memory
 * mode (PR #202 F03): set back, the handler says the previous settings are
 * still active, and the snapshot reads the old mode; when VS Code refuses
 * to set it back, the handler says which mode stands instead. Through the
 * real router and room handler. *Alice*.
 */
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, MessageType } from '@messages';
import type { SettingsStore } from '@/platform';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

function room(refuseRollback: boolean) {
  const harness = createWorkshopRouteTestHarness();
  const state = { mode: 'off' as unknown };
  const get = harness.settings.get.bind(harness.settings);
  (harness.settings as { get: SettingsStore['get'] }).get = ((section: string, key: string, fallback?: unknown) =>
    key === 'workshop.projectMemory' ? state.mode : get(section, key, fallback)) as SettingsStore['get'];
  (harness.settings.update as jest.Mock).mockImplementation(async (_section: string, key: string, value: unknown) => {
    if (key === 'workshop.projectMemory') {
      if (refuseRollback && value === 'off') {
        throw new Error('settings are read-only');
      }
      state.mode = value;
    }
  });
  harness.service.replaceWorkshopConversationSettings.mockRejectedValueOnce(new Error('prompt missing'));
  return { harness, state };
}

const apply = (harness: ReturnType<typeof createWorkshopRouteTestHarness>) => harness.router.route(message(
  MessageType.WORKSHOP_SET_CONVERSATION_SETTINGS,
  { behavior: DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, projectMemory: 'auto' }
) as never);

describe('a failed apply and the project-memory mode (PR #202 F03)', () => {
  it('set back: the previous settings are still active, and the snapshot says Off', async () => {
    const { harness, state } = room(false);
    await harness.pin();
    await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Open the room.' }) as never);
    await apply(harness);

    expect(state.mode).toBe('off');
    expect(harness.posted(MessageType.ERROR).at(-1).payload.message).toBe('Could not change conversation settings. The previous settings are still active.');
    expect(harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload.projectMemory).toBe('off');
  });

  it('not set back: the message names the mode that stands, and the snapshot reads it', async () => {
    const { harness, state } = room(true);
    await harness.pin();
    await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Open the room.' }) as never);
    await apply(harness);

    expect(state.mode).toBe('auto');
    expect(harness.posted(MessageType.ERROR).at(-1).payload.message).toBe(
      'Could not change conversation settings. Project memory is now Save and tell me: it couldn\'t be set back. Your other previous settings are still active.'
    );
    expect(harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload.projectMemory).toBe('auto');
  });
});
