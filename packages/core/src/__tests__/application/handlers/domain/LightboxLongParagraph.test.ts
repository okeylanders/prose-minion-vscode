/**
 * A long paragraph the board accepts is read through, and every started run
 * finishes (PR #149 F-10).
 *
 * The real LightboxReadingHandler, LightboxService (over the real
 * measurement services), LightboxReadingRunner, quote verifier and term
 * counter. CJK text has no code point below U+0300, so one paragraph of it is
 * one normalization run: the board counts it as a few words, the estimate
 * says it fits, and the verifier must still build over it. A failure
 * injected into the verifier's setup shows a run finishing all the same.
 * The text is synthetic; only the provider is played, with the prompt
 * bundle's worked examples. No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { MessageType } from '@/shared/types/messages';
import * as quoteVerifier from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxReadingHost, settle } from './lightboxReadingHarness';

const SENTENCE = '彼女は静かな部屋で時計の音を聞いた。';
/** 162,014 characters: one long run, flushed at the end of the paragraph. */
const ENDS_IN_ONE_RUN = `Alice waited. ${SENTENCE.repeat(9_000)}`;
/** 150,014 characters: one long run, flushed at the ASCII space after it. */
const RUN_THEN_ASCII = `${'漢'.repeat(150_000)} Alice waited.`;
// The unspaced Latin control of the same length is checked by the verifier's and the runner's tests: building its
// board takes minutes in the part-of-speech tokenizer (tech debt 2026-10-19-pos-tagger-long-token-backtracking).

const SETUP_FAILED = 'The chapter could not be prepared for checking quotes, so nothing was sent.';

describe('a long paragraph the board accepts is read through (PR #149 F-10)', () => {
  const unhandled = jest.fn();
  beforeEach(() => {
    unhandled.mockReset();
    process.on('unhandledRejection', unhandled);
  });
  afterEach(() => {
    process.off('unhandledRejection', unhandled);
    jest.restoreAllMocks();
  });

  async function readThrough(text: string) {
    const host = await createLightboxReadingHost({ text });
    const tab = host.openTab();
    await tab.setLenses([]);
    const estimate = tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).at(-1)?.payload.estimate;
    await tab.run();
    await settle();
    const phases = tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).map((message) => message.payload.phase);
    return { host, tab, estimate, phases };
  }

  it.each([
    ['ends in one long run (flushed at the end of the paragraph)', ENDS_IN_ONE_RUN],
    ['holds one long run before ASCII text (flushed at the next ASCII character)', RUN_THEN_ASCII]
  ])('reads a paragraph that %s, and finishes', async (_case, text) => {
    const { host, tab, estimate, phases } = await readThrough(text);

    expect(host.board.paragraphs).toHaveLength(1);
    expect(estimate?.fit).toBe('fits');
    expect(host.runInitial).toHaveBeenCalledTimes(3);
    expect(phases[0]).toBe('started');
    expect(phases.at(-1)).toBe('finished');
    expect(host.service.currentBoard()?.readings.map((group) => group.status)).toEqual(['ok', 'ok', 'ok']);
    expect(host.runner.activeRun(host.board.boardId)).toBeUndefined();
    expect(tab.logged()).toMatch(/Group A read \(.+\): \d+ tiles, .* \d+ quotes checked/);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('finishes a run whose setup throws: every group failed, the run released, nothing sent', async () => {
    const host = await createLightboxReadingHost();
    const tab = host.openTab();
    // The setup failure's own text never leaves the host's categories.
    jest.spyOn(quoteVerifier, 'createLightboxQuoteVerifier').mockImplementationOnce(() => {
      throw new RangeError('PRIVATE: Alice was beginning to get very tired');
    });

    await tab.run();
    await settle();

    expect(host.runInitial).not.toHaveBeenCalled();
    const progress = tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).map((message) => message.payload);
    expect(progress.map((payload) => payload.phase)).toEqual(['started', 'streaming', 'streaming', 'streaming', 'finished']);
    expect(progress.at(-1)).toMatchObject({ token: 'run-1-token', groupsBack: 3 });
    expect(host.service.currentBoard()?.readings.map((group) => [group.status, group.error])).toEqual([
      ['failed', SETUP_FAILED],
      ['failed', SETUP_FAILED],
      ['failed', SETUP_FAILED]
    ]);
    expect(host.runner.activeRun(host.board.boardId)).toBeUndefined();
    expect(tab.logged()).toContain('Run run-1-token could not be set up: setup-failed (RangeError)');
    expect(tab.logged()).not.toContain('PRIVATE');
    expect(unhandled).not.toHaveBeenCalled();

    // Released: the next press reads the board.
    await tab.run();
    await settle();
    expect(host.runInitial).toHaveBeenCalledTimes(3);
    expect(host.service.currentBoard()?.readings.map((group) => group.status)).toEqual(['ok', 'ok', 'ok']);
  });
});
