/**
 * Every started run finishes (PR #149 F-10): `done` never rejects, every
 * group settles, the run is released, and the listener hears it finish.
 *
 * The real LightboxReadingRunner, quote verifier and term counter; only the
 * engine is played, with the prompt bundle's worked examples (Lewis
 * Carroll's "Alice's Adventures in Wonderland", 1865, public domain). The
 * long paragraphs are synthetic. Failures are injected into the verifier
 * and the listener. No provider is called.
 */
// p-limit ships as ESM; as in the other runner tests, run every call at once.
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import type { LightboxReadingGroupId } from '@messages';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import * as quoteVerifier from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { LightboxReadingRunner } from '@/infrastructure/lightbox/LightboxReadingRunner';
import type {
  LightboxGroupOutcome,
  LightboxRunListener,
  LightboxRunSource,
  LightboxRunSummary
} from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import { lightboxGroupLenses } from '@shared/constants/lightbox';
import { readWorkedExample } from './lightboxReadingFixtures';

const examples = Object.fromEntries(
  (['A', 'B', 'C'] as const).map((group) => [group, readWorkedExample(group)])
) as Record<LightboxReadingGroupId, ReturnType<typeof readWorkedExample>>;

const SENTENCE = '彼女は静かな部屋で時計の音を聞いた。';
/** One long run, flushed at the end of the paragraph. */
const ENDS_IN_ONE_RUN = `Alice waited. ${SENTENCE.repeat(9_000)}`;
/** One long run, flushed at the ASCII space after it. */
const RUN_THEN_ASCII = `${'漢'.repeat(150_000)} Alice waited.`;
/** The control: unspaced Latin of the first one's length, cut into a run per letter. */
const UNSPACED_LATIN = 'Alicewaitedquietly'.repeat(10_000).slice(0, ENDS_IN_ONE_RUN.length);

const SETUP_FAILED = 'The chapter could not be prepared for checking quotes, so nothing was sent.';
const CHECK_FAILED = 'The reading came back but could not be checked against the chapter. Press Finish or Analyze to try again.';

const sourceOf = (paragraphs: readonly string[]): LightboxRunSource => ({
  boardId: 'board-1',
  material: { paragraphs: [...paragraphs], columns: paragraphs.map((_, index) => ({ from: index + 1, to: index + 1 })), context: [] },
  sourceWords: 3,
  contextWords: 0,
  averageWordsPerSentence: 12
});

const ok = (request: InitialRunRequest): ExecutionResult => ({
  content: 'visible',
  rawContent: examples[request.toolName.slice(-1).toUpperCase() as LightboxReadingGroupId].response,
  usedGuides: [],
  requestedResources: [],
  artifacts: [],
  finishReason: 'stop',
  modelId: 'provider/model-v1'
});

function setup(paragraphs: readonly string[], listen: Partial<LightboxRunListener> = {}) {
  const runInitial = jest.fn(async (request: InitialRunRequest) => ok(request));
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  let tokens = 0;
  const runner = new LightboxReadingRunner(
    { getEngine: () => ({ runInitial }), getResolvedModel: () => 'provider/model-v1' },
    { loadPrompts: async (files: string[]) => files.join('\n') },
    { capture: jest.fn(async () => undefined) },
    { present: jest.fn(async () => undefined) },
    log,
    {
      catalog: { contextLength: () => 200_000, pricing: () => undefined },
      mintToken: () => `token-${++tokens}-0000-0000`
    }
  );
  const source = sourceOf(paragraphs);
  const outcomes: LightboxGroupOutcome[] = [];
  const finished: LightboxRunSummary[] = [];
  const listener: LightboxRunListener = {
    onGroup: listen.onGroup ?? ((outcome) => outcomes.push(outcome)),
    onProgress: () => undefined,
    onFinished: (summary) => finished.push(summary)
  };
  const start = async () => {
    const calls = await runner.prepare(source, (['A', 'B', 'C'] as const).map((group) => ({ group, lenses: lightboxGroupLenses(group) })));
    const started = runner.start(source, calls, listener);
    if (!started.started) {
      throw new Error(`expected a run: ${started.message}`);
    }
    return started;
  };
  const logged = () => log.appendLine.mock.calls.map(([line]) => String(line)).join('\n');
  return { runner, runInitial, outcomes, finished, start, logged };
}

