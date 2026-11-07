/**
 * Reaction delivery through the real routes (ADR 2026-11-07 D4, D6): the
 * room handler puts `<workshop-reactions>` beside the writer's next message
 * to a host or guest, after the room catch-up and before the writer's
 * message; never on a tool sidecar's message. The reply that commits records
 * it; a call that fails records nothing, so the next message carries it
 * again. Adding a reaction starts no model call.
 */

import { MessageType } from '@messages';
import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

const send = (harness: ReturnType<typeof createWorkshopRouteTestHarness>, text: string) =>
  harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text }) as never);
const react = (harness: ReturnType<typeof createWorkshopRouteTestHarness>, turnId: string, reaction: string) =>
  harness.router.route(message(MessageType.WORKSHOP_SET_TURN_REACTION, { turnId, reaction, reacted: true }) as never);
const lastContinued = (harness: ReturnType<typeof createWorkshopRouteTestHarness>): string =>
  (harness.service.continueConversation as jest.Mock).mock.calls.at(-1)[1];
const replies = (harness: ReturnType<typeof createWorkshopRouteTestHarness>) =>
  harness.session.readRoomLedger().filter((turn) => turn.role === 'assistant' && turn.participant === 'host');

const MODEL_CALLS = ['startWorkshopPersonaConversation', 'startWorkshopGuestConversation', 'continueConversation'] as const;
const modelCalls = (harness: ReturnType<typeof createWorkshopRouteTestHarness>): number =>
  MODEL_CALLS.reduce((total, name) => total + (harness.service[name] as jest.Mock).mock.calls.length, 0);

async function hostRoom() {
  const harness = createWorkshopRouteTestHarness();
  await harness.pin();
  await send(harness, 'Alice follows the rabbit. Does the chase land?');
  await send(harness, 'And the falling?');
  return harness;
}

