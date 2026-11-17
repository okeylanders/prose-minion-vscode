/**
 * How readily personas suggest notes, through the real room handler
 * (Everyday Conveniences, Round Two, item B): every session state names the
 * level the setting holds, and a change of the setting mid-room rebuilds the
 * retained persona prompts through the existing system-message replacement,
 * then tells the webview.
 */

import { MessageType } from '@messages';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

type Harness = ReturnType<typeof createWorkshopRouteTestHarness>;

const send = (harness: Harness, text: string) =>
  harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text }) as never);

const lastState = (harness: Harness) => harness.postMessage.mock.calls.map(([posted]) => posted)
  .filter((posted) => posted.type === MessageType.WORKSHOP_SESSION_STATE).at(-1)!;

/** A room whose settings say memory is on, and whose level the test moves. */
function roomWith(initial?: unknown) {
  const state: { level: unknown } = { level: initial };
  const harness = createWorkshopRouteTestHarness();
  const get = harness.settings.get;
  harness.settings.get = ((section: string, key: string, fallback?: unknown) => {
    if (key === 'workshop.memory.suggestions') return state.level;
    if (key === 'workshop.projectMemory') return 'ask';
    return get(section, key, fallback);
  }) as typeof get;
  return { harness, state };
}

describe('the memory-suggestion level through the room handler', () => {
  it('every session state names the level: Sparingly when unset or unknown', async () => {
    const { harness, state } = roomWith();
    await harness.pin();
    expect(lastState(harness).payload.memorySuggestions).toBe('sparingly');

    state.level = 'nonsense';
    await harness.handler.syncConversationSettingsFromSettings();
    expect(lastState(harness).payload.memorySuggestions).toBe('sparingly');
  });

  it('a change mid-room rebuilds the retained persona prompts once, and the next state names the new level', async () => {
    const { harness, state } = roomWith();
    await harness.pin();
    await send(harness, 'Alice follows the rabbit. Does the chase land?');
    // The room was built with memory off; this first sync is the memory mode's own rebuild.
    await harness.handler.syncConversationSettingsFromSettings();
    const replace = harness.service.replaceWorkshopConversationSettings as jest.Mock;
    replace.mockClear();
    harness.postMessage.mockClear();

    state.level = 'readily';
    await harness.handler.syncConversationSettingsFromSettings();

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toEqual([expect.objectContaining({ role: 'host', personaId: 'jill' })]);
    expect(lastState(harness).payload.memorySuggestions).toBe('readily');
    expect((harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)))
      .toContain('[WorkshopConversationSettingsService] Memory suggestions readily; persona prompts rebuilt');

    // The same level again is no change: nothing is rebuilt.
    await harness.handler.syncConversationSettingsFromSettings();
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
