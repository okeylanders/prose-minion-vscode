/**
 * PR #177 F-01: a Craft Flags run goes to the model its confirmation named,
 * whatever the craft model is by the time the chapter is sent.
 *
 * Through the production AIResourceManager, AgentRunEngine, OpenRouterClient,
 * CraftFlagsService and CraftFlagsUseCase. The network is the only stand-in:
 * `fetch` records the model each request body names, and answers with an
 * empty reply. The price source, the prompts or the gap before the run are
 * held while the model changes, by the writer's own Craft Flags setting or by
 * the Workshop model it follows. Model ids, keys and prices are placeholders;
 * nothing reaches a provider.
 */
import { AIResourceManager } from '@orchestration/AIResourceManager';
import { CraftFlagsService, type CraftFlagsPriceSource } from '@services/craftFlags/CraftFlagsService';
import { CRAFT_FLAGS_CLOSING_SENTINEL, CRAFT_FLAGS_OPENING_SENTINEL } from '@services/craftFlags/CraftFlagsResponseCodec';
import { CraftFlagsUseCase } from '@/application/services/draftEdit/CraftFlagsUseCase';
import { CRAFT_FLAG_CATEGORIES } from '@/domain/models/CraftFlag';
import { FakeAnnotations, FakeDocuments } from '@/__tests__/application/services/draftEdit/fakeDocuments';

const CHEAP = 'test/cheap-model';
const EXPENSIVE = 'test/expensive-model';
const TEXT = 'When the Rabbit took a watch out of its waistcoat-pocket, a chill ran down her spine.';
const PASS = { kind: 'craft' as const, categories: [...CRAFT_FLAG_CATEGORIES] };

const held = () => {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

const built: AIResourceManager[] = [];

async function createHost(values: Record<string, unknown>) {
  const settings = { get: (_section: string, key: string, fallback?: unknown) => values[key] ?? fallback };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const manager = new AIResourceManager(
    { getGuideRegistry: jest.fn(), getGuideLoader: jest.fn() } as never,
    { getApiKey: jest.fn(async () => 'sk-placeholder') } as never,
    settings as never,
    { createProvider: jest.fn() } as never,
    log
  );
  built.push(manager);
  await manager.ensureInitialized();

  const sent: string[] = [];
  global.fetch = jest.fn(async (_url: unknown, init?: { body?: unknown }) => {
    sent.push(JSON.parse(String(init?.body)).model);
    /* eslint-disable @typescript-eslint/naming-convention -- OpenRouter's wire names. */
    return {
      ok: true,
      json: async () => ({
        model: sent[sent.length - 1],
        choices: [{ message: { content: `${CRAFT_FLAGS_OPENING_SENTINEL}\n{"version":1,"flags":[]}\n${CRAFT_FLAGS_CLOSING_SENTINEL}` }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      })
    } as Response;
    /* eslint-enable @typescript-eslint/naming-convention */
  }) as typeof fetch;

  const pricing = { gate: undefined as Promise<void> | undefined };
  const prices: CraftFlagsPriceSource = {
    pricing: async (model) => {
      await pricing.gate;
      return model === CHEAP ? { promptUsdPerToken: 0.000_000_1, completionUsdPerToken: 0.000_000_1 } : { promptUsdPerToken: 0.000_1, completionUsdPerToken: 0.000_1 };
    }
  };
  const prompts = { gate: undefined as Promise<void> | undefined };
  const promptLoader = {
    loadPrompts: async (files: string[]) => {
      await prompts.gate;
      return `SYSTEM ${files.join(' + ')}`;
    }
  };
  const service = new CraftFlagsService(manager, promptLoader as never, prices, { alwaysReasons: async () => undefined }, { capture: jest.fn() } as never, { present: jest.fn() }, log);
  const documents = new FakeDocuments(TEXT);
  const useCase = new CraftFlagsUseCase(service, documents, new FakeAnnotations(documents), log);
  const target = { uri: documents.uri, version: documents.version, text: TEXT, languageId: 'markdown', relativePath: 'chapter-01.md' };

  const repick = async (changes: Record<string, unknown>) => {
    Object.assign(values, changes);
    await manager.refreshModelSelections();
  };
  return { manager, useCase, target, sent, pricing, prompts, repick };
}

describe('Craft Flags runs at the model the writer approved (PR #177 F-01)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    built.splice(0).forEach((manager) => manager.dispose());
  });

  async function approvedThenRun(
    host: Awaited<ReturnType<typeof createHost>>,
    during: { pricing?: () => Promise<void>; confirmation?: () => Promise<void>; prompts?: () => Promise<void> }
  ) {
    const begun = host.useCase.begin(host.target, PASS);
    if (begun.kind !== 'gesture') {
      throw new Error('no gesture');
    }
    const pricingHeld = held();
    host.pricing.gate = pricingHeld.promise;
    const planned = host.useCase.plan(begun.gesture);
    await during.pricing?.();
    pricingHeld.release();
    const plan = await planned;
    if (plan.kind !== 'ready') {
      throw new Error(`not ready: ${plan.kind}`);
    }
    // The writer reads the confirmation here.
    await during.confirmation?.();
    const promptsHeld = held();
    host.prompts.gate = promptsHeld.promise;
    const ran = host.useCase.run(begun.gesture, { model: plan.estimate.model });
    await during.prompts?.();
    promptsHeld.release();
    return { plan, outcome: await ran };
  }

  it.each([
    ['its own setting, while the price is read', { pricing: true }],
    ['its own setting, while the confirmation is open', { confirmation: true }],
    ['its own setting, while the prompts load', { prompts: true }]
  ])('sends the chapter to the confirmed model when the writer changes %s', async (_case, when) => {
    const host = await createHost({ craftModel: CHEAP });
    const change = () => host.repick({ craftModel: EXPENSIVE });
    const { plan, outcome } = await approvedThenRun(host, {
      ...('pricing' in when ? { pricing: change } : {}),
      ...('confirmation' in when ? { confirmation: change } : {}),
      ...('prompts' in when ? { prompts: change } : {})
    });

    expect(host.manager.getEngine('craft')?.getModel()).toBe(EXPENSIVE);
    expect(plan.estimate).toMatchObject({ model: CHEAP });
    expect(plan.estimate.usd).toBeLessThan(0.01);
    expect(outcome.kind).toBe('completed');
    expect(host.sent).toEqual(PASS.categories.map(() => CHEAP));
  });

  it.each([
    ['while the price is read', 'pricing'],
    ['while the confirmation is open', 'confirmation'],
    ['while the prompts load', 'prompts']
  ] as const)('sends the chapter to the confirmed model when the Workshop model it follows changes %s', async (_case, when) => {
    const host = await createHost({ assistantModel: CHEAP });
    const change = () => host.repick({ assistantModel: EXPENSIVE });
    const { plan } = await approvedThenRun(host, { [when]: change });

    expect(host.manager.getEngine('craft')?.getModel()).toBe(EXPENSIVE);
    expect(plan.estimate.model).toBe(CHEAP);
    expect(host.sent).toEqual(PASS.categories.map(() => CHEAP));
  });

  it('sends to the craft model as it stands when nothing changed: the control', async () => {
    const host = await createHost({ craftModel: EXPENSIVE });
    const { plan } = await approvedThenRun(host, {});

    expect(plan.estimate.model).toBe(EXPENSIVE);
    expect(host.sent).toEqual(PASS.categories.map(() => EXPENSIVE));
  });
});
