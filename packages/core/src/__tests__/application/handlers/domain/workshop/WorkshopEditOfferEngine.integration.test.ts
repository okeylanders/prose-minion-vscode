/**
 * A press through the real engine, conversation store, router, room handler
 * and completion (PR #252 F-01, F-02, F-03; ADR 2026-11-10 D2, D5). Only the
 * provider transport and the staging port are faked: no model is called.
 *
 * - **F-01.** A cut-off or interrupted answer is a failure, in both
 *   transports: the ledger and the persona's whole retained history are as
 *   they were before the press, and no correction is requested.
 * - **F-02.** When a correction succeeds, retained history holds the host's
 *   line in place of the rejected prose, never the prose.
 * - **R1.** A press refused after its reply ended (Stop, or file edits
 *   turned off, while its edits are staged) retained nothing: the engine
 *   holds the exchange until the answer is adopted. A newer run's exchange
 *   is never touched.
 * - **F-03.** An excerpt offer keeps its bound document: pin A, get the
 *   offer, pin B, press, and the answer's `<excerpt/>` is staged against A.
 * Made-up text: Alice.
 */

import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import type { AgentCapability, AgentRunOptions, ExecutionResult } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';
import { OpenRouterApiError } from '@providers/OpenRouterClient';
import { MessageType, type WorkshopTurn } from '@messages';
import { sanitizeWorkshopReplyForRetention } from '@/utils/workshopReplyControls';
import { WORKSHOP_EDIT_REQUEST_CORRECTION } from '@/utils/workshopEditRequestFrame';
import { editOfferFrame, fakeFileEditStaging, fileEditFrame, URI_SENTINEL } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

const SAID = 'Two slips on the first page: "begining" and a doubled "the".';
const PROSE_SENTINEL = 'ZZQ-REJECTED-PROSE';
const EXCERPT_FIX = fileEditFrame({ excerpt: true, why: 'The two slips.', body: ['<find>begining</find>', '<replace-with>beginning</replace-with>'] });
const NONE = '<prose-minion-no-file-edit><why>Already correct.</why></prose-minion-no-file-edit>';

type Transport = 'streaming' | 'non-streaming';
interface Reply { content: string; finishReason?: string; interrupted?: boolean }

const capability = (): AgentCapability<unknown, never> => ({
  catalog: 'workshopPersona',
  appendContract: async (userMessage: string) => userMessage,
  inspectRequest: () => ({ kind: 'none' }),
  fulfill: async () => ({ evidence: '', artifacts: [], deliveredItems: [] }),
  stripToolCalls: (content: string) => content.trim(),
  statusMessage: () => '',
  requestLogSummary: () => '',
  invalidRequestInstruction: () => '',
  limitInstruction: () => ''
});

