import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AgentCapability } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';
import { ResourceRequestGate } from '@orchestration/capabilities/ResourceRequestGate';
import { ResourceReadRequest } from '@orchestration/ResourceReadXmlCodec';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';

const stream = async function* (tokens: string[], usage = { promptTokens: 3, completionTokens: 2, totalTokens: 5 }) {
  for (const token of tokens) {
    yield { token, done: false };
  }
  yield { token: '', done: true, usage, finishReason: 'stop' };
};

/**
 * A non-streaming provider turn the test resolves by hand, so a run can be
 * held in flight while the between-run replacement guard is probed
 * (ADR 2026-07-20).
 */
const deferredTurn = () => {
  let resolve!: (value: { content: string; finishReason?: string }) => void;
  const promise = new Promise<{ content: string; finishReason?: string }>(res => {
    resolve = res;
  });
  return { promise, resolve };
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
  appendTurnContract: jest.fn(async message => `${message}\n\nFresh capability budget for this user turn.`),
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
  inspectionLogContext: jest.fn(() => 'request=host-request persona=jill'),
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

  it('commits current retained context separately from multi-call processed traffic', async () => {
    const guides = capability();
    guides.fulfill.mockResolvedValueOnce({
      evidence: 'Evidence',
      deliveredItems: ['dialogue.md'],
      artifacts: [],
      usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25, requestCount: 2 }
    });
    client.createChatCompletion
      .mockResolvedValueOnce({
        content: GUIDE_REQUEST,
        usage: { promptTokens: 38, completionTokens: 2, totalTokens: 40 },
        observation: {
          modelId: 'model/a', promptTokens: 38, completionTokens: 2, totalTokens: 40,
          requestedMaxOutputTokens: 10_000, finishReason: 'stop', contextCompression: 'unknown', measuredAt: 1
        }
      })
      .mockResolvedValueOnce({
        content: 'Final response.',
        usage: { promptTokens: 41, completionTokens: 3, totalTokens: 44 },
        observation: {
          modelId: 'model/a', promptTokens: 41, completionTokens: 3, totalTokens: 44,
          requestedMaxOutputTokens: 10_000, finishReason: 'stop', contextCompression: 'not-applied', measuredAt: 2
        }
      });

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze.',
      policy: { ...AGENT_RUN_POLICIES.assistant, retention: 'retain' }, capability: guides
    });
    expect(result.usage).toMatchObject({ totalTokens: 109, requestCount: 4 });
    expect(conversations.getContextBudget(result.conversationId)).toMatchObject({
      contextTokens: 44,
      promptTokens: 41,
      completionTokens: 3,
      peakPromptTokensThisTurn: 41,
      callsThisTurn: 4,
      turnProcessedTokens: 109
    });
  });

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

  it('accepts a narrated Workshop resource search without burning its correction turn', async () => {
    const adapter = personaCapability();
    const codec = new WorkshopCapabilityXmlCodec();
    adapter.inspectRequest.mockImplementation(candidate => codec.inspect(candidate));
    const resourceSearch = [
      'I should search the character files before answering.',
      '<prose-minion-tool-call name="resource.search">',
      '<query>Micah</query>',
      '<group>characters</group>',
      '</prose-minion-tool-call>'
    ].join('\n');
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([resourceSearch]))
      .mockReturnValueOnce(stream(['Micah-backed final response.']));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Read Micah\'s guide.',
      policy: AGENT_RUN_POLICIES.workshopHost, capability: adapter,
      options: { onToken: token => visible.push(token) }
    });

    expect(adapter.invalidRequestInstruction).not.toHaveBeenCalled();
    expect(adapter.fulfill).toHaveBeenCalledWith({
      capability: 'resource.search', query: 'Micah', group: 'characters'
    });
    expect(visible.join('')).toBe('Micah-backed final response.');
    expect(result.content).toBe('Micah-backed final response.');
  });

  it('recovers from an invalid protocol-only response with a final answer instead of a blank result', async () => {
    const guides = capability();
    guides.handleInvalidRequest = jest.fn(() => [{
      catalog: 'guides', id: 'rejected-1', label: 'Rejected guide request',
      category: 'rejected', size: 0, reason: 'Invalid path'
    }]);
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
    expect(guides.handleInvalidRequest).toHaveBeenCalledTimes(1);
    expect(guides.invalidRequestInstruction).toHaveBeenCalledTimes(1);
    expect(result.artifacts).toEqual([expect.objectContaining({ id: 'rejected-1' })]);
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

  it('does not invent telemetry or retain history when transport fails before completion', async () => {
    client.createChatCompletion.mockRejectedValueOnce(new Error('network unavailable'));

    await expect(engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    })).rejects.toThrow('network unavailable');
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
    expect(result.usage?.requestCount).toBe(3);
    expect(client.createChatCompletion.mock.calls.at(-2)?.[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('Fresh capability budget for this user turn.')
      })
    ]));
    expect(conversations.getConversationInfo(initial.conversationId!)?.messageCount).toBe(7);
  });

  it('runs rejected-request correction through retained continuation', async () => {
    client.createChatCompletion.mockResolvedValueOnce({ content: 'Host hello' });
    const initial = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopHost, capability: personaCapability()
    });
    const adapter = personaCapability();
    const invalid = '<prose-minion-tool-call name="secrets.read"></prose-minion-tool-call>';
    adapter.inspectRequest.mockImplementation(candidate => candidate === invalid
      ? { kind: 'invalid', reason: 'unknown-capability' }
      : { kind: 'none' });
    client.createChatCompletion
      .mockResolvedValueOnce({ content: invalid })
      .mockResolvedValueOnce({ content: 'Corrected continuation answer.' });

    const result = await engine.continueConversation({
      conversationId: initial.conversationId!,
      userMessage: 'Try that again.',
      policy: AGENT_RUN_POLICIES.workshopHost,
      capability: adapter
    });

    expect(adapter.invalidRequestInstruction).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('Corrected continuation answer.');
  });

  it('forces final prose after five capability calls on retained continuation', async () => {
    client.createChatCompletion.mockResolvedValueOnce({ content: 'Host hello' });
    const initial = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopHost, capability: personaCapability()
    });
    const adapter = personaCapability();
    adapter.handleCapabilityLimit = jest.fn(() => [{
      catalog: 'workshopPersona', id: 'limit-1', label: 'Rejected resource request',
      category: 'resource.read', size: 0, reason: 'Round cap'
    }]);
    client.createChatCompletion
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: 'Continuation final after five calls.' });

    const result = await engine.continueConversation({
      conversationId: initial.conversationId!,
      userMessage: 'Use whatever evidence you need.',
      policy: AGENT_RUN_POLICIES.workshopHost,
      capability: adapter
    });

    expect(adapter.fulfill).toHaveBeenCalledTimes(5);
    expect(adapter.handleCapabilityLimit).toHaveBeenCalledTimes(1);
    expect(adapter.limitInstruction).toHaveBeenCalledTimes(1);
    expect(result.artifacts).toEqual([expect.objectContaining({ id: 'limit-1' })]);
    expect(result.content).toBe('Continuation final after five calls.');
  });

  it('withholds rejected Workshop lookup narration and attributes the rejection log', async () => {
    const output = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    const diagnosticEngine = new AgentRunEngine(client as never, conversations, undefined, output);
    const adapter = personaCapability();
    const narration = 'I want to look up that word first. ';
    const mixed = `${narration}${PERSONA_REQUEST}`;
    adapter.inspectRequest.mockImplementation(candidate => candidate === mixed
      ? { kind: 'invalid', reason: 'mixed-content' }
      : { kind: 'none' });
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream([narration, PERSONA_REQUEST]))
      .mockReturnValueOnce(stream(['Recovered Workshop answer.']));
    const visible: string[] = [];

    try {
      const result = await diagnosticEngine.runInitial({
        toolName: 'host', systemMessage: 'System', userMessage: 'Help.',
        policy: AGENT_RUN_POLICIES.workshopHost,
        capability: adapter,
        options: { onToken: token => visible.push(token) }
      });

      expect(visible.join('')).toBe('Recovered Workshop answer.');
      expect(result.content).toBe('Recovered Workshop answer.');
      expect(output.appendLine.mock.calls.flat().join('\n')).toContain(
        'Rejected workshopPersona capability request request=host-request persona=jill: reason=mixed-content.'
      );
    } finally {
      diagnosticEngine.dispose();
    }
  });

  it('delivers a pending host frame once within capability rounds and commits nothing when cancelled', async () => {
    client.createChatCompletion.mockResolvedValueOnce({
      content: 'Host hello',
      usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
      observation: {
        modelId: 'model/a', promptTokens: 10, completionTokens: 2, totalTokens: 12,
        requestedMaxOutputTokens: 10_000, finishReason: 'stop', contextCompression: 'unknown', measuredAt: 1
      }
    });
    const initial = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopHost, capability: personaCapability()
    });
    const before = conversations.getConversationInfo(initial.conversationId!)?.messageCount;
    const contextBefore = conversations.getContextBudget(initial.conversationId!);
    const controller = new AbortController();
    const fulfill = jest.fn().mockImplementation(async () => {
      controller.abort(new Error('cancel after evidence'));
      return { evidence: 'Completed evidence', deliveredItems: ['dictionary.lookup:success'], artifacts: [] };
    });
    client.createChatCompletion
      .mockResolvedValueOnce({
        content: PERSONA_REQUEST,
        usage: { promptTokens: 20, completionTokens: 2, totalTokens: 22 },
        observation: {
          modelId: 'model/a', promptTokens: 20, completionTokens: 2, totalTokens: 22,
          requestedMaxOutputTokens: 10_000, finishReason: 'stop', contextCompression: 'unknown', measuredAt: 2
        }
      })
      .mockResolvedValueOnce({
        content: 'This response is abandoned.',
        usage: { promptTokens: 30, completionTokens: 3, totalTokens: 33 },
        observation: {
          modelId: 'model/a', promptTokens: 30, completionTokens: 3, totalTokens: 33,
          requestedMaxOutputTokens: 10_000, finishReason: 'stop', contextCompression: 'unknown', measuredAt: 3
        }
      });
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
    expect(conversations.getContextBudget(initial.conversationId!)).toEqual(contextBefore);
  });

  it('resets the five-call persona budget per user turn and forces final prose at the boundary', async () => {
    client.createChatCompletion
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: 'Final after five calls.' });
    const adapter = personaCapability();

    const result = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Help.',
      policy: AGENT_RUN_POLICIES.workshopHost, capability: adapter
    });

    expect(adapter.fulfill).toHaveBeenCalledTimes(5);
    expect(adapter.limitInstruction).toHaveBeenCalledTimes(1);
    expect(result.content).toBe('Final after five calls.');
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

  it('stamps stable art-N ids on retained capability evidence at injection (ADR 2026-07-18)', async () => {
    const persona = personaCapability();
    client.createChatCompletion
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: 'Dictionary-backed answer.' });

    const result = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopHost, capability: persona
    });

    const history = conversations.getMessages(result.conversationId!);
    const evidenceEntry = history.find(message => message.content.includes('Dictionary evidence'));
    expect(evidenceEntry).toMatchObject({
      role: 'user',
      content: '<agent-artifact id="art-1">\nDictionary evidence\n</agent-artifact>'
    });

    // A second capability round in the SAME conversation mints the next id.
    const followUp = personaCapability();
    client.createChatCompletion
      .mockResolvedValueOnce({ content: PERSONA_REQUEST })
      .mockResolvedValueOnce({ content: 'Second answer.' });
    await engine.continueConversation({
      conversationId: result.conversationId!,
      userMessage: 'Again?',
      policy: AGENT_RUN_POLICIES.workshopHost,
      capability: followUp
    });
    const artifactIds = conversations.getMessages(result.conversationId!)
      .flatMap(message => [...message.content.matchAll(/<agent-artifact id="(art-\d+)">/g)].map(m => m[1]));
    expect(artifactIds).toEqual(['art-1', 'art-2']);
  });

  it('leaves discard-run evidence unstamped — no address is needed for history that never persists', async () => {
    const guides = capability();
    client.createChatCompletion
      .mockResolvedValueOnce({ content: GUIDE_REQUEST })
      .mockResolvedValueOnce({ content: 'Guide-backed answer.' });

    await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides
    });

    const evidenceTurnMessages = client.createChatCompletion.mock.calls[1][0] as Array<{ role: string; content: string }>;
    const evidenceEntry = evidenceTurnMessages.find(message => message.content.includes('Evidence for dialogue.md'));
    expect(evidenceEntry?.content).toBe('Evidence for dialogue.md');
    expect(evidenceEntry?.content).not.toContain('<agent-artifact');
  });

  it('replaces a settled retained system message between runs and the next turn runs against it (ADR 2026-07-20)', async () => {
    client.createChatCompletion.mockResolvedValueOnce({ content: 'Host hello', finishReason: 'stop' });
    const initial = await engine.runInitial({
      toolName: 'host', systemMessage: 'Old system', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });
    const conversationId = initial.conversationId!;

    expect(engine.isConversationActive(conversationId)).toBe(false);
    engine.replaceSystemMessagesBetweenRuns([{ conversationId, systemMessage: 'New mode system' }]);

    expect(conversations.getMessages(conversationId)[0]).toEqual({ role: 'system', content: 'New mode system' });
    // The replacement governs the very next inference, not some later one.
    client.createChatCompletion.mockResolvedValueOnce({ content: 'Mode-governed reply', finishReason: 'stop' });
    await engine.continueConversation({
      conversationId, userMessage: 'Again', policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });
    expect(client.createChatCompletion.mock.calls.at(-1)?.[0][0]).toEqual({ role: 'system', content: 'New mode system' });
  });

  it('rejects replacement while the target run is in flight, then accepts it after settlement (ADR 2026-07-20)', async () => {
    client.createChatCompletion.mockResolvedValueOnce({ content: 'Host hello', finishReason: 'stop' });
    const initial = await engine.runInitial({
      toolName: 'host', systemMessage: 'Old system', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });
    const conversationId = initial.conversationId!;

    const turn = deferredTurn();
    client.createChatCompletion.mockReturnValueOnce(turn.promise);
    const pending = engine.continueConversation({
      conversationId, userMessage: 'Follow up', policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });

    // The id is marked synchronously, before the engine reads history.
    expect(engine.isConversationActive(conversationId)).toBe(true);
    expect(() => engine.replaceSystemMessagesBetweenRuns([
      { conversationId, systemMessage: 'Mid-flight replacement' }
    ])).toThrow(conversationId);
    expect(conversations.getMessages(conversationId)[0]).toEqual({ role: 'system', content: 'Old system' });

    turn.resolve({ content: 'Late reply', finishReason: 'stop' });
    await pending;

    expect(engine.isConversationActive(conversationId)).toBe(false);
    engine.replaceSystemMessagesBetweenRuns([{ conversationId, systemMessage: 'Between-run replacement' }]);
    expect(conversations.getMessages(conversationId)[0]).toEqual({ role: 'system', content: 'Between-run replacement' });
  });

  it('holds the initial run active from conversation creation until settlement (ADR 2026-07-20)', async () => {
    const startSpy = jest.spyOn(conversations, 'startConversation');
    const turn = deferredTurn();
    client.createChatCompletion.mockReturnValueOnce(turn.promise);
    const pending = engine.runInitial({
      toolName: 'host', systemMessage: 'Old system', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });
    const conversationId = startSpy.mock.results[0]!.value as string;

    // The first turn is committed to this conversation the moment it exists.
    expect(engine.isConversationActive(conversationId)).toBe(true);
    expect(() => engine.replaceSystemMessagesBetweenRuns([
      { conversationId, systemMessage: 'Too early' }
    ])).toThrow(conversationId);
    expect(conversations.getMessages(conversationId)[0]).toEqual({ role: 'system', content: 'Old system' });

    turn.resolve({ content: 'First reply', finishReason: 'stop' });
    const result = await pending;

    expect(result.conversationId).toBe(conversationId);
    expect(engine.isConversationActive(conversationId)).toBe(false);
  });

  it('rejects the whole batch when any target is active and leaves idle targets untouched (ADR 2026-07-20)', async () => {
    client.createChatCompletion
      .mockResolvedValueOnce({ content: 'Host hello', finishReason: 'stop' })
      .mockResolvedValueOnce({ content: 'Guest hello', finishReason: 'stop' });
    const host = await engine.runInitial({
      toolName: 'host', systemMessage: 'Host system', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });
    const guest = await engine.runInitial({
      toolName: 'guest', systemMessage: 'Guest system', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });
    const turn = deferredTurn();
    client.createChatCompletion.mockReturnValueOnce(turn.promise);
    const pending = engine.continueConversation({
      conversationId: guest.conversationId!, userMessage: 'Busy', policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });

    let thrown: Error | undefined;
    try {
      engine.replaceSystemMessagesBetweenRuns([
        { conversationId: host.conversationId!, systemMessage: 'New host system' },
        { conversationId: guest.conversationId!, systemMessage: 'New guest system' }
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    // The error names the offending id only, and the idle host is not
    // half-applied — a mode change is one batch or none.
    expect(thrown?.message).toContain(guest.conversationId!);
    expect(thrown?.message).not.toContain(host.conversationId!);
    expect(conversations.getMessages(host.conversationId!)[0]).toEqual({ role: 'system', content: 'Host system' });
    expect(conversations.getMessages(guest.conversationId!)[0]).toEqual({ role: 'system', content: 'Guest system' });

    turn.resolve({ content: 'Late guest reply', finishReason: 'stop' });
    await pending;

    engine.replaceSystemMessagesBetweenRuns([
      { conversationId: host.conversationId!, systemMessage: 'New host system' },
      { conversationId: guest.conversationId!, systemMessage: 'New guest system' }
    ]);
    expect(conversations.getMessages(host.conversationId!)[0]).toEqual({ role: 'system', content: 'New host system' });
    expect(conversations.getMessages(guest.conversationId!)[0]).toEqual({ role: 'system', content: 'New guest system' });
  });

  it('releases the active mark after cancellation and transport failure (ADR 2026-07-20)', async () => {
    client.createChatCompletion.mockResolvedValueOnce({ content: 'Host hello', finishReason: 'stop' });
    const initial = await engine.runInitial({
      toolName: 'host', systemMessage: 'Old system', userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });
    const conversationId = initial.conversationId!;

    // Cancellation surfaces as a cancelled result, not a throw — and releases.
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    client.createChatCompletion.mockRejectedValueOnce(abortError);
    const cancelled = await engine.continueConversation({
      conversationId, userMessage: 'Cancelled turn', policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });
    expect(cancelled.cancelled).toBe(true);
    expect(engine.isConversationActive(conversationId)).toBe(false);

    // Transport failure propagates — and still releases.
    client.createChatCompletion.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(engine.continueConversation({
      conversationId, userMessage: 'Failing turn', policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    })).rejects.toThrow('network unavailable');
    expect(engine.isConversationActive(conversationId)).toBe(false);

    // A settled (even unhappy) conversation accepts between-run replacement.
    engine.replaceSystemMessagesBetweenRuns([{ conversationId, systemMessage: 'Post-failure replacement' }]);
    expect(conversations.getMessages(conversationId)[0]).toEqual({ role: 'system', content: 'Post-failure replacement' });
  });
});
