/**
 * Alternative versions, a chip each (ADR 2026-11-10, second addendum; epic
 * Slice 3b), through the real router, room handler, session and completion.
 * The provider is the harness's mock: no model is called.
 *
 * - A rewrites offer's options are stored on the turn and reach the webview,
 *   with one derived status per option.
 * - A press names one version by its index; the host reads the label from
 *   its own ledger, and the directive, the request line and the answer line
 *   name it.
 * - Pressing one version never uses up another, or the fixes.
 * - An option the offer does not have, none when it has them, or one on an
 *   offer without them is refused, and adds no turn.
 * - The per-turn reminder rides a persona's message, never a press.
 * Made-up text: Alice.
 */

import { MessageType, type WorkshopEditOfferKind, type WorkshopTurn } from '@messages';
import { WORKSHOP_EDIT_OFFER_REFUSAL_WORDS } from '@shared/constants/workshopEditOfferWords';
import { renderWorkshopEditOfferReminder } from '@/application/services/workshop/fileEdits/WorkshopEditOfferReminder';
import {
  editOfferFrame,
  fakeFileEditStaging,
  fileEditFrame
} from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

const CHAPTER = 'chapters/down-the-rabbit-hole.md';
const SAID = 'One slip: "begining". And three ways the Rabbit\'s line could go.\n\nVersion 1: "Oh dear!"\n\nVersion 2: "I shall be late!"\n\n'
  + 'A third option: "Late, late."';
const LABELS = ['Version 1', 'Version 2', 'A third option'];
const OFFERS = `${editOfferFrame({ kind: 'fixes', count: 1 })}\n${editOfferFrame({ kind: 'rewrites', extra: LABELS.map((label) => `<option>${label}</option>`) })}`;
const rewrite = fileEditFrame({
  group: 'chapters', path: CHAPTER, why: 'The second version.', body: ['<find>Oh dear! Oh dear!</find>', '<replace-with>I shall be late!</replace-with>']
});
const NONE = '<prose-minion-no-file-edit><why>The line already reads that way.</why></prose-minion-no-file-edit>';

