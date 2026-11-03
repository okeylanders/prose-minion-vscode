/**
 * Astra's review of Workshop Wayfinding Slice 6, F-01 and F-02, through the
 * real OpenRouterClient and AgentRunEngine with only HTTP mocked:
 *
 * - F-01: a served model is one the provider's response named. The client's
 *   requested-model fallback (kept for context telemetry) never counts, and a
 *   named model counts whether or not usage was reported.
 * - F-02: a reply the engine writes in place of an unusable one is marked
 *   `host-fallback`, so it cannot be attributed to a model.
 */
/* eslint-disable @typescript-eslint/naming-convention -- OpenRouter's wire names. */
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AnyAgentCapability } from '@orchestration/AgentRunContracts';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';
import { ResourceRequestGate } from '@orchestration/capabilities/ResourceRequestGate';
import { ResourceReadRequest } from '@orchestration/ResourceReadXmlCodec';
import { OpenRouterClient } from '@providers/OpenRouterClient';

const REQUESTED = 'openrouter/auto';
const USAGE = { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 };

/** One provider response, in whichever mode the test runs. */
interface WireReply {
  content: string | null;
  model?: string;
  usage?: typeof USAGE;
  finishReason?: string;
  /** Streaming only: the provider errors after the content arrived. */
  interrupt?: boolean;
}

const streamingResponse = (events: unknown[]): Response => {
  const encoded = events.map(event => new TextEncoder().encode(
    event === '[DONE]' ? 'data: [DONE]\n\n' : `data: ${JSON.stringify(event)}\n\n`
  ));
  let index = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: jest.fn(async () => index < encoded.length
          ? { done: false, value: encoded[index++] }
          : { done: true, value: undefined }),
        releaseLock: jest.fn()
      }),
      cancel: jest.fn().mockResolvedValue(undefined)
    }
  } as unknown as Response;
};

const wire = (reply: WireReply, streaming: boolean): Response => {
  const model = reply.model ? { model: reply.model } : {};
  const finish = reply.finishReason ?? 'stop';
  if (!streaming) {
    return {
      ok: true,
      json: async () => ({
        ...model,
        ...(reply.usage ? { usage: reply.usage } : {}),
        choices: [{ message: { content: reply.content }, finish_reason: finish }]
      })
    } as Response;
  }
  if (reply.interrupt) {
    return streamingResponse([
      { ...model, choices: [{ delta: { content: reply.content } }] },
      { error: { code: 502, message: 'Upstream closed the stream' } }
    ]);
  }
  return streamingResponse([
    { ...model, choices: [{ delta: { content: reply.content ?? '' } }] },
    { ...model, choices: [{ delta: {}, finish_reason: finish }], ...(reply.usage ? { usage: reply.usage } : {}) },
    '[DONE]'
  ]);
};

const guideGate = new ResourceRequestGate({
  catalogLabel: 'craft-guide',
  nothingLoaded: 'No guides were loaded.',
  finalArtifactLabel: 'the final response',
  evidenceLabel: 'guide'
});
guideGate.setAllowedPaths(['dialogue.md']);
const GUIDE_REQUEST = '<prose-minion-tool-call name="resource.read"><paths><path>dialogue.md</path></paths></prose-minion-tool-call>';
const INVALID_REQUEST = '<prose-minion-tool-call name="resource.read"><paths><path>secret.md</path></paths></prose-minion-tool-call>';

const guideCapability = (): AnyAgentCapability => ({
  catalog: 'guides',
  appendContract: jest.fn(async (message: string) => `${message}\n\nGuide catalog`),
  inspectRequest: jest.fn((candidate: string) => guideGate.inspect(candidate)),
  fulfill: jest.fn(async (request: ResourceReadRequest) => ({
    evidence: `Evidence for ${request.paths.join(', ')}`,
    deliveredItems: [...request.paths],
    artifacts: []
  })),
  stripToolCalls: jest.fn((content: string) => content.includes('<prose-minion-tool-call') ? '' : content.trim()),
  statusMessage: jest.fn(() => 'Loading requested craft guides...'),
  requestLogSummary: jest.fn(() => 'guide'),
  invalidRequestInstruction: jest.fn(() => 'Correct it.'),
  limitInstruction: jest.fn(() => 'Produce the response.')
} as unknown as AnyAgentCapability);

