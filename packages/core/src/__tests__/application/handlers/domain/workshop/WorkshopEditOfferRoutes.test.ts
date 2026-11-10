/**
 * The press on a reply's edit offer, through the real router, room handler,
 * session and completion (ADR 2026-11-10 D3–D7, D9; epic Slice 2). The
 * provider is the harness's mock: no model is called.
 *
 * - A press carries ids only; the directive quotes the ledger's reply.
 * - The answer is cards or a host line, never the persona's prose.
 * - A refusal adds no turn; a stopped or failed run leaves none.
 * - Fixes are held to a fix's size at staging, and to the offered file.
 * - Logs carry ids, kinds, counts and fault names only.
 * Made-up text: Alice.
 */

import { MessageType, type WorkshopEditOfferKind, type WorkshopTurn } from '@messages';
import { WORKSHOP_EDIT_OFFER_REFUSAL_WORDS } from '@shared/constants/workshopEditOfferWords';
import { AGENT_FINAL_REPLY_REFUSED, type AgentFinalReplyCheck } from '@orchestration/AgentRunContracts';
import { WORKSHOP_EDIT_REQUEST_CORRECTION } from '@/utils/workshopEditRequestFrame';
import {
  editOfferFrame,
  fakeFileEditStaging,
  fileEditFrame,
  URI_SENTINEL
} from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

const CHAPTER = 'chapters/down-the-rabbit-hole.md';
const SAID_SENTINEL = 'ZZQ-SAID';
const SAID = `Two slips in the chapter ${SAID_SENTINEL}: "begining" and a doubled "the". The Rabbit's line would land harder cut short.`;
const PROSE_SENTINEL = 'ZZQ-STRAY-PROSE';
const WHY_SENTINEL = 'ZZQ-WHY';
const OFFERS = `${editOfferFrame({ kind: 'fixes', count: 2 })}\n${editOfferFrame({ kind: 'rewrites' })}`;
const fixes = (path = CHAPTER, body = ['<find>begining</find>', '<replace-with>beginning</replace-with>', '<find>the the</find>', '<replace-with>the</replace-with>']) =>
  fileEditFrame({ group: 'chapters', path, why: 'The two slips.', body });
const NONE = `<prose-minion-no-file-edit><why>Already reads beginning ${WHY_SENTINEL}.</why></prose-minion-no-file-edit>`;

