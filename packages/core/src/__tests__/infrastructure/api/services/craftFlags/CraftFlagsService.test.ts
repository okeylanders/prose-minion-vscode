/**
 * CraftFlagsService (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c): one
 * capability-free call per category over the whole passage, its reply read
 * on its own, and the price of the same calls before anything is sent. The
 * engine and the catalog are stand-ins; no provider is reached. Replies are
 * about public-domain *Alice*.
 */
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import { estimateRequestTokens } from '@orchestration/RequestContextPreflight';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  CRAFT_FLAGS_SHARED_PROMPT,
  CRAFT_FLAGS_TEMPERATURE,
  CRAFT_FLAG_PROMPTS,
  CraftFlagsService,
  buildCraftFlagsMessage,
  type CraftFlagsPriceSource
} from '@services/craftFlags/CraftFlagsService';
import { CRAFT_FLAGS_CLOSING_SENTINEL, CRAFT_FLAGS_OPENING_SENTINEL } from '@services/craftFlags/CraftFlagsResponseCodec';

const USAGE = { promptTokens: 4000, completionTokens: 600, totalTokens: 4600, costUsd: 0.02 };
const PASSAGE = 'But when the Rabbit actually took a watch out of its waistcoat-pocket, a chill ran down her spine.';
const CHILL = { original: 'a chill ran down her spine', before: 'its waistcoat-pocket,', after: '.', kind: 'cliche', why: 'A borrowed shiver.' };
const replyOf = (...flags: unknown[]) =>
  `${CRAFT_FLAGS_OPENING_SENTINEL}\n${JSON.stringify({ version: 1, flags })}\n${CRAFT_FLAGS_CLOSING_SENTINEL}`;

type Reply = { content: string; finishReason?: string; usage?: typeof USAGE; cancelled?: boolean } | Error;

function createService(replies: Reply[], options: { engine?: boolean; prices?: CraftFlagsPriceSource; model?: string } = {}) {
  const queue = [...replies];
  const runInitial = jest.fn(async () => {
    const next = queue.shift();
    if (!next) {
      throw new Error('no reply queued');
    }
    if (next instanceof Error) {
      throw next;
    }
    return { usedGuides: [], requestedResources: [], artifacts: [], finishReason: 'stop', usage: USAGE, ...next };
  });
  const manager = {
    ensureInitialized: jest.fn(async () => undefined),
    getEngine: jest.fn(() => (options.engine === false ? undefined : { runInitial })),
    getResolvedModel: jest.fn(() => options.model ?? 'placeholder/craft-model')
  };
  const promptLoader = { loadPrompts: jest.fn(async (files: string[]) => `SYSTEM ${files.join(' + ')}`) };
  const prices = options.prices ?? { pricing: jest.fn(async () => ({ promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 })) };
  const recovery = { capture: jest.fn(async () => ({ filePath: '/project/prose-minion/recovery/x.txt', toolName: 'craft-flags', storageScope: 'project' })) };
  const presenter = { present: jest.fn(async () => undefined) };
  const log = { appendLine: jest.fn() };
  const service = new CraftFlagsService(manager as never, promptLoader as never, prices, recovery as never, presenter, log as never);
  return { service, runInitial, manager, promptLoader, prices, recovery, presenter, log };
}

const request = { passage: PASSAGE, categories: ['cliche'] as const, label: 'chapter-01.md' };

