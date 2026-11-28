/**
 * Proofread continues to respect Off and the catalog's mandatory reasoners.
 * Craft Flags prices and sends Standard for legacy Off, and checks live model
 * support before adding a thinking budget.
 *
 * Through the production AIResourceManager, AgentRunEngine, OpenRouterClient,
 * live catalog reader, ProofreadService, CraftFlagsService and both use
 * cases. The network is the only stand-in: `fetch` serves a catalog, records
 * each chat request's model and reasoning, and refuses `effort: 'none'` for a
 * model marked mandatory, as OpenRouter documents. Model ids, keys and prices
 * are placeholders; nothing reaches a provider. Text is public-domain *Alice*.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  // One at a time, in order: p-limit ships as an ES module jest does not transform.
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
import { OpenRouterModels } from '@providers/OpenRouterModels';
import { ProofreadService } from '@services/proofread/ProofreadService';
import { PROOFREAD_CLOSING_SENTINEL, PROOFREAD_OPENING_SENTINEL } from '@services/proofread/ProofreadResponseFrame';
import { CraftFlagsService } from '@services/craftFlags/CraftFlagsService';
import { CRAFT_FLAGS_CLOSING_SENTINEL, CRAFT_FLAGS_OPENING_SENTINEL } from '@services/craftFlags/CraftFlagsResponseCodec';
import { liveCatalogReasoning } from '@orchestration/ReasoningCatalog';
import { DraftEditUseCase } from '@/application/services/draftEdit/DraftEditUseCase';
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { CraftFlagsUseCase } from '@/application/services/draftEdit/CraftFlagsUseCase';
import { describeDraftEditOutcome } from '@/application/services/draftEdit/draftEditSummary';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { CRAFT_FLAG_CATEGORIES } from '@/domain/models/CraftFlag';
import type { ReasoningLevel } from '@/domain/models/ReasoningLevel';
import { FakeAnnotations, FakeDocuments, proofreadNow } from '@/__tests__/application/services/draftEdit/fakeDocuments';

const ALWAYS = 'test/always-reasons';
const CAN_STOP = 'test/can-stop';
const PLAIN = 'test/no-reasoning';
const TEXT = 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.';

interface Sent {
  readonly model: string;
  readonly reasoning?: Record<string, unknown>;
  readonly maxTokens: number;
}

const built: AIResourceManager[] = [];

async function createHost(values: Record<string, unknown>, catalog: { reachable: boolean; plainSupportsReasoning?: boolean }) {
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

  const sent: Sent[] = [];
  const catalogReads = { count: 0 };
  global.fetch = jest.fn(async (url: unknown, init?: { body?: unknown }) => {
    /* eslint-disable @typescript-eslint/naming-convention -- OpenRouter's wire names. */
    if (String(url).endsWith('/models')) {
      catalogReads.count++;
      if (!catalog.reachable) {
        throw new Error('catalog unreachable');
      }
      return {
        ok: true,
        json: async () => ({ data: [
          { id: ALWAYS, context_length: 1_000_000, pricing: { prompt: '0.000001', completion: '0.000001' }, reasoning: { mandatory: true } },
          { id: CAN_STOP, context_length: 1_000_000, pricing: { prompt: '0.000001', completion: '0.000001' }, reasoning: { mandatory: false } },
          { id: PLAIN, context_length: 1_000_000, supported_parameters: catalog.plainSupportsReasoning ? ['temperature', 'reasoning'] : ['temperature'] }
        ] })
      } as Response;
    }
    const body = JSON.parse(String(init?.body)) as Omit<Sent, 'maxTokens'> & { max_tokens: number; messages: Array<{ content: string }> };
    sent.push({ model: body.model, maxTokens: body.max_tokens, ...('reasoning' in body ? { reasoning: body.reasoning } : {}) });
    if (body.model === ALWAYS && body.reasoning?.effort === 'none') {
      return {
        ok: false,
        status: 400,
        headers: { get: () => null },
        text: async () => JSON.stringify({ error: { code: 400, message: 'Reasoning cannot be disabled for this model (test stand-in).' } })
      } as unknown as Response;
    }
    const proofread = body.messages.some((message) => message.content.includes('"task": "proofread"'));
    const content = proofread
      ? `${PROOFREAD_OPENING_SENTINEL}\n{"version":1,"issues":[]}\n${PROOFREAD_CLOSING_SENTINEL}`
      : `${CRAFT_FLAGS_OPENING_SENTINEL}\n{"version":1,"flags":[]}\n${CRAFT_FLAGS_CLOSING_SENTINEL}`;
    return {
      ok: true,
      json: async () => ({
        model: body.model,
        choices: [{ message: { content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      })
    } as Response;
    /* eslint-enable @typescript-eslint/naming-convention */
  }) as typeof fetch;

  const promptLoader = { loadPrompts: async (files: string[]) => `SYSTEM ${files.join(' + ')}` };
  const recovery = { capture: jest.fn(async () => undefined) };
  const presenter = { present: jest.fn(async () => undefined) };
  const reasoningCatalog = liveCatalogReasoning(log);
  const documents = new FakeDocuments(TEXT);
  const target = { uri: documents.uri, version: documents.version, text: TEXT, languageId: 'markdown', relativePath: 'chapter-01.md' };

  const proofread = new DraftEditUseCase(
    new ProofreadService(manager, promptLoader as never, reasoningCatalog, recovery, presenter, log),
    documents,
    new FakeAnnotations(documents),
    new DraftEditApplier(documents),
    log
  );
  const craft = new CraftFlagsUseCase(
    new CraftFlagsService(manager, promptLoader as never, { pricing: async () => undefined }, reasoningCatalog, recovery, presenter, log),
    documents,
    new FakeAnnotations(documents),
    log
  );
  const repick = async (changes: Record<string, unknown>) => {
    Object.assign(values, changes);
    await manager.refreshModelSelections();
  };
  return { proofread, craft, target, sent, catalogReads, repick };
}

