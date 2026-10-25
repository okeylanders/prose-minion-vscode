/**
 * PR #171 F-05: a Proofread run's usage, through the production
 * AIResourceManager, AgentRunEngine and OpenRouterClient. Only `fetch` is a
 * stand-in. When a reply carries no usage record, the run's cost is unknown,
 * never the other calls' subtotal, and the call still counts.
 *
 * Replies are about public-domain passages; the key and model id are
 * placeholders. Nothing reaches a provider.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => {
    let chain: Promise<unknown> = Promise.resolve();
    return (fn: () => Promise<unknown>) => {
      const run = chain.then(fn);
      chain = run.catch(() => undefined);
      return run;
    };
  }
}));

import { AIResourceManager } from '@orchestration/AIResourceManager';
import { ProofreadService } from '@services/proofread/ProofreadService';
import { WEATHER_ISSUE, replyOf } from '@/__tests__/infrastructure/api/services/proofread/proofreadReplyFixtures';
import { ALICE_OPENING_SEEDED, ALICE_RABBIT_SEEDED } from '@/__tests__/utils/draftEdit/proofreadFixtures';

const REPORTED_USAGE = { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20, cost: 0.1, prompt_tokens_details: { cached_tokens: 3 } };

function completion(usage: typeof REPORTED_USAGE | undefined) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'gen-placeholder',
      model: 'placeholder/proofread-model',
      choices: [{ message: { content: replyOf(WEATHER_ISSUE) }, finish_reason: 'stop' }],
      ...(usage ? { usage } : {})
    })
  };
}

async function runWith(usages: Array<typeof REPORTED_USAGE | undefined>) {
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const manager = new AIResourceManager(
    { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
    { getApiKey: jest.fn(async () => 'sk-placeholder') } as never,
    { get: (_section: string, key: string, fallback?: unknown) => (key === 'proofreadModel' ? 'placeholder/proofread-model' : fallback) } as never,
    { createProvider: jest.fn() } as never,
    log
  );
  const queue = [...usages];
  const fetchStub = jest.fn(async () => completion(queue.shift()));
  global.fetch = fetchStub as unknown as typeof fetch;
  const service = new ProofreadService(
    manager,
    { loadPrompts: async () => 'SYSTEM' } as never,
    { capture: jest.fn(async () => undefined) },
    { present: jest.fn(async () => undefined) },
    log as never
  );
  try {
    const result = await service.proofread({ chunks: [ALICE_OPENING_SEEDED, ALICE_RABBIT_SEEDED], label: 'chapter-01.md' });
    return { result, calls: fetchStub.mock.calls.length };
  } finally {
    manager.dispose();
  }
}

describe('a Proofread run\'s usage when a reply carries none (PR #171 F-05)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('control: two reported replies make a known total', async () => {
    const { result, calls } = await runWith([REPORTED_USAGE, REPORTED_USAGE]);

    expect(calls).toBe(2);
    expect(result).toMatchObject({
      kind: 'completed',
      chunks: [{ kind: 'read' }, { kind: 'read' }],
      usage: { promptTokens: 20, totalTokens: 40, costUsd: 0.2, cachedTokens: 6, requestCount: 2 }
    });
  });

  it('leaves cost and cache unknown when the second reply has no usage, and counts both calls', async () => {
    const { result, calls } = await runWith([REPORTED_USAGE, undefined]);

    expect(calls).toBe(2);
    expect(result).toMatchObject({ kind: 'completed', chunks: [{ kind: 'read' }, { kind: 'read' }] });
    const usage = (result as { usage?: Record<string, unknown> }).usage;
    expect(usage).toEqual({ promptTokens: 10, completionTokens: 10, totalTokens: 20, requestCount: 2 });
  });

  it('reports no usage at all when no reply carried any; the chunks still say both were read', async () => {
    const { result, calls } = await runWith([undefined, undefined]);

    expect(calls).toBe(2);
    expect(result).toMatchObject({ kind: 'completed', chunks: [{ kind: 'read' }, { kind: 'read' }] });
    expect(result).not.toHaveProperty('usage');
  });
});
