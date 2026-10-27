/**
 * PR #169 F-01, for Proofread (ADR 2026-10-21 D6): once the API key is
 * removed or replaced, a Proofread run in progress starts no new provider
 * request through the engine it holds, keeps the chunks that finished, and
 * names the key change.
 *
 * Through the production AIResourceManager, AgentRunEngine, and real
 * OpenRouterClients, whose non-streaming transport is the only stand-in: it
 * records each request it starts, and holds the first until the test
 * releases it. Chunks run one at a time, so the second starts only after the
 * key change. Replies are about public-domain passages; keys and model ids
 * are placeholders. Nothing reaches a provider.
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
import { OpenRouterClient } from '@providers/OpenRouterClient';
import { ProofreadService } from '@services/proofread/ProofreadService';
import { WEATHER_ISSUE, replyOf } from '@/__tests__/infrastructure/api/services/proofread/proofreadReplyFixtures';
import { ALICE_OPENING_SEEDED, ALICE_RABBIT_SEEDED } from '@/__tests__/utils/draftEdit/proofreadFixtures';

async function createHost() {
  let savedKey: string | undefined = 'sk-placeholder-first';
  const secrets = { getApiKey: jest.fn(async () => savedKey) };
  const values: Record<string, unknown> = { proofreadModel: 'placeholder/proofread-model' };
  const settings = { get: (_section: string, key: string, fallback?: unknown) => values[key] ?? fallback };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const manager = new AIResourceManager(
    { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
    secrets as never,
    settings as never,
    { createProvider: jest.fn() } as never,
    log
  );
  await manager.ensureInitialized();

  const starts: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstHeld = new Promise<void>((release) => { releaseFirst = release; });
  jest.spyOn(OpenRouterClient.prototype, 'createChatCompletion').mockImplementation(async function complete(this: OpenRouterClient) {
    const index = starts.push(Reflect.get(this, 'apiKey') as string) - 1;
    if (index === 0) {
      await firstHeld;
    }
    return {
      content: replyOf(WEATHER_ISSUE),
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20, costUsd: 0.001 }
    };
  });

  const service = new ProofreadService(
    manager,
    { loadPrompts: async () => 'SYSTEM' } as never,
    { alwaysReasons: async () => undefined },
    { capture: jest.fn(async () => undefined) },
    { present: jest.fn(async () => undefined) },
    log as never
  );
  const run = service.proofread({ chunks: [ALICE_OPENING_SEEDED, ALICE_RABBIT_SEEDED], label: 'chapter-01.md' });
  const until = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 400 && !condition(); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };
  await until(() => starts.length === 1);

  return {
    manager, starts, run,
    release: () => releaseFirst?.(),
    setKey: (key: string | undefined) => { savedKey = key; }
  };
}

describe('a Proofread run after its key is removed or replaced (PR #169 F-01)', () => {
  const managers: AIResourceManager[] = [];
  afterEach(() => {
    jest.restoreAllMocks();
    managers.splice(0).forEach((manager) => manager.dispose());
  });

  it('control: with the key kept, both chunks start a request', async () => {
    const host = await createHost();
    managers.push(host.manager);
    host.release();

    await expect(host.run).resolves.toMatchObject({ kind: 'completed', chunks: [{ kind: 'read' }, { kind: 'read' }] });
    expect(host.starts).toEqual(['sk-placeholder-first', 'sk-placeholder-first']);
  });

  it('starts no second request once the key is cleared; the first, already sent, lands', async () => {
    const host = await createHost();
    managers.push(host.manager);
    host.setKey(undefined);
    await host.manager.refreshConfiguration();
    host.release();

    await expect(host.run).resolves.toMatchObject({
      kind: 'completed',
      chunks: [{ kind: 'read', findings: [{ category: 'homophone' }] }, { kind: 'unsent' }],
      interrupted: { cause: 'key-changed' }
    });
    expect(host.starts).toHaveLength(1);
  });

  it('never sends the rest on the retired engine when the key is replaced; a new run uses the new key', async () => {
    const host = await createHost();
    managers.push(host.manager);
    host.setKey('sk-placeholder-next');
    await host.manager.refreshConfiguration();
    host.release();

    await expect(host.run).resolves.toMatchObject({ chunks: [{ kind: 'read' }, { kind: 'unsent' }], interrupted: { cause: 'key-changed' } });
    expect(host.starts).toEqual(['sk-placeholder-first']);
    expect(host.manager.getEngine('proofread')?.isProviderAvailable()).toBe(true);
  });
});