describe.each([false, true])('reply provenance through the real client and engine (streaming=%s)', (streaming) => {
  const originalFetch = global.fetch;
  let engine: AgentRunEngine;

  afterEach(() => {
    global.fetch = originalFetch;
    engine?.dispose();
  });

  const run = async (replies: WireReply[], capability?: AnyAgentCapability) => {
    const queue = [...replies];
    global.fetch = jest.fn(async () => wire(queue.shift()!, streaming)) as typeof fetch;
    engine = new AgentRunEngine(new OpenRouterClient('key', REQUESTED), new ConversationManager());
    return engine.runInitial({
      toolName: 'host',
      systemMessage: 'System',
      userMessage: 'Hello',
      policy: capability ? AGENT_RUN_POLICIES.assistant : AGENT_RUN_POLICIES.workshopToolWithoutResources,
      ...(capability ? { capability } : {}),
      options: streaming ? { onToken: jest.fn() } : {}
    });
  };

  describe('F-01: served models are only those the provider named', () => {
    it('lists none when the response named no model, though usage was reported', async () => {
      const result = await run([{ content: 'Reply.', usage: USAGE }]);

      expect(result.models).toEqual({ requestedModelId: REQUESTED, servedModelIds: [] });
    });

    it('lists the named model when usage was reported', async () => {
      const result = await run([{ content: 'Reply.', model: 'vendor/served', usage: USAGE }]);

      expect(result.models).toEqual({ requestedModelId: REQUESTED, servedModelIds: ['vendor/served'] });
    });

    it('lists the named model when usage was not reported', async () => {
      const result = await run([{ content: 'Reply.', model: 'vendor/served' }]);

      expect(result.models).toEqual({ requestedModelId: REQUESTED, servedModelIds: ['vendor/served'] });
    });

    it('lists each named model once, in first-use order, across a run\'s calls', async () => {
      const result = await run([
        { content: GUIDE_REQUEST, model: 'vendor/first', usage: USAGE },
        { content: GUIDE_REQUEST, usage: USAGE },
        { content: 'Final reply.', model: 'vendor/first', usage: USAGE }
      ], guideCapability());

      expect(result.content).toBe('Final reply.');
      expect(result.models).toEqual({ requestedModelId: REQUESTED, servedModelIds: ['vendor/first'] });
    });

    it('lists two named models in the order they first answered', async () => {
      const result = await run([
        { content: GUIDE_REQUEST, model: 'vendor/second', usage: USAGE },
        { content: 'Final reply.', model: 'vendor/first' }
      ], guideCapability());

      expect(result.models?.servedModelIds).toEqual(['vendor/second', 'vendor/first']);
    });
  });

  describe('F-02: only a provider reply is a provider reply', () => {
    it.each([
      ['an empty reply', ''],
      ['a null reply', null]
    ])('marks the engine\'s stand-in for %s as host-written', async (_label, content) => {
      if (streaming && content === null) {
        return; // A stream has no null content; the empty case covers it.
      }
      const result = await run([{ content, model: 'vendor/served', usage: USAGE }]);

      expect(result.content).toContain('no usable final response');
      expect(result.replySource).toBe('host-fallback');
    });

    it('marks the stand-in after exhausted correction turns as host-written', async () => {
      const result = await run([
        { content: INVALID_REQUEST, model: 'vendor/served', usage: USAGE },
        { content: INVALID_REQUEST, model: 'vendor/served', usage: USAGE }
      ], guideCapability());

      expect(result.content).toContain('could not complete its tool request');
      expect(result.replySource).toBe('host-fallback');
    });

    it('marks the stand-in after an exhausted capability limit as host-written', async () => {
      const result = await run(
        Array.from({ length: 5 }, () => ({ content: GUIDE_REQUEST, model: 'vendor/served', usage: USAGE })),
        guideCapability()
      );

      expect(result.content).toContain('exhausted its capability-call limit');
      expect(result.replySource).toBe('host-fallback');
    });

    it('marks an ordinary reply as the provider\'s', async () => {
      const result = await run([{ content: 'Reply.', model: 'vendor/served', usage: USAGE }]);

      expect(result.replySource).toBe('provider');
    });

    it('marks a reply cut off at its ceiling as the provider\'s', async () => {
      const result = await run([{ content: 'Half a reply', model: 'vendor/served', usage: USAGE, finishReason: 'length' }]);

      expect(result.content).toContain('Half a reply');
      expect(result.replySource).toBe('provider');
    });

    if (streaming) {
      describe('F-03: a model named after the last content', () => {
        const runFrames = async (events: unknown[]) => {
          global.fetch = jest.fn(async () => streamingResponse(events)) as typeof fetch;
          engine = new AgentRunEngine(new OpenRouterClient('key', REQUESTED), new ConversationManager());
          return engine.runInitial({
            toolName: 'host',
            systemMessage: 'System',
            userMessage: 'Hello',
            policy: AGENT_RUN_POLICIES.workshopToolWithoutResources,
            options: { onToken: jest.fn() }
          });
        };
        const CONTENT = { choices: [{ delta: { content: 'Most of a reply' } }] };
        const MODEL_ONLY = { model: 'vendor/served', choices: [{ delta: {} }] };

        it('keeps it when the stream ends with no terminal frame', async () => {
          const result = await runFrames([CONTENT, MODEL_ONLY]);

          expect(result.content).toContain('Most of a reply');
          expect(result.models?.servedModelIds).toEqual(['vendor/served']);
          expect(result.replySource).toBe('provider');
        });

        it('keeps it when the provider errors after naming it', async () => {
          const result = await runFrames([
            CONTENT,
            MODEL_ONLY,
            { error: { code: 502, message: 'Upstream closed the stream' } }
          ]);

          expect(result.content).toContain('provider interrupted');
          expect(result.models?.servedModelIds).toEqual(['vendor/served']);
          expect(result.replySource).toBe('provider');
        });

        it('keeps it on a stream that finishes normally', async () => {
          const result = await runFrames([
            CONTENT,
            MODEL_ONLY,
            { choices: [{ delta: {}, finish_reason: 'stop' }], usage: USAGE },
            '[DONE]'
          ]);

          expect(result.models?.servedModelIds).toEqual(['vendor/served']);
        });

        it('names nothing when no frame named a model', async () => {
          const result = await runFrames([CONTENT, { choices: [{ delta: {} }] }]);

          expect(result.models?.servedModelIds).toEqual([]);
        });
      });

      it('marks a retained reply the provider interrupted as the provider\'s', async () => {
        const result = await run([{ content: 'Most of a reply', model: 'vendor/served', interrupt: true }]);

        expect(result.content).toContain('Most of a reply');
        expect(result.content).toContain('provider interrupted');
        expect(result.replySource).toBe('provider');
        expect(result.models?.servedModelIds).toEqual(['vendor/served']);
      });
    }
  });
});
