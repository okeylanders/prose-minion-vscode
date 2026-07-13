import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AgentCapability } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';
import { ResourceRequestGate } from '@orchestration/capabilities/ResourceRequestGate';
import { ResourceReadRequest } from '@orchestration/ResourceReadXmlCodec';

const stream = async function* (tokens: string[], usage = { promptTokens: 3, completionTokens: 2, totalTokens: 5 }) {
  for (const token of tokens) {
    yield { token, done: false };
  }
  yield { token: '', done: true, usage, finishReason: 'stop' };
};

const GUIDE_REQUEST = '<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>';
const PERSONA_REQUEST = '<prose-minion-tool-call name="dictionary.lookup"><word>liminal</word><context>threshold</context><purpose>tone</purpose></prose-minion-tool-call>';

// The mock delegates inspection to the production gate with a one-guide
// allowlist, mirroring GuideCapability, so these engine tests exercise the
// real accept/reject contract instead of a simulated one.
const guideGate = new ResourceRequestGate({
  catalogLabel: 'craft-guide',
  nothingLoaded: 'No guides were loaded.',
  finalArtifactLabel: 'the final response',
  evidenceLabel: 'guide'
});
guideGate.setAllowedPaths(['dialogue.md']);

const capability = (): jest.Mocked<AgentCapability<ResourceReadRequest, any>> => ({
  catalog: 'guides',
  appendContract: jest.fn(async message => `${message}\n\nGuide catalog`),
  inspectRequest: jest.fn(candidate => guideGate.inspect(candidate)),
  fulfill: jest.fn(async request => ({
    evidence: `Evidence for ${request.paths.join(', ')}`,
    deliveredItems: [...request.paths],
    artifacts: [{ catalog: 'guides' as const, id: request.paths[0], label: 'Dialogue Tags', category: 'Dialogue', size: 22, reason: 'Requested craft guide' }]
  })),
  stripToolCalls: jest.fn(content => content.includes('<prose-minion-tool-call') ? '' : content.trim()),
  statusMessage: jest.fn(() => 'Loading requested craft guides...'),
  statusTicker: jest.fn(() => 'Dialogue'),
  requestLogSummary: jest.fn(request => `${request.paths.length} path(s): ${request.paths.join(', ')}`),
  invalidRequestInstruction: jest.fn(() => 'The resource request was invalid. Correct it or provide the final response.'),
  limitInstruction: jest.fn(() => 'Produce the response.')
} as unknown as jest.Mocked<AgentCapability<ResourceReadRequest, any>>);

const personaCapability = (fulfill = jest.fn().mockResolvedValue({
  evidence: 'Dictionary evidence',
  deliveredItems: ['dictionary.lookup:success'],
  artifacts: [],
  usage: { promptTokens: 4, completionTokens: 3, totalTokens: 7 }
})): jest.Mocked<AgentCapability<any, any>> => ({
  catalog: 'workshopPersona',
  appendContract: jest.fn(async message => `${message}\n\nWorkshop capability contract`),
  inspectRequest: jest.fn(candidate => candidate === PERSONA_REQUEST
    ? {
        kind: 'request',
        request: {
          capability: 'dictionary.lookup',
          word: 'liminal',
          context: 'threshold',
          purpose: 'tone'
        }
      }
    : { kind: 'none' }),
  fulfill,
  stripToolCalls: jest.fn(content => content.includes('<prose-minion-tool-call') ? '' : content.trim()),
  statusMessage: jest.fn(() => 'Jill is checking the dictionary…'),
  statusTicker: jest.fn(() => 'Dictionary · liminal'),
  requestLogSummary: jest.fn(() => 'word="liminal"'),
  invalidRequestInstruction: jest.fn(() => 'Correct the call or answer without it.'),
  limitInstruction: jest.fn(() => 'Produce the final answer now.')
} as unknown as jest.Mocked<AgentCapability<any, any>>);