/** The room harness with its provider calls run by a real engine over a real conversation store. */
function bridged(transport: Transport) {
  let excerptPath = 'drafts/pool-of-tears.md';
  const base = fakeFileEditStaging({ excerptPath: () => excerptPath });
  // Staging is asynchronous (a catalog or file read): a test may hold it open, with no sleep or guessed timing.
  let gate: { entered: () => void; release: Promise<void> } | undefined;
  const staging: typeof base = {
    ...base,
    stage: async (target, stagingOptions) => {
      if (gate) {
        gate.entered();
        await gate.release;
      }
      return base.stage(target, stagingOptions);
    }
  };
  const harness: WorkshopRouteTestHarness = createWorkshopRouteTestHarness({ fileEditStaging: staging });
  const conversations = new ConversationManager();
  const queued: Reply[] = [];
  const next = (): Reply => {
    const reply = queued.shift();
    if (!reply) {
      throw new Error('The provider was asked for a reply the test did not queue');
    }
    return reply;
  };
  const client = {
    createChatCompletion: jest.fn(async () => {
      const reply = next();
      return { content: reply.content, finishReason: reply.finishReason ?? 'stop' };
    }),
    createStreamingChatCompletion: jest.fn(async function* () {
      const reply = next();
      yield { token: reply.content, done: false };
      if (reply.interrupted) {
        throw new OpenRouterApiError('upstream closed the stream', 502, 'provider_error');
      }
      yield { token: '', done: true, finishReason: reply.finishReason ?? 'stop' };
    })
  };
  const engine = new AgentRunEngine(client as never, conversations, jest.fn());
  // As `AssistantToolService` maps them: the Workshop's sanitizer unless the run words its own reply.
  const options = (given: {
    signal?: AbortSignal;
    onToken?: (token: string) => void;
    finalReply?: { check: AgentRunOptions['finalReplyCheck']; retained: (reply: string) => string; deferRetention?: AgentRunOptions['deferRetention'] };
  }): AgentRunOptions => ({
    signal: given.signal,
    ...(transport === 'streaming' ? { onToken: given.onToken ?? (() => undefined) } : {}),
    retainedAssistantContentSanitizer: given.finalReply?.retained ?? sanitizeWorkshopReplyForRetention,
    finalReplyCheck: given.finalReply?.check,
    deferRetention: given.finalReply?.deferRetention
  });
  const result = (run: ExecutionResult, conversationId: string | undefined) => analysisResult(run.content, {
    conversationId: run.conversationId ?? conversationId, finishReason: run.finishReason
  });
  harness.service.startWorkshopPersonaConversation.mockImplementation((async (input: { message: string }, given: never) =>
    result(await engine.runInitial({
      toolName: 'workshop_persona_jill', systemMessage: 'System', userMessage: input.message,
      policy: AGENT_RUN_POLICIES.workshopHost, capability: capability(), options: options(given)
    }), undefined)) as never);
  harness.service.continueConversation.mockImplementation((async (conversationId: string, userMessage: string, given: never) =>
    result(await engine.continueConversation({
      conversationId, userMessage, policy: AGENT_RUN_POLICIES.workshopHost, capability: capability(), options: options(given)
    }), conversationId)) as never);
  harness.service.readWorkshopRetainedHistory.mockImplementation(((id: string) => conversations.getCommittedHistoryCounts(id)) as never);

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const settle = async () => {
    for (let round = 0; round < 8; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const ledger = () => harness.session.readRoomLedger();
  const history = () => conversations.getMessages(harness.session.getHostConversationId()!).map((entry) => [entry.role, entry.content]);
  return {
    harness, staging, engine, client, queued, route, settle, ledger, history,
    /** Hold the next staging call open: resolves `entered` once staging is reached; `release` lets it finish. */
    holdStaging: () => {
      let release: () => void = () => undefined;
      let entered: () => void = () => undefined;
      const reached = new Promise<void>((resolve) => { entered = resolve; });
      gate = { entered, release: new Promise<void>((resolve) => { release = resolve; }) };
      return { reached, release: () => { gate = undefined; release(); } };
    },
    setFileEdits: (value: unknown) => {
      const get = harness.settings.get.bind(harness.settings);
      (harness.settings as { get: unknown }).get = ((section: string, key: string, fallback?: unknown) =>
        key === 'workshop.fileEdits' ? value : get(section, key, fallback as never)) as typeof harness.settings.get;
    },
    pinTo: async (relativePath: string) => {
      excerptPath = relativePath;
      await route(MessageType.WORKSHOP_SET_EXCERPT, {
        text: `Alice, in ${relativePath}.`,
        source: { kind: 'file', sourceUri: `file:///ws/${relativePath}`, relativePath }
      });
    },
    /** A reply with an excerpt-targeted fixes offer, from the host. */
    offered: async (): Promise<WorkshopTurn> => {
      queued.push({ content: `${SAID}\n\n${editOfferFrame({ kind: 'fixes', excerpt: true, count: 2 })}` });
      await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Read the first page for slips.' });
      await settle();
      return [...ledger()].reverse().find((turn) => turn.role === 'assistant')!;
    },
    press: async (source: WorkshopTurn) => {
      await route(MessageType.WORKSHOP_EDIT_OFFER_ACTION, {
        requestId: 'press', roomRevision: harness.session.readRoomRevision(), turnId: source.id, kind: 'fixes'
      });
      await settle();
      return harness.posted(MessageType.WORKSHOP_EDIT_OFFER_RESULT).at(-1)!.payload;
    }
  };
}

describe.each<Transport>(['streaming', 'non-streaming'])('a press through the real engine (%s)', (transport) => {
  let room: ReturnType<typeof bridged>;
  let source: WorkshopTurn;

  beforeEach(async () => {
    room = bridged(transport);
    await room.pinTo('drafts/pool-of-tears.md');
    source = await room.offered();
    expect(source.editOffers).toHaveLength(1);
  });
  afterEach(() => room.engine.dispose());

  const cuts: Array<[string, Partial<Reply>]> = [
    ['at its token ceiling', { finishReason: 'length' }],
    ...(transport === 'streaming' ? [['by the provider, mid-stream', { interrupted: true }] as [string, Partial<Reply>]] : [])
  ];
  it.each(cuts)('F-01: a whole frame in an answer cut off %s is a failure that leaves no hidden exchange', async (_name, cut) => {
    const ledgerBefore = room.ledger();
    const historyBefore = room.history();
    room.queued.push({ content: EXCERPT_FIX, ...cut });
    const calls = room.client.createChatCompletion.mock.calls.length + room.client.createStreamingChatCompletion.mock.calls.length;

    const result = await room.press(source);

    expect(result).toEqual(expect.objectContaining({ answer: 'failed', reason: 'cut-off' }));
    expect(result.message).toBe('The answer was cut off before it finished, so nothing was suggested. Try again, or ask for fewer edits at a time.');
    // The thread and the persona's whole retained history are as they were before the press.
    expect(room.ledger()).toEqual(ledgerBefore);
    expect(room.history()).toEqual(historyBefore);
    // One request: a cut-off answer is refused, never corrected.
    expect(room.client.createChatCompletion.mock.calls.length + room.client.createStreamingChatCompletion.mock.calls.length).toBe(calls + 1);
    expect(room.queued).toEqual([]);
    // The offer reads open, and the same press then succeeds, with one exchange retained for it.
    room.queued.push({ content: EXCERPT_FIX });
    expect(await room.press(source)).toEqual(expect.objectContaining({ answer: 'answered', outcome: 'proposed', cards: 1 }));
    expect(room.history()).toHaveLength(historyBefore.length + 2);
  });

  it('F-01: an answer that ends whole is accepted, and the check and completion read the same reply', async () => {
    const historyBefore = room.history();
    room.queued.push({ content: `\n\n${EXCERPT_FIX}\n\n\n` });
    const result = await room.press(source);
    expect(result).toEqual(expect.objectContaining({ answer: 'answered', outcome: 'proposed', cards: 1, changes: 1 }));
    expect(room.history().slice(historyBefore.length).map(([role]) => role)).toEqual(['user', 'assistant']);
    expect(room.history().at(-1)).toEqual(['assistant', 'Suggested 1 fix as file edits.']);
  });

  it('F-02: after a successful correction, retained history holds the host\'s lines and never the rejected prose', async () => {
    const historyBefore = room.history();
    room.queued.push({ content: `I would rather talk it through first. ${PROSE_SENTINEL}` }, { content: NONE });

    const result = await room.press(source);

    expect(result).toEqual(expect.objectContaining({ answer: 'answered', outcome: 'none' }));
    const added = room.history().slice(historyBefore.length);
    expect(added.map(([role]) => role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(added[0][1]).toContain('<prose-minion-edit-request kind="fixes">');
    expect(added.slice(1)).toEqual([
      ['assistant', 'Did not answer with file edits.'],
      ['user', WORKSHOP_EDIT_REQUEST_CORRECTION],
      ['assistant', 'Found nothing to change: Already correct.']
    ]);
    // The whole retained history, the thread and everything posted: the prose is nowhere.
    expect(JSON.stringify(room.history())).not.toContain(PROSE_SENTINEL);
    expect(JSON.stringify([room.ledger(), room.harness.postMessage.mock.calls])).not.toContain(PROSE_SENTINEL);
    // The model itself was shown its own reply in the correction request.
    const transportMock = transport === 'streaming' ? room.client.createStreamingChatCompletion : room.client.createChatCompletion;
    expect(JSON.stringify((transportMock.mock.calls.at(-1) as unknown[])[0])).toContain(PROSE_SENTINEL);
  });

  it('F-02: a correction that fails too retains nothing at all', async () => {
    const historyBefore = room.history();
    const ledgerBefore = room.ledger();
    room.queued.push({ content: `Talk first. ${PROSE_SENTINEL}` }, { content: `Still talking. ${PROSE_SENTINEL}` });
    expect(await room.press(source)).toEqual(expect.objectContaining({ answer: 'failed', reason: 'no-answer' }));
    expect(room.history()).toEqual(historyBefore);
    expect(room.ledger()).toEqual(ledgerBefore);
  });

  describe('R1: a press refused after its reply ended retained nothing', () => {
    const whileStaging: Array<[string, string, (held: ReturnType<typeof bridged>) => Promise<void>]> = [
      ['the writer presses Stop', 'stopped', async (held) => {
        await held.route(MessageType.CANCEL_WORKSHOP_REQUEST, { requestId: held.harness.session.getSnapshot().activeRequestId, domain: 'workshop' });
      }],
      ['file edits are turned off', 'file-edits-off', async (held) => {
        held.setFileEdits('off');
      }]
    ];

    it.each(whileStaging)('%s while the answer\'s edits are staged: the ledger and the whole retained history are as before the press', async (_name, reason, act) => {
      const ledgerBefore = room.ledger();
      const historyBefore = room.history();
      room.queued.push({ content: EXCERPT_FIX });
      const staging = room.holdStaging();
      const pressed = room.route(MessageType.WORKSHOP_EDIT_OFFER_ACTION, {
        requestId: 'held', roomRevision: room.harness.session.readRoomRevision(), turnId: source.id, kind: 'fixes'
      });
      // The reply has ended and passed its check; its edits are being staged.
      await staging.reached;
      expect(room.history()).toEqual(historyBefore);

      await act(room);
      staging.release();
      await pressed;
      await room.settle();

      const result = room.harness.posted(MessageType.WORKSHOP_EDIT_OFFER_RESULT).at(-1)!.payload;
      expect(result).toEqual(expect.objectContaining({ requestId: 'held', answer: 'failed', reason }));
      expect(room.ledger()).toEqual(ledgerBefore);
      expect(room.history()).toEqual(historyBefore);
      expect(JSON.stringify(room.history())).not.toContain('Suggested 1 fix as file edits.');

      // The same press then succeeds, and retains exactly its own exchange.
      room.setFileEdits('ask');
      room.queued.push({ content: EXCERPT_FIX });
      expect(await room.press(source)).toEqual(expect.objectContaining({ answer: 'answered', outcome: 'proposed', cards: 1 }));
      const added = room.history().slice(historyBefore.length);
      expect(added.map(([role]) => role)).toEqual(['user', 'assistant']);
      expect(added[1]).toEqual(['assistant', 'Suggested 1 fix as file edits.']);
    });

    it('a newer message that takes the room while the edits are staged keeps its own exchange, and the press adds nothing', async () => {
      const historyBefore = room.history();
      room.queued.push({ content: EXCERPT_FIX }, { content: 'The Queen comes later.' });
      const staging = room.holdStaging();
      const pressed = room.route(MessageType.WORKSHOP_EDIT_OFFER_ACTION, {
        requestId: 'overtaken', roomRevision: room.harness.session.readRoomRevision(), turnId: source.id, kind: 'fixes'
      });
      await staging.reached;
      // A new message preempts the run that is still staging, and commits its own exchange first.
      await room.route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And what of the Queen?' });
      await room.settle();
      const newer = room.history();
      expect(newer.slice(historyBefore.length).map(([role]) => role)).toEqual(['user', 'assistant']);
      expect(newer.at(-1)).toEqual(['assistant', 'The Queen comes later.']);

      staging.release();
      await pressed;
      await room.settle();

      // The press's held exchange was never committed: the newer run's history stands, untouched.
      expect(room.history()).toEqual(newer);
      expect(room.ledger().some((turn) => turn.editOfferRequest || turn.editOfferAnswer)).toBe(false);
      expect(room.ledger().at(-1)?.content).toBe('The Queen comes later.');
    });

    it('an adopted answer commits its exchange before its retained-history mark is recorded', async () => {
      const historyBefore = room.history();
      room.queued.push({ content: EXCERPT_FIX });
      await room.press(source);
      expect(room.history()).toHaveLength(historyBefore.length + 2);
      // The mark the completion recorded counts the exchange it describes.
      const marks = room.harness.service.readWorkshopRetainedHistory.mock.results.at(-1)!.value as { messageCount: number };
      expect(marks.messageCount).toBe(room.history().length - 1);
    });
  });

  it('F-03: pin A, get an excerpt offer, pin B, press: the directive names A and the answer is staged against A', async () => {
    const offered = source.editOffers![0].target;
    expect(offered).toEqual({ kind: 'excerpt', documentUri: `file:///ws/${URI_SENTINEL}/drafts/pool-of-tears.md`, relativePath: 'drafts/pool-of-tears.md' });
    await room.pinTo('chapters/down-the-rabbit-hole.md');
    await room.settle();
    // The old offer, its author and the room generation survive the new excerpt.
    expect(room.ledger().find((turn) => turn.id === source.id)?.editOffers?.[0].target).toEqual(offered);
    room.queued.push({ content: EXCERPT_FIX });

    const result = await room.press(source);

    const directive = room.history().filter(([role]) => role === 'user').at(-1)![1];
    expect(directive).toContain('Edit only the file your reply named, drafts/pool-of-tears.md: name it as <excerpt/>.');
    expect(directive).toContain('In this answer <excerpt/> means that file, even if the room\'s excerpt has changed since.');
    expect(directive).not.toContain(URI_SENTINEL);
    expect(result).toEqual(expect.objectContaining({ answer: 'answered', outcome: 'proposed', cards: 1 }));
    const answer = room.ledger().at(-1)!;
    expect(answer.fileEditProposals).toEqual([expect.objectContaining({
      state: 'pending',
      intent: 'fixes',
      requested: { kind: 'excerpt' },
      target: offered
    })]);
    expect(answer.content).toContain('to drafts/pool-of-tears.md,');
    // Unbound, the same frame is the room's excerpt now: B. An ordinary reply is not retargeted.
    room.queued.push({ content: `One for this chapter too.\n\n${EXCERPT_FIX}` });
    await room.route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'And this chapter?' });
    await room.settle();
    expect(room.ledger().at(-1)?.fileEditProposals?.[0].target?.relativePath).toBe('chapters/down-the-rabbit-hole.md');
  });
});
