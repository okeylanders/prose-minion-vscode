/**
 * PR #171 F-01: Proofread with no webview open. The editor command uses the
 * shared AIResourceManager directly, so the manager's key and model
 * subscriptions must not depend on a webview's MessageHandler. Here no
 * handler exists: only the production SecretStorageService (over a stand-in
 * secret store that fires its change event), AIResourceManager,
 * AIResourceRefresh, AgentRunEngine, OpenRouterClient and ProofreadService.
 * HTTP is stubbed at `fetch`, which records each request's model and key.
 *
 * Chunks run three at a time, as Proofread's budget sets. Replies are about
 * public-domain passages; keys and model ids are placeholders. Nothing
 * reaches a provider.
 */
/* eslint-disable @typescript-eslint/naming-convention -- OpenRouter's wire fields are snake_case. */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: (concurrency: number) => {
    let active = 0;
    const waiting: Array<() => void> = [];
    const next = () => {
      if (active < concurrency && waiting.length > 0) {
        active += 1;
        waiting.shift()!();
      }
    };
    return <T>(task: () => Promise<T>) => new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        task().then(resolve, reject).finally(() => {
          active -= 1;
          next();
        });
      });
      next();
    });
  }
}));

import { AIResourceManager } from '@orchestration/AIResourceManager';
import { AIResourceRefresh } from '@orchestration/AIResourceRefresh';
import { SecretStorageService } from '@/infrastructure/secrets/SecretStorageService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { ProofreadService } from '@services/proofread/ProofreadService';
import { WEATHER_ISSUE, replyOf } from '@/__tests__/infrastructure/api/services/proofread/proofreadReplyFixtures';
import { ALICE_OPENING_SEEDED } from '@/__tests__/utils/draftEdit/proofreadFixtures';

const FIRST_KEY = 'sk-placeholder-first';
const NEXT_KEY = 'sk-placeholder-next';
const MODEL_A = 'placeholder/proofread-model-a';
const MODEL_B = 'placeholder/proofread-model-b';

interface Sent {
  readonly model: string;
  readonly authorization: string;
}

async function createHost() {
  const stored = new Map<string, string>([['openRouterApiKey', FIRST_KEY]]);
  const listeners = new Set<(event: unknown) => unknown>();
  const changed = () => listeners.forEach((listener) => listener({ key: 'openRouterApiKey' }));
  /** When set, the next read answers only when released, with the key as it stood when read. */
  let holdNextRead = false;
  const heldReads: Array<() => void> = [];
  const secretStore = {
    get: (key: string) => {
      const value = stored.get(key);
      if (!holdNextRead) {
        return Promise.resolve(value);
      }
      holdNextRead = false;
      return new Promise<string | undefined>((resolve) => heldReads.push(() => resolve(value)));
    },
    store: async (key: string, value: string) => { stored.set(key, value); changed(); },
    delete: async (key: string) => { stored.delete(key); changed(); },
    onDidChange: (listener: (event: unknown) => unknown) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    }
  };
  const secrets = new SecretStorageService(secretStore);
  const values: Record<string, unknown> = { proofreadModel: MODEL_A };
  const settings = { get: (_section: string, key: string, fallback?: unknown) => values[key] ?? fallback };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const manager = new AIResourceManager(
    { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
    secrets,
    settings as never,
    { createProvider: jest.fn() } as never,
    log
  );
  await manager.ensureInitialized();
  const refresh = new AIResourceRefresh(manager, secrets, settings as never, log);

  const sent: Sent[] = [];
  let holding = 0;
  const held: Array<() => void> = [];
  global.fetch = jest.fn(async (_url: unknown, init: { body: string; headers: Record<string, string> }) => {
    sent.push({ model: JSON.parse(init.body).model, authorization: init.headers.Authorization });
    if (holding > 0) {
      holding -= 1;
      await new Promise<void>((release) => held.push(release));
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'gen-placeholder',
        choices: [{ message: { content: replyOf(WEATHER_ISSUE) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20, cost: 0.001 }
      })
    };
  }) as unknown as typeof fetch;

  const service = new ProofreadService(
    manager,
    { loadPrompts: async () => 'SYSTEM' } as never,
    { alwaysReasons: async () => undefined },
    { capture: jest.fn(async () => undefined) },
    { present: jest.fn(async () => undefined) },
    log as never
  );
  const until = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 400 && !condition(); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };
  return {
    manager, refresh, secrets, service, sent, until,
    proofread: (chunks: number) => service.proofread({ chunks: Array.from({ length: chunks }, () => ALICE_OPENING_SEEDED), label: 'chapter-01.md' }),
    hold: (count: number) => { holding = count; },
    holdNextKeyRead: () => { holdNextRead = true; },
    releaseKeyRead: () => heldReads.shift()?.(),
    releaseAll: () => held.splice(0).forEach((release) => release()),
    held: () => held.length,
    setModel: (model: string) => {
      values.proofreadModel = model;
      refresh.handleConfigurationChange((section) => section === 'proseMinion.proofreadModel');
    },
    generation: () => manager.getGeneration('assistant')!,
    /** Change the stored key, then wait for the rebuild its change event alone starts: nothing here asks for one. */
    changeKey: async (change: () => Promise<void>) => {
      const before = manager.getGeneration('assistant')!;
      await change();
      await until(() => manager.getGeneration('assistant')! > before);
      expect(manager.getGeneration('assistant')).toBe(before + 1);
    }
  };
}

