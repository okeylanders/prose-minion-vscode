/**
 * The room handler measures what it writes (ADR 2026-11-18 D3, D6): each
 * persona run carries one recorder, shared by the fresh envelope, the
 * handler's frames and the capability, and a tool sidecar's run carries
 * none. Fake data only: *Alice*.
 */
import { MessageType } from '@messages';
import { WorkshopContextTallyRecorder } from '@services/analysis/WorkshopContextTally';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

describe('Workshop context tally through the room handler (ADR 2026-11-18 D6)', () => {
  it('hands one recorder to a fresh host run: its envelope, its frames and its capability', async () => {
    const { router, service, capabilityFactory, pin } = createWorkshopRouteTestHarness();
    await pin();
    await router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Where is Alice going?' }) as any);

    const [, options] = service.startWorkshopPersonaConversation.mock.calls[0] as unknown as [unknown, { contextTally?: unknown }];
    expect(options.contextTally).toBeInstanceOf(WorkshopContextTallyRecorder);
    const created = (capabilityFactory.create as jest.Mock).mock.calls[0][0] as { contextTally?: unknown };
    expect(created.contextTally).toBe(options.contextTally);
  });

  it('tallies a retained host\'s frames as its message carries them, never the writer\'s words', async () => {
    const { router, service, pin } = createWorkshopRouteTestHarness();
    await pin();
    await router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Where is Alice going?' }) as any);
    await router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And the White Rabbit?' }) as any);

    const [, prompt, options] = service.continueConversation.mock.calls.at(-1) as unknown as
      [string, string, { contextTally: WorkshopContextTallyRecorder }];
    const pieces = options.contextTally.snapshot();
    const time = /<workshop-time-context[\s\S]*?<\/workshop-time-context>/.exec(prompt)?.[0];
    if (time) expect(pieces['room.time']).toBe(estimateTextTokens(time));
    const activation = /<workshop-behavior-activation[\s\S]*?<\/workshop-behavior-activation>/.exec(prompt)![0];
    expect(pieces['room.behavior']).toBeGreaterThanOrEqual(estimateTextTokens(activation));
    const total = Object.values(pieces).reduce((sum, tokens) => sum + tokens, 0);
    expect(total).toBeLessThan(estimateTextTokens(prompt));
  });

  it('gives a direct tool sidecar run no recorder', async () => {
    const { router, service, pin, runProse } = createWorkshopRouteTestHarness();
    await pin();
    await runProse();
    await router.route(message(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'tool', toolId: 'prose' }) as any);
    service.continueConversation.mockClear();
    await router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Tighten the Hatter.' }) as any);
    const call = service.continueConversation.mock.calls.at(-1) as unknown as [string, string, { contextTally?: unknown }] | undefined;
    expect(call![0]).toBe('tool-conv');
    expect(call![2].contextTally).toBeUndefined();
  });
});
