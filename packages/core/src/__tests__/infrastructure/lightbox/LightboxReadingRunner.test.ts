/**
 * LightboxReadingRunner (ADR 2026-10-19 D6, D7): the groups fan out on the
 * assistant engine, fail alone, stop on request keeping what landed, drop
 * stale results, fail a `length` finish, quarantine unusable paid bodies,
 * and sum usage. Every engine here is a mock: no provider is called.
 */
// p-limit ships as ESM; as in the Dictionary's tests, run every call at once.
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import type { LightboxReadingGroupId, TokenUsage } from '@messages';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import { OpenRouterApiError } from '@providers/OpenRouterClient';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import type {
  LightboxGroupOutcome,
  LightboxRunListener,
  LightboxRunSource,
  LightboxRunSummary
} from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import { lightboxGroupLenses } from '@shared/constants/lightbox';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';

const examples = Object.fromEntries(
  (['A', 'B', 'C'] as const).map((group) => [group, readWorkedExample(group)])
) as Record<LightboxReadingGroupId, ReturnType<typeof readWorkedExample>>;
const paragraphs = examples.A.paragraphs;

const source: LightboxRunSource = {
  boardId: 'board-1',
  material: { paragraphs, columns: paragraphs.map((_, index) => ({ from: index + 1, to: index + 1 })), context: [] },
  sourceWords: 508,
  contextWords: 0,
  averageWordsPerSentence: 21.4
};

const usage = (cost: number): TokenUsage => ({
  promptTokens: 1_000,
  completionTokens: 200,
  totalTokens: 1_200,
  costUsd: cost,
  cachedTokens: 0
});

const ok = (group: LightboxReadingGroupId, extra: Partial<ExecutionResult> = {}): ExecutionResult => ({
  content: 'visible',
  rawContent: examples[group].response,
  usedGuides: [],
  requestedResources: [],
  artifacts: [],
  usage: usage(0.01),
  finishReason: 'stop',
  modelId: 'provider/model-v1',
  ...extra
});

const groupOf = (request: InitialRunRequest): LightboxReadingGroupId =>
  request.toolName.slice(-1).toUpperCase() as LightboxReadingGroupId;

/** A promise the test settles, which also settles as cancelled when its signal aborts. */
function deferredCall(request: InitialRunRequest) {
  let resolve!: (result: ExecutionResult) => void;
  const promise = new Promise<ExecutionResult>((done) => {
    resolve = done;
    request.options?.signal?.addEventListener('abort', () => done({ ...ok('A'), cancelled: true, content: '' }));
  });
  return { promise, resolve };
}

function setup(respond: (request: InitialRunRequest) => Promise<ExecutionResult> | ExecutionResult, options: {
  engine?: boolean;
} = {}) {
  const runInitial = jest.fn(async (request: InitialRunRequest) => respond(request));
  const getEngine = jest.fn(() => (options.engine === false ? undefined : { runInitial }));
  const capture = jest.fn(async () => ({
    filePath: '/workspace/prose-minion/recovery/model-responses/lightbox.response.txt',
    toolName: 'lightbox-readings' as const,
    storageScope: 'project' as const
  }));
  const present = jest.fn(async () => undefined);
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  let tokens = 0;
  const runner = new LightboxReadingRunner(
    { getEngine, getResolvedModel: () => 'provider/model-v1' },
    { loadPrompts: async (files: string[]) => files.join('\n') },
    { capture },
    { present },
    log,
    {
      catalog: { contextLength: () => 200_000, pricing: () => ({ promptUsdPerToken: 0.000003, completionUsdPerToken: 0.000015 }) },
      mintToken: () => `token-${++tokens}-0000-0000`
    }
  );
  const outcomes: LightboxGroupOutcome[] = [];
  const finished: LightboxRunSummary[] = [];
  const progress: number[] = [];
  const listener: LightboxRunListener = {
    onGroup: (outcome) => outcomes.push(outcome),
    onProgress: (characters) => progress.push(characters),
    onFinished: (summary) => finished.push(summary)
  };
  const start = async (groups: LightboxReadingGroupId[] = ['A', 'B', 'C']) => {
    const calls = await runner.prepare(source, groups.map((group) => ({ group, lenses: lightboxGroupLenses(group) })));
    return runner.start(source, calls, listener);
  };
  const logged = () => log.appendLine.mock.calls.map(([line]) => String(line)).join('\n');
  return { runner, runInitial, getEngine, capture, present, outcomes, finished, progress, start, logged };
}