describe('Draft editing reasoning over the provider transport', () => {
  const originalFetch = global.fetch;
  beforeEach(() => OpenRouterModels.clearCache());
  afterEach(() => {
    global.fetch = originalFetch;
    OpenRouterModels.clearCache();
    built.splice(0).forEach((manager) => manager.dispose());
  });

  const proofreadAt = (host: Awaited<ReturnType<typeof createHost>>, reasoning: ReasoningLevel) =>
    proofreadNow(host.proofread, host.target, { kind: 'proofread', output: 'flag', reasoning });

  describe('Proofread', () => {
    it('refuses off on the always-reasoning model, sending nothing, and says what to change', async () => {
      const host = await createHost({ proofreadModel: ALWAYS }, { reachable: true });
      const outcome = await proofreadAt(host, 'off');

      expect(outcome).toEqual({ kind: 'reasoning-required', model: ALWAYS });
      expect(host.sent).toEqual([]);
      expect(describeDraftEditOutcome(outcome, 'chapter-01.md')).toEqual({
        level: 'warning',
        message: 'Proofread sent nothing: the model catalog says test/always-reasons always reasons, so it cannot be asked for reasoning off. '
          + 'Set proseMinion.proofread.reasoning to light or higher, or choose another model in proseMinion.proofreadModel.',
        hasFlags: false
      });
    });

    it('sends the same model a budget at light, and off to a model that can stop: the controls', async () => {
      const light = await createHost({ proofreadModel: ALWAYS }, { reachable: true });
      expect((await proofreadAt(light, 'light')).kind).toBe('completed');
      // eslint-disable-next-line @typescript-eslint/naming-convention -- OpenRouter's wire name.
      expect(light.sent).toMatchObject([{ model: ALWAYS, reasoning: { max_tokens: 1_024 } }]);
      expect(light.catalogReads.count).toBe(0);

      const off = await createHost({ proofreadModel: CAN_STOP }, { reachable: true });
      expect((await proofreadAt(off, 'off')).kind).toBe('completed');
      expect(off.sent).toMatchObject([{ model: CAN_STOP, reasoning: { effort: 'none' } }]);
    });

    it('sends off as asked when the catalog cannot be read, and the provider\'s refusal is the run\'s', async () => {
      const host = await createHost({ proofreadModel: ALWAYS }, { reachable: false });
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      let outcome;
      try {
        outcome = await proofreadAt(host, 'off');
      } finally {
        consoleError.mockRestore();
      }

      expect(host.sent).toMatchObject([{ model: ALWAYS, reasoning: { effort: 'none' } }]);
      expect(outcome).toMatchObject({
        kind: 'completed',
        chunks: { total: 1, completed: 0 },
        interrupted: { cause: 'provider', message: expect.stringContaining('Reasoning cannot be disabled for this model') }
      });
    });
  });

  describe('Craft Flags', () => {
    const CALLS = CRAFT_FLAG_CATEGORIES.length;
    const TYPICAL = PROMPT_BUDGETS.craftFlags.typicalOutputTokens;
    const REPLY_TOKENS = PROMPT_BUDGETS.craftFlags.outputTokens;
    const STANDARD = PROMPT_BUDGETS.reasoning.standard;

    async function planRun(host: Awaited<ReturnType<typeof createHost>>, reasoning: ReasoningLevel) {
      const begun = host.craft.begin(host.target, { kind: 'craft', categories: CRAFT_FLAG_CATEGORIES, reasoning });
      if (begun.kind !== 'gesture') {
        throw new Error(`no gesture: ${begun.kind}`);
      }
      const plan = await host.craft.plan(begun.gesture);
      if (plan.kind !== 'ready') {
        throw new Error(`not ready: ${plan.kind}`);
      }
      const { model, reasoningBudgeted } = plan.estimate;
      return { estimate: plan.estimate, run: () => host.craft.run(begun.gesture, { model, reasoningBudgeted }) };
    }

    it.each([ALWAYS, CAN_STOP])('estimates and sends Standard for a historical Off setting on %s', async model => {
      const host = await createHost({ assistantModel: model }, { reachable: true });
      const plan = await planRun(host, 'off');
      expect(plan.estimate).toMatchObject({ model, reasoningBudgeted: true, outputTokens: CALLS * (TYPICAL + STANDARD / 2) });
      expect(host.sent).toEqual([]);

      await host.repick({ craftModel: PLAIN });
      expect((await plan.run()).kind).toBe('completed');
      // eslint-disable-next-line @typescript-eslint/naming-convention -- OpenRouter's wire name.
      expect(host.sent).toEqual(CRAFT_FLAG_CATEGORIES.map(() => ({ model, maxTokens: REPLY_TOKENS + STANDARD, reasoning: { max_tokens: STANDARD } })));
    });

    it('keeps the plain request and estimate for a non-reasoning model after the catalog refreshes', async () => {
      const catalog = { reachable: true, plainSupportsReasoning: false };
      const host = await createHost({ assistantModel: ALWAYS, craftModel: PLAIN }, catalog);
      const plan = await planRun(host, 'deep');
      expect(plan.estimate).toMatchObject({ model: PLAIN, reasoningBudgeted: false, outputTokens: CALLS * TYPICAL });

      catalog.plainSupportsReasoning = true;
      OpenRouterModels.clearCache();
      await OpenRouterModels.fetchModels();
      expect(OpenRouterModels.getCachedSupportsReasoning(PLAIN)).toBe(true);
      expect((await plan.run()).kind).toBe('completed');
      expect(host.sent).toEqual(CRAFT_FLAG_CATEGORIES.map(() => ({ model: PLAIN, maxTokens: REPLY_TOKENS })));
    });

    it('keeps the selected budget when the model catalog has no entry', async () => {
      const model = 'test/model-not-listed';
      const host = await createHost({ craftModel: model }, { reachable: true });
      const plan = await planRun(host, 'light');
      const light = PROMPT_BUDGETS.reasoning.light;
      expect(plan.estimate).toMatchObject({ model, reasoningBudgeted: true, outputTokens: CALLS * (TYPICAL + light / 2) });
      expect((await plan.run()).kind).toBe('completed');
      // eslint-disable-next-line @typescript-eslint/naming-convention -- OpenRouter's wire name.
      expect(host.sent).toEqual(CRAFT_FLAG_CATEGORIES.map(() => ({ model, maxTokens: REPLY_TOKENS + light, reasoning: { max_tokens: light } })));
    });
  });
});