describe('AgentRunEngine', () => {
  let client: { createChatCompletion: jest.Mock; createStreamingChatCompletion: jest.Mock };
  let conversations: ConversationManager;
  let engine: AgentRunEngine;
  let statusCallback: jest.Mock;

  beforeEach(() => {
    client = { createChatCompletion: jest.fn(), createStreamingChatCompletion: jest.fn() };
    conversations = new ConversationManager();
    statusCallback = jest.fn();
    engine = new AgentRunEngine(client as never, conversations, statusCallback);
  });

  afterEach(() => engine.dispose());

  it('buffers an exact XML request, then progressively streams the final answer', async () => {
    const guides = capability();
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream(['<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>']))
      .mockReturnValueOnce(stream([
        'Final answer begins with enough ordinary prose to clear the protocol guard. ',
        'It continues as a separate streamed chunk.'
      ]));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides,
      options: { onToken: token => visible.push(token) }
    });

    expect(guides.fulfill).toHaveBeenCalledWith({ operation: 'resource.read', paths: ['dialogue.md'] });
    expect(statusCallback).toHaveBeenCalledWith('Loading requested craft guides...', 'Dialogue');
    expect(visible.join('')).toBe('Final answer begins with enough ordinary prose to clear the protocol guard. It continues as a separate streamed chunk.');
    expect(visible.length).toBeGreaterThan(1);
    expect(result.content).toBe('Final answer begins with enough ordinary prose to clear the protocol guard. It continues as a separate streamed chunk.');
    expect(result.usedGuides).toEqual(['dialogue.md']);
    expect(result.usage?.totalTokens).toBe(10);
    expect(result.artifacts).toEqual([expect.objectContaining({ id: 'dialogue.md', reason: 'Requested craft guide' })]);
    expect(conversations.getActiveConversationCount()).toBe(0);
  });

  it('does not fulfill or leak a mixed candidate and recovers final prose', async () => {
    const guides = capability();
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([GUIDE_REQUEST, ' Here is the actual answer.']))
      .mockReturnValueOnce(stream(['Recovered complete answer.']));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides,
      options: { onToken: token => visible.push(token) }
    });

    expect(guides.fulfill).not.toHaveBeenCalled();
    expect(visible.join('')).toBe('Recovered complete answer.');
    expect(result.content).toBe('Recovered complete answer.');
  });

  it('continues streaming safe prose before a mixed tool call without leaking its markup', async () => {
    const guides = capability();
    const mixed = '<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>';
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([
        'The opening diagnosis is still useful and safely visible. ',
        mixed,
        'This prose is intentionally hidden because it followed invalid protocol markup.'
      ]))
      .mockReturnValueOnce(stream(['Recovered final answer.']));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides,
      options: { onToken: token => visible.push(token) }
    });

    expect(guides.fulfill).not.toHaveBeenCalled();
    expect(visible.join('')).toBe('The opening diagnosis is still useful and safely visible. Recovered final answer.');
    expect(visible.join('')).not.toContain('prose-minion-tool-call');
    expect(result.content).toBe('Recovered final answer.');
  });

  it('delivers an answer that quotes the protocol tag instead of trading it for a correction turn', async () => {
    const guides = capability();
    const quotingAnswer = 'The engine expects `<prose-minion-tool-call name="resource.read">` markup, ' +
      'but no guides were needed. The dialogue reads cleanly and the beats are well placed.';
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([
        'The engine expects `<prose-minion-tool-call name="resource.read">` markup, ',
        'but no guides were needed. The dialogue reads cleanly and the beats are well placed.'
      ]));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides,
      options: { onToken: token => visible.push(token) }
    });

    expect(guides.fulfill).not.toHaveBeenCalled();
    expect(guides.invalidRequestInstruction).not.toHaveBeenCalled();
    expect(client.createStreamingChatCompletion).toHaveBeenCalledTimes(1);
    expect(visible.join('')).toBe(quotingAnswer);
    expect(result.content).toBe(quotingAnswer);
  });

  it('streams a long answer progressively even when it opens with narrated-sounding intent', async () => {
    const guides = capability();
    const opener = 'Let me check the pacing in this scene before giving feedback: ';
    const body = 'the paragraph rhythm holds steady and the dialogue beats are spaced well. '.repeat(8);
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([opener, ...body.match(/.{1,80}/g)!]));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides,
      options: { onToken: token => visible.push(token) }
    });

    expect(visible.length).toBeGreaterThan(2);
    expect(visible.join('').trim()).toBe(`${opener}${body}`.trim());
    expect(result.content).toBe(`${opener}${body}`.trim());
  });

  it('accepts a narrated request preamble on the first turn without burning the correction turn', async () => {
    const guides = capability();
    const narratedRequest = `I need to access several craft guides before answering.\n${GUIDE_REQUEST}`;
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([narratedRequest]))
      .mockReturnValueOnce(stream(['Guide-backed final response.']));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides,
      options: { onToken: token => visible.push(token) }
    });

    expect(guides.invalidRequestInstruction).not.toHaveBeenCalled();
    expect(guides.fulfill).toHaveBeenCalledWith({ operation: 'resource.read', paths: ['dialogue.md'] });
    expect(visible.join('')).toBe('Guide-backed final response.');
    expect(result.content).toBe('Guide-backed final response.');
  });

  it('recovers from an invalid protocol-only response with a final answer instead of a blank result', async () => {
    const guides = capability();
    const invalid = '<prose-minion-tool-call name="resource.read"><paths><path>outside-catalog.md</path></paths></prose-minion-tool-call>';
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([invalid]))
      .mockReturnValueOnce(stream(['A final answer after the rejected request.']));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides,
      options: { onToken: token => visible.push(token) }
    });

    expect(guides.fulfill).not.toHaveBeenCalled();
    expect(guides.invalidRequestInstruction).toHaveBeenCalledTimes(1);
    expect(visible.join('')).toBe('A final answer after the rejected request.');
    expect(result.content).toBe('A final answer after the rejected request.');
  });

  it('logs the accepted request paths and the delivered evidence for diagnosis', async () => {
    const guides = capability();
    const output = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    const diagnosticEngine = new AgentRunEngine(client as never, conversations, undefined, output);
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([GUIDE_REQUEST]))
      .mockReturnValueOnce(stream(['Guide-backed final response.']));

    try {
      await diagnosticEngine.runInitial({
        toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
        policy: AGENT_RUN_POLICIES.assistant, capability: guides,
        options: { onToken: jest.fn() }
      });
    } finally {
      diagnosticEngine.dispose();
    }

    const logs = output.appendLine.mock.calls.flat().join('\n');
    expect(logs).toContain('Accepted guides capability request: 1 path(s): dialogue.md');
    expect(logs).toContain('Fulfilled guides capability 1/2');
    expect(logs).toContain('delivered=dialogue.md');
  });

  it('logs the full rejected assistant response only when debug logging is opted in', async () => {
    const guides = capability();
    const output = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    const debugSettings = { get: jest.fn().mockReturnValue(true) };
    const diagnosticEngine = new AgentRunEngine(client as never, conversations, undefined, output, undefined, debugSettings as never);
    const invalid = '<prose-minion-tool-call name="resource.read"><paths><path>outside-catalog.md</path></paths></prose-minion-tool-call>';
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([invalid]))
      .mockReturnValueOnce(stream(['Safe final prose.']));

    try {
      await diagnosticEngine.runInitial({
        toolName: 'dialogue', systemMessage: 'System', userMessage: 'PRIVATE PASSAGE',
        policy: AGENT_RUN_POLICIES.assistant, capability: guides,
        options: { onToken: jest.fn() }
      });
    } finally {
      diagnosticEngine.dispose();
    }

    const logs = output.appendLine.mock.calls.flat().join('\n');
    expect(debugSettings.get).toHaveBeenCalledWith('proseMinion', 'debugLogging', false);
    expect(logs).toContain('reason=path-not-allowlisted');
    expect(logs).toContain('BEGIN REJECTED CAPABILITY RESPONSE');
    expect(logs).toContain(invalid);
    expect(logs).toContain('END REJECTED CAPABILITY RESPONSE');
    expect(logs).not.toContain('PRIVATE PASSAGE');
  });

  it('withholds the full rejected-response dump by default and says how to enable it', async () => {
    const guides = capability();
    const output = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    const quietEngine = new AgentRunEngine(client as never, conversations, undefined, output);
    const invalid = '<prose-minion-tool-call name="resource.read"><paths><path>outside-catalog.md</path></paths></prose-minion-tool-call>';
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([invalid]))
      .mockReturnValueOnce(stream(['Safe final prose.']));

    try {
      await quietEngine.runInitial({
        toolName: 'dialogue', systemMessage: 'System', userMessage: 'PRIVATE PASSAGE',
        policy: AGENT_RUN_POLICIES.assistant, capability: guides,
        options: { onToken: jest.fn() }
      });
    } finally {
      quietEngine.dispose();
    }

    const logs = output.appendLine.mock.calls.flat().join('\n');
    expect(logs).toContain('reason=path-not-allowlisted');
    expect(logs).toContain('proseMinion.debugLogging');
    expect(logs).not.toContain('BEGIN REJECTED CAPABILITY RESPONSE');
  });

  it('appends the truncation notice when a run ends with finish_reason length', async () => {
    client.createChatCompletion.mockResolvedValueOnce({ content: 'Partial analysis', finishReason: 'length' });

    const result = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });

    expect(result.content).toContain('Partial analysis');
    expect(result.content).toContain('⚠️ Response truncated. Increase Max Tokens in settings.');
  });

  it('accepts a Markdown-fenced XML request instead of burning the correction turn', async () => {
    const guides = capability();
    const request = '<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>';
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream(['```xml\n', request, '\n```']))
      .mockReturnValueOnce(stream(['A guide-backed answer after the fenced request.']));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides,
      options: { onToken: token => visible.push(token) }
    });

    expect(guides.fulfill).toHaveBeenCalledWith({ operation: 'resource.read', paths: ['dialogue.md'] });
    expect(guides.invalidRequestInstruction).not.toHaveBeenCalled();
    expect(visible.join('')).toBe('A guide-backed answer after the fenced request.');
    expect(result.content).toBe('A guide-backed answer after the fenced request.');
  });

  it('recovers from a rejected request on a non-streaming route', async () => {
    const guides = capability();
    const invalid = '<prose-minion-tool-call name="resource.read"><paths><path>outside-catalog.md</path></paths></prose-minion-tool-call>';
    client.createChatCompletion
      .mockResolvedValueOnce({ content: invalid, finishReason: 'stop' })
      .mockResolvedValueOnce({ content: 'Non-streaming recovery answer.', finishReason: 'stop' });

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides
    });

    expect(client.createChatCompletion).toHaveBeenCalledTimes(2);
    expect(guides.fulfill).not.toHaveBeenCalled();
    expect(result.content).toBe('Non-streaming recovery answer.');
  });

  it('bounds repeated invalid-request correction and returns explicit fallback prose', async () => {
    const guides = capability();
    const invalid = '<prose-minion-tool-call name="resource.read"><paths><path>outside-catalog.md</path></paths></prose-minion-tool-call>';
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([invalid]))
      .mockReturnValueOnce(stream([invalid]));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides,
      options: { onToken: token => visible.push(token) }
    });

    expect(client.createStreamingChatCompletion).toHaveBeenCalledTimes(2);
    expect(result.content).toContain('could not produce a usable final response');
    expect(visible.join('')).toContain('could not produce a usable final response');
  });

  it('preserves partial cancellation but never retains an abandoned exchange', async () => {
    client.createStreamingChatCompletion.mockReturnValue((async function* () {
      yield { token: 'Partial', done: false };
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    })());

    const result = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources,
      options: { onToken: jest.fn() }
    });

    expect(result).toMatchObject({ content: 'Partial', cancelled: true, conversationId: undefined });
    expect(conversations.getActiveConversationCount()).toBe(0);
  });

  it('keeps direct retained continuation as a history operation with no capability rounds', async () => {
    client.createChatCompletion.mockResolvedValueOnce({ content: 'Host hello', finishReason: 'stop' });
    const initial = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Hello', policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });
    client.createChatCompletion.mockResolvedValueOnce({ content: '<prose-minion-tool-call name="resource.read"><paths><path>secret.md</path></paths></prose-minion-tool-call> Continued reply', finishReason: 'stop' });

    const result = await engine.continueConversation({
      conversationId: initial.conversationId!,
      userMessage: 'Follow up',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });

    expect(result.content).toContain('Continued reply');
    expect(conversations.getConversationInfo(initial.conversationId!)?.messageCount).toBe(5);
  });

  it('runs the same bounded capability loop on retained continuation and aggregates nested usage once', async () => {
    const initialCapability = personaCapability();
    client.createChatCompletion.mockResolvedValueOnce({
      content: 'Host hello', finishReason: 'stop',
      usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 }
    });
    const initial = await engine.runInitial({
      toolName: 'host',
      systemMessage: 'System',
      userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopHost,
      capability: initialCapability
    });

    const followUpCapability = personaCapability();
    client.createChatCompletion
      .mockResolvedValueOnce({
        content: PERSONA_REQUEST,
        usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 }
      })
      .mockResolvedValueOnce({
        content: 'Dictionary-backed follow-up.',
        usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 }
      });
    const result = await engine.continueConversation({
      conversationId: initial.conversationId!,
      userMessage: 'Could this word work?',
      policy: AGENT_RUN_POLICIES.workshopHost,
      capability: followUpCapability
    });

    expect(followUpCapability.fulfill).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('Dictionary-backed follow-up.');
    expect(result.usage?.totalTokens).toBe(17);
    expect(conversations.getConversationInfo(initial.conversationId!)?.messageCount).toBe(7);
  });

  it('delivers a pending host frame once within capability rounds and commits nothing when cancelled', async () => {
    client.createChatCompletion.mockResolvedValueOnce({ content: 'Host hello' });
    const initial = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopHost, capability: personaCapability()
    });
    const before = conversations.getConversationInfo(initial.conversationId!)?.messageCount;
    const controller = new AbortController();
    const fulfill = jest.fn().mockImplementation(async () => {
      controller.abort(new Error('cancel after evidence'));
      return { evidence: 'Completed evidence', deliveredItems: ['dictionary.lookup:success'], artifacts: [] };
    });
    client.createChatCompletion
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: 'This response is abandoned.' });
    const pendingFrame = '<pinned-excerpt version="2">Revised once.</pinned-excerpt>\nWriter asks again.';

    const result = await engine.continueConversation({
      conversationId: initial.conversationId!,
      userMessage: pendingFrame,
      policy: AGENT_RUN_POLICIES.workshopHost,
      capability: personaCapability(fulfill),
      options: { signal: controller.signal }
    });

    const capabilityRoundMessages = client.createChatCompletion.mock.calls.at(-1)![0];
    expect(capabilityRoundMessages.filter((message: { content: string }) =>
      message.content.includes('<pinned-excerpt version="2">'))).toHaveLength(1);
    expect(result.cancelled).toBe(true);
    expect(conversations.getConversationInfo(initial.conversationId!)?.messageCount).toBe(before);
  });

  it('resets the three-call persona budget per user turn and forces final prose at the boundary', async () => {
    client.createChatCompletion
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: 'Final after three calls.' });
    const adapter = personaCapability();

    const result = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Help.',
      policy: AGENT_RUN_POLICIES.workshopHost, capability: adapter
    });

    expect(adapter.fulfill).toHaveBeenCalledTimes(3);
    expect(adapter.limitInstruction).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('Final after three calls.');
  });

  it('bounds configured context-file capability rounds and forces a final response', async () => {
    const contextCapability = {
      ...capability(),
      catalog: 'projectContext' as const,
      inspectRequest: jest.fn((candidate: string) => candidate === '<prose-minion-tool-call name="resource.read"><paths><path>mara.md</path></paths></prose-minion-tool-call>'
        ? { kind: 'request', request: { operation: 'resource.read', paths: ['mara.md'] } }
        : { kind: 'none' }),
      fulfill: jest.fn().mockResolvedValue({ evidence: 'Mara evidence', deliveredItems: ['mara.md'], artifacts: [] }),
      limitInstruction: jest.fn(() => 'Produce the briefing now.')
    } as unknown as jest.Mocked<AgentCapability>;
    client.createChatCompletion
      .mockResolvedValueOnce({ content: '<prose-minion-tool-call name="resource.read"><paths><path>mara.md</path></paths></prose-minion-tool-call>' })
      .mockResolvedValueOnce({ content: '<prose-minion-tool-call name="resource.read"><paths><path>mara.md</path></paths></prose-minion-tool-call>' })
      .mockResolvedValueOnce({ content: '<prose-minion-tool-call name="resource.read"><paths><path>mara.md</path></paths></prose-minion-tool-call>' })
      .mockResolvedValueOnce({ content: 'Final briefing' });

    const result = await engine.runInitial({
      toolName: 'context', systemMessage: 'System', userMessage: 'Build a brief.',
      policy: AGENT_RUN_POLICIES.context, capability: contextCapability
    });

    expect(contextCapability.fulfill).toHaveBeenCalledTimes(2);
    expect(contextCapability.limitInstruction).toHaveBeenCalledTimes(1);
    expect(client.createChatCompletion).toHaveBeenCalledTimes(4);
    expect(result.content).toBe('Final briefing');
    expect(result.requestedResources).toEqual(['mara.md']);
  });

  it('forces a final answer when guide requests reach their configured round limit', async () => {
    const guides = capability();
    const request = '<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>';
    client.createChatCompletion
      .mockResolvedValueOnce({ content: request })
      .mockResolvedValueOnce({ content: request })
      .mockResolvedValueOnce({ content: request })
      .mockResolvedValueOnce({ content: 'Final guide-backed answer' });

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides
    });

    expect(guides.fulfill).toHaveBeenCalledTimes(2);
    expect(guides.limitInstruction).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('Final guide-backed answer');
  });

  it('retries a forced final turn that returns another XML request instead of ending blank', async () => {
    const guides = capability();
    const request = '<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>';
    client.createChatCompletion
      .mockResolvedValueOnce({ content: request })
      .mockResolvedValueOnce({ content: request })
      .mockResolvedValueOnce({ content: request })
      .mockResolvedValueOnce({ content: request })
      .mockResolvedValueOnce({ content: 'Recovered final guide-backed answer' });

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides
    });

    expect(guides.fulfill).toHaveBeenCalledTimes(2);
    expect(client.createChatCompletion).toHaveBeenCalledTimes(5);
    expect(result.content).toBe('Recovered final guide-backed answer');
  });

  it('returns an explicit failure instead of a blank panel when forced-final retries keep requesting resources', async () => {
    const guides = capability();
    const request = '<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>';
    client.createChatCompletion.mockResolvedValue({ content: request });

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides
    });

    expect(guides.fulfill).toHaveBeenCalledTimes(2);
    expect(result.content).toContain('exhausted its capability-call limit');
  });
});
