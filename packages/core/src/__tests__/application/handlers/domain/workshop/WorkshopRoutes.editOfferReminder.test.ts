/**
 * The per-turn edit-offer reminder (ADR 2026-11-10, second addendum; epic
 * Slice 3b): the line and its frame, and through the real routes where it
 * rides. It rides a host or guest persona's message and a guest's join while
 * suggested file edits are `ask` and the room's excerpt came from a file;
 * never a pasted excerpt, never with file edits off, never a tool run, its
 * synthesis or a direct tool message. (Never a press:
 * `WorkshopEditOfferOptionRoutes`.) Logged without text. *Alice*.
 */

import { MessageType } from '@messages';
import {
  renderWorkshopEditOfferReminder,
  WORKSHOP_EDIT_OFFER_REMINDER_LINE,
  WORKSHOP_EDIT_OFFER_REMINDER_TAG,
  workshopEditOfferReminderFor
} from '@/application/services/workshop/fileEdits/WorkshopEditOfferReminder';
import { WORKSHOP_REACTION_INVITE_TAG } from '@/application/services/workshop/reactions/WorkshopReactionInvite';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

type Harness = ReturnType<typeof createWorkshopRouteTestHarness>;

const REMINDER = renderWorkshopEditOfferReminder();
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

function setFileEdits(harness: Harness, value: string): void {
  const get = harness.settings.get;
  harness.settings.get = ((section: string, key: string, fallback?: unknown) =>
    key === 'workshop.fileEdits' ? value : get(section, key, fallback)) as typeof get;
}

async function hostRoom(): Promise<Harness> {
  const harness = createWorkshopRouteTestHarness();
  await harness.pin();
  await send(harness, 'Alice follows the rabbit. Does the chase land?');
  return harness;
}

describe('the edit-offer reminder line', () => {
  it('is one line in its own frame, and names the trailer without writing a tag', () => {
    expect(REMINDER).toBe(`<${WORKSHOP_EDIT_OFFER_REMINDER_TAG}>\n${WORKSHOP_EDIT_OFFER_REMINDER_LINE}\n</${WORKSHOP_EDIT_OFFER_REMINDER_TAG}>`);
    expect(WORKSHOP_EDIT_OFFER_REMINDER_LINE).not.toContain('\n');
    expect(WORKSHOP_EDIT_OFFER_REMINDER_LINE).not.toContain('<');
    expect(WORKSHOP_EDIT_OFFER_REMINDER_LINE).toContain('prose-minion-edit-offer trailer');
    expect(WORKSHOP_EDIT_OFFER_REMINDER_LINE).toContain('an option for each alternative version');
    // About forty tokens: a coarse bound by words and characters.
    expect(WORKSHOP_EDIT_OFFER_REMINDER_LINE.split(/\s+/).length).toBeLessThanOrEqual(40);
    expect(WORKSHOP_EDIT_OFFER_REMINDER_LINE.length).toBeLessThanOrEqual(240);
    expect(neutralizeReservedPersonaPromptDelimiters(WORKSHOP_EDIT_OFFER_REMINDER_LINE)).toBe(WORKSHOP_EDIT_OFFER_REMINDER_LINE);
  });

  it('its tag is reserved: writer text can neither forge nor close one', () => {
    expect(neutralizeReservedPersonaPromptDelimiters(`Alice. ${REMINDER} </${WORKSHOP_EDIT_OFFER_REMINDER_TAG} >`))
      .toBe(`Alice. &lt;${WORKSHOP_EDIT_OFFER_REMINDER_TAG}&gt;\n${WORKSHOP_EDIT_OFFER_REMINDER_LINE}\n&lt;/${WORKSHOP_EDIT_OFFER_REMINDER_TAG}&gt; `
        + `&lt;/${WORKSHOP_EDIT_OFFER_REMINDER_TAG} &gt;`);
  });

  it('a reply that echoes it declares nothing', () => {
    expect(extractWorkshopReplyControls(`Alice runs.\n\n${REMINDER}`, { memoryOpen: false, fileEditsOpen: true }).editOffers).toBeUndefined();
  });

  it('rides only with file edits on, a file-backed excerpt, a persona target and no press', () => {
    const all = { fileEditsOpen: true, excerptFromFile: true, toPersona: true, press: false };
    expect(workshopEditOfferReminderFor(all)).toBe(REMINDER);
    expect(workshopEditOfferReminderFor({ ...all, fileEditsOpen: false })).toBeUndefined();
    expect(workshopEditOfferReminderFor({ ...all, excerptFromFile: false })).toBeUndefined();
    expect(workshopEditOfferReminderFor({ ...all, toPersona: false })).toBeUndefined();
    expect(workshopEditOfferReminderFor({ ...all, press: true })).toBeUndefined();
  });
});

