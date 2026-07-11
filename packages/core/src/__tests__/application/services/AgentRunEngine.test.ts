import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AgentCapability } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';
import { ResourceRequestGate } from '@orchestration/capabilities/ResourceRequestGate';

const stream = async function* (tokens: string[], usage = { promptTokens: 3, completionTokens: 2, totalTokens: 5 }) {
  for (const token of tokens) {
    yield { token, done: false };
  }
  yield { token: '', done: true, usage, finishReason: 'stop' };
};

const GUIDE_REQUEST = '<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>';

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

const capability = (): jest.Mocked<AgentCapability> => ({
  catalog: 'guides',
  appendCatalog: jest.fn(async message => `${message}\n\nGuide catalog`),
  inspectRequest: jest.fn(candidate => guideGate.inspect(candidate)),
  fulfill: jest.fn(async paths => ({
    evidence: `Evidence for ${paths.join(', ')}`,
    deliveredPaths: [...paths],
    artifacts: [{ catalog: 'guides' as const, path: paths[0], label: 'Dialogue Tags', category: 'Dialogue', size: 22, reason: 'Requested craft guide' }]
  })),
  stripToolCalls: jest.fn(content => content.includes('<prose-minion-tool-call') ? '' : content.trim()),
  statusMessage: jest.fn((_paths: readonly string[]) => 'Loading requested craft guides...'),
  statusTicker: jest.fn((_paths: readonly string[]) => 'Dialogue'),
  invalidRequestInstruction: jest.fn(() => 'The resource request was invalid. Correct it or provide the final response.'),
  limitInstruction: jest.fn(() => 'Produce the response.')
} as unknown as jest.Mocked<AgentCapability>);

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

    expect(guides.fulfill).toHaveBeenCalledWith(['dialogue.md']);
    expect(statusCallback).toHaveBeenCalledWith('Loading requested craft guides...', 'Dialogue');
    expect(visible.join('')).toBe('Final answer begins with enough ordinary prose to clear the protocol guard. It continues as a separate streamed chunk.');
    expect(visible.length).toBeGreaterThan(1);
    expect(result.content).toBe('Final answer begins with enough ordinary prose to clear the protocol guard. It continues as a separate streamed chunk.');
    expect(result.usedGuides).toEqual(['dialogue.md']);
    expect(result.usage?.totalTokens).toBe(10);
    expect(result.artifacts).toEqual([expect.objectContaining({ path: 'dialogue.md', reason: 'Requested craft guide' })]);
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
    expect(guides.fulfill).toHaveBeenCalledWith(['dialogue.md']);
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
    expect(logs).toContain('Accepted guides resource request for 1 path(s): dialogue.md');
    expect(logs).toContain('Delivered 1/1 guides resource(s)');
    expect(logs).toContain('chars of evidence: dialogue.md');
  });

  it('logs the full rejected assistant response between diagnostic delimiters', async () => {
    const guides = capability();
    const output = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    const diagnosticEngine = new AgentRunEngine(client as never, conversations, undefined, output);
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
    expect(logs).toContain('reason=path-not-allowlisted; paths=1; allowlisted=0');
    expect(logs).toContain(`BEGIN REJECTED RESOURCE RESPONSE (${invalid.length} chars)`);
    expect(logs).toContain(invalid);
    expect(logs).toContain('END REJECTED RESOURCE RESPONSE');
    expect(logs).not.toContain('PRIVATE PASSAGE');
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

    expect(guides.fulfill).toHaveBeenCalledWith(['dialogue.md']);
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
      policy: AGENT_RUN_POLICIES.workshopHost,
      options: { onToken: jest.fn() }
    });

    expect(result).toMatchObject({ content: 'Partial', cancelled: true, conversationId: undefined });
    expect(conversations.getActiveConversationCount()).toBe(0);
  });

  it('keeps direct retained continuation as a history operation with no capability rounds', async () => {
    client.createChatCompletion.mockResolvedValueOnce({ content: 'Host hello', finishReason: 'stop' });
    const initial = await engine.runInitial({
      toolName: 'host', systemMessage: 'System', userMessage: 'Hello', policy: AGENT_RUN_POLICIES.workshopHost
    });
    client.createChatCompletion.mockResolvedValueOnce({ content: '<prose-minion-tool-call name="resource.read"><paths><path>secret.md</path></paths></prose-minion-tool-call> Continued reply', finishReason: 'stop' });

    const result = await engine.continueConversation(initial.conversationId!, 'Follow up');

    expect(result.content).toContain('Continued reply');
    expect(conversations.getConversationInfo(initial.conversationId!)?.messageCount).toBe(5);
  });

  it('bounds configured context-file capability rounds and forces a final response', async () => {
    const contextCapability = {
      ...capability(),
      catalog: 'projectContext' as const,
      inspectRequest: jest.fn((candidate: string) => candidate === '<prose-minion-tool-call name="resource.read"><paths><path>mara.md</path></paths></prose-minion-tool-call>'
        ? { kind: 'request', request: { operation: 'resource.read', paths: ['mara.md'] } }
        : { kind: 'none' }),
      fulfill: jest.fn().mockResolvedValue({ evidence: 'Mara evidence', deliveredPaths: ['mara.md'], artifacts: [] }),
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
    expect(result.content).toContain('exhausted its resource-request limit');
  });
});
