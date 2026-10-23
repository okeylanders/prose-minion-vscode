/**
 * A reading's frame repaired before it is rejected (Slice 4H, epic decision
 * 39), and a reply cut off at the output ceiling salvaged (decision 40),
 * through the production codec and the reply reader. The replies are the
 * worked examples' (the opening of "Alice's Adventures in Wonderland",
 * Lewis Carroll, 1865, public domain), broken as models break them: the
 * writer's real case was group E's reply closing its last block with `}}}`
 * where `}}` belonged, about 6,400 characters in; it is rebuilt here from
 * group E's worked example.
 */
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { LIGHTBOX_CUT_OFF_REASON, LightboxGroupFrameError } from '@/infrastructure/lightbox/LightboxReadingWire';
import { readLightboxGroupReply, lightboxGroupTools } from '@/infrastructure/lightbox/LightboxGroupReply';
import type { LightboxPreparedCall } from '@/infrastructure/lightbox/LightboxRunEstimate';
import type { LightboxRunSource } from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';

const E = readWorkedExample('E');
const contextOf = (group: 'A' | 'B' | 'C' | 'E' | 'F') => {
  const example = readWorkedExample(group);
  return { group, lenses: example.lenses, columnCount: group === 'F' ? 0 : example.paragraphs.length };
};
const END_E = '\n===END_LIGHTBOX_GROUP_E_V1===';
/** The real case: group E's last block closed with one brace too many. */
const EXTRA_BRACE = E.response.replace(`}}${END_E}`, `}}}${END_E}`);

describe('the real case: one closing brace too many after the last block (group E)', () => {
  it('fails JSON.parse near its end, as the writer\'s reply did', () => {
    const json = EXTRA_BRACE.split('\n').slice(1, -1).join('\n');
    expect(() => JSON.parse(json)).toThrow(/Unexpected non-whitespace character after JSON/);
    expect(json.length).toBeGreaterThan(5_000);
  });

  it('reads it whole, as the clean reply reads, with the repair named', () => {
    const clean = decodeLightboxGroup(E.response, contextOf('E'));
    const repaired = decodeLightboxGroup(EXTRA_BRACE, contextOf('E'));
    expect(repaired.blocks).toEqual(clean.blocks);
    expect(repaired.withheld).toEqual([]);
    expect(repaired.report).toEqual({ repairs: ['stray-closing-bracket'], clipped: 0, cutOff: false });
    expect(clean.report).toEqual({ repairs: [], clipped: 0, cutOff: false });
  });

  it('logs the repair by its kind, with no text, and lands every lens', async () => {
    const { outcome, logged } = await readReply(EXTRA_BRACE);
    expect(outcome.status).toBe('ok');
    expect(outcome.withheldBlocks).toEqual([]);
    expect(logged).toContain('[LightboxReadingRunner] Group E repaired: stray-closing-bracket');
    expect(logged).not.toContain('Portal descent');
  });
});

describe('the other structural faults, repaired', () => {
  const A = readWorkedExample('A');
  const clean = decodeLightboxGroup(A.response, contextOf('A'));

  it.each([
    ['a code fence inside the sentinels', A.response.replace('===\n{', '===\n```json\n{').replace('}\n===END', '}\n```\n===END'), ['code-fence']],
    ['a code fence around the whole frame', `\`\`\`\n${A.response}\n\`\`\``, ['code-fence']],
    // After the headline's terms (a list) and after its friction (an object's last member).
    ['trailing commas', A.response.replace('"],"evidence"', '",],"evidence"').replace('"},"motifs"', '",},"motifs"'), ['trailing-comma']],
    ['closing brackets missing at the end, its closing sentinel there', A.response.replace(/\}\}\n===END/, '\n===END'), ['missing-closing-bracket']],
    ['curly quotation marks as a key\'s delimiters', A.response.replace('"headline":', '“headline”:'), ['curly-quote-delimiters']],
    ['no closing sentinel, its JSON complete', A.response.replace('\n===END_LIGHTBOX_GROUP_A_V1===', ''), ['missing-closing-sentinel']]
  ])('repairs %s, reading the same blocks', (_case, text, repairs) => {
    const decoded = decodeLightboxGroup(text, contextOf('A'));
    expect(decoded.report?.repairs).toEqual(repairs);
    expect(decoded.blocks).toEqual(clean.blocks);
  });

  it('leaves curly quotation marks inside a string as the chapter\'s own punctuation', () => {
    const decoded = decodeLightboxGroup(readWorkedExample('B').response, contextOf('B'));
    expect(decoded.report?.repairs).toEqual([]);
    expect(JSON.stringify(decoded.blocks)).toContain('“');
  });

  it('refuses a repair the content guard or the grammar will not make, and keeps why for the recovery file only', () => {
    // A string cut short by a stray straight quote: only rewriting the text could read it.
    const broken = A.response.replace('"sentence":"', '"sentence":"A "quoted" ');
    let caught: unknown;
    try {
      decodeLightboxGroup(broken, contextOf('A'));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LightboxGroupFrameError);
    const frameError = caught as LightboxGroupFrameError;
    expect(frameError.message).toMatch(/^The group A response JSON is invalid \(at character \d+\)$/);
    expect(frameError.diagnostic).toMatch(/^A structural repair was refused: text that is not JSON at character \d+\.$/);
    expect(`${frameError.message} ${frameError.diagnostic}`).not.toContain('quoted');
  });
});