describe('every started run finishes (PR #149 F-10)', () => {
  const unhandled = jest.fn();
  beforeEach(() => {
    unhandled.mockReset();
    process.on('unhandledRejection', unhandled);
  });
  afterEach(() => {
    process.off('unhandledRejection', unhandled);
    jest.restoreAllMocks();
  });

  it.each([
    ['ends in one long run (flushed at the end of the paragraph)', ENDS_IN_ONE_RUN],
    ['holds one long run before ASCII text (flushed at the next ASCII character)', RUN_THEN_ASCII],
    ['is unspaced Latin of the same length (the control)', UNSPACED_LATIN]
  ])('reads a paragraph that %s: every group back, the run released', async (_case, text) => {
    const { runner, runInitial, outcomes, finished, start } = setup([text]);
    const started = await start();

    await expect(started.done).resolves.toBeUndefined();
    expect(runInitial).toHaveBeenCalledTimes(3);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['ok', 'ok', 'ok']);
    expect(finished).toHaveLength(1);
    expect(runner.activeRun('board-1')).toBeUndefined();
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('fails every group, sends nothing and finishes when the run cannot be set up', async () => {
    const { runner, runInitial, outcomes, finished, start, logged } = setup(examples.A.paragraphs);
    jest.spyOn(quoteVerifier, 'createLightboxQuoteVerifier').mockImplementationOnce(() => {
      throw new RangeError('PRIVATE: Alice was beginning to get very tired');
    });
    const started = await start();

    await expect(started.done).resolves.toBeUndefined();
    expect(runInitial).not.toHaveBeenCalled();
    expect(outcomes.map((outcome) => [outcome.group, outcome.status, outcome.error])).toEqual([
      ['A', 'failed', SETUP_FAILED],
      ['B', 'failed', SETUP_FAILED],
      ['C', 'failed', SETUP_FAILED]
    ]);
    expect(finished).toHaveLength(1);
    expect(finished[0].outcomes.map((outcome) => outcome.status)).toEqual(['failed', 'failed', 'failed']);
    expect(runner.activeRun('board-1')).toBeUndefined();
    expect(logged()).toContain('Run token-1-0000-0000 could not be set up: setup-failed (RangeError)');
    expect(logged()).toContain('Run token-1-0000-0000 finished: A failed, B failed, C failed');
    expect(logged()).not.toContain('PRIVATE');
    expect(unhandled).not.toHaveBeenCalled();

    // Released: the board's next run starts and reads.
    const next = await start();
    await next.done;
    expect(runInitial).toHaveBeenCalledTimes(3);
  });

  it('fails only the group whose reply could not be checked, and finishes', async () => {
    const real = quoteVerifier.createLightboxQuoteVerifier;
    jest.spyOn(quoteVerifier, 'createLightboxQuoteVerifier').mockImplementationOnce((paragraphs) => {
      const verifier = real(paragraphs);
      let checks = 0;
      return {
        ...verifier,
        verify: (paragraph, quote) => {
          if (++checks === 1) {
            throw new TypeError('PRIVATE: down, down, down');
          }
          return verifier.verify(paragraph, quote);
        }
      };
    });
    const { runner, outcomes, finished, start, logged } = setup(examples.A.paragraphs);
    const started = await start();

    await expect(started.done).resolves.toBeUndefined();
    expect(outcomes.filter((outcome) => outcome.status === 'failed').map((outcome) => outcome.error)).toEqual([CHECK_FAILED]);
    expect(outcomes.filter((outcome) => outcome.status === 'ok')).toHaveLength(2);
    expect(finished).toHaveLength(1);
    expect(runner.activeRun('board-1')).toBeUndefined();
    expect(logged()).toMatch(/Group [ABC] could not be checked: check-failed \(TypeError\)/);
    expect(logged()).not.toContain('PRIVATE');
  });

  it('finishes when its listener throws', async () => {
    const heard: LightboxGroupOutcome[] = [];
    const { runner, finished, start, logged } = setup(examples.A.paragraphs, {
      onGroup: (outcome) => {
        heard.push(outcome);
        if (heard.length === 1) {
          throw new Error('PRIVATE: the listener broke');
        }
      }
    });
    const started = await start();

    await expect(started.done).resolves.toBeUndefined();
    expect(heard).toHaveLength(3);
    expect(finished).toHaveLength(1);
    expect(finished[0].outcomes).toHaveLength(3);
    expect(runner.activeRun('board-1')).toBeUndefined();
    expect(logged()).toContain('Run token-1-0000-0000 listener failed: unexpected (Error)');
    expect(logged()).not.toContain('PRIVATE');
  });
});