describe('Proofread with no webview open, after a model or key change (PR #171 F-01)', () => {
  const originalFetch = global.fetch;
  const managers: AIResourceManager[] = [];
  const refreshes: AIResourceRefresh[] = [];
  afterEach(() => {
    global.fetch = originalFetch;
    managers.splice(0).forEach((manager) => manager.dispose());
    refreshes.splice(0).forEach((refresh) => refresh.dispose());
  });
  const track = (host: Awaited<ReturnType<typeof createHost>>) => {
    managers.push(host.manager);
    refreshes.push(host.refresh);
    return host;
  };

  it('uses a Proofread model changed in VS Code settings on the next request', async () => {
    const host = track(await createHost());
    await host.proofread(1);
    host.setModel(MODEL_B);
    await host.until(() => host.manager.getEngine('proofread')?.getModel() === MODEL_B);
    await host.proofread(1);

    expect(host.sent.map((each) => each.model)).toEqual([MODEL_A, MODEL_B]);
  });

  it('is unconfigured once the key is removed from another window, and sends nothing', async () => {
    const host = track(await createHost());
    await host.proofread(1);
    await host.changeKey(() => host.secrets.deleteApiKey());

    await expect(host.proofread(1)).resolves.toEqual({ kind: 'unconfigured' });
    expect(host.sent).toHaveLength(1);
  });

  it('uses a replaced key on the next request', async () => {
    const host = track(await createHost());
    await host.proofread(1);
    await host.changeKey(() => host.secrets.setApiKey(NEXT_KEY));
    await host.proofread(1);

    expect(host.sent.map((each) => each.authorization)).toEqual([`Bearer ${FIRST_KEY}`, `Bearer ${NEXT_KEY}`]);
  });

  it('sends no queued chunk on the old key: three in flight land, three are never sent, and the run names the key change', async () => {
    const host = track(await createHost());
    expect(PROMPT_BUDGETS.proofread.concurrency).toBe(3);
    host.hold(3);
    const run = host.proofread(6);
    await host.until(() => host.held() === 3);

    await host.changeKey(() => host.secrets.deleteApiKey());
    host.releaseAll();

    const result = await run;
    expect(host.sent).toHaveLength(3);
    expect(result).toMatchObject({
      kind: 'completed',
      chunks: [{ kind: 'read' }, { kind: 'read' }, { kind: 'read' }, { kind: 'unsent' }, { kind: 'unsent' }, { kind: 'unsent' }],
      interrupted: { cause: 'key-changed' }
    });
    await expect(host.proofread(1)).resolves.toEqual({ kind: 'unconfigured' });
  });

  it('never lets an older key read that answers last retire a run on the newer key, or hide the next deletion (re-review)', async () => {
    const host = track(await createHost());
    // The deletion's read is held after it saw no key.
    host.holdNextKeyRead();
    await host.secrets.deleteApiKey();
    // A newer key arrives, and its change rebuilds the manager.
    await host.changeKey(() => host.secrets.setApiKey(NEXT_KEY));
    const afterNext = host.generation();

    // A fresh run starts on the newer key; three requests are held in flight.
    host.hold(3);
    const run = host.proofread(6);
    await host.until(() => host.sent.length === 3);

    // The older read lands last: it builds nothing and retires nothing.
    host.releaseKeyRead();
    await new Promise((resolve) => setImmediate(resolve));
    expect(host.generation()).toBe(afterNext);
    host.releaseAll();
    const result = await run;
    expect(result).toMatchObject({ kind: 'completed', chunks: Array.from({ length: 6 }, () => ({ kind: 'read' })) });
    expect(result).not.toHaveProperty('interrupted');
    expect(host.sent.map((each) => each.authorization)).toEqual(Array.from({ length: 6 }, () => `Bearer ${NEXT_KEY}`));

    // The next deletion is still heard, as the overlay's Clear awaits it.
    await host.changeKey(() => host.secrets.deleteApiKey());
    await host.refresh.refreshKey();
    await expect(host.proofread(1)).resolves.toEqual({ kind: 'unconfigured' });
    expect(host.sent).toHaveLength(6);
    expect(host.manager.getEngine('assistant')?.isProviderAvailable()).toBe(false);
  });

  it('builds nothing for a key read still pending when the owner is disposed', async () => {
    const host = track(await createHost());
    const before = host.generation();
    host.holdNextKeyRead();
    await host.secrets.setApiKey(NEXT_KEY);
    host.refresh.dispose();
    host.releaseKeyRead();
    await new Promise((resolve) => setImmediate(resolve));

    expect(host.generation()).toBe(before);
  });

  it('rebuilds once for a key change that this owner and an open webview both hear', async () => {
    const host = track(await createHost());
    const before = host.manager.getGeneration('proofread')!;
    // A webview's handler asks too, as MessageHandler does on the same event, twice over.
    await host.secrets.setApiKey(NEXT_KEY);
    await Promise.all([host.refresh.refreshKey(), host.refresh.refreshKey()]);
    await host.refresh.refreshKey();

    expect(host.manager.getGeneration('proofread')).toBe(before + 1);
  });
});
