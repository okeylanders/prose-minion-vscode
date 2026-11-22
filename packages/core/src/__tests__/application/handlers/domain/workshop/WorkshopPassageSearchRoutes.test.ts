/**
 * A persona's passage-search card, through the real router, room handler,
 * session and completion (ADR 2026-11-20 D17–D21, D19a). The engine is a
 * fake that makes no call, and the provider is the harness's mock.
 *
 * - The price is never skipped: a Run naming another key answers the new
 *   estimate and searches nothing.
 * - Delivered means the persona's reply was adopted: every other outcome
 *   of a delivery leaves no request turn, no active run and a `ready` card
 *   whose Send delivers without a second search.
 * - Logs carry ids, counts and reason kinds only.
 * Made-up text: Alice.
 */

import { API_KEY_NOT_CONFIGURED_HEADING, MessageType, type WorkshopPassageSearchCardView, type WorkshopTurn } from '@messages';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import { WorkshopContextTallyRecorder } from '@services/analysis/WorkshopContextTally';
import { WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS } from '@shared/constants/workshopPassageSearchWords';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';
import {
  aliceResult,
  CHAPTER,
  fakePassageSearch,
  LABEL_SENTINEL,
  NOTE_SENTINEL,
  PATH_SENTINEL,
  QUESTION,
  QUESTION_SENTINEL,
  QUOTE_SENTINEL,
  searchFrame,
  type FakePassageSearch
} from './passageSearchRouteFixtures';

const ASKED = 'I would like every watch moment found before we talk about pacing.';

