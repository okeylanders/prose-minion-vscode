import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AgentCapability } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';

const stream = async function* (tokens: string[], usage = { promptTokens: 3, completionTokens: 2, totalTokens: 5 }) {
  for (const token of tokens) {
    yield { token, done: false };
  }
  yield { token: '', done: true, usage, finishReason: 'stop' };
};

const capability = (): jest.Mocked<AgentCapability> => ({
  catalog: 'guides',
  appendCatalog: jest.fn(async message => `${message}\n\nGuide catalog`),
  parseExactRequest: jest.fn(candidate => candidate === '<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>'
    ? { operation: 'resource.read', paths: ['dialogue.md'] }
    : undefined),
  fulfill: jest.fn(async paths => ({
    evidence: `Evidence for ${paths.join(', ')}`,
    deliveredPaths: [...paths],
    artifacts: [{ catalog: 'guides' as const, path: paths[0], label: 'Dialogue Tags', category: 'Dialogue', size: 22, reason: 'Requested craft guide' }]
  })),
  stripToolCalls: jest.fn(content => content.includes('<prose-minion-tool-call') ? '' : content.trim()),
  statusMessage: jest.fn((_paths: readonly string[]) => 'Loading requested craft guides...'),
  limitInstruction: jest.fn(() => 'Produce the response.')
} as unknown as jest.Mocked<AgentCapability>);

describe('AgentRunEngine', () => {
  let client: { createChatCompletion: jest.Mock; createStreamingChatCompletion: jest.Mock };
  let conversations: ConversationManager;
  let engine: AgentRunEngine;

  beforeEach(() => {
    client = { createChatCompletion: jest.fn(), createStreamingChatCompletion: jest.fn() };
    conversations = new ConversationManager();
    engine = new AgentRunEngine(client as never, conversations);
  });

  afterEach(() => engine.dispose());

  it('buffers exact XML requests, delivers attributable evidence, and streams only final output', async () => {
    const guides = capability();
    client.createStreamingChatCompletion
      .mockReturnValueOnce(stream(['<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>']))
      .mockReturnValueOnce(stream(['Final', ' answer.']));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides,
      options: { onToken: token => visible.push(token) }
    });

    expect(guides.fulfill).toHaveBeenCalledWith(['dialogue.md']);
    expect(visible.join('')).toBe('Final answer.');
    expect(result.content).toBe('Final answer.');
    expect(result.usedGuides).toEqual(['dialogue.md']);
    expect(result.usage?.totalTokens).toBe(10);
    expect(result.artifacts).toEqual([expect.objectContaining({ path: 'dialogue.md', reason: 'Requested craft guide' })]);
    expect(conversations.getActiveConversationCount()).toBe(0);
  });

  it('does not fulfill or leak a malformed candidate tool call into visible streaming', async () => {
    const guides = capability();
    client.createStreamingChatCompletion.mockReturnValue(stream([
      '<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>', ' Here is the actual answer.'
    ]));
    const visible: string[] = [];

    const result = await engine.runInitial({
      toolName: 'dialogue', systemMessage: 'System', userMessage: 'Analyze this.',
      policy: AGENT_RUN_POLICIES.assistant, capability: guides,
      options: { onToken: token => visible.push(token) }
    });

    expect(guides.fulfill).not.toHaveBeenCalled();
    expect(visible.join('')).toBe('');
    expect(result.content).toBe('');
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
      parseExactRequest: jest.fn((candidate: string) => candidate === '<prose-minion-tool-call name="resource.read"><paths><path>mara.md</path></paths></prose-minion-tool-call>'
        ? { operation: 'resource.read', paths: ['mara.md'] }
        : undefined),
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
});
