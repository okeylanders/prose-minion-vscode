/**
 * Workshop Wayfinding Slice 6 (ADR 2026-11-03 D7): every run returns the
 * model it requested, captured before its first request, and the distinct
 * models the provider reported serving, in first-use order.
 */
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AnyAgentCapability } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';
import { ResourceRequestGate } from '@orchestration/capabilities/ResourceRequestGate';
import { ResourceReadRequest } from '@orchestration/ResourceReadXmlCodec';
import type { InferenceRequestObservation } from '@shared/types';

const GUIDE_REQUEST = '<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>';

const guideGate = new ResourceRequestGate({
  catalogLabel: 'craft-guide',
  nothingLoaded: 'No guides were loaded.',
  finalArtifactLabel: 'the final response',
  evidenceLabel: 'guide'
});
guideGate.setAllowedPaths(['dialogue.md']);

const guideCapability = (onFulfill: () => void = () => undefined) => ({
  catalog: 'guides',
  appendContract: jest.fn(async (message: string) => `${message}\n\nGuide catalog`),
  inspectRequest: jest.fn((candidate: string) => guideGate.inspect(candidate)),
  fulfill: jest.fn(async (request: ResourceReadRequest) => {
    onFulfill();
    return {
      evidence: `Evidence for ${request.paths.join(', ')}`,
      deliveredItems: [...request.paths],
      artifacts: []
    };
  }),
  stripToolCalls: jest.fn((content: string) => content.includes('<prose-minion-tool-call') ? '' : content.trim()),
  statusMessage: jest.fn(() => 'Loading requested craft guides...'),
  requestLogSummary: jest.fn(() => 'guide'),
  invalidRequestInstruction: jest.fn(() => 'Correct it.'),
  limitInstruction: jest.fn(() => 'Produce the response.')
} as unknown as AnyAgentCapability);

const observed = (modelId: string): InferenceRequestObservation => ({
  modelId,
  promptTokens: 10,
  completionTokens: 2,
  totalTokens: 12,
  requestedMaxOutputTokens: 1000,
  contextCompression: 'unknown',
  measuredAt: 0
});

describe('AgentRunEngine model provenance (Workshop Wayfinding D7)', () => {
  let model: string;
  let client: { createChatCompletion: jest.Mock; createStreamingChatCompletion: jest.Mock; getModel: () => string; setModel: (id: string) => void };
  let engine: AgentRunEngine;

  beforeEach(() => {
    model = 'vendor/model-a';
    client = {
      createChatCompletion: jest.fn(),
      createStreamingChatCompletion: jest.fn(),
      getModel: () => model,
      setModel: (id: string) => { model = id; }
    };
    engine = new AgentRunEngine(client as never, new ConversationManager());
  });

  afterEach(() => engine.dispose());

  it('collects distinct served ids in first-use order across capability rounds', async () => {
    client.createChatCompletion
      .mockResolvedValueOnce({ content: GUIDE_REQUEST, observation: observed('vendor/model-a-0601') })
      .mockResolvedValueOnce({ content: GUIDE_REQUEST, observation: observed('vendor/fallback') })
      .mockResolvedValueOnce({ content: GUIDE_REQUEST })
      .mockResolvedValueOnce({ content: 'Final reply.', observation: observed('vendor/model-a-0601') });

    const result = await engine.runInitial({
      toolName: 'host',
      systemMessage: 'System',
      userMessage: 'Hello',
      policy: { ...AGENT_RUN_POLICIES.assistant, retention: 'retain', maxCapabilityRounds: 3 },
      capability: guideCapability()
    });

    expect(client.createChatCompletion).toHaveBeenCalledTimes(4);
    expect(result.models).toEqual({
      requestedModelId: 'vendor/model-a',
      servedModelIds: ['vendor/model-a-0601', 'vendor/fallback']
    });
  });

  it('returns no served ids when no request reported an observation', async () => {
    client.createChatCompletion.mockResolvedValue({ content: 'Reply.' });

    const result = await engine.runInitial({
      toolName: 'host',
      systemMessage: 'System',
      userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });

    expect(result.models).toEqual({ requestedModelId: 'vendor/model-a', servedModelIds: [] });
  });

  it('keeps the requested model a selection change during the run would relabel', async () => {
    client.createChatCompletion
      .mockResolvedValueOnce({ content: GUIDE_REQUEST, observation: observed('vendor/model-a') })
      .mockResolvedValueOnce({ content: 'Final reply.', observation: observed('vendor/model-b') });

    const result = await engine.runInitial({
      toolName: 'host',
      systemMessage: 'System',
      userMessage: 'Hello',
      policy: { ...AGENT_RUN_POLICIES.assistant, retention: 'retain' },
      // The manager's hot-swap path, between the run's two requests.
      capability: guideCapability(() => engine.setModel('vendor/model-b'))
    });

    expect(model).toBe('vendor/model-b');
    expect(result.models).toEqual({
      requestedModelId: 'vendor/model-a',
      servedModelIds: ['vendor/model-a', 'vendor/model-b']
    });
  });

  it('records the model a continuation requested at its own start', async () => {
    client.createChatCompletion.mockResolvedValue({ content: 'Reply.', observation: observed('vendor/model-a') });
    const initial = await engine.runInitial({
      toolName: 'host',
      systemMessage: 'System',
      userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });
    engine.setModel('vendor/model-b');
    client.createChatCompletion.mockResolvedValue({ content: 'Reply.', observation: observed('vendor/model-b') });

    const next = await engine.continueConversation({
      conversationId: initial.conversationId!,
      userMessage: 'Continue',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources
    });

    expect(initial.models?.requestedModelId).toBe('vendor/model-a');
    expect(next.models).toEqual({ requestedModelId: 'vendor/model-b', servedModelIds: ['vendor/model-b'] });
  });

  it('names a pinned run model as requested', async () => {
    client.createChatCompletion.mockResolvedValue({ content: 'Reply.' });

    const result = await engine.runInitial({
      toolName: 'craft-flags',
      systemMessage: 'System',
      userMessage: 'Hello',
      policy: AGENT_RUN_POLICIES.workshopToolWithoutResources,
      options: { model: 'vendor/approved' }
    });

    expect(result.models?.requestedModelId).toBe('vendor/approved');
  });
});
