/**
 * PassageSearchModelOrganizer (ADR 2026-11-20 D12, D12a, D13, D22): a plan
 * sends nothing and prices the exact request; a pass sends exactly that
 * request to the result's model, once; nothing starts after Stop or a key
 * change; a cut-off, malformed or failed pass leaves the list whole with
 * its reason; and logs carry counts and fault kinds only. The engine is a
 * stand-in; no provider is reached. Texts adapt *Alice's Adventures in
 * Wonderland*.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  // One at a time, in order, so the reads and then the pass take replies in a known order.
  default: () => {
    let chain: Promise<unknown> = Promise.resolve();
    return (fn: () => Promise<unknown>) => {
      const run = chain.then(fn);
      chain = run.catch(() => undefined);
      return run;
    };
  }
}));

import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { estimateRequestTokens } from '@orchestration/RequestContextPreflight';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import {
  PASSAGE_SEARCH_ORGANIZE_PROMPTS,
  buildPassageSearchOrganizeMessage
} from '@services/search/passage/PassageSearchOrganizeRequest';
import type { PassageSearchModelFacts } from '@services/search/passage/PassageSearchPrices';
import { PASSAGE_MODEL, instanceOf, resultOf } from '@/__tests__/infrastructure/api/services/search/passage/passageSearchFixtures';
import {
  ANALYSIS_REPLY,
  PRICING,
  RESULT,
  USAGE,
  createHost,
  ok,
  organize,
  planOf,
  type Reply
} from '@/__tests__/infrastructure/api/services/search/passage/passageSearchOrganizeHarness';

const many = (count: number) => Array.from({ length: count }, (_unused, index) =>
  instanceOf(index + 1, { quote: `The Rabbit looked at its watch a ${index + 1}th time, and hurried on down the long passage.` }));

describe('PassageSearchModelOrganizer.plan', () => {
  it('sends nothing to a model, and prices the exact request it would send', async () => {
    const { organizer, runInitial, promptLoader, prices } = createHost();
    const plan = await planOf(organizer);
    expect(runInitial).not.toHaveBeenCalled();
    expect(promptLoader.loadPrompts).toHaveBeenCalledWith([...PASSAGE_SEARCH_ORGANIZE_PROMPTS]);
    expect(prices.facts).toHaveBeenCalledWith(PASSAGE_MODEL);
    const system = `SYSTEM ${PASSAGE_SEARCH_ORGANIZE_PROMPTS.join(' + ')}`;
    const user = buildPassageSearchOrganizeMessage(RESULT, RESULT.instances, 3);
    const inputTokens = estimateRequestTokens([{ role: 'system', content: system }, { role: 'user', content: user }]);
    expect(plan).toMatchObject({ model: PASSAGE_MODEL, systemMessage: system, userMessage: user, shown: [1, 2, 3], instances: { read: 3, of: 3 } });
    expect(plan.estimate).toEqual({
      model: PASSAGE_MODEL,
      calls: 1,
      inputTokens,
      outputTokens: organize.typicalOutputTokens,
      usd: inputTokens * PRICING.promptUsdPerToken + organize.typicalOutputTokens * PRICING.completionUsdPerToken
    });
    expect(plan.planKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives one key to one request at one price, and another when the price moves, appears or goes away', async () => {
    const key = async (facts?: PassageSearchModelFacts | Error, result: PassageSearchResult = RESULT): Promise<string> =>
      (await planOf(createHost([], { facts }).organizer, result)).planKey;
    const base = await key();
    expect(await key()).toBe(base);
    expect(await key({ pricing: { ...PRICING, promptUsdPerToken: 0.000002 } })).not.toBe(base);
    expect(await key({ pricing: { ...PRICING, completionUsdPerToken: 0.000005 } })).not.toBe(base);
    const unpriced = await key({});
    expect(unpriced).not.toBe(base);
    // A catalog that cannot be read is no price, and still a plan.
    expect(await key(new Error('offline: /secret/path'))).toBe(unpriced);
    const offline = await planOf(createHost([], { facts: new Error('offline') }).organizer);
    expect(offline.estimate).not.toHaveProperty('usd');
    expect(offline.estimate.calls).toBe(1);
  });

  it('gives another key when the model or anything rendered differs', async () => {
    const key = async (result: PassageSearchResult): Promise<string> => (await planOf(createHost().organizer, result)).planKey;
    const base = await key(RESULT);
    expect(await key({ ...RESULT, model: 'placeholder/other-model' })).not.toBe(base);
    expect(await key({ ...RESULT, question: 'Find every watch.' })).not.toBe(base);
    expect(await key({ ...RESULT, instances: RESULT.instances.slice(0, 2) })).not.toBe(base);
    expect(await key({ ...RESULT, instances: RESULT.instances.map((instance) => ({ ...instance, note: 'Another note.' })) })).not.toBe(base);
    // What is not rendered does not move it: how the reads ended is not part of the request.
    expect(await key({ ...RESULT, ended: 'key-changed' })).toBe(base);
  });

  it('says how many instances it would read of how many, sampled within half a small window', async () => {
    const result = resultOf(many(600));
    const { organizer } = createHost([], { facts: { pricing: PRICING, contextLength: 20_000 } });
    const plan = await planOf(organizer, result);
    expect(plan.instances.of).toBe(600);
    expect(plan.instances.read).toBeGreaterThan(20);
    expect(plan.instances.read).toBeLessThan(600);
    expect(plan.estimate.inputTokens + organize.outputTokens).toBeLessThanOrEqual(10_000);
    expect(plan.shown[plan.shown.length - 1]).toBeGreaterThan(580);
    // With no window known the bound is organize.inputTokens alone.
    const unbounded = await planOf(createHost([], { facts: {} }).organizer, resultOf(many(2_000)));
    expect(unbounded.estimate.inputTokens).toBeLessThanOrEqual(organize.inputTokens);
    expect(unbounded.instances.read).toBeLessThan(2_000);
    expect(unbounded.estimate.inputTokens).toBeGreaterThan(organize.inputTokens * 0.9);
  });

  it('is unavailable, in host words, over no instances or when not one fits', async () => {
    const { organizer, runInitial } = createHost([], { facts: { contextLength: 2 * organize.outputTokens + 40 } });
    await expect(organizer.plan(resultOf([]))).resolves.toEqual({ kind: 'unavailable', message: 'There is nothing to organize: the search found no instances.' });
    const none = await organizer.plan(RESULT);
    expect(none).toEqual({ kind: 'unavailable', message: 'These results cannot be organized: not one instance fits what the model can read in one call.' });
    expect(runInitial).not.toHaveBeenCalled();
  });
});

describe('PassageSearchModelOrganizer.organize', () => {
  it('makes one capability-free call with the plan\'s own messages, on the plan\'s model, at temperature 0', async () => {
    const { organizer, runInitial, promptLoader, prices } = createHost([ok()]);
    const plan = await planOf(organizer);
    promptLoader.loadPrompts.mockClear();
    prices.facts.mockClear();
    const organized = await organizer.organize(RESULT, { plan });
    expect(runInitial).toHaveBeenCalledTimes(1);
    expect(runInitial.mock.calls[0][0]).toEqual({
      toolName: 'passage-search-organize',
      systemMessage: plan.systemMessage,
      userMessage: plan.userMessage,
      policy: AGENT_RUN_POLICIES.passageSearch,
      options: { model: PASSAGE_MODEL, temperature: 0, maxTokens: organize.outputTokens }
    });
    // Exactly the plan: nothing is rendered, loaded or priced again.
    expect(promptLoader.loadPrompts).not.toHaveBeenCalled();
    expect(prices.facts).not.toHaveBeenCalled();
    expect(organized).toMatchObject({ kind: 'analysis', usage: USAGE });
    expect(organized?.kind === 'analysis' && organized.analysis).toEqual({
      headline: 'The Rabbit frets aloud once and reaches for its watch twice.',
      sections: [
        { title: 'Aloud', claims: [{ text: 'It cries "I shall be late!" to itself.', cites: [1] }] },
        { title: 'The watch', claims: [{ text: 'It "took a watch out of its waistcoat-pocket", then "glanced at its watch again".', cites: [2, 3] }] }
      ],
      read: { instances: 3, of: 3 },
      dropped: { claims: 0, uncited: 0, misquoted: 0, malformed: 0, sections: 0, cites: 0 },
      replaced: { headline: false, titles: 0 },
      clipped: 0
    });
  });

  it('with no plan renders its own request, fitted to the model\'s window, and passes the caller\'s signal', async () => {
    const result = resultOf(many(600));
    const everyNumber = result.instances.map((instance) => instance.number);
    const { organizer, runInitial } = createHost([ok(JSON.stringify({ headline: 'x', sections: [{ title: 'T', claims: [{ text: 'It hurries.', cites: everyNumber }] }] }))], { facts: { contextLength: 20_000 } });
    const stop = new AbortController();
    const organized = await organizer.organize(result, { signal: stop.signal });
    const sent = runInitial.mock.calls[0][0];
    expect(sent.options).toMatchObject({ model: PASSAGE_MODEL, signal: stop.signal });
    expect(estimateRequestTokens([{ role: 'system', content: sent.systemMessage }, { role: 'user', content: sent.userMessage }]) + organize.outputTokens).toBeLessThanOrEqual(10_000);
    if (organized?.kind !== 'analysis') {
      throw new Error('expected an analysis');
    }
    // "The analysis read N of 600 instances": cites of instances outside the sample are not kept.
    expect(organized.analysis.read.of).toBe(600);
    expect(organized.analysis.read.instances).toBeLessThan(600);
    expect(sent.userMessage).toContain(`Below are ${organized.analysis.read.instances} of the 600 instances found`);
    for (const cite of organized.analysis.sections[0].claims[0].cites) {
      expect(sent.userMessage).toContain(`\n[${cite}] `);
    }
    expect(organized.analysis.sections[0].claims[0].cites).toHaveLength(organized.analysis.read.instances);
    expect(organized.analysis.dropped.cites).toBe(600 - organized.analysis.read.instances);
  });

  it('does not run when not one instance fits, and says so', async () => {
    const { organizer, runInitial } = createHost([ok()], { facts: { contextLength: 2 * organize.outputTokens + 40 } });
    await expect(organizer.organize(RESULT, {})).resolves.toEqual({ kind: 'missing', reason: 'no-room' });
    await expect(organizer.organize(resultOf([]), {})).resolves.toBeUndefined();
    expect(runInitial).not.toHaveBeenCalled();
  });

  it('never starts after Stop, reading the signal again immediately before dispatch', async () => {
    const stop = new AbortController();
    const { organizer, runInitial, manager } = createHost([ok()]);
    const plan = await planOf(organizer);
    // The stop lands in the last thing awaited before the call.
    manager.ensureInitialized.mockImplementationOnce(async () => {
      stop.abort();
    });
    await expect(organizer.organize(RESULT, { plan, signal: stop.signal })).resolves.toEqual({ kind: 'missing', reason: 'stopped' });
    expect(runInitial).not.toHaveBeenCalled();
  });

  it('reports a pass stopped in flight as stopped, with what it spent', async () => {
    const stop = new AbortController();
    const cancelled = createHost([{ content: '', cancelled: true }]);
    await expect(cancelled.organizer.organize(RESULT, { signal: stop.signal })).resolves.toEqual({ kind: 'missing', reason: 'stopped', usage: USAGE });
    const thrown = createHost([() => {
      stop.abort();
      throw new Error('aborted');
    }]);
    await expect(thrown.organizer.organize(RESULT, { signal: stop.signal })).resolves.toEqual({ kind: 'missing', reason: 'stopped' });
  });

  it('never starts with no engine, and reads a retired engine\'s refusal as a key change', async () => {
    const none = createHost([ok()], { engine: false });
    await expect(none.organizer.organize(RESULT, {})).resolves.toEqual({ kind: 'missing', reason: 'key-changed' });
    expect(none.runInitial).not.toHaveBeenCalled();
    const retired = createHost([new AgentRunUnavailableError('missing-credentials')]);
    await expect(retired.organizer.organize(RESULT, {})).resolves.toEqual({ kind: 'missing', reason: 'key-changed' });
  });

  it('gives a closed reason for a failed, cut-off or malformed pass, and for one whose every claim the checks dropped', async () => {
    const reason = async (reply: Reply): Promise<unknown> => createHost([reply]).organizer.organize(RESULT, {});
    await expect(reason(new Error('502 from the provider: “Oh dear!”'))).resolves.toEqual({ kind: 'missing', reason: 'failed' });
    await expect(reason({ content: ANALYSIS_REPLY.slice(0, 80), finishReason: 'length' })).resolves.toEqual({ kind: 'missing', reason: 'cut', usage: USAGE });
    // Even a reply that happens to parse is not kept once the provider cut it off.
    await expect(reason({ content: ANALYSIS_REPLY, finishReason: 'length' })).resolves.toEqual({ kind: 'missing', reason: 'cut', usage: USAGE });
    await expect(reason(ok('The Rabbit is late, mostly.'))).resolves.toEqual({ kind: 'missing', reason: 'malformed', usage: USAGE });
    await expect(reason(ok('{"headline":"x"}'))).resolves.toEqual({ kind: 'missing', reason: 'malformed', usage: USAGE });
    await expect(reason(ok(JSON.stringify({ headline: 'x', sections: [{ title: 'T', claims: [{ text: 'It cries "I am terribly late!"', cites: [1] }, { text: 'Uncited.', cites: [77] }] }] }))))
      .resolves.toEqual({ kind: 'missing', reason: 'nothing-kept', usage: USAGE });
  });

  it('refuses a plan that is not this result\'s, sending nothing', async () => {
    const { organizer, runInitial } = createHost([ok(), ok(), ok()]);
    const plan = await planOf(organizer);
    const edited = { ...RESULT, instances: RESULT.instances.map((instance) => ({ ...instance, note: 'Another note.' })) };
    await expect(organizer.organize(edited, { plan })).resolves.toEqual({ kind: 'missing', reason: 'failed' });
    await expect(organizer.organize({ ...RESULT, model: 'placeholder/other-model' }, { plan })).resolves.toEqual({ kind: 'missing', reason: 'failed' });
    await expect(organizer.organize({ ...RESULT, instances: RESULT.instances.slice(0, 2) }, { plan })).resolves.toEqual({ kind: 'missing', reason: 'failed' });
    expect(runInitial).not.toHaveBeenCalled();
  });
});

describe('The organizing pass\'s logs (D22)', () => {
  const SECRETS = [
    'UNIQUEQUESTION', 'UNIQUEQUOTE', 'UNIQUENOTE', 'UNIQUELABEL', 'UNIQUEPATH', 'UNIQUEHEADLINE', 'UNIQUETITLE', 'UNIQUECLAIM', 'UNIQUEERROR', 'uniquefield'
  ];
  const result = resultOf([
    instanceOf(1, { quote: 'the UNIQUEQUOTE looked at its watch', note: 'UNIQUENOTE', label: 'UNIQUELABEL', displayPath: 'chapters/UNIQUEPATH.md' }),
    instanceOf(2, { quote: 'the UNIQUEQUOTE hurried on', note: 'UNIQUENOTE', label: 'UNIQUELABEL', displayPath: 'chapters/UNIQUEPATH.md' })
  ], { question: 'UNIQUEQUESTION?' });
  const reply = JSON.stringify({
    headline: 'UNIQUEHEADLINE "invented words"',
    uniquefield: true,
    sections: [
      { title: 'UNIQUETITLE "invented words"', claims: [{ text: 'UNIQUECLAIM "the UNIQUEQUOTE hurried on".', cites: [2] }, { text: 'UNIQUECLAIM "never written".', cites: [1] }, { text: 'UNIQUECLAIM uncited.', cites: [9] }] },
      { title: 'UNIQUETITLE', claims: [{ text: '' }] }
    ]
  });

  it('carry counts and fault kinds only: never the question, a quote, a note, a label, a path, a headline, a title or a claim', async () => {
    const hosts = [
      createHost([ok(reply)]),
      createHost([new Error('UNIQUEERROR: the UNIQUEQUOTE looked at its watch')]),
      createHost([ok('UNIQUECLAIM is not JSON')]),
      createHost([{ content: reply, finishReason: 'length' }]),
      createHost([ok(reply)], { facts: new Error('UNIQUEERROR at chapters/UNIQUEPATH.md') })
    ];
    for (const host of hosts) {
      const priced = await host.organizer.plan(result);
      await host.service.organize(result, priced.kind === 'planned' ? priced.plan : (undefined as never));
      await host.organizer.organize(result, {}).catch(() => undefined);
      const lines = host.logged();
      expect(lines.length).toBeGreaterThan(0);
      for (const secret of SECRETS) {
        expect([secret, lines.includes(secret)]).toEqual([secret, false]);
      }
      expect(lines).not.toContain('invented words');
      expect(lines).not.toContain('hurried on');
    }
    const lines = hosts[0].logged();
    expect(lines).toContain('Organize plan: 2 of 2 instance(s), 1 label(s)');
    expect(lines).toContain('Organizing pass checked: read 2 of 2 instance(s), kept 1 section(s) and 1 claim(s), dropped 3 claim(s) (uncited 1, misquoted 1, malformed 1), 1 section(s) and 1 cite(s), host headline yes, 1 host title(s), 0 clipped, 1 ignored field(s), repairs none');
    expect(hosts[1].logged()).toContain('left no analysis (failed; Error)');
    expect(hosts[2].logged()).toContain('left no analysis (malformed; unparseable)');
    expect(hosts[3].logged()).toContain('left no analysis (cut; cut)');
  });
});
