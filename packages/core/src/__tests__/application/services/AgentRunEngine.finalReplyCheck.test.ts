/**
 * The engine's final-reply check (`AgentRunOptions.finalReplyCheck`; ADR
 * 2026-11-10 D5): feature-agnostic, tested with a mocked transport and no
 * Workshop name. The owner's check returns an instruction or nothing; the
 * engine replays an instruction as a correction turn, spending the policy's
 * existing `maxCorrectionTurns`, and retains nothing when a reply is still
 * refused with none left.
 */
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AGENT_FINAL_REPLY_REFUSED, type AgentCapability, type AgentFinalReplyCheck } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';

const REQUEST = '<prose-minion-tool-call name="dictionary.lookup"><word>curious</word></prose-minion-tool-call>';
const INVALID = '<prose-minion-tool-call name="secrets.read"></prose-minion-tool-call>';
const INSTRUCTION = 'Answer with one word: yes or no.';
const oneWord = (reply: string): string | undefined => /^(yes|no)$/i.test(reply.trim()) ? undefined : INSTRUCTION;

const capability = (): jest.Mocked<AgentCapability<any, any>> => ({
  catalog: 'workshopPersona',
  appendContract: jest.fn(async (message) => message),
  inspectRequest: jest.fn((candidate) => candidate === REQUEST
    ? { kind: 'request', request: { word: 'curious' } }
    : candidate === INVALID ? { kind: 'invalid', reason: 'unknown-capability' } : { kind: 'none' }),
  fulfill: jest.fn(async () => ({ evidence: 'Curious: eager to know.', deliveredItems: ['dictionary.lookup'], artifacts: [] })),
  stripToolCalls: jest.fn((content) => content.includes('<prose-minion-tool-call') ? '' : content.trim()),
  statusMessage: jest.fn(() => 'Looking it up…'),
  requestLogSummary: jest.fn(() => 'word'),
  invalidRequestInstruction: jest.fn(() => 'Correct the call or answer without it.'),
  limitInstruction: jest.fn(() => 'Answer now.')
} as unknown as jest.Mocked<AgentCapability<any, any>>);