describe('Workshop routes — a press on one version of a reply\'s rewrites', () => {
  let harness: WorkshopRouteTestHarness;
  let source: WorkshopTurn;
  let presses = 0;

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const settle = async () => {
    for (let round = 0; round < 8; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const ledger = () => harness.session.readRoomLedger();
  const lastReply = () => [...ledger()].reverse().find((turn) => turn.role === 'assistant' && !turn.capability)!;
  const press = async (kind: WorkshopEditOfferKind, option?: unknown) => {
    presses += 1;
    const requestId = `press-${presses}`;
    await route(MessageType.WORKSHOP_EDIT_OFFER_ACTION, {
      requestId, roomRevision: harness.session.readRoomRevision(), turnId: source.id, kind, ...(option !== undefined ? { option } : {})
    });
    await settle();
    return harness.posted(MessageType.WORKSHOP_EDIT_OFFER_RESULT).map((entry) => entry.payload).find((payload) => payload.requestId === requestId);
  };
  const answerWith = (content: string) =>
    harness.service.continueConversation.mockResolvedValueOnce(analysisResult(content, { conversationId: 'host-conv' }) as never);
  const offerViews = () => harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1)!.payload.session.turns
    .find((turn: WorkshopTurn) => turn.id === source.id)?.editOffers;
  const logs = () => (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).join('\n');

  beforeEach(async () => {
    presses = 0;
    harness = createWorkshopRouteTestHarness({ fileEditStaging: fakeFileEditStaging(), sessionNow: () => Date.UTC(2026, 6, 23, 14, 2) });
    await harness.pin();
    harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(
      analysisResult(`${SAID}\n\n${OFFERS}`, { conversationId: 'host-conv' }) as never
    );
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Give me an idea of what you are thinking.' });
    await settle();
    source = lastReply();
  });

  it('keeps the labels on the turn and sends them with one open status per option', () => {
    expect(source.content).toBe(SAID);
    expect(source.editOffers).toEqual([
      expect.objectContaining({ kind: 'fixes', count: 1 }),
      expect.objectContaining({ kind: 'rewrites', options: LABELS })
    ]);
    expect(source.editOffers![0]).not.toHaveProperty('options');
    expect(offerViews()).toEqual([
      { kind: 'fixes', target: { kind: 'file', relativePath: CHAPTER }, count: 1, status: { state: 'open' } },
      {
        kind: 'rewrites',
        target: { kind: 'file', relativePath: CHAPTER },
        options: LABELS,
        optionStatuses: [{ state: 'open' }, { state: 'open' }, { state: 'open' }]
      }
    ]);
    expect(logs()).toContain('Edit offer kept (kind=rewrites; target=file; count=none; options=3) (Jill)');
  });

  it('carried the reminder on the writer\'s message, and never carries it on a press', async () => {
    const first = harness.service.startWorkshopPersonaConversation.mock.calls[0][0] as unknown as { message: string };
    expect(first.message).toContain(renderWorkshopEditOfferReminder());
    expect(logs()).toContain('Edit offer reminder added');
    expect(logs()).not.toContain('prose-minion-edit-offer trailer');

    answerWith(rewrite);
    await press('rewrites', 1);
    const [, pressed] = harness.service.continueConversation.mock.calls.at(-1) as unknown as [string, string];
    expect(pressed).toContain('<prose-minion-edit-request kind="rewrites">');
    expect(pressed).not.toContain('workshop-edit-offer-reminder');
  });

  it('asks for the chosen version only, by the stored label, and the lines name it', async () => {
    answerWith(`Gladly!\n\n${rewrite}`);
    const before = ledger().length;

    const result = await press('rewrites', 1);

    const [conversationId, modelMessage] = harness.service.continueConversation.mock.calls.at(-1) as unknown as [string, string];
    expect(conversationId).toBe('host-conv');
    const at = /from your reply of (\d{1,2}:02 [ap]m), quoted below/.exec(modelMessage)![1];
    expect(modelMessage).toContain(`The writer chose "Version 2" from your reply of ${at}, quoted below. Suggest that version only, as file edits.`);
    expect(modelMessage).toContain('That version only: the replacement prose your reply wrote out as "Version 2".');
    expect(modelMessage).toContain('Leave the other versions out');
    expect(modelMessage).not.toContain('The writer pressed "');
    expect(modelMessage).toContain(`<source-reply turn="${source.id}" at="${at}">\n${SAID}\n</source-reply>`);

    const [request, answer] = ledger().slice(before);
    expect(request.editOfferRequest).toEqual({ sourceTurnId: source.id, kind: 'rewrites', option: 1 });
    expect(request.content).toBe('Asked Jill for an edit · Version 2, from that reply.');
    expect(answer.editOfferAnswer).toEqual({ sourceTurnId: source.id, kind: 'rewrites', option: 1, outcome: 'proposed' });
    expect(answer.content).toBe(`Suggested Version 2 as an edit to ${CHAPTER}, from the ${at} reply.`);
    expect(answer.fileEditProposals).toEqual([expect.objectContaining({ state: 'pending' })]);
    expect(answer.fileEditProposals![0]).not.toHaveProperty('intent');

    expect(result).toEqual({
      requestId: 'press-1',
      roomRevision: harness.session.readRoomRevision(),
      turnId: source.id,
      kind: 'rewrites',
      option: 1,
      answer: 'answered',
      answerTurnId: answer.id,
      outcome: 'proposed',
      cards: 1,
      changes: 1,
      message: `Jill suggested Version 2 as an edit to ${CHAPTER}. It is at the end of the conversation.`
    });
    // One version's press uses up neither its siblings nor the fixes.
    expect(offerViews()[0].status).toEqual({ state: 'open' });
    expect(offerViews()[1].optionStatuses).toEqual([
      { state: 'open' },
      { state: 'answered', answerTurnId: answer.id, cards: 1, changes: 1, askAgain: false },
      { state: 'open' }
    ]);
    expect(logs()).toContain(`press answered turn=${source.id} kind=rewrites option=1`);
    // Logs carry the index, never the label.
    expect(logs()).not.toContain('Version 2');
  });

  it('takes a second version after the first, and refuses the first again', async () => {
    answerWith(rewrite);
    await press('rewrites', 1);
    answerWith(NONE);
    const second = await press('rewrites', 2);
    expect(second).toMatchObject({ answer: 'answered', outcome: 'none', option: 2, message: 'Jill found nothing to change for A third option.' });
    expect(lastReply().content).toBe('Jill found nothing to change for A third option: The line already reads that way.');
    expect(lastReply().editOfferAnswer).toEqual({
      sourceTurnId: source.id, kind: 'rewrites', option: 2, outcome: 'none', why: 'The line already reads that way.'
    });
    expect(offerViews()[1].optionStatuses.map((status: { state: string }) => status.state)).toEqual(['open', 'answered', 'nothing-to-change']);

    const before = ledger().length;
    const again = await press('rewrites', 1);
    expect(again).toMatchObject({ answer: 'refused', reason: 'already-answered', option: 1 });
    expect(ledger()).toHaveLength(before);
  });

  it.each([
    ['no option on an offer that has them', 'rewrites', undefined],
    ['an option past the offer\'s last', 'rewrites', 3],
    ['an option on the fixes offer', 'fixes', 0]
  ] as const)('refuses %s, and adds no turn', async (_name, kind, option) => {
    const before = ledger().length;
    const result = await press(kind, option);
    expect(result).toMatchObject({ answer: 'refused', reason: 'no-offer', message: WORKSHOP_EDIT_OFFER_REFUSAL_WORDS['no-offer'] });
    expect(ledger()).toHaveLength(before);
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
  });

  it.each([[-1], [1.5], ['1'], [null]])('reads option %p as no press at all', async (option) => {
    const before = ledger().length;
    await route(MessageType.WORKSHOP_EDIT_OFFER_ACTION, {
      requestId: 'bad', roomRevision: harness.session.readRoomRevision(), turnId: source.id, kind: 'rewrites', option
    });
    await settle();
    expect(harness.posted(MessageType.WORKSHOP_EDIT_OFFER_RESULT)).toEqual([]);
    expect(ledger()).toHaveLength(before);
  });
});