describe('reaction delivery through the room handler (ADR 2026-11-07 D4, D6)', () => {
  it('rides the host\'s next message before the writer\'s, once, and is recorded on the reply', async () => {
    const harness = await hostRoom();
    const [first] = replies(harness);
    const calls = modelCalls(harness);
    await react(harness, first.id, 'mind-blown');
    expect(modelCalls(harness)).toBe(calls);

    await send(harness, 'Who is late?');
    const sent = lastContinued(harness);
    expect(sent).toContain('<workshop-reactions>\nReactions you haven\'t been told of yet.');
    expect(sent).toContain('- The writer reacted mind-blown ("hadn\'t thought of that") to your reply that began');
    expect(sent.indexOf('</workshop-reactions>')).toBeLessThan(sent.indexOf('WRITER MESSAGE:'));
    expect(sent.endsWith('WRITER MESSAGE:\nWho is late?')).toBe(true);
    expect(sent).not.toContain(first.id);
    expect(replies(harness).at(-1)!.reactionDelivery).toEqual([{
      participant: { kind: 'host' }, kind: 'update',
      reactions: [{ turnId: first.id, author: { kind: 'writer' }, reaction: 'mind-blown' }]
    }]);

    await send(harness, 'And the Queen?');
    expect(lastContinued(harness)).not.toContain('<workshop-reactions>');
  });

  it('a call that fails records nothing, and the next message carries the reaction again', async () => {
    const harness = await hostRoom();
    const [first] = replies(harness);
    await react(harness, first.id, 'heart');
    (harness.service.continueConversation as jest.Mock).mockRejectedValueOnce(new Error('provider down'));

    await send(harness, 'Who is late?');
    expect(lastContinued(harness)).toContain('reacted heart');
    expect(harness.session.readRoomLedger().some((turn) => turn.reactionDelivery)).toBe(false);

    await send(harness, 'Who is late, then?');
    expect(lastContinued(harness)).toContain('reacted heart');
    expect(replies(harness).at(-1)!.reactionDelivery).toHaveLength(1);
  });

  it('a guest hears it on its join and its messages, by whose message; the host by the guest\'s name', async () => {
    const harness = await hostRoom();
    const [first] = replies(harness);
    await react(harness, first.id, 'fire');

    await harness.router.route(message(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' }) as never);
    const join = (harness.service.startWorkshopGuestConversation as jest.Mock).mock.calls.at(-1)[0].message as string;
    expect(join).toContain('<workshop-reactions>\nReactions on messages in the room so far.');
    expect(join).toMatch(/- The writer reacted fire \("this is strong"\) to \w+'s reply that began/);
    expect(join.indexOf('</workshop-reactions>')).toBeLessThan(join.indexOf('<writer-message>'));

    const guestReply = harness.session.readRoomLedger().filter((turn) => turn.participant === 'guest').at(-1)!;
    await react(harness, guestReply.id, 'eyes');
    await send(harness, 'Margot, how does the voice sound?');
    const guestSent = lastContinued(harness);
    expect(guestSent).toContain('- The writer reacted eyes ("intrigued") to your reply that began');
    expect(guestSent).not.toContain('reacted fire');
    expect(guestSent.indexOf('</workshop-reactions>')).toBeLessThan(guestSent.indexOf('<writer-message>'));

    await harness.router.route(message(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'host' }) as never);
    await send(harness, 'What did Margot see?');
    const hostSent = lastContinued(harness);
    expect(hostSent).toContain('- The writer reacted eyes ("intrigued") to Margot\'s reply that began');
    // The host has had no turn since the fire on its own reply: it hears that too.
    expect(hostSent).toContain('- The writer reacted fire ("this is strong") to your reply that began');
  });

  it('never rides a direct tool message', async () => {
    const harness = await hostRoom();
    await harness.runProse();
    const [first] = replies(harness);
    await react(harness, first.id, 'fire');
    await harness.router.route(message(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'tool', toolId: 'prose' }) as never);
    await send(harness, 'Tighten the second paragraph.');
    const toolSent = lastContinued(harness);
    expect(toolSent).toContain('Tighten the second paragraph.');
    expect(toolSent).not.toContain('<workshop-reactions>');
  });

  it('logs counts and participant keys, never the text it quotes', async () => {
    const harness = await hostRoom();
    const [first] = replies(harness);
    await react(harness, first.id, 'fire');
    (harness.log.appendLine as jest.Mock).mockClear();
    await send(harness, 'Who is late?');
    const lines = (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).filter((line) => line.includes('Reactions delivery'));
    expect(lines).toEqual(['[WorkshopRoomHandler] Reactions delivery staged (host, update): listed=1 counted=0 deferred=0 waiting=0']);
  });

  it('a synthesis that starts a fresh host conversation begins its view, so the next message delivers again (PR #246 M1)', async () => {
    const harness = await hostRoom();
    const [first] = replies(harness);
    await react(harness, first.id, 'fire');
    await send(harness, 'Who is late?');
    expect(lastContinued(harness)).toContain('reacted fire');

    // A settings change loses the conversation generation: every conversation is cleared.
    (harness.service.continueConversation as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('gone'), { name: 'ConversationNotFoundError' })
    );
    await send(harness, 'Still there?');
    expect(harness.session.getHostConversationId()).toBeUndefined();

    // The tool run's synthesis starts the host's new conversation, without a frame.
    await harness.runProse();
    const synthesisMessage = (harness.service.startWorkshopPersonaConversation as jest.Mock).mock.calls.at(-1)[0].message as string;
    expect(synthesisMessage).not.toContain('<workshop-reactions>');
    const synthesis = harness.session.readRoomLedger().filter((turn) => turn.artifact === 'persona_synthesis').at(-1)!;
    expect(synthesis.reactionDelivery).toEqual([{ participant: { kind: 'host' }, kind: 'start', reactions: [] }]);

    await send(harness, 'Where were we?');
    expect(lastContinued(harness)).toContain('- The writer reacted fire ("this is strong") to your reply that began');
  });

  it.each([
    ['an AbortError cancel', () => Object.assign(new Error('stopped'), { name: 'AbortError' })],
    ['an unavailable model\'s rollback', () => new AgentRunUnavailableError('context-window-exceeded')]
  ])('%s records nothing, and the next message carries the reaction', async (_case, failure) => {
    const harness = await hostRoom();
    const [first] = replies(harness);
    await react(harness, first.id, 'heart');
    (harness.service.continueConversation as jest.Mock).mockRejectedValueOnce(failure());

    await send(harness, 'Who is late?');
    expect(lastContinued(harness)).toContain('reacted heart');
    expect(harness.session.readRoomLedger().some((turn) => turn.reactionDelivery)).toBe(false);

    await send(harness, 'Who is late, then?');
    expect(lastContinued(harness)).toContain('reacted heart');
    expect(replies(harness).at(-1)!.reactionDelivery).toHaveLength(1);
  });

  it('an overtaken run records nothing; the message that overtook it carries the reaction', async () => {
    const harness = await hostRoom();
    const [first] = replies(harness);
    await react(harness, first.id, 'heart');
    (harness.service.continueConversation as jest.Mock).mockImplementationOnce(
      (_id: string, _message: string, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      })
    );

    const overtaken = send(harness, 'Who is late?');
    await new Promise((resolve) => setImmediate(resolve));
    expect(lastContinued(harness)).toContain('reacted heart');
    await send(harness, 'Never mind: who is the Queen?');
    await overtaken;

    expect(lastContinued(harness)).toContain('reacted heart');
    const recorded = harness.session.readRoomLedger().filter((turn) => turn.reactionDelivery);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].id).toBe(replies(harness).at(-1)!.id);
  });

  it('never posts the record to the webview (PR #246 L3)', async () => {
    const harness = await hostRoom();
    const [first] = replies(harness);
    await react(harness, first.id, 'fire');
    harness.postMessage.mockClear();
    await send(harness, 'Who is late?');
    expect(replies(harness).at(-1)!.reactionDelivery).toHaveLength(1);
    expect(JSON.stringify(harness.postMessage.mock.calls)).not.toContain('reactionDelivery');
  });
});
