/**
 * The per-turn reaction invite through the real routes (ADR 2026-11-07,
 * 2026-11-10 addendum, Slice 4a): it rides a host or guest message and a
 * guest's join while persona reactions are on, exactly where a reply's
 * trailer would have a target; never a direct tool message or a synthesis,
 * and never while the setting is off. Logged without text.
 */

import { MessageType } from '@messages';
import { WORKSHOP_REACTION_INVITE_TAG } from '@/application/services/workshop/reactions/WorkshopReactionInvite';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

type Harness = ReturnType<typeof createWorkshopRouteTestHarness>;

const INVITE = `<${WORKSHOP_REACTION_INVITE_TAG}>`;
const send = (harness: Harness, text: string) =>
  harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text }) as never);
const lastContinued = (harness: Harness): string =>
  (harness.service.continueConversation as jest.Mock).mock.calls.at(-1)[1];
const lines = (harness: Harness): string[] =>
  (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
const MODEL_CALLS = ['startWorkshopPersonaConversation', 'startWorkshopGuestConversation', 'continueConversation'] as const;
const allSent = (harness: Harness): string =>
  JSON.stringify(MODEL_CALLS.flatMap((name) => (harness.service[name] as jest.Mock).mock.calls));
const clearCalls = (harness: Harness): void =>
  MODEL_CALLS.forEach((name) => (harness.service[name] as jest.Mock).mockClear());

function turnOff(harness: Harness): void {
  const get = harness.settings.get;
  harness.settings.get = ((section: string, key: string, fallback?: unknown) =>
    key === 'workshop.reactions.personas' ? false : get(section, key, fallback)) as typeof get;
}

async function hostRoom(): Promise<Harness> {
  const harness = createWorkshopRouteTestHarness();
  await harness.pin();
  await send(harness, 'Alice follows the rabbit. Does the chase land?');
  return harness;
}

describe('the reaction invite through the room handler (2026-11-10 addendum)', () => {
  it('rides the host\'s first and later messages, ahead of the writer\'s words, and is logged without text', async () => {
    const harness = await hostRoom();
    const first = (harness.service.startWorkshopPersonaConversation as jest.Mock).mock.calls.at(-1)[0].message as string;
    expect(first).toContain(INVITE);
    (harness.log.appendLine as jest.Mock).mockClear();

    await send(harness, 'And the falling?');
    const sent = lastContinued(harness);
    expect(sent.split(INVITE)).toHaveLength(2);
    expect(sent.indexOf(INVITE)).toBeLessThan(sent.indexOf('WRITER MESSAGE:'));
    expect(sent.endsWith('WRITER MESSAGE:\nAnd the falling?')).toBe(true);
    expect(lines(harness).filter((line) => line.includes('Reaction invite'))).toEqual(['[WorkshopRoomHandler] Reaction invite added']);
  });

  it('sits after the reactions frame when both ride', async () => {
    const harness = await hostRoom();
    const reply = harness.session.readRoomLedger().at(-1)!;
    await harness.router.route(message(MessageType.WORKSHOP_SET_TURN_REACTION, { turnId: reply.id, reaction: 'confused', reacted: true }) as never);
    await send(harness, 'What did you mean?');
    const sent = lastContinued(harness);
    expect(sent.indexOf('</workshop-reactions>')).toBeLessThan(sent.indexOf(INVITE));
  });

  it('rides a guest\'s join and its messages', async () => {
    const harness = await hostRoom();
    await harness.router.route(message(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' }) as never);
    const join = (harness.service.startWorkshopGuestConversation as jest.Mock).mock.calls.at(-1)[0].message as string;
    expect(join.indexOf(INVITE)).toBeGreaterThan(-1);
    expect(join.indexOf(INVITE)).toBeLessThan(join.indexOf('<writer-message>'));

    await send(harness, 'Margot, how does the voice sound?');
    expect(lastContinued(harness)).toContain(INVITE);
  });

  it('off (Q8): no message carries it, and nothing is logged', async () => {
    const harness = createWorkshopRouteTestHarness();
    turnOff(harness);
    await harness.pin();
    await send(harness, 'Alice follows the rabbit. Does the chase land?');
    await send(harness, 'And the falling?');
    await harness.router.route(message(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' }) as never);
    expect(allSent(harness)).not.toContain(WORKSHOP_REACTION_INVITE_TAG);
    expect(lines(harness).some((line) => line.includes('Reaction invite'))).toBe(false);
  });

  it('never rides a tool run, its synthesis, or a direct tool message', async () => {
    const harness = await hostRoom();
    clearCalls(harness);
    await harness.runProse();
    expect(allSent(harness)).toContain('newly completed room report'); // the synthesis was sent
    expect(allSent(harness)).not.toContain(WORKSHOP_REACTION_INVITE_TAG);

    await harness.router.route(message(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'tool', toolId: 'prose' }) as never);
    clearCalls(harness);
    await send(harness, 'Tighten the second paragraph.');
    expect(lastContinued(harness)).toContain('Tighten the second paragraph.');
    expect(allSent(harness)).not.toContain(WORKSHOP_REACTION_INVITE_TAG);
  });
});
