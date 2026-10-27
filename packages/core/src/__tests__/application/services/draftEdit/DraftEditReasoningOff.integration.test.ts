/**
 * PR #181 F-01: reasoning `off` never goes to a model the catalog marks as
 * always reasoning (`reasoning.mandatory`), in either pass, and goes as asked
 * when the catalog cannot say.
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
import { liveCatalogReasoning } from '@services/draftEdit/DraftEditReasoningSupport';
import { DraftEditUseCase } from '@/application/services/draftEdit/DraftEditUseCase';
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { CraftFlagsUseCase } from '@/application/services/draftEdit/CraftFlagsUseCase';
import { describeDraftEditOutcome } from '@/application/services/draftEdit/draftEditSummary';
import { describeCraftFlagsOutcome } from '@/application/services/draftEdit/craftFlagsSummary';
import { CRAFT_FLAG_CATEGORIES } from '@/domain/models/CraftFlag';
import type { ReasoningLevel } from '@/domain/models/ReasoningLevel';
import { FakeAnnotations, FakeDocuments } from '@/__tests__/application/services/draftEdit/fakeDocuments';

const ALWAYS = 'test/always-reasons';
const CAN_STOP = 'test/can-stop';
const TEXT = 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.';

interface Sent {
  readonly model: string;
  readonly reasoning?: Record<string, unknown>;
}

const built: AIResourceManager[] = [];

async function createHost(values: Record<string, unknown>, catalog: { reachable: boolean }) {
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
          { id: CAN_STOP, context_length: 1_000_000, pricing: { prompt: '0.000001', completion: '0.000001' }, reasoning: { mandatory: false } }
        ] })
      } as Response;
    }
    const body = JSON.parse(String(init?.body)) as Sent & { messages: Array<{ content: string }> };
    sent.push({ model: body.model, ...(body.reasoning ? { reasoning: body.reasoning } : {}) });
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

describe('Reasoning off on a model that always reasons (PR #181 F-01)', () => {
  const originalFetch = global.fetch;
  beforeEach(() => OpenRouterModels.clearCache());
  afterEach(() => {
    global.fetch = originalFetch;
    OpenRouterModels.clearCache();
    built.splice(0).forEach((manager) => manager.dispose());
  });

  const proofreadAt = (host: Awaited<ReturnType<typeof createHost>>, reasoning: ReasoningLevel) =>
    host.proofread.run(host.target, { kind: 'proofread', output: 'flag', reasoning });

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
      expect(light.sent).toEqual([{ model: ALWAYS, reasoning: { max_tokens: 1_024 } }]);
      expect(light.catalogReads.count).toBe(0);

      const off = await createHost({ proofreadModel: CAN_STOP }, { reachable: true });
      expect((await proofreadAt(off, 'off')).kind).toBe('completed');
      expect(off.sent).toEqual([{ model: CAN_STOP, reasoning: { effort: 'none' } }]);
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

      expect(host.sent).toEqual([{ model: ALWAYS, reasoning: { effort: 'none' } }]);
      expect(outcome).toMatchObject({
        kind: 'completed',
        chunks: { total: 1, completed: 0 },
        interrupted: { cause: 'provider', message: expect.stringContaining('Reasoning cannot be disabled for this model') }
      });
    });
  });

  describe('Craft Flags', () => {
    const PASS = { kind: 'craft' as const, categories: [...CRAFT_FLAG_CATEGORIES], reasoning: 'off' as const };

    function gestureOf(host: Awaited<ReturnType<typeof createHost>>) {
      const begun = host.craft.begin(host.target, PASS);
      if (begun.kind !== 'gesture') {
        throw new Error(`no gesture: ${begun.kind}`);
      }
      return begun.gesture;
    }

    it('refuses off on the always-reasoning model before any confirmation, sending none of the four calls', async () => {
      const host = await createHost({ craftModel: ALWAYS }, { reachable: true });
      const plan = await host.craft.plan(gestureOf(host));

      expect(plan).toEqual({ kind: 'reasoning-required', model: ALWAYS });
      expect(host.sent).toEqual([]);
      expect(describeCraftFlagsOutcome(plan as { kind: 'reasoning-required'; model: string }, 'chapter-01.md').message).toBe(
        'Craft Flags sent nothing: the model catalog says test/always-reasons always reasons, so it cannot be asked for reasoning off. '
          + 'Set proseMinion.craftFlags.reasoning to light or higher, or choose another model in proseMinion.craftModel.'
      );
      expect(host.craft.begin(host.target, PASS).kind).toBe('gesture');
    });

    it('sends all four calls at off to the approved model when the setting moves to an always-reasoning one during the confirmation', async () => {
      const host = await createHost({ craftModel: CAN_STOP }, { reachable: true });
      const gesture = gestureOf(host);
      const plan = await host.craft.plan(gesture);
      if (plan.kind !== 'ready') {
        throw new Error(`not ready: ${plan.kind}`);
      }
      // The writer reads the confirmation here, and picks another model meanwhile.
      await host.repick({ craftModel: ALWAYS });
      const outcome = await host.craft.run(gesture, { model: plan.estimate.model });

      expect(outcome.kind).toBe('completed');
      expect(host.sent).toEqual(CRAFT_FLAG_CATEGORIES.map(() => ({ model: CAN_STOP, reasoning: { effort: 'none' } })));
    });

    it('refuses at the calls when the catalog, unreadable at the price, is read again before the run', async () => {
      const catalog = { reachable: false };
      const host = await createHost({ craftModel: ALWAYS }, catalog);
      const gesture = gestureOf(host);
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      let plan;
      try {
        plan = await host.craft.plan(gesture);
      } finally {
        consoleError.mockRestore();
      }
      expect(plan?.kind).toBe('ready');

      // The model browser refreshes the catalog while the confirmation is open.
      catalog.reachable = true;
      OpenRouterModels.clearCache();
      const outcome = await host.craft.run(gesture, { model: ALWAYS });

      expect(outcome).toEqual({ kind: 'reasoning-required', model: ALWAYS });
      expect(host.sent).toEqual([]);
    });
  });
});