function listenerOf(outcomes: LightboxGroupOutcome[]): LightboxRunListener {
  return { onGroup: (outcome) => outcomes.push(outcome), onProgress: () => undefined, onFinished: () => undefined };
}

describe('LightboxReadingRunner', () => {
  it('runs every group on the assistant engine, without resources, under the group output ceiling', async () => {
    const { start, runInitial, getEngine, outcomes, finished } = setup((request) => ok(groupOf(request)));
    const started = await start();
    expect(started.started).toBe(true);
    if (started.started) {
      await started.done;
    }
    expect(getEngine).toHaveBeenCalledWith('assistant');
    expect(runInitial).toHaveBeenCalledTimes(3);
    for (const [request] of runInitial.mock.calls) {
      expect(request.policy).toBe(AGENT_RUN_POLICIES.assistantWithoutResources);
      expect(request.options?.maxTokens).toBe(PROMPT_BUDGETS.lightbox.groupOutputTokens);
      expect(request.options?.timeoutMs).toBeGreaterThan(0);
      expect(request.userMessage.startsWith('# The chapter')).toBe(true);
    }
    expect(outcomes.map((outcome) => [outcome.group, outcome.status])).toEqual(
      expect.arrayContaining([['A', 'ok'], ['B', 'ok'], ['C', 'ok']])
    );
    expect(outcomes.find((outcome) => outcome.group === 'A')?.tiles[0].id).toBe('lbt-token-1--A-1');
    expect(finished).toHaveLength(1);
  });

  it('sums usage across groups, cost included', async () => {
    const { start, finished } = setup((request) => ok(groupOf(request)));
    const started = await start();
    if (started.started) {
      await started.done;
    }
    expect(finished[0].usage).toEqual({
      promptTokens: 3_000,
      completionTokens: 600,
      totalTokens: 3_600,
      costUsd: 0.03,
      requestCount: 3,
      cachedTokens: 0
    });
  });

  it('lets one group fail while the others land', async () => {
    const { start, outcomes, logged } = setup((request) => {
      if (groupOf(request) === 'B') {
        throw new AgentRunUnavailableError('rate-limited', 'provider detail', 30);
      }
      return ok(groupOf(request));
    });
    const started = await start();
    if (started.started) {
      await started.done;
    }
    const byGroup = Object.fromEntries(outcomes.map((outcome) => [outcome.group, outcome]));
    expect(byGroup.A.status).toBe('ok');
    expect(byGroup.C.status).toBe('ok');
    expect(byGroup.B).toMatchObject({
      status: 'failed',
      error: 'OpenRouter is rate limiting requests. Try again in about 30 seconds.',
      tiles: []
    });
    expect(logged()).toContain('Group B call failed: rate-limited');
    expect(logged()).not.toContain(paragraphs[3].slice(0, 30));
  });

  describe('keeps arbitrary diagnostics out of Output and the board (PR #149 F-05)', () => {
    const PRIVATE = 'Synthetic private note';
    /** A provider error that echoes the request: multiline, and far longer than any reason. */
    const echoed = `Provider rejected input: ${PRIVATE}\n${'chapter prose '.repeat(50)}`;

    it.each([
      ['an unclassified provider rejection', new OpenRouterApiError(echoed, 400, 'invalid_request'),
        'The provider refused the call (HTTP 400). Press Finish or Analyze to try again.', 'provider-rejected (HTTP 400)'],
      ['an unavailable provider, with its details', new AgentRunUnavailableError('provider-unavailable', echoed),
        'The model\'s provider is unavailable right now. Press Finish or Analyze to try again.', 'provider-unavailable'],
      ['a plain error', new Error(echoed),
        'The call failed before a reading came back. Press Finish or Analyze to try again.', 'unexpected (Error)'],
      ['a thrown string', echoed,
        'The call failed before a reading came back. Press Finish or Analyze to try again.', 'unexpected']
    ])('%s: a host category, never the provider text', async (_label, thrown, error, category) => {
      const { start, outcomes, logged } = setup((request) => {
        if (groupOf(request) === 'A') {
          throw thrown;
        }
        return ok(groupOf(request));
      });
      const started = await start();
      if (started.started) {
        await started.done;
      }
      expect(outcomes.find((outcome) => outcome.group === 'A')).toMatchObject({ status: 'failed', error });
      expect(logged()).toContain(`Group A call failed: ${category}`);
      for (const surface of [logged(), JSON.stringify(outcomes)]) {
        expect(surface).not.toContain(PRIVATE);
        expect(surface).not.toContain('chapter prose');
      }
    });

    it('reads a reply with prose in its root keys, counting the keys in Output and naming them nowhere (Slice 4K)', async () => {
      const body = framedJson(examples.A.response);
      const raw = frame('A', { ...body, [`${PRIVATE}: she never told the Queen`]: 1 });
      const { start, outcomes, logged, capture } = setup((request) => ok(groupOf(request), groupOf(request) === 'A' ? { rawContent: raw } : {}));
      const started = await start();
      if (started.started) {
        await started.done;
      }
      // A field the format does not define withholds nothing (decision 50): the group lands whole, and nothing is quarantined.
      const a = outcomes.find((outcome) => outcome.group === 'A');
      expect(a).toMatchObject({ status: 'ok', withheldBlocks: [] });
      expect(a?.tiles.length).toBeGreaterThan(0);
      expect(logged()).toContain('[LightboxReadingRunner] Group A ignored 1 field the format does not define');
      expect(capture).not.toHaveBeenCalled();
      for (const surface of [logged(), JSON.stringify(outcomes)]) {
        expect(surface).not.toContain(PRIVATE);
      }
    });
  });

  it('keeps what a reply cut off at the output ceiling finished, withholds the block it was cut inside, and saves the paid body (Slice 4H)', async () => {
    // Example C cut inside its lineage block: the genre block finished, the spark block was never reached.
    const whole = examples.C.response;
    const cut = whole.slice(0, whole.indexOf('"lineage"') + 200);
    const { start, outcomes, capture, present, logged } = setup((request) =>
      groupOf(request) === 'C' ? ok('C', { finishReason: 'length', rawContent: cut }) : ok(groupOf(request))
    );
    const started = await start();
    if (started.started) {
      await started.done;
    }
    const c = outcomes.find((outcome) => outcome.group === 'C');
    expect(c?.status).toBe('ok');
    expect(c?.tiles.filter((tile) => tile.lens === 'genre').length).toBeGreaterThan(0);
    expect(c?.tiles.some((tile) => tile.lens === 'lineage' || tile.lens === 'spark')).toBe(false);
    expect(c?.withheldBlocks).toEqual([
      {
        kind: 'lineage',
        lens: 'lineage',
        reason: 'The reply reached the output ceiling before this block finished. ' +
          'Complete response saved for recovery at /workspace/prose-minion/recovery/model-responses/lightbox.response.txt.'
      },
      // Slice 4J (decision 52): a block it never reached says so, with the same place, so the board says the cut once.
      {
        kind: 'spark',
        lens: 'spark',
        reason: 'The reply reached the output ceiling before this block began. ' +
          'Complete response saved for recovery at /workspace/prose-minion/recovery/model-responses/lightbox.response.txt.'
      }
    ]);
    // Still saved, with the group's own contract; no warning, since the reply was read.
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'lightbox-readings',
      rawResponse: cut,
      finishReason: 'length',
      contract: expect.objectContaining({ protocol: expect.stringContaining('(genre, lineage, spark)') })
    }));
    expect(present).not.toHaveBeenCalled();
    expect(logged()).toContain('[LightboxReadingRunner] Group C reached the output ceiling: 1 blocks finished, cut inside lineage');
    expect(logged()).toContain('[LightboxReadingRunner] Group C repaired: missing-closing-sentinel');
    expect(logged()).toContain('[LightboxReadingRunner] Group C repaired: missing-closing-bracket');
    expect(logged()).not.toContain(cut.slice(-60));
  });

  it('fails a reply cut off at the output ceiling that cannot be salvaged, and quarantines the paid body', async () => {
    const { start, outcomes, capture, present } = setup((request) =>
      groupOf(request) === 'C' ? ok('C', { finishReason: 'length', rawContent: '===LIGHTBOX_GROUP_C_V1===\nHere is what the chapter' }) : ok(groupOf(request))
    );
    const started = await start();
    if (started.started) {
      await started.done;
    }
    const c = outcomes.find((outcome) => outcome.group === 'C');
    expect(c?.status).toBe('failed');
    expect(c?.error).toContain('12,000-token output ceiling, and what came back could not be read');
    expect(c?.error).toContain('Complete response saved for recovery at /workspace/prose-minion/recovery/');
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'lightbox-readings',
      finishReason: 'length',
      rejection: expect.stringContaining('A salvage was refused: text that is not JSON at character 0.')
    }));
    expect(present).toHaveBeenCalledTimes(1);
  });

  it('quarantines an undecodable body and fails only its group', async () => {
    const { start, outcomes, capture } = setup((request) =>
      groupOf(request) === 'A' ? ok('A', { rawContent: 'Here are your readings! The chapter is lovely.' }) : ok(groupOf(request))
    );
    const started = await start();
    if (started.started) {
      await started.done;
    }
    expect(outcomes.find((outcome) => outcome.group === 'A')).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('must contain exactly one ===LIGHTBOX_GROUP_A_V1===')
    });
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'lightbox-readings',
      requestSummary: 'Lightbox group A: Headline, Theme & motif, Tension arc, Lexical gravity, Palette'
    }));
    expect(outcomes.filter((outcome) => outcome.status === 'ok')).toHaveLength(2);
  });

  it('reads rawContent, never the visible content', async () => {
    const { start, outcomes } = setup((request) => ok(groupOf(request), { content: 'cleaned for display' }));
    const started = await start(['B']);
    if (started.started) {
      await started.done;
    }
    expect(outcomes[0].status).toBe('ok');
  });

  it('fails a group whose call timed out (the engine reports it as cancelled)', async () => {
    const { start, outcomes } = setup((request) =>
      groupOf(request) === 'A' ? { ...ok('A'), cancelled: true, content: '' } : ok(groupOf(request))
    );
    const started = await start();
    if (started.started) {
      await started.done;
    }
    expect(outcomes.find((outcome) => outcome.group === 'A')).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('took longer than 5 minutes')
    });
  });

  it('stops mid-run: finished groups were delivered, later ones never are', async () => {
    const pending = new Map<LightboxReadingGroupId, ReturnType<typeof deferredCall>>();
    const { runner, start, outcomes, finished, capture } = setup((request) => {
      const call = deferredCall(request);
      pending.set(groupOf(request), call);
      return call.promise;
    });
    const started = await start();
    if (!started.started) {
      throw new Error('expected a run');
    }
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    pending.get('A')?.resolve(ok('A'));
    await new Promise((resolve) => setImmediate(resolve));
    expect(outcomes.map((outcome) => outcome.group)).toEqual(['A']);

    expect(runner.cancel('board-1', 'not-the-token')).toBe(false);
    expect(runner.cancel('board-1', started.run.token)).toBe(true);
    pending.get('B')?.resolve(ok('B'));
    await started.done;
    expect(outcomes.map((outcome) => outcome.group)).toEqual(['A']);
    expect(finished).toEqual([]);
    expect(capture).not.toHaveBeenCalled();
    expect(runner.activeRun('board-1')).toBeUndefined();
  });

  it('drops a stale result from a stopped run once a new run has started', async () => {
    const pending: Array<ReturnType<typeof deferredCall>> = [];
    let deferNext = true;
    const { runner, start, outcomes } = setup((request) => {
      if (!deferNext) {
        return ok(groupOf(request));
      }
      // The stopped run's call ignores the abort and answers late.
      let resolve!: (result: ExecutionResult) => void;
      const promise = new Promise<ExecutionResult>((done) => { resolve = done; });
      pending.push({ promise, resolve });
      return promise;
    });
    const first = await start(['A']);
    if (!first.started) {
      throw new Error('expected a run');
    }
    await new Promise((resolve) => setImmediate(resolve));
    runner.cancel('board-1', first.run.token);
    deferNext = false;
    const second = await start(['A']);
    if (!second.started) {
      throw new Error('expected a second run');
    }
    await second.done;
    pending[0].resolve(ok('A'));
    await first.done;
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].tiles[0].id).toContain(second.run.token.slice(0, 8));
  });

  it('refuses a second press while the board is being read, and a press with no API key', async () => {
    const pending: Array<ReturnType<typeof deferredCall>> = [];
    const { start, runner } = setup((request) => {
      const call = deferredCall(request);
      pending.push(call);
      return call.promise;
    });
    const first = await start(['A']);
    expect(first.started).toBe(true);
    expect(await start(['B'])).toEqual({ started: false, message: 'This board is already being read. Stop that run first.' });
    if (first.started) {
      runner.cancel('board-1', first.run.token);
      await first.done;
    }

    const keyless = setup(() => ok('A'), { engine: false });
    expect(await keyless.start(['A'])).toEqual({
      started: false,
      message: 'Add an OpenRouter API key in Settings to run AI analyses.'
    });
    expect(keyless.runInitial).not.toHaveBeenCalled();
  });

  describe('a reservation holds the board from the press (PR #149 F-02)', () => {
    const prepare = async (runner: LightboxReadingRunner) =>
      runner.prepare(source, (['A', 'B', 'C'] as const).map((group) => ({ group, lenses: lightboxGroupLenses(group) })));

    it('holds the board under a minted token, refuses a second press, and starts the reserved calls', async () => {
      const { runner, runInitial, outcomes } = setup((request) => ok(groupOf(request)));
      const held = runner.reserve('board-1', ['A', 'B', 'C']);
      if (!held.reserved) {
        throw new Error('expected a reservation');
      }
      expect(held.reservation.run).toEqual({ boardId: 'board-1', token: 'token-1-0000-0000', groups: ['A', 'B', 'C'] });
      expect(runner.holds(held.reservation)).toBe(true);
      expect(runner.activeRun('board-1')).toBeUndefined();
      expect(runner.reserve('board-1', ['A'])).toEqual({ reserved: false, message: 'This board is already being read. Stop that run first.' });

      const started = runner.startReserved(held.reservation, source, await prepare(runner), listenerOf(outcomes));
      expect(started).toMatchObject({ started: true, run: { token: 'token-1-0000-0000' } });
      expect(runner.activeRun('board-1')?.token).toBe('token-1-0000-0000');
      if (started.started) {
        await started.done;
      }
      expect(runInitial).toHaveBeenCalledTimes(3);
    });

    it.each([
      ['stopped', (runner: LightboxReadingRunner, token: string) => runner.cancel('board-1', token)],
      ['disposed', (runner: LightboxReadingRunner) => runner.dispose()]
    ])('never starts a reservation %s before its calls were prepared', async (_label, release) => {
      const { runner, runInitial, outcomes } = setup((request) => ok(groupOf(request)));
      const held = runner.reserve('board-1', ['A', 'B', 'C']);
      if (!held.reserved) {
        throw new Error('expected a reservation');
      }
      const calls = await prepare(runner);
      release(runner, held.reservation.run.token);
      expect(runner.holds(held.reservation)).toBe(false);
      expect(runner.startReserved(held.reservation, source, calls, listenerOf(outcomes)))
        .toEqual({ started: false, message: 'This press was stopped before it started.' });
      expect(runInitial).not.toHaveBeenCalled();
      expect(runner.reserve('board-1', ['A']).reserved).toBe(true);
    });

    it('starts only the calls a reservation was made for', async () => {
      const { runner, runInitial, outcomes } = setup((request) => ok(groupOf(request)));
      const held = runner.reserve('board-1', ['A']);
      if (!held.reserved) {
        throw new Error('expected a reservation');
      }
      expect(runner.startReserved(held.reservation, source, await prepare(runner), listenerOf(outcomes)))
        .toEqual({ started: false, message: 'The prepared calls are not the ones this press reserved.' });
      expect(runner.holds(held.reservation)).toBe(false);
      expect(runInitial).not.toHaveBeenCalled();
    });

    it('gives the board back when a reservation is released, and refuses one without an engine', async () => {
      const { runner } = setup(() => ok('A'));
      const held = runner.reserve('board-1', ['A']);
      if (!held.reserved) {
        throw new Error('expected a reservation');
      }
      runner.release(held.reservation);
      expect(runner.holds(held.reservation)).toBe(false);
      expect(runner.reserve('board-1', ['A']).reserved).toBe(true);
      expect(setup(() => ok('A'), { engine: false }).runner.reserve('board-1', ['A']))
        .toEqual({ reserved: false, message: 'Add an OpenRouter API key in Settings to run AI analyses.' });
    });
  });

  it('reports throttled streaming progress', async () => {
    const { start, progress } = setup((request) => {
      for (let index = 0; index < 6; index++) {
        request.options?.onToken?.('x'.repeat(400));
      }
      return ok(groupOf(request));
    });
    const started = await start(['A']);
    if (started.started) {
      await started.done;
    }
    expect(progress).toEqual([1_200, 2_400]);
  });

  it('estimates the exact messages it would send, against the live window and prices', async () => {
    const { runner } = setup(() => ok('A'));
    const estimate = await runner.estimate(
      source,
      [{ group: 'A', lenses: ['headline', 'motif', 'tension'] }],
      [{ group: 'A', lenses: ['motif'] }],
      { facts: runner.modelFacts(), key: 'key-1' }
    );
    expect(estimate).toMatchObject({
      boardId: 'board-1', key: 'key-1', model: 'provider/model-v1', contextLength: 200_000, fit: 'fits'
    });
    expect(estimate.groups[0].inputTokens).toBeGreaterThan(0);
    expect(estimate.rereads[0].lenses).toEqual(['motif']);
    expect(estimate.costUsd).toBeGreaterThan(0);
  });
});