describe('AgentRunEngine: the final-reply check', () => {
  let client: { createChatCompletion: jest.Mock; createStreamingChatCompletion: jest.Mock };
  let conversations: ConversationManager;
  let engine: AgentRunEngine;
  let conversationId: string;
  const replies = (...contents: string[]) => contents.forEach((content) => client.createChatCompletion.mockResolvedValueOnce({ content }));
  const run = (check: AgentFinalReplyCheck, adapter = capability()) => engine.continueConversation({
    conversationId,
    userMessage: 'Was Alice curious?',
    policy: AGENT_RUN_POLICIES.workshopHost,
    capability: adapter,
    options: { finalReplyCheck: check, retainedAssistantContentSanitizer: (content) => `[retained] ${content}` }
  });
  const history = () => conversations.getMessages(conversationId).map((entry) => entry.content);

  beforeEach(async () => {
    client = { createChatCompletion: jest.fn(), createStreamingChatCompletion: jest.fn() };
    conversations = new ConversationManager();
    engine = new AgentRunEngine(client as never, conversations, jest.fn());
    replies('Hello, Alice.');
    conversationId = (await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopHost, capability: capability()
    })).conversationId!;
    client.createChatCompletion.mockClear();
  });

  afterEach(() => engine.dispose());

  it('has a correction budget to spend on the policy it is tested with', () => {
    expect(AGENT_RUN_POLICIES.workshopHost.maxCorrectionTurns).toBe(1);
  });

  it('leaves an accepted reply alone: one request, and the reply retained', async () => {
    replies('Yes');
    const check = jest.fn(oneWord);
    const result = await run(check);
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith('Yes', { incomplete: false });
    expect(client.createChatCompletion).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('Yes');
    expect(result.finalReplyRejected).toBeUndefined();
    expect(history().slice(-2)).toEqual(['Was Alice curious?', '[retained] Yes']);
  });

  it('replays the rejected reply in the correction request, and retains only the owner\'s form of it (PR #252 F-02)', async () => {
    replies('She was, very much so, as the Rabbit found.', 'Yes');
    const check = jest.fn(oneWord);
    const result = await run(check);
    expect(check).toHaveBeenCalledTimes(2);
    expect(client.createChatCompletion).toHaveBeenCalledTimes(2);
    // The model is shown its own reply and the instruction, in order.
    const sent = client.createChatCompletion.mock.calls[1][0].map((entry: { role: string; content: string }) => [entry.role, entry.content]);
    expect(sent.slice(-3)).toEqual([
      ['user', 'Was Alice curious?'],
      ['assistant', 'She was, very much so, as the Rabbit found.'],
      ['user', INSTRUCTION]
    ]);
    expect(result.content).toBe('Yes');
    expect(result.finalReplyRejected).toBeUndefined();
    // Retained: the rejected reply goes through the run's sanitizer, as the final one does.
    expect(history().slice(-4)).toEqual([
      'Was Alice curious?', '[retained] She was, very much so, as the Rabbit found.', INSTRUCTION, '[retained] Yes'
    ]);
  });

  it('keeps capability calls and evidence as they were replayed: only a rejected final reply takes the retained form', async () => {
    replies(REQUEST, 'Let me think about it.', 'Yes');
    await run(jest.fn(oneWord));
    const kept = history().slice(-6);
    expect(kept[0]).toBe('Was Alice curious?');
    expect(kept[1]).toBe(REQUEST);
    expect(kept[2]).toContain('Curious: eager to know.');
    expect(kept.slice(3)).toEqual(['[retained] Let me think about it.', INSTRUCTION, '[retained] Yes']);
  });

  it('with no sanitizer, retains the rejected reply as it was replayed', async () => {
    replies('She was.', 'Yes');
    await engine.continueConversation({
      conversationId, userMessage: 'Was Alice curious?', policy: AGENT_RUN_POLICIES.workshopHost, capability: capability(),
      options: { finalReplyCheck: oneWord }
    });
    expect(history().slice(-4)).toEqual(['Was Alice curious?', 'She was.', INSTRUCTION, 'Yes']);
  });

  it('refuses a reply outright when the check says so: no correction turn, nothing retained', async () => {
    replies('She was.', 'Never reached');
    const before = history();
    const result = await run(() => AGENT_FINAL_REPLY_REFUSED);
    expect(client.createChatCompletion).toHaveBeenCalledTimes(1);
    expect(result.finalReplyRejected).toBe(true);
    expect(history()).toEqual(before);
  });

  it.each([
    ['the token ceiling', 'length', 'Response truncated'],
    ['an ordinary stop', 'stop', undefined]
  ])('tells the check whether the provider cut the reply short (%s), and never shows it the display notice (PR #252 F-01)', async (_name, finishReason, notice) => {
    client.createChatCompletion.mockResolvedValueOnce({ content: 'Yes', finishReason });
    const check = jest.fn(oneWord);
    const result = await run(check);
    expect(check).toHaveBeenCalledWith('Yes', { incomplete: finishReason === 'length' });
    if (notice) {
      expect(result.content).toContain(notice);
    } else {
      expect(result.content).toBe('Yes');
    }
  });

  it('returns a reply still refused after its correction turn as rejected, and retains nothing', async () => {
    replies('She was.', 'She certainly was.', 'Never reached');
    const before = history();
    const result = await run(oneWord);
    expect(client.createChatCompletion).toHaveBeenCalledTimes(2);
    expect(result.finalReplyRejected).toBe(true);
    expect(result.content).toBe('She certainly was.');
    expect(result.cancelled).toBe(false);
    // The conversation is as it was before the turn, as after a cancellation.
    expect(history()).toEqual(before);
  });

  it('shares the budget with a rejected capability request: none is left for the final reply', async () => {
    replies(INVALID, 'She was, I think.');
    const adapter = capability();
    const before = history();
    const result = await run(oneWord, adapter);
    expect(adapter.invalidRequestInstruction).toHaveBeenCalledTimes(1);
    expect(client.createChatCompletion).toHaveBeenCalledTimes(2);
    expect(result.finalReplyRejected).toBe(true);
    expect(history()).toEqual(before);
  });

  it('checks only a final reply: a capability call is fulfilled first, and a corrected reply may still call one', async () => {
    replies(REQUEST, 'Let me think about it.', REQUEST, 'Yes');
    const adapter = capability();
    const check = jest.fn(oneWord);
    const result = await run(check, adapter);
    expect(check.mock.calls.map(([reply]) => reply)).toEqual(['Let me think about it.', 'Yes']);
    expect(adapter.fulfill).toHaveBeenCalledTimes(2);
    expect(result.content).toBe('Yes');
    expect(result.finalReplyRejected).toBeUndefined();
  });

  it('never runs without a check, and never on a cancelled run', async () => {
    replies('She was.');
    const plain = await engine.continueConversation({
      conversationId, userMessage: 'Was Alice curious?', policy: AGENT_RUN_POLICIES.workshopHost, capability: capability()
    });
    expect(plain.finalReplyRejected).toBeUndefined();
    expect(client.createChatCompletion).toHaveBeenCalledTimes(1);

    const controller = new AbortController();
    controller.abort();
    const check = jest.fn(oneWord);
    const cancelled = await engine.continueConversation({
      conversationId, userMessage: 'And the Queen?', policy: AGENT_RUN_POLICIES.workshopHost, capability: capability(),
      options: { finalReplyCheck: check, signal: controller.signal }
    }).catch((error: Error) => error);
    expect(check).not.toHaveBeenCalled();
    expect(cancelled).toBeDefined();
  });

  it('names no Workshop feature: the seam is the engine\'s own', () => {
    const source = require('fs').readFileSync(require.resolve('@orchestration/AgentRunEngine'), 'utf8') as string;
    expect(source).toContain('finalReplyCheck');
    expect(source).not.toMatch(/edit[- ]?offer|EditOffer|no-file-edit|prose-minion-file-edit/i);
  });
});
