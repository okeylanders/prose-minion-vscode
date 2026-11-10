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
  const staging = fakeFileEditStaging({ excerptPath: () => excerptPath });
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
  const options = (given: { signal?: AbortSignal; onToken?: (token: string) => void; finalReply?: { check: AgentRunOptions['finalReplyCheck']; retained: (reply: string) => string } }): AgentRunOptions => ({
    signal: given.signal,
    ...(transport === 'streaming' ? { onToken: given.onToken ?? (() => undefined) } : {}),
    retainedAssistantContentSanitizer: given.finalReply?.retained ?? sanitizeWorkshopReplyForRetention,
    finalReplyCheck: given.finalReply?.check
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