describe('Workshop routes — a persona\'s passage search', () => {
  let harness: WorkshopRouteTestHarness;
  let search: FakePassageSearch;
  let card: WorkshopTurn;
  let asked = 0;

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const settle = async () => {
    for (let round = 0; round < 10; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const ledger = () => harness.session.readRoomLedger();
  const act = async (type: MessageType, extra: Record<string, unknown> = {}) => {
    asked += 1;
    const requestId = `ps-${asked}`;
    const running = route(type, { requestId, roomRevision: harness.session.readRoomRevision(), turnId: card.id, ...extra });
    return { requestId, running };
  };
  const answersOf = (requestId: string) => harness.posted(MessageType.WORKSHOP_PASSAGE_SEARCH_RESULT)
    .map((entry) => entry.payload).filter((payload) => payload.requestId === requestId);
  const done = async (type: MessageType, extra: Record<string, unknown> = {}) => {
    const { requestId, running } = await act(type, extra);
    await running;
    await settle();
    return answersOf(requestId);
  };
  const view = async (): Promise<WorkshopPassageSearchCardView | undefined> => {
    await route(MessageType.WORKSHOP_REQUEST_SESSION, {});
    return harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1)!.payload.session.turns
      .find((turn: WorkshopTurn) => turn.id === card.id)?.passageSearchRequest?.view;
  };
  const logs = () => (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).join('\n');
  const requestTurns = () => ledger().filter((turn) => turn.passageSearchResults);
  const lastDelivery = () => harness.service.continueConversation.mock.calls.at(-1) as unknown as
    [string, string, { contextTally: WorkshopContextTallyRecorder; onToken?: (token: string) => void; finalReply?: unknown }];

  beforeEach(async () => {
    asked = 0;
    search = fakePassageSearch();
    harness = createWorkshopRouteTestHarness({ passageSearch: search.ports });
    await harness.pin();
    harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(
      analysisResult(`${ASKED}\n\n${searchFrame()}`, { conversationId: 'host-conv' }) as never
    );
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Where does the Rabbit check his watch?' });
    await settle();
    card = [...ledger()].reverse().find((turn) => turn.passageSearchRequest)!;
    harness.service.continueConversation.mockClear();
  });

  it('commits the card with the reply, settled against one listing, and shows it pending', async () => {
    expect(card.content).toBe(ASKED);
    expect(card.passageSearchRequest).toEqual({
      question: QUESTION,
      scopes: [{ kind: 'group', group: 'chapters' }, { kind: 'file', group: 'chapters', path: CHAPTER }, { kind: 'excerpt' }]
    });
    expect(search.listGroupFiles).toHaveBeenCalledTimes(1);
    expect(search.listGroupFiles).toHaveBeenCalledWith(['chapters']);
    expect(card.trailerOutcomes?.passageSearch).toEqual({ cards: 1, dropped: [] });
    expect(await view()).toEqual({ status: 'pending' });
    // Nothing was priced or sent to a model for the request itself.
    expect(search.plan).not.toHaveBeenCalled();
  });

  it('answers the price from the stored card, and sends nothing', async () => {
    const [answer] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE);
    expect(answer).toEqual(expect.objectContaining({
      action: 'estimate', outcome: 'done',
      estimate: { planKey: 'key-1', calls: 4, files: 2, model: 'model/search', usd: 0.42, organizes: true }
    }));
    expect(search.requests()[0]).toEqual({
      question: QUESTION,
      organize: true,
      scopes: [
        { kind: 'group', group: 'chapters' },
        { kind: 'file', file: { group: 'chapters', path: CHAPTER } },
        { kind: 'text', label: 'Excerpt', text: 'A pinned excerpt.' }
      ]
    });
    expect(search.run).not.toHaveBeenCalled();
  });

  it('a Run naming another key answers the new estimate and searches nothing', async () => {
    search.planKey = 'key-2';
    const answers = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    expect(answers).toEqual([expect.objectContaining({ action: 'run', outcome: 'price-changed', estimate: expect.objectContaining({ planKey: 'key-2' }) })]);
    expect(search.run).not.toHaveBeenCalled();
    expect(await view()).toEqual({ status: 'pending' });
  });

  it('a Run with the key shown searches, then delivers to the author in an idle room', async () => {
    harness.service.continueConversation.mockResolvedValueOnce(analysisResult('Three watch moments, all in one chapter.', { conversationId: 'host-conv' }) as never);
    const answers = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });

    expect(answers.map((answer) => answer.outcome)).toEqual(['started', 'finished']);
    expect(search.run).toHaveBeenCalledTimes(1);
    const [conversationId, sent, options] = lastDelivery();
    expect(conversationId).toBe('host-conv');
    expect(sent).toContain('<prose-minion-passage-search-results>');
    expect(sent).toContain(`${QUOTE_SENTINEL} 3`);
    // It streams, and takes ordinary prose: no final-reply check.
    expect(options.finalReply).toBeUndefined();
    // Tallied where it is placed, under its own piece; the card's own outcomes ride the same message.
    const frame = /<prose-minion-passage-search-results>[\s\S]*<\/prose-minion-passage-search-results>/.exec(sent)![0];
    expect(options.contextTally.snapshot()['room.passage-search']).toBe(estimateTextTokens(frame));
    expect(sent).toContain('<workshop-trailer-outcomes');
    expect(sent).not.toContain('workshop-reaction-invite');

    const request = requestTurns();
    expect(request).toHaveLength(1);
    expect(request[0].content).toBe('Passage search finished: 3 instances in 1 file.');
    expect(request[0].passageSearchResults).toEqual({ cardTurnId: card.id });
    const reply = ledger().at(-1)!;
    expect(reply.passageSearchDelivery).toEqual({
      cardTurnId: card.id, instances: 3, files: 1, labels: 1, dropped: 3,
      calls: { planned: 4, answered: 4, failed: 0, cut: 0, unsent: 0, cancelled: 0 }, ended: 'complete', organized: false, shown: 3
    });
    expect(await view()).toEqual(expect.objectContaining({ status: 'delivered', shown: 3, reportHeld: true }));
    // The receipt is the host's: the webview's reply does not carry it.
    const posted = harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1)!.payload.session.turns as WorkshopTurn[];
    expect(posted.some((turn) => turn.passageSearchDelivery)).toBe(false);
  });

  it('pushes progress by the Run\'s request id, and Stop leaves a ready card that is never sent', async () => {
    search.hold = true;
    const { requestId, running } = await act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await settle();
    search.progress({ calls: { planned: 4, done: 2 }, found: 5 });
    expect(harness.posted(MessageType.WORKSHOP_PASSAGE_SEARCH_PROGRESS).at(-1)!.payload)
      .toEqual({ requestId, turnId: card.id, done: 2, planned: 4, found: 5 });
    expect(await view()).toEqual({ status: 'running', progress: { done: 2, planned: 4, found: 5 } });

    // A second Run is refused in the room's busy words while one is going.
    const [second] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    expect(second).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'search-running', message: WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['search-running'] }));

    const [stopped] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_STOP);
    expect(stopped.outcome).toBe('done');
    await running;
    await settle();

    expect(answersOf(requestId).at(-1)).toEqual(expect.objectContaining({
      outcome: 'finished', message: 'Stopped: 3 instances from 2 of 4 reads. 1 call was stopped in flight and may still have been charged.'
    }));
    // A call stopped in flight is kept apart from one never made, on the card and on the receipt.
    expect((await view() as { counts: { calls: unknown } }).counts.calls).toEqual({ planned: 4, answered: 2, failed: 0, cut: 0, unsent: 1, cancelled: 1 });
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
    expect(requestTurns()).toHaveLength(0);
    expect(await view()).toEqual(expect.objectContaining({ status: 'ready', partial: true }));

    // Send is the writer's press: the partial result goes, with no second search.
    const [sent] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
    expect(sent.outcome).toBe('done');
    expect(search.run).toHaveBeenCalledTimes(1);
    expect(ledger().at(-1)!.passageSearchDelivery?.ended).toBe('stopped');
    expect(ledger().at(-1)!.passageSearchDelivery?.calls).toEqual({ planned: 4, answered: 2, failed: 0, cut: 0, unsent: 1, cancelled: 1 });
    expect(lastDelivery()[1]).toContain('1 call was stopped in flight, so the text they cover was not searched; they may still have been charged.');
    expect(lastDelivery()[1]).toContain('Ended early: Stopped before every call was answered.');
  });

  it('a room busy at the finish leaves the card ready, and Send delivers', async () => {
    search.hold = true;
    const { running } = await act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await settle();
    let reply!: (value: unknown) => void;
    harness.service.continueConversation.mockImplementationOnce(() => new Promise((resolve) => { reply = resolve; }) as never);
    const writing = route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Meanwhile, a question about the Duchess.' });
    await settle();
    search.finish();
    await running;
    await settle();

    expect(harness.service.continueConversation).toHaveBeenCalledTimes(1);
    expect(requestTurns()).toHaveLength(0);
    expect(await view()).toEqual(expect.objectContaining({ status: 'ready', partial: false }));
    const [early] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
    expect(early).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'run-active' }));

    reply(analysisResult('About the Duchess.', { conversationId: 'host-conv' }));
    await writing;
    await settle();
    const [sent] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
    expect(sent.outcome).toBe('done');
    expect(search.run).toHaveBeenCalledTimes(1);
    expect(await view()).toEqual(expect.objectContaining({ status: 'delivered' }));
  });

  describe('a delivery that is not adopted', () => {
    const notAdopted = async (why: string) => {
      expect(requestTurns()).toHaveLength(0);
      expect(harness.session.getSnapshot().activeRequestId).toBeUndefined();
      expect(await view()).toEqual(expect.objectContaining({ status: 'ready' }));
      expect(ledger().some((turn) => turn.passageSearchDelivery)).toBe(false);
      // Send tries again with the held result: no second search.
      harness.service.continueConversation.mockResolvedValueOnce(analysisResult(`After ${why}.`, { conversationId: 'host-conv' }) as never);
      const [sent] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
      expect(sent.outcome).toBe('done');
      expect(search.run).toHaveBeenCalledTimes(1);
      expect(requestTurns()).toHaveLength(1);
      expect(ledger().at(-1)!.passageSearchDelivery?.cardTurnId).toBe(card.id);
    };

    it('stopped: no request turn, no active run, a ready card, and Send delivers', async () => {
      let reply!: (value: unknown) => void;
      harness.service.continueConversation.mockImplementationOnce(() => new Promise((resolve) => { reply = resolve; }) as never);
      const { requestId, running } = await act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      await settle();
      // While it runs the request turn stands, and the card says it is on its way.
      expect(requestTurns()).toHaveLength(1);
      expect(await view()).toEqual(expect.objectContaining({ status: 'ready', sending: true }));
      await route(MessageType.CANCEL_WORKSHOP_REQUEST, { requestId: harness.session.getSnapshot().activeRequestId, domain: 'workshop' });
      reply(analysisResult('A reply nobody will see.', { conversationId: 'host-conv' }));
      await running;
      await settle();
      expect(answersOf(requestId).at(-1)!.message).toContain(WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['delivery-failed']);
      await notAdopted('a stop');
    });

    it('no key: the same', async () => {
      harness.service.continueConversation.mockResolvedValueOnce(analysisResult(`${API_KEY_NOT_CONFIGURED_HEADING}\n\nAdd one.`, { conversationId: 'host-conv' }) as never);
      await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      await notAdopted('a missing key');
    });

    it('no retained conversation: the same', async () => {
      // The host's conversation was lost, so the delivery starts a fresh one, which returns none.
      harness.session.clearAllConversations();
      harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(analysisResult('A reply with nowhere to live.') as never);
      await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      expect(requestTurns()).toHaveLength(0);
      expect(harness.session.getSnapshot().activeRequestId).toBeUndefined();
      expect(await view()).toEqual(expect.objectContaining({ status: 'ready' }));
      harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(analysisResult('Now retained.', { conversationId: 'host-conv-2' }) as never);
      const [sent] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
      expect(sent.outcome).toBe('done');
      expect(search.run).toHaveBeenCalledTimes(1);
      expect(ledger().at(-1)!.passageSearchDelivery?.cardTurnId).toBe(card.id);
    });

    it('a thrown provider failure: the same', async () => {
      harness.service.continueConversation.mockRejectedValueOnce(new Error('socket hang up'));
      await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      await notAdopted('a failure');
    });
  });

  it('refuses a Send once the author left, and keeps the result', async () => {
    await route(MessageType.WORKSHOP_INVITE_GUEST, { personaId: 'margot', openingMessage: 'Read this with us.' });
    await settle();
    harness.service.continueConversation.mockResolvedValueOnce(analysisResult(`${ASKED}\n\n${searchFrame()}`, { conversationId: 'guest-conv' }) as never);
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Margot, the watch?' });
    await settle();
    card = [...ledger()].reverse().find((turn) => turn.passageSearchRequest)!;
    expect(card.participant).toBe('guest');
    search.result = aliceResult(2, { ended: 'stopped' });
    await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await route(MessageType.WORKSHOP_DISMISS_GUEST, { personaId: 'margot' });
    await settle();
    harness.service.continueConversation.mockClear();

    const [sent] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
    expect(sent).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'author-left' }));
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
    expect(await view()).toEqual(expect.objectContaining({ status: 'ready', authorLeft: true }));
  });

  it('a room replaced mid-search aborts it as the replacement lands, and nothing reaches the new room', async () => {
    search.hold = true;
    const { requestId, running } = await act(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await settle();
    const signal = (search.run.mock.calls[0][1] as { signal: AbortSignal }).signal;
    // New: the coordinator tells the replacement in the step that swaps the room. Nothing is drawn, and no call answers.
    await harness.persistence.resetSession({ start: 'carry' });
    expect(signal.aborted).toBe(true);
    await running;
    await settle();

    expect(answersOf(requestId).at(-1)).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'room-changed' }));
    expect(harness.service.continueConversation).not.toHaveBeenCalled();
    expect(harness.service.startWorkshopPersonaConversation).toHaveBeenCalledTimes(1);
    expect(requestTurns()).toHaveLength(0);
  });

  describe('a Rewind of the same open room keeps a card\'s result (D19); the real coordinator\'s path is WorkshopPassageSearchRoomInstances', () => {
    /** The session cut at a turn under a new revision, and the coordinator's word for it: a Rewind, or another room. */
    const replaceKeeping = (keep: (turn: WorkshopTurn) => boolean = () => true, said: 'rewound' | 'replaced' | 'nothing' = 'rewound'): void => {
      const state = harness.session.exportCommittedState();
      harness.session.hydrateCommittedState(
        { ...state, turns: state.turns.filter(keep) }, { host: 'host-conv' } as never, harness.session.getConversationBehavior()
      );
      if (said !== 'nothing') {
        harness.roomInstance[said]();
      }
    };
    const rewindKeeping = (keep?: (turn: WorkshopTurn) => boolean): void => replaceKeeping(keep, 'rewound');

    it('a result not yet sent is still ready, and Send delivers it without a second search', async () => {
      search.result = aliceResult(2, { ended: 'stopped' });
      await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      const before = harness.session.readRoomRevision();
      rewindKeeping();
      expect(harness.session.readRoomRevision()).not.toBe(before);
      expect(await view()).toEqual(expect.objectContaining({ status: 'ready' }));

      harness.service.continueConversation.mockResolvedValueOnce(analysisResult('Two watch moments, then.') as never);
      const [sent] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
      expect(sent.outcome).toBe('done');
      expect(search.run).toHaveBeenCalledTimes(1);
      expect(lastDelivery()[1]).toContain(`${QUOTE_SENTINEL} 2`);
      expect(await view()).toEqual(expect.objectContaining({ status: 'delivered' }));
    });

    it('a Rewind that cut only the delivery reads ready again, with the result it delivered', async () => {
      search.result = aliceResult(2, { ended: 'stopped' });
      await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      harness.service.continueConversation.mockResolvedValueOnce(analysisResult('Two watch moments, then.') as never);
      await done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
      expect(await view()).toEqual(expect.objectContaining({ status: 'delivered' }));

      const delivery = new Set(ledger().filter((turn) => turn.passageSearchResults || turn.passageSearchDelivery).map((turn) => turn.id));
      expect(delivery.size).toBe(2);
      rewindKeeping((turn) => !delivery.has(turn.id));
      expect(requestTurns()).toHaveLength(0);
      expect(await view()).toEqual(expect.objectContaining({ status: 'ready' }));

      harness.service.continueConversation.mockResolvedValueOnce(analysisResult('Two watch moments, again.') as never);
      const [sent] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
      expect(sent.outcome).toBe('done');
      expect(search.run).toHaveBeenCalledTimes(1);
      expect(logs()).toContain('room rewound kept=1 dropped=0');
    });

    it('a Rewind past the card drops its result', async () => {
      search.result = aliceResult(2, { ended: 'stopped' });
      await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      rewindKeeping((turn) => turn.id !== card.id);
      const [sent] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
      expect(sent).toEqual(expect.objectContaining({ outcome: 'refused' }));
      expect(logs()).toContain('room rewound kept=0 dropped=1');
      expect(harness.service.continueConversation).not.toHaveBeenCalled();
    });

    it.each([['another open room', 'replaced'], ['a revision moved with no word', 'nothing']] as const)(
      '%s drops it, even one holding the same card under the same turn id', async (_name, said) => {
        search.result = aliceResult(2, { ended: 'stopped' });
        await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
        // Open, a reload of the same named session, Branch: the same ledger, and the same session id too.
        replaceKeeping(() => true, said);
        expect(await view()).toEqual({ status: 'pending' });
        const [sent] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_SEND);
        expect(sent).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'not-ready' }));
        const [report] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT);
        expect(report).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'not-held' }));
        expect(search.save).not.toHaveBeenCalled();
        expect(logs()).not.toContain('room rewound');
        expect(logs()).toContain(said === 'replaced' ? 'room replaced dropped=1' : 'room replaced unannounced dropped=1');
      });

    it('a Rewind that changed the card under the same turn id and question drops it', async () => {
      search.result = aliceResult(2, { ended: 'stopped' });
      await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
      const state = harness.session.exportCommittedState();
      harness.session.hydrateCommittedState({
        ...state,
        turns: state.turns.map((turn) => turn.id === card.id
          ? { ...turn, passageSearchRequest: { ...turn.passageSearchRequest!, scopes: [{ kind: 'group' as const, group: 'characters' as const }] } }
          : turn)
      }, { host: 'host-conv' } as never, harness.session.getConversationBehavior());
      harness.roomInstance.rewound();
      expect(await view()).toEqual({ status: 'pending' });
      const [report] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT);
      expect(report).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'not-held' }));
      expect(logs()).toContain('room rewound kept=0 dropped=1');
    });
  });

  it('Cancel is stored on the card, and a cancelled card cannot be run', async () => {
    const [cancelled] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_CANCEL);
    expect(cancelled.outcome).toBe('done');
    expect(ledger().find((turn) => turn.id === card.id)!.passageSearchRequest!.answer).toBe('cancelled');
    expect(await view()).toEqual({ status: 'cancelled' });
    const [run] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    expect(run).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'not-pending' }));
    expect(search.run).not.toHaveBeenCalled();
  });

  it('opens the shared report while the result is held, and says so once it is not', async () => {
    search.result = aliceResult(2, { ended: 'stopped' });
    await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    const [opened] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT);
    expect(opened.outcome).toBe('done');
    // The shared export writes it, from the display-safe view: never the engine's result, never a host path.
    const saved = search.save.mock.calls[0][0] as { instances: Array<{ quote: string }>; canOrganize: boolean };
    expect(saved.instances.map((instance) => instance.quote).join('\n')).toContain(`${QUOTE_SENTINEL} 2`);
    expect(saved.canOrganize).toBe(false);
    expect(JSON.stringify(saved)).not.toContain('absolutePath');

    const [discarded] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_DISCARD);
    expect(discarded.outcome).toBe('done');
    expect(await view()).toEqual({ status: 'pending' });
    const [gone] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT);
    expect(gone).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'not-held', message: WORKSHOP_PASSAGE_SEARCH_REFUSAL_WORDS['not-held'] }));
  });

  it('refuses a request for another room, and logs ids, counts and reasons only', async () => {
    harness.service.continueConversation.mockResolvedValueOnce(analysisResult('Three watch moments.', { conversationId: 'host-conv' }) as never);
    await done(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE);
    await done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: 'key-1' });
    await done(MessageType.WORKSHOP_PASSAGE_SEARCH_OPEN_REPORT);
    const [stale] = await done(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE, { roomRevision: harness.session.readRoomRevision() + 1 });
    expect(stale).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'room-changed' }));

    const written = logs();
    expect(written).toContain('[WorkshopPassageSearchHandler] run finished');
    expect(written).toContain('delivery adopted');
    for (const sentinel of [QUESTION_SENTINEL, QUOTE_SENTINEL, NOTE_SENTINEL, LABEL_SENTINEL, PATH_SENTINEL]) {
      expect(written).not.toContain(sentinel);
    }
  });
});