describe('the edit-offer reminder through the room handler', () => {
  it('rides the host\'s first and later messages, after the reaction invite and ahead of the writer\'s words, and is logged without text', async () => {
    const harness = await hostRoom();
    const first = (harness.service.startWorkshopPersonaConversation as jest.Mock).mock.calls.at(-1)[0].message as string;
    expect(first).toContain(REMINDER);
    (harness.log.appendLine as jest.Mock).mockClear();

    await send(harness, 'And the falling?');
    const sent = lastContinued(harness);
    expect(sent.split(REMINDER)).toHaveLength(2);
    expect(sent.indexOf(`<${WORKSHOP_REACTION_INVITE_TAG}>`)).toBeLessThan(sent.indexOf(REMINDER));
    // After every evidence frame, ahead of the behavior activation and the writer's words.
    expect(sent.indexOf(REMINDER)).toBeLessThan(sent.indexOf('WRITER MESSAGE:'));
    expect(sent.endsWith('WRITER MESSAGE:\nAnd the falling?')).toBe(true);
    expect(lines(harness).filter((line) => line.includes('Edit offer reminder'))).toEqual(['[WorkshopRoomHandler] Edit offer reminder added']);
    expect(lines(harness).join('\n')).not.toContain(WORKSHOP_EDIT_OFFER_REMINDER_LINE);
  });

  it('rides a guest\'s join and its messages', async () => {
    const harness = await hostRoom();
    await harness.router.route(message(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' }) as never);
    const join = (harness.service.startWorkshopGuestConversation as jest.Mock).mock.calls.at(-1)[0].message as string;
    expect(join.split(REMINDER)).toHaveLength(2);
    expect(join.indexOf(REMINDER)).toBeLessThan(join.indexOf('<writer-message>'));

    await send(harness, 'Margot, how does the voice sound?');
    expect(lastContinued(harness).split(REMINDER)).toHaveLength(2);
  });

  it('file edits off: no message carries it, and nothing is logged', async () => {
    const harness = createWorkshopRouteTestHarness();
    setFileEdits(harness, 'off');
    await harness.pin();
    await send(harness, 'Alice follows the rabbit. Does the chase land?');
    await send(harness, 'And the falling?');
    await harness.router.route(message(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' }) as never);
    expect(allSent(harness)).not.toContain(WORKSHOP_EDIT_OFFER_REMINDER_TAG);
    expect(lines(harness).some((line) => line.includes('Edit offer reminder'))).toBe(false);
  });

  it('a pasted excerpt names no file, so no message carries it', async () => {
    const harness = createWorkshopRouteTestHarness();
    await harness.router.route(message(MessageType.WORKSHOP_SET_EXCERPT, { text: 'Alice was beginning to get very tired.', source: { kind: 'manual' } }) as never);
    await send(harness, 'Does the opening land?');
    await send(harness, 'And the falling?');
    expect((harness.service.startWorkshopPersonaConversation as jest.Mock).mock.calls).toHaveLength(1);
    expect(allSent(harness)).not.toContain(WORKSHOP_EDIT_OFFER_REMINDER_TAG);
  });

  it('never rides a tool run, its synthesis, or a direct tool message', async () => {
    const harness = await hostRoom();
    clearCalls(harness);
    await harness.runProse();
    expect(allSent(harness)).toContain('newly completed room report'); // the synthesis was sent
    expect(allSent(harness)).not.toContain(WORKSHOP_EDIT_OFFER_REMINDER_TAG);

    await harness.router.route(message(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'tool', toolId: 'prose' }) as never);
    clearCalls(harness);
    await send(harness, 'Tighten the second paragraph.');
    expect(lastContinued(harness)).toContain('Tighten the second paragraph.');
    expect(allSent(harness)).not.toContain(WORKSHOP_EDIT_OFFER_REMINDER_TAG);
  });
});