describe('CraftFlagsService.flag', () => {
  it('reports unconfigured, sending nothing, when there is no craft engine', async () => {
    const { service, runInitial, manager } = createService([], { engine: false });
    await expect(service.flag(request)).resolves.toEqual({ kind: 'unconfigured' });
    expect(manager.getEngine).toHaveBeenCalledWith('craft');
    expect(runInitial).not.toHaveBeenCalled();
  });

  it('calls the craft engine once per category: capability-free, at its temperature, the passage as a JSON string', async () => {
    const { service, runInitial, promptLoader } = createService([{ content: replyOf(CHILL) }]);
    const result = await service.flag(request);

    const files = [CRAFT_FLAGS_SHARED_PROMPT, ...CRAFT_FLAG_PROMPTS.cliche];
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith(files);
    expect(runInitial).toHaveBeenCalledTimes(1);
    const [sent] = runInitial.mock.calls[0] as unknown as [Record<string, any>];
    expect(sent).toMatchObject({
      toolName: 'craft-flags',
      systemMessage: `SYSTEM ${files.join(' + ')}`,
      policy: AGENT_RUN_POLICIES.craftFlags,
      options: { temperature: CRAFT_FLAGS_TEMPERATURE, maxTokens: PROMPT_BUDGETS.craftFlags.outputTokens }
    });
    expect(sent.userMessage).toBe(buildCraftFlagsMessage('cliche', PASSAGE));
    expect(JSON.parse(sent.userMessage.slice(sent.userMessage.indexOf('{')))).toEqual({ task: 'craft-flags', category: 'cliche', passage: PASSAGE });
    expect(result).toEqual({
      kind: 'completed',
      calls: [{ kind: 'read', findings: [expect.objectContaining({ category: 'cliche', kind: 'cliche' })], malformed: 0, notesWithheld: 0 }],
      usage: expect.objectContaining(USAGE)
    });
  });

  it('rejects a reply that reached the output ceiling, never salvaged, and saves it for recovery', async () => {
    const { service, recovery, presenter, log } = createService([{ content: replyOf(CHILL).slice(0, 60), finishReason: 'length' }]);
    const result = await service.flag(request);

    expect(result).toMatchObject({ kind: 'completed', calls: [{ kind: 'rejected', saved: true }] });
    expect(recovery.capture).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'craft-flags', requestSummary: 'Craft Flags chapter-01.md, cliche' }));
    expect(presenter.present).toHaveBeenCalledTimes(1);
    expect(log.appendLine).toHaveBeenCalledWith(expect.stringContaining('output ceiling'));
  });

  it('rejects a reply whose frame cannot be read, and says what was wrong without its text', async () => {
    const { service, log } = createService([{ content: 'Here are the clichés: a chill ran down her spine' }]);
    expect(await service.flag(request)).toMatchObject({ kind: 'completed', calls: [{ kind: 'rejected' }] });
    const logged = log.appendLine.mock.calls.map(([line]) => line).join('\n');
    expect(logged).toContain('rejected');
    expect(logged).not.toContain('a chill ran down her spine');
  });

  it('says why a call was not sent: a key changed mid-run, or any other provider refusal', async () => {
    const keyChanged = await createService([new AgentRunUnavailableError('missing-credentials')]).service.flag(request);
    expect(keyChanged).toMatchObject({
      kind: 'completed',
      calls: [{ kind: 'unsent' }],
      interrupted: { cause: 'key-changed', message: 'The API key changed during the run, so the remaining categories were not sent.' }
    });
    const refused = await createService([new Error('402 Payment Required')]).service.flag(request);
    expect(refused).toMatchObject({ interrupted: { cause: 'provider', message: expect.stringContaining('402 Payment Required') } });
  });

  it('reports a run cancelled while its call worked, with what it spent', async () => {
    const controller = new AbortController();
    const { service, runInitial } = createService([]);
    runInitial.mockImplementationOnce(async () => {
      controller.abort();
      return { usedGuides: [], requestedResources: [], artifacts: [], finishReason: 'stop', usage: USAGE, content: '', cancelled: true };
    });
    await expect(service.flag({ ...request, signal: controller.signal }))
      .resolves.toEqual({ kind: 'cancelled', usage: expect.objectContaining(USAGE) });
  });

  it('sends nothing for a run cancelled before it began', async () => {
    const controller = new AbortController();
    controller.abort();
    const { service, runInitial } = createService([]);
    await expect(service.flag({ ...request, signal: controller.signal })).resolves.toEqual({ kind: 'cancelled' });
    expect(runInitial).not.toHaveBeenCalled();
  });
});

describe('CraftFlagsService.estimate', () => {
  it('prices the exact messages with the engine\'s estimator, and a typical reply per call', async () => {
    const { service } = createService([]);
    const estimate = await service.estimate(request);
    const inputTokens = estimateRequestTokens([
      { role: 'system', content: `SYSTEM ${[CRAFT_FLAGS_SHARED_PROMPT, ...CRAFT_FLAG_PROMPTS.cliche].join(' + ')}` },
      { role: 'user', content: buildCraftFlagsMessage('cliche', PASSAGE) }
    ]);
    const outputTokens = PROMPT_BUDGETS.craftFlags.typicalOutputTokens;

    expect(estimate).toEqual({
      model: 'placeholder/craft-model',
      calls: 1,
      inputTokens,
      outputTokens,
      usd: inputTokens * 0.000003 + outputTokens * 0.000015
    });
  });

  it('leaves the price out when the catalog has none, or cannot be read, and names no model without an engine', async () => {
    expect(await createService([], { prices: { pricing: async () => undefined } }).service.estimate(request)).not.toHaveProperty('usd');
    const failing = createService([], { prices: { pricing: async () => { throw new Error('offline'); } } });
    expect(await failing.service.estimate(request)).not.toHaveProperty('usd');
    expect(failing.log.appendLine).toHaveBeenCalledWith(expect.stringContaining('offline'));
    const unconfigured = await createService([], { engine: false }).service.estimate(request);
    expect(unconfigured).not.toHaveProperty('model');
    expect(unconfigured).not.toHaveProperty('usd');
  });
});