describe('a reply cut off at the output ceiling (decision 40)', () => {
  /** Group E's reply cut inside its summary block: template, pressure and artifacts finished. */
  const cut = E.response.slice(0, E.response.indexOf('"summary"') + 120);

  it('keeps the blocks it finished and withholds the block it was cut inside, never trusting it', () => {
    const decoded = decodeLightboxGroup(cut, { ...contextOf('E'), end: 'ceiling' });
    expect(decoded.blocks.map((block) => block.lens)).toEqual(['template', 'pressure', 'artifacts']);
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: LIGHTBOX_CUT_OFF_REASON }]);
    expect(decoded.report).toEqual({ repairs: ['missing-closing-sentinel', 'missing-closing-bracket'], clipped: 0, cutOff: true });
  });

  it('reports the lenses it never reached as missing, as any missing lens is', () => {
    const early = E.response.slice(0, E.response.indexOf('"pressure"') + 40);
    const decoded = decodeLightboxGroup(early, { ...contextOf('E'), end: 'ceiling' });
    expect(decoded.blocks.map((block) => block.lens)).toEqual(['template']);
    expect(decoded.withheld).toEqual([
      { lens: 'pressure', reason: LIGHTBOX_CUT_OFF_REASON },
      { lens: 'artifacts', reason: 'The reading returned no artifacts block.' },
      { lens: 'summary', reason: 'The reading returned no summary block.' }
    ]);
  });

  it('reads a reply cut off just after its frame\'s JSON closed as whole', () => {
    const whole = E.response.replace(END_E, '');
    const decoded = decodeLightboxGroup(whole, { ...contextOf('E'), end: 'ceiling' });
    expect(decoded.withheld).toEqual([]);
    expect(decoded.report?.cutOff).toBe(true);
  });

  it('withholds the Opinion, group F, when its one block was cut', () => {
    const F = readWorkedExample('F');
    const decoded = decodeLightboxGroup(F.response.slice(0, F.response.indexOf('"views"') + 50), { ...contextOf('F'), end: 'ceiling' });
    expect(decoded.blocks).toEqual([]);
    expect(decoded.withheld).toEqual([{ lens: 'opinion', reason: LIGHTBOX_CUT_OFF_REASON }]);
  });

  it('lands the group, the cut block naming where the paid reply was saved, with the group\'s own contract', async () => {
    const { outcome, logged, capture } = await readReply(cut, 'length');
    expect(outcome.status).toBe('ok');
    expect(outcome.withheldBlocks).toEqual([{
      kind: 'synopsis',
      lens: 'summary',
      reason: `${LIGHTBOX_CUT_OFF_REASON} Complete response saved for recovery at /workspace/prose-minion/recovery/model-responses/e.response.txt.`
    }]);
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'lightbox-readings',
      rawResponse: cut,
      finishReason: 'length',
      contract: {
        id: 'lightbox-reading-group-v1',
        intendedContentType: 'application/json',
        protocol: 'First-line ===LIGHTBOX_GROUP_E_V1===, then JSON {version: 1, one block per requested lens ' +
          '(template, pressure, artifacts, summary), each with friction}, then final-line ===END_LIGHTBOX_GROUP_E_V1===.'
      }
    }));
    expect(logged).toContain('[LightboxReadingRunner] Group E reached the output ceiling: 3 blocks finished, cut inside summary');
  });
});

describe('the safety ceiling, logged', () => {
  it('logs how many fields were clipped, never what they said', async () => {
    const body = framedJson(E.response) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    body.template.freshness.note = 'Familiar steps, lightly worn. '.repeat(60);
    const { outcome, logged } = await readReply(frame('E', body));
    expect(outcome.status).toBe('ok');
    expect(logged).toContain('[LightboxReadingRunner] Group E clipped 1 field at the safety ceiling');
    expect(logged).not.toContain('lightly worn');
  });
});

async function readReply(rawContent: string, finishReason: ExecutionResult['finishReason'] = 'stop') {
  const lines: string[] = [];
  const capture = jest.fn(async () => ({
    filePath: '/workspace/prose-minion/recovery/model-responses/e.response.txt',
    toolName: 'lightbox-readings' as const,
    storageScope: 'project' as const
  }));
  const ports = {
    recovery: { capture },
    recoveryPresenter: { present: jest.fn(async () => undefined) },
    outputChannel: { appendLine: (line: string) => lines.push(line), show: jest.fn(), clear: jest.fn() }
  };
  const call: LightboxPreparedCall = { group: 'E', lenses: E.lenses, systemMessage: '', userMessage: '', chapterTokens: 0 };
  const source: LightboxRunSource = {
    boardId: 'board-1',
    material: { paragraphs: E.paragraphs, columns: E.paragraphs.map((_, index) => ({ from: index + 1, to: index + 1 })), context: [] },
    sourceWords: 500,
    contextWords: 0,
    averageWordsPerSentence: 20
  };
  const result: ExecutionResult = {
    content: 'visible', rawContent, usedGuides: [], requestedResources: [], artifacts: [], finishReason, modelId: 'provider/model-v1'
  };
  const outcome = await readLightboxGroupReply(ports, { call, result, source, tools: lightboxGroupTools(source), token: 'token-1-0000' });
  return { outcome, logged: lines.join('\n'), capture };
}
