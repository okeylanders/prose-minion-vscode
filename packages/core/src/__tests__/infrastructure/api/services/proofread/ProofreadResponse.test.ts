/**
 * Reading a Proofread reply (ADR 2026-10-21 D6): the frame's tolerances, the
 * shared repair parser, and the codec's rule (forgiving per chunk,
 * fail-closed per issue). Replies are about public-domain passages.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  PROOFREAD_CLOSING_SENTINEL,
  PROOFREAD_OPENING_SENTINEL,
  ProofreadFrameError,
  readProofreadFrame
} from '@services/proofread/ProofreadResponseFrame';
import { decodeProofreadReply } from '@services/proofread/ProofreadResponseCodec';
import {
  RUNS_ISSUE,
  THE_THE_ISSUE,
  WEATHER_ISSUE,
  frameOf,
  replyOf
} from '@/__tests__/infrastructure/api/services/proofread/proofreadReplyFixtures';

const read = (content: string) => decodeProofreadReply(readProofreadFrame(content).root);

describe('readProofreadFrame', () => {
  it('reads a well-formed frame with no repairs', () => {
    expect(readProofreadFrame(replyOf(WEATHER_ISSUE))).toEqual({
      root: { version: 1, issues: [WEATHER_ISSUE] },
      repairs: []
    });
  });

  it('sets aside a code fence around the whole frame', () => {
    const fenced = `\`\`\`json\n${replyOf(WEATHER_ISSUE)}\n\`\`\``;
    expect(readProofreadFrame(fenced).repairs).toEqual(['code-fence']);
  });

  it('accepts a missing closing sentinel when the JSON is complete', () => {
    const content = `${PROOFREAD_OPENING_SENTINEL}\n${JSON.stringify({ version: 1, issues: [] })}`;
    expect(readProofreadFrame(content)).toEqual({ root: { version: 1, issues: [] }, repairs: ['missing-closing-sentinel'] });
  });

  it('refuses a missing closing sentinel when the JSON is incomplete, adding no bracket', () => {
    const content = `${PROOFREAD_OPENING_SENTINEL}\n{"version":1,"issues":[`;
    expect(() => readProofreadFrame(content)).toThrow(`The response must end with ${PROOFREAD_CLOSING_SENTINEL}`);
  });

  it('repairs a trailing comma through the shared parser', () => {
    const content = frameOf('{"version":1,"issues":[],}');
    expect(readProofreadFrame(content).repairs).toEqual(['trailing-comma']);
  });

  it('refuses text before the opening sentinel, a repeated sentinel, or a sentinel out of place', () => {
    expect(() => readProofreadFrame(`Here you go:\n${replyOf()}`)).toThrow('must be the first line');
    expect(() => readProofreadFrame(`${replyOf()}\n${PROOFREAD_OPENING_SENTINEL}`)).toThrow('exactly one');
    expect(() => readProofreadFrame(`${replyOf()}\nThanks!`)).toThrow('must be the final line');
    expect(() => readProofreadFrame(`${replyOf()}\n${PROOFREAD_CLOSING_SENTINEL}`)).toThrow('at most one');
  });

  it('refuses an empty frame, a non-object root, and a runaway response', () => {
    expect(() => readProofreadFrame(`${PROOFREAD_OPENING_SENTINEL}\n${PROOFREAD_CLOSING_SENTINEL}`)).toThrow('JSON is empty');
    expect(() => readProofreadFrame(frameOf('[1, 2]'))).toThrow('must be an object');
    expect(() => readProofreadFrame('x'.repeat(PROMPT_BUDGETS.proofread.responseCharacters + 1))).toThrow('runs past');
  });

  it('never puts the reply text into its message', () => {
    const secret = 'unbirthday';
    try {
      readProofreadFrame(frameOf(`{"version":1,"issues":[{"category": ${secret}}]}`));
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(ProofreadFrameError);
      expect(`${(error as ProofreadFrameError).message} ${(error as ProofreadFrameError).diagnostic}`).not.toContain(secret);
    }
  });
});

describe('decodeProofreadReply', () => {
  it('decodes issues into chunk-relative findings', () => {
    expect(read(replyOf(WEATHER_ISSUE, RUNS_ISSUE))).toEqual({
      findings: [
        {
          anchor: { quote: 'weather', before: WEATHER_ISSUE.before, after: WEATHER_ISSUE.after },
          category: 'homophone',
          replacement: 'whether',
          explanation: WEATHER_ISSUE.explanation
        },
        {
          anchor: { quote: 'runs', before: RUNS_ISSUE.before, after: RUNS_ISSUE.after },
          category: 'tense',
          replacement: 'ran',
          explanation: RUNS_ISSUE.explanation
        }
      ],
      malformed: 0,
      ignoredFields: 0
    });
  });

  it('ignores and counts fields the format does not define, at the root and on issues', () => {
    const reply = read(frameOf({ version: 1, model: 'x', issues: [{ ...THE_THE_ISSUE, confidence: 0.9, severity: 'low' }] }));
    expect(reply.findings).toHaveLength(1);
    expect(reply.ignoredFields).toBe(3);
  });

  it('drops and counts a malformed issue without losing the others', () => {
    const reply = read(replyOf(
      WEATHER_ISSUE,
      { ...RUNS_ISSUE, category: 'style' },
      { ...RUNS_ISSUE, original: '' },
      { ...RUNS_ISSUE, explanation: '  ' },
      { ...RUNS_ISSUE, before: 42 },
      { ...RUNS_ISSUE, replacement: 7 },
      { ...RUNS_ISSUE, original: 'x'.repeat(PROMPT_BUDGETS.proofread.quoteCharacters + 1) },
      'not an issue',
      THE_THE_ISSUE
    ));
    expect(reply.findings.map((finding) => finding.anchor.quote)).toEqual(['weather', 'the the']);
    expect(reply.malformed).toBe(7);
  });

  it('omits empty context and a missing replacement, and clips long context nearest the quote', () => {
    const B = PROMPT_BUDGETS.proofread;
    const [finding] = read(replyOf({
      category: 'agreement',
      original: 'nor did Alice think',
      before: `${'x'.repeat(B.contextCharacters)}that;`,
      after: '',
      explanation: 'Agreement.'
    })).findings;
    expect(finding.anchor).toEqual({ quote: 'nor did Alice think', before: `${'x'.repeat(B.contextCharacters - 5)}that;` });
    expect(finding).not.toHaveProperty('replacement');
  });

  it('clips a runaway explanation', () => {
    const long = 'Because '.repeat(100);
    const [finding] = read(replyOf({ ...WEATHER_ISSUE, explanation: long })).findings;
    expect(finding.explanation).toHaveLength(PROMPT_BUDGETS.proofread.explanationCharacters);
    expect(finding.explanation.endsWith('…')).toBe(true);
  });

  it('rejects the whole chunk only for a root of the wrong shape', () => {
    expect(() => read(frameOf({ version: 2, issues: [] }))).toThrow('version 1');
    expect(() => read(frameOf({ version: 1 }))).toThrow('issues array');
    expect(read(frameOf({ issues: [] }))).toEqual({ findings: [], malformed: 0, ignoredFields: 0 });
  });
});