describe('Workshop routes — a press on a reply\'s edit offer', () => {
  let harness: WorkshopRouteTestHarness;
  let staging: ReturnType<typeof fakeFileEditStaging>;
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
  const setFileEdits = (value: unknown) => {
    const get = harness.settings.get.bind(harness.settings);
    (harness.settings as { get: unknown }).get = ((section: string, key: string, fallback?: unknown) =>
      key === 'workshop.fileEdits' ? value : get(section, key, fallback as never)) as typeof harness.settings.get;
  };
  const press = async (kind: WorkshopEditOfferKind, overrides: Record<string, unknown> = {}) => {
    presses += 1;
    const requestId = `press-${presses}`;
    await route(MessageType.WORKSHOP_EDIT_OFFER_ACTION, {
      requestId, roomRevision: harness.session.readRoomRevision(), turnId: source.id, kind, ...overrides
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
    staging = fakeFileEditStaging();
    harness = createWorkshopRouteTestHarness({ fileEditStaging: staging, sessionNow: () => Date.UTC(2026, 6, 23, 14, 2) });
    await harness.pin();
    harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(
      analysisResult(`${SAID}\n\n${OFFERS}`, { conversationId: 'host-conv' }) as never
    );
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Read the first page for slips.' });
    await settle();
    source = lastReply();
    harness.service.continueConversation.mockClear();
  });

  it('shows each offer open in the webview\'s view, with no URI', () => {
    expect(source.editOffers).toHaveLength(2);
    expect(offerViews()).toEqual([
      { kind: 'fixes', target: { kind: 'file', relativePath: CHAPTER }, count: 2, status: { state: 'open' } },
      { kind: 'rewrites', target: { kind: 'file', relativePath: CHAPTER }, status: { state: 'open' } }
    ]);
    expect(JSON.stringify(harness.posted(MessageType.WORKSHOP_SESSION_STATE))).not.toContain(URI_SENTINEL);
  });

  it('asks the reply\'s author with a directive that quotes the ledger\'s reply, and answers with cards and a host line', async () => {
    answerWith(`Here you go! ${PROSE_SENTINEL}\n\n${fixes()}`);
    const before = ledger().length;

    const result = await press('fixes');

    // The run: the author's own conversation, the directive frame, the reply's check, and nothing streamed.
    const [conversationId, modelMessage, options] = harness.service.continueConversation.mock.calls[0] as unknown as
      [string, string, { finalReply: { check: AgentFinalReplyCheck; retained: (reply: string) => string } }];
    expect(conversationId).toBe('host-conv');
    expect(modelMessage).toContain('<prose-minion-edit-request kind="fixes">');
    // The source reply's time, in the session's timezone, as the room shows it.
    const at = /on your reply of (\d{1,2}:02 [ap]m), quoted below/.exec(modelMessage)![1];
    expect(modelMessage).toContain(`The writer pressed "2 fixes" on your reply of ${at}, quoted below.`);
    expect(modelMessage).toContain(`<source-reply turn="${source.id}" at="${at}">\n${SAID}\n</source-reply>`);
    expect(modelMessage.trimEnd().endsWith('Follow the edit request frame above.)')).toBe(true);
    expect(modelMessage).toContain(`Edit only the file your reply named, ${CHAPTER}`);
    expect(options.finalReply.check('Sure, will do.', { incomplete: false })).toBe(WORKSHOP_EDIT_REQUEST_CORRECTION);
    expect(options.finalReply.check(fixes(), { incomplete: false })).toBeUndefined();
    expect(options.finalReply.check(fixes(), { incomplete: true })).toBe(AGENT_FINAL_REPLY_REFUSED);
    expect(options.finalReply.retained(`Chatter.\n\n${fixes()}`)).toBe('Suggested 2 fixes as file edits.');
    expect(harness.posted(MessageType.STREAM_CHUNK)).toEqual([]);

    // The thread: one request turn, one answer, each naming the source and kind.
    const added = ledger().slice(before);
    expect(added.map((turn) => [turn.role, turn.participant])).toEqual([['user', 'writer'], ['assistant', 'host']]);
    const [request, answer] = added;
    expect(request.editOfferRequest).toEqual({ sourceTurnId: source.id, kind: 'fixes' });
    expect(request.content).toBe('Asked Jill to suggest the fixes from their reply as file edits.');
    expect(answer.editOfferAnswer).toEqual({ sourceTurnId: source.id, kind: 'fixes', outcome: 'proposed' });
    expect(answer.content).toBe(`Suggested 2 fixes to ${CHAPTER}, from the ${at} reply.`);
    expect(answer.model).toBeUndefined();
    expect(answer.actionableFindings).toBeUndefined();
    expect(answer.widgetRecommendation).toBeUndefined();
    expect(answer.fileEditProposals).toEqual([expect.objectContaining({
      state: 'pending', intent: 'fixes', class: 'prose', target: expect.objectContaining({ relativePath: CHAPTER })
    })]);

    // The answer, and the status the bubble will draw.
    expect(result).toEqual({
      requestId: 'press-1',
      roomRevision: harness.session.readRoomRevision(),
      turnId: source.id,
      kind: 'fixes',
      answer: 'answered',
      answerTurnId: answer.id,
      outcome: 'proposed',
      cards: 1,
      changes: 2,
      message: 'Jill suggested 2 fixes to chapters/down-the-rabbit-hole.md. They are at the end of the conversation.'
    });
    expect(offerViews().map((offer: { status: unknown }) => offer.status)).toEqual([
      { state: 'answered', answerTurnId: answer.id, cards: 1, changes: 2, askAgain: false },
      { state: 'open' }
    ]);
    // The persona's prose is nowhere the writer or another participant reads.
    const shown = JSON.stringify([ledger(), harness.postMessage.mock.calls]);
    expect(shown).not.toContain(PROSE_SENTINEL);
  });

  it('answers the no-file-edit frame with a host line and the one-line why, and no card', async () => {
    answerWith(NONE);
    const result = await press('fixes');
    const answer = lastReply();
    expect(answer.editOfferAnswer).toEqual({
      sourceTurnId: source.id, kind: 'fixes', outcome: 'none', why: `Already reads beginning ${WHY_SENTINEL}.`
    });
    expect(answer.content).toBe(`Jill found nothing to change: Already reads beginning ${WHY_SENTINEL}.`);
    expect(answer.fileEditProposals).toBeUndefined();
    expect(result).toEqual(expect.objectContaining({ answer: 'answered', outcome: 'none', message: 'Jill found nothing to change.' }));
    expect(result.cards).toBeUndefined();
    expect(offerViews()[0].status).toEqual({ state: 'nothing-to-change', answerTurnId: answer.id, askAgain: true });
  });

  it('refuses a card for a file other than the offer\'s, and a fix that is more than a fix', async () => {
    answerWith([
      fixes('chapters/the-pool-of-tears.md'),
      fixes(CHAPTER, ['<find>She was tired.</find>', `<replace-with>${'Alice had grown so tired of sitting by her sister on the bank. '.repeat(2)}</replace-with>`])
    ].join('\n'));
    const result = await press('fixes');
    expect(lastReply().fileEditProposals?.map((card) => [card.state, card.reason, card.intent])).toEqual([
      ['refused', 'not-the-offered-file', 'fixes'],
      ['refused', 'more-than-a-fix', 'fixes']
    ]);
    expect(result).toEqual(expect.objectContaining({ answer: 'answered', cards: 2 }));
    // Every card is spent, so D7 lets the offer be asked again.
    expect(offerViews()[0].status).toEqual(expect.objectContaining({ state: 'ask-again', askAgain: true }));
    answerWith(fixes());
    expect(await press('fixes')).toEqual(expect.objectContaining({ answer: 'answered', cards: 1, changes: 2 }));
  });

  it('holds only a fixes answer to the fixes policy: the same long replace is a pending rewrites card', async () => {
    answerWith(fixes(CHAPTER, ['<find>She was tired.</find>', `<replace-with>${'Alice had grown so tired of sitting by her sister on the bank. '.repeat(2)}</replace-with>`]));
    await press('rewrites');
    expect(lastReply().editOfferAnswer?.kind).toBe('rewrites');
    expect(lastReply().fileEditProposals?.map((card) => [card.state, card.intent])).toEqual([['pending', undefined]]);
  });

  it('refuses a second press while the answer\'s card is pending: asking again could double it', async () => {
    answerWith(fixes());
    await press('fixes');
    const turns = ledger().length;
    const result = await press('fixes');
    expect(result).toEqual(expect.objectContaining({
      answer: 'refused', reason: 'already-answered', message: WORKSHOP_EDIT_OFFER_REFUSAL_WORDS['already-answered']
    }));
    expect(ledger()).toHaveLength(turns);
    expect(harness.service.continueConversation).toHaveBeenCalledTimes(1);
  });

  it('an answer with neither edits nor the no-edit frame leaves no turns, and the offer open', async () => {
    answerWith(`I would rather talk it through. ${PROSE_SENTINEL}`);
    const turns = ledger().length;
    const result = await press('fixes');
    expect(result).toEqual(expect.objectContaining({ answer: 'failed', reason: 'no-answer', message: WORKSHOP_EDIT_OFFER_REFUSAL_WORDS['no-answer'] }));
    expect(ledger()).toHaveLength(turns);
    expect(ledger().some((turn) => turn.editOfferRequest || turn.editOfferAnswer)).toBe(false);
    expect(offerViews()[0].status).toEqual({ state: 'open' });
    expect(harness.session.getSnapshot().activeRequestId).toBeUndefined();
  });

  it('a stopped run leaves no turns, and the offer open', async () => {
    harness.service.continueConversation.mockImplementationOnce(((_id: string, _message: string, options: { signal?: AbortSignal }) =>
      new Promise((resolve) => options.signal?.addEventListener('abort', () =>
        resolve(analysisResult(fixes(), { conversationId: 'host-conv' }))))) as never);
    const turns = ledger().length;
    const pressed = route(MessageType.WORKSHOP_EDIT_OFFER_ACTION, {
      requestId: 'stopped', roomRevision: harness.session.readRoomRevision(), turnId: source.id, kind: 'fixes'
    });
    await Promise.resolve();
    // While it runs: the request turn stands, and the chip reads asked.
    expect(ledger().at(-1)?.editOfferRequest).toEqual({ sourceTurnId: source.id, kind: 'fixes' });
    expect(offerViews()[0].status).toEqual({ state: 'asked' });
    await route(MessageType.CANCEL_WORKSHOP_REQUEST, { requestId: harness.session.getSnapshot().activeRequestId, domain: 'workshop' });
    await pressed;
    await settle();

    const result = harness.posted(MessageType.WORKSHOP_EDIT_OFFER_RESULT).at(-1)!.payload;
    expect(result).toEqual(expect.objectContaining({ requestId: 'stopped', answer: 'failed', reason: 'stopped' }));
    expect(ledger()).toHaveLength(turns);
    expect(offerViews()[0].status).toEqual({ state: 'open' });
  });

  it('a failed run leaves no turns, and the offer open', async () => {
    harness.service.continueConversation.mockRejectedValueOnce(new Error('socket hang up'));
    const turns = ledger().length;
    const result = await press('rewrites');
    expect(result).toEqual(expect.objectContaining({ answer: 'failed', reason: 'failed' }));
    expect(ledger()).toHaveLength(turns);
    expect(offerViews()[1].status).toEqual({ state: 'open' });
  });

  it('refuses a press during a run, with the reason, and never queues it', async () => {
    let finish: (value: unknown) => void = () => undefined;
    harness.service.continueConversation.mockImplementationOnce((() => new Promise((resolve) => {
      finish = resolve;
    })) as never);
    const running = route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And what of the Queen?' });
    await Promise.resolve();
    const turns = ledger().length;

    const result = await press('fixes');

    expect(result).toEqual(expect.objectContaining({ answer: 'refused', reason: 'run-active', message: 'Wait for the current reply to finish.' }));
    expect(ledger()).toHaveLength(turns);
    finish(analysisResult('The Queen comes later.', { conversationId: 'host-conv' }));
    await running;
    await settle();
    // Not queued: the run that was going finished, and no press followed it.
    expect(harness.service.continueConversation).toHaveBeenCalledTimes(1);
    expect(ledger().some((turn) => turn.editOfferRequest)).toBe(false);
  });

  it('refuses a press after file edits were turned off, and stops drawing the chips', async () => {
    setFileEdits('off');
    const turns = ledger().length;
    const result = await press('fixes');
    expect(result).toEqual(expect.objectContaining({ answer: 'refused', reason: 'file-edits-off' }));
    expect(ledger()).toHaveLength(turns);
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And what of the Queen?' });
    await settle();
    expect(offerViews()).toBeUndefined();
    // The offer itself is still on the turn: turning the setting back on draws it again.
    expect(ledger().find((turn) => turn.id === source.id)?.editOffers).toHaveLength(2);
  });

  it.each([
    ['another room\'s press', { roomRevision: -1 }, 'room-changed'],
    ['a turn the room does not hold', { turnId: 'turn-404' }, 'no-turn']
  ])('refuses %s and adds no turn', async (_name, overrides, reason) => {
    const turns = ledger().length;
    expect(await press('fixes', overrides)).toEqual(expect.objectContaining({ answer: 'refused', reason }));
    expect(ledger()).toHaveLength(turns);
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
  });

  it('refuses a kind the reply did not offer, and a press that names nothing', async () => {
    const writerTurn = ledger().find((turn) => turn.participant === 'writer')!;
    expect(await press('fixes', { turnId: writerTurn.id })).toEqual(expect.objectContaining({ answer: 'refused', reason: 'no-offer' }));
    await route(MessageType.WORKSHOP_EDIT_OFFER_ACTION, { requestId: 'bad', roomRevision: 1, turnId: source.id, kind: 'both' });
    await route(MessageType.WORKSHOP_EDIT_OFFER_ACTION, { requestId: 'bad-2', roomRevision: 1, turnId: source.id, kind: 'fixes', text: undefined, path: 7 });
    expect(harness.posted(MessageType.WORKSHOP_EDIT_OFFER_RESULT).some((entry) => entry.payload.requestId === 'bad')).toBe(false);
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
  });

  it('refuses a press once the reply\'s author has left the room, and says so in the view', async () => {
    await route(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' });
    await settle();
    harness.service.continueConversation.mockResolvedValueOnce(analysisResult(`${SAID}\n\n${OFFERS}`, { conversationId: 'guest-conv' }) as never);
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Margot, any slips?' });
    await settle();
    source = lastReply();
    await route(MessageType.WORKSHOP_DISMISS_GUEST, { personaId: 'margot' });
    await settle();
    harness.service.continueConversation.mockClear();
    const turns = ledger().length;

    const result = await press('fixes');

    expect(result).toEqual(expect.objectContaining({ answer: 'refused', reason: 'author-left' }));
    expect(ledger()).toHaveLength(turns);
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
    await route(MessageType.WORKSHOP_REQUEST_SESSION, {});
    expect(offerViews()[0].status).toEqual({ state: 'open', blocked: 'author-left' });
  });

  it('a guest\'s reply is answered by that guest, whoever the composer points at', async () => {
    await route(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' });
    await settle();
    harness.service.continueConversation.mockResolvedValueOnce(analysisResult(`${SAID}\n\n${OFFERS}`, { conversationId: 'guest-conv' }) as never);
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Margot, any slips?' });
    await settle();
    source = lastReply();
    expect(source.participant).toBe('guest');
    await route(MessageType.WORKSHOP_SET_CHAT_TARGET, { kind: 'host' });
    harness.service.continueConversation.mockClear();
    harness.service.continueConversation.mockResolvedValueOnce(analysisResult(fixes(), { conversationId: 'guest-conv' }) as never);

    const result = await press('fixes');

    expect(harness.service.continueConversation.mock.calls[0][0]).toBe('guest-conv');
    expect(lastReply()).toEqual(expect.objectContaining({ participant: 'guest', personaId: 'margot' }));
    expect(result).toEqual(expect.objectContaining({ answer: 'answered', outcome: 'proposed' }));
    // The composer still points at the host.
    expect(harness.session.getChatTarget()).toEqual({ kind: 'host' });
  });

  it('logs ids, kinds, counts and fault names: never a path, a URI, the reply, the prose or the why', async () => {
    answerWith(`Chatter ${PROSE_SENTINEL}.\n\n${fixes()}`);
    await press('fixes');
    answerWith(NONE);
    await press('rewrites');
    answerWith(`Only talk ${PROSE_SENTINEL}.`);
    await press('rewrites');
    const written = logs();
    expect(written).toContain('[WorkshopEditOfferHandler] press taken');
    expect(written).toContain('outcome=proposed; cards=1; changes=2');
    expect(written).toContain('reason=no-answer');
    for (const secret of [CHAPTER, 'down-the-rabbit-hole', URI_SENTINEL, SAID_SENTINEL, PROSE_SENTINEL, WHY_SENTINEL, 'begining']) {
      expect(written).not.toContain(secret);
    }
  });
});
