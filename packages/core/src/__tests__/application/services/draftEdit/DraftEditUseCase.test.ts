/**
 * DraftEditUseCase (ADR 2026-10-21 D2, D4, D6, D7): a Proofread run from a
 * gesture's target to flags. The pass, the document reader, and the
 * annotator are stand-ins; nothing reaches a provider. Passages are public
 * domain (Lewis Carroll, 1865) with seeded errors.
 */
import { DraftEditUseCase, type ProofreadPassPort } from '@/application/services/draftEdit/DraftEditUseCase';
import type { DraftEditTarget } from '@/domain/models/DraftEdit';
import type { ProofreadFinding } from '@/domain/models/ProofreadIssue';
import type { DocumentAnnotation, DocumentTextChange } from '@/platform';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ProofreadRunRequest, ProofreadRunResult } from '@services/proofread/ProofreadService';
import { PROTECTED_PLACEHOLDER } from '@/utils/draftEdit/protectedRegions';
import {
  ALICE_MARKDOWN_CHAPTER,
  ALICE_OPENING_SEEDED,
  ALICE_RABBIT_SEEDED
} from '@/__tests__/utils/draftEdit/proofreadFixtures';

const URI = 'file:///workspace/chapter-01.txt';
const TEXT = `${ALICE_OPENING_SEEDED}\n\n${ALICE_RABBIT_SEEDED}`;
const USAGE = { promptTokens: 100, completionTokens: 20, totalTokens: 120, costUsd: 0.001 };

const WEATHER: ProofreadFinding = {
  anchor: { quote: 'weather', before: 'very sleepy and stupid),', after: 'the pleasure of making' },
  category: 'homophone',
  replacement: 'whether',
  explanation: '“Weather” is the climate.'
};
const RUNS: ProofreadFinding = {
  anchor: { quote: 'runs', before: 'White Rabbit with pink eyes', after: 'close by her.' },
  category: 'tense',
  replacement: 'ran',
  explanation: 'The narration is past tense.'
};
const THE_THE: ProofreadFinding = {
  anchor: { quote: 'the the', before: 'so very much out of', after: 'way to hear' },
  category: 'spelling',
  replacement: 'the',
  explanation: 'The word “the” is doubled.'
};

const read = (...findings: ProofreadFinding[]): ProofreadRunResult => ({
  kind: 'completed',
  chunks: [{ kind: 'read', findings, malformed: 0 }],
  usage: USAGE
});

function target(overrides: Partial<DraftEditTarget> = {}): DraftEditTarget {
  return { uri: URI, version: 1, text: TEXT, languageId: 'plaintext', relativePath: 'chapter-01.txt', ...overrides };
}

/** The document as the run's watch settles to it: its live text and the edits that made it, or closed. */
type Live = { readonly version?: number; readonly text: string; readonly languageId?: string; readonly edits?: DocumentTextChange[][] } | 'closed';

function setup(options: {
  result?: ProofreadRunResult | Promise<ProofreadRunResult>;
  live?: Live;
  /** False: the document is not open at the gesture's version when the run starts. */
  watchable?: boolean;
  shows?: boolean;
} = {}) {
  const requests: ProofreadRunRequest[] = [];
  const pass: ProofreadPassPort = {
    proofread: jest.fn(async (request: ProofreadRunRequest) => {
      requests.push(request);
      return options.result ?? read();
    })
  };
  const shown: Array<{ uri: string; version: number; annotations: readonly DocumentAnnotation[] }> = [];
  const annotations = {
    show: jest.fn((uri: string, version: number, list: readonly DocumentAnnotation[]) => {
      shown.push({ uri, version, annotations: list });
      return options.shows ?? true;
    }),
    remove: jest.fn(),
    clear: jest.fn()
  };
  const disposed = jest.fn();
  const documents = {
    watch: jest.fn((uri: string, version: number) => {
      if (options.watchable === false) {
        return undefined;
      }
      return {
        settle: () => {
          const live = options.live ?? { text: TEXT };
          return live === 'closed'
            ? { kind: 'closed' as const }
            : {
                kind: 'open' as const,
                snapshot: { uri, version: live.version ?? version, text: live.text, languageId: live.languageId ?? 'plaintext' },
                edits: live.edits ?? []
              };
        },
        dispose: disposed
      };
    })
  };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const useCase = new DraftEditUseCase(pass, documents, annotations, log);
  return { useCase, pass, requests, shown, annotations, documents, disposed };
}

const FLAG = { kind: 'proofread', output: 'flag' } as const;
const NONE = { unanchored: 0, protected: 0, overlapping: 0, stale: 0, malformed: 0 };

describe('DraftEditUseCase.run: placing and showing flags', () => {
  it('places each finding by its quote and shows it as an annotation on the live version', async () => {
    const { useCase, requests, shown } = setup({ result: read(WEATHER, RUNS, THE_THE) });
    const outcome = await useCase.run(target(), FLAG);

    expect(requests).toEqual([{ chunks: [TEXT], label: 'chapter-01.txt' }]);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ uri: URI, version: 1 });
    expect(shown[0].annotations.map((annotation) => ({
      text: TEXT.slice(annotation.start, annotation.end),
      severity: annotation.severity,
      code: annotation.code
    }))).toEqual([
      { text: 'weather', severity: 'info', code: 'proofread.homophone' },
      { text: 'runs', severity: 'warning', code: 'proofread.tense' },
      { text: 'the the', severity: 'info', code: 'proofread.spelling' }
    ]);
    expect(shown[0].annotations[0].message).toBe('“Weather” is the climate. Suggested: “whether”.');
    expect(outcome).toEqual({
      kind: 'completed',
      flagged: 3,
      judgmentCalls: 1,
      dropped: NONE,
      rejectedChunks: { saved: 0, unsaved: 0 },
      chunks: { total: 1, completed: 1 },
      usage: USAGE
    });
  });

  it('proofreads a selection, and places its flags in document offsets', async () => {
    const start = TEXT.indexOf(ALICE_RABBIT_SEEDED);
    const { useCase, requests, shown } = setup({ result: read(THE_THE) });
    await useCase.run(target({ range: { start, end: TEXT.length } }), FLAG);

    expect(requests[0]).toEqual({ chunks: [ALICE_RABBIT_SEEDED], label: 'chapter-01.txt (selection)' });
    const [annotation] = shown[0].annotations;
    expect(annotation.start).toBe(TEXT.indexOf('the the'));
  });

  it('never sends protected regions, and places a quote at its prose occurrence only', async () => {
    const live = { text: ALICE_MARKDOWN_CHAPTER, languageId: 'markdown' };
    const teh: ProofreadFinding = { anchor: { quote: 'teh', before: 'for', after: 'rest.' }, category: 'spelling', replacement: 'the', explanation: 'Typo.' };
    const { useCase, requests, shown } = setup({ result: read(teh), live });
    await useCase.run(target({ text: ALICE_MARKDOWN_CHAPTER, languageId: 'markdown' }), FLAG);

    const sent = requests[0].chunks.join('\n');
    expect(sent).toContain(PROTECTED_PLACEHOLDER);
    expect(sent).not.toContain('title: Down the Rabbit-Hole');
    expect(sent).not.toContain('teh rabbit-hole went straight');
    expect(sent).not.toContain('gutenberg.org');
    expect(sent).not.toContain('teh draft continues');
    const [annotation] = shown[0].annotations;
    expect(annotation.start).toBe(ALICE_MARKDOWN_CHAPTER.indexOf('teh rest'));
  });

  it('drops a quote that touches a protected placeholder', async () => {
    const live = { text: ALICE_MARKDOWN_CHAPTER, languageId: 'markdown' };
    // Unique in the masked text, and straddling the link destination's placeholder.
    const intoLink: ProofreadFinding = { anchor: { quote: `text]${PROTECTED_PLACEHOLDER} for` }, category: 'spacing', replacement: 'x', explanation: 'x' };
    const { useCase } = setup({ result: read(intoLink), live });
    const outcome = await useCase.run(target({ text: ALICE_MARKDOWN_CHAPTER, languageId: 'markdown' }), FLAG);

    expect(outcome).toMatchObject({ flagged: 0, dropped: { ...NONE, protected: 1 } });
  });

  it('protects a selection made inside a fenced block, so there is nothing to proofread', async () => {
    const start = ALICE_MARKDOWN_CHAPTER.indexOf('teh rabbit-hole');
    const { useCase, pass } = setup();
    const outcome = await useCase.run(
      target({ text: ALICE_MARKDOWN_CHAPTER, languageId: 'markdown', range: { start, end: start + 15 } }),
      FLAG
    );

    expect(outcome).toEqual({ kind: 'empty' });
    expect(pass.proofread).not.toHaveBeenCalled();
  });

  it('counts unplaceable and ambiguous quotes, and keeps the earlier of two overlapping issues', async () => {
    const cheshire: ProofreadFinding = { anchor: { quote: 'Cheshire' }, category: 'spelling', replacement: 'x', explanation: 'x' };
    const ambiguous: ProofreadFinding = { anchor: { quote: 'the' }, category: 'spelling', replacement: 'teh', explanation: 'x' };
    const overlapping: ProofreadFinding = { anchor: { quote: 'the way', before: 'so very much out of the' }, category: 'spelling', replacement: 'the path', explanation: 'x' };
    const { useCase, shown } = setup({ result: read(THE_THE, cheshire, ambiguous, overlapping) });
    const outcome = await useCase.run(target(), FLAG);

    expect(shown[0].annotations.map((annotation) => TEXT.slice(annotation.start, annotation.end))).toEqual(['the the']);
    expect(outcome).toMatchObject({ flagged: 1, dropped: { ...NONE, unanchored: 2, overlapping: 1 } });
  });

  it('says nothing about a finding whose replacement is its own text, and flags a downgraded fix as a surface error', async () => {
    const noOp: ProofreadFinding = { ...WEATHER, replacement: 'weather' };
    const rewrite: ProofreadFinding = { ...THE_THE, category: 'spelling', replacement: 'the very far' };
    const { useCase, shown } = setup({ result: read(noOp, rewrite) });
    const outcome = await useCase.run(target(), FLAG);

    expect(shown[0].annotations).toEqual([expect.objectContaining({ code: 'proofread.spelling', severity: 'info' })]);
    expect(outcome).toMatchObject({ flagged: 1, dropped: NONE });
  });

  it('moves flags through the writer\'s edits during the run, dropping one an edit touched', async () => {
    const prefix = 'Oh dear! ';
    const weather = TEXT.indexOf('weather');
    const edits = [
      [{ offset: 0, length: 0, text: prefix }],
      [{ offset: weather + prefix.length, length: 'weather'.length, text: 'whether' }]
    ];
    const edited = `${prefix}${TEXT.replace('weather', 'whether')}`;
    const { useCase, shown } = setup({ result: read(WEATHER, RUNS), live: { version: 3, text: edited, edits } });
    const outcome = await useCase.run(target(), FLAG);

    expect(shown[0].version).toBe(3);
    expect(shown[0].annotations.map((annotation) => edited.slice(annotation.start, annotation.end))).toEqual(['runs']);
    expect(shown[0].annotations[0].start).toBe(TEXT.indexOf('runs') + prefix.length);
    expect(outcome).toMatchObject({ flagged: 1, dropped: { ...NONE, stale: 1 } });
  });

  it('shows nothing when the document closed during the run, and says so (PR #171 F-04)', async () => {
    const { useCase, annotations, disposed } = setup({
      result: { kind: 'completed', chunks: [{ kind: 'read', findings: [WEATHER, RUNS], malformed: 0 }, { kind: 'rejected', saved: false }], usage: USAGE },
      live: 'closed'
    });
    const outcome = await useCase.run(target(), FLAG);

    expect(annotations.show).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: 'closed', rejectedChunks: { saved: 0, unsaved: 1 }, usage: USAGE });
    expect(disposed).toHaveBeenCalled();
  });

  it('sends nothing when the document is no longer open at the gesture\'s version', async () => {
    const { useCase, pass, annotations } = setup({ watchable: false });
    expect(await useCase.run(target(), FLAG)).toEqual({ kind: 'changed' });
    expect(pass.proofread).not.toHaveBeenCalled();
    expect(annotations.show).not.toHaveBeenCalled();
  });

  it('counts everything stale when the host refuses the version', async () => {
    const { useCase } = setup({ result: read(WEATHER), shows: false });
    expect(await useCase.run(target(), FLAG)).toMatchObject({ flagged: 0, dropped: { ...NONE, stale: 1 } });
  });

  it('replaces the document\'s earlier flags even when it finds nothing', async () => {
    const { useCase, shown } = setup({ result: read() });
    await useCase.run(target(), FLAG);
    expect(shown).toEqual([{ uri: URI, version: 1, annotations: [] }]);
  });

  it('reports malformed issues, rejected and unsent chunks, and the interruption', async () => {
    const malformed = setup({ result: { kind: 'completed', chunks: [{ kind: 'read', findings: [], malformed: 2 }] } });
    expect(await malformed.useCase.run(target(), FLAG)).toMatchObject({ dropped: { ...NONE, malformed: 2 } });

    const rejected = setup({ result: { kind: 'completed', chunks: [{ kind: 'rejected', saved: true }, { kind: 'rejected', saved: false }, { kind: 'rejected', saved: true }] } });
    expect(await rejected.useCase.run(target(), FLAG)).toMatchObject({ rejectedChunks: { saved: 2, unsaved: 1 }, chunks: { total: 3, completed: 3 } });

    const interrupted = { cause: 'key-changed' as const, message: 'The API key changed.' };
    const unsent = setup({ result: { kind: 'completed', chunks: [{ kind: 'unsent' }], interrupted } });
    expect(await unsent.useCase.run(target(), FLAG)).toMatchObject({ chunks: { total: 1, completed: 0 }, interrupted });
  });

  it('maps an unconfigured or cancelled pass, and an empty target', async () => {
    expect(await setup({ result: { kind: 'unconfigured' } }).useCase.run(target(), FLAG)).toEqual({ kind: 'unconfigured' });
    expect(await setup({ result: { kind: 'cancelled', usage: USAGE } }).useCase.run(target(), FLAG)).toEqual({ kind: 'cancelled', usage: USAGE });
    const blank = setup();
    expect(await blank.useCase.run(target({ text: '  \n\n ' }), FLAG)).toEqual({ kind: 'empty' });
    expect(blank.pass.proofread).not.toHaveBeenCalled();
  });

  it('refuses a second run on a document while one is in flight, and allows one after', async () => {
    let finish: (result: ProofreadRunResult) => void = () => undefined;
    const pending = new Promise<ProofreadRunResult>((resolve) => { finish = resolve; });
    const { useCase } = setup({ result: pending });
    const first = useCase.run(target(), FLAG);

    expect(await useCase.run(target(), FLAG)).toEqual({ kind: 'busy' });
    // Another document runs alongside; it shares the held pass result, so it settles with the first.
    const other = useCase.run(target({ uri: 'file:///workspace/other.txt' }), FLAG);
    finish(read());
    await expect(first).resolves.toMatchObject({ kind: 'completed' });
    await expect(other).resolves.toMatchObject({ kind: 'completed' });
    expect(await useCase.run(target(), FLAG)).toMatchObject({ kind: 'completed' });
  });
});

describe('DraftEditUseCase.run: protected Markdown never reaches the payload or a flag (PR #171 F-02)', () => {
  const PROSE = 'Alice was beginning to get very tired.';
  const TEH: ProofreadFinding = { anchor: { quote: 'teh' }, category: 'spelling', replacement: 'the', explanation: 'Typo.' };
  const CONSTRUCTS: ReadonlyArray<[string, string]> = [
    ['a fence in a block quote', '> ~~~txt\n> teh\n> ~~~'],
    ['a fence in a list item', '- ~~~txt\n  teh\n  ~~~'],
    ['a destination with balanced parentheses', '[chapter](chap(one)/teh.md)'],
    ['a destination on the next line', '[chapter](\n  secret/teh.md\n)'],
    ['a reference definition on two lines', '[chapter]:\n  secret/teh.md'],
    ['an email autolink', 'Contact <teh@example.invalid>.'],
    ['a code span after an unmatched backtick run', 'A `` b `teh` c'],
    ['a tag whose quoted attribute holds >', 'See <a title="x>y" href="teh.html">link</a>.']
  ];

  it.each(CONSTRUCTS)('a whole-document run: %s', async (_name, construct) => {
    const text = `${construct}\n\n${PROSE}`;
    const { useCase, requests, shown } = setup({ result: read(TEH), live: { text, languageId: 'markdown' } });
    const outcome = await useCase.run(target({ text, languageId: 'markdown' }), FLAG);

    expect(requests[0].chunks.join('\n')).not.toContain('teh');
    expect(shown[0].annotations).toEqual([]);
    expect(outcome).toMatchObject({ flagged: 0, dropped: { ...NONE, unanchored: 1 } });
  });

  it.each(CONSTRUCTS)('a selection of the protected word alone: %s', async (_name, construct) => {
    const text = `${construct}\n\n${PROSE}`;
    const start = text.indexOf('teh');
    const { useCase, pass, annotations } = setup({ result: read(TEH) });
    const outcome = await useCase.run(target({ text, languageId: 'markdown', range: { start, end: start + 3 } }), FLAG);

    expect(outcome).toEqual({ kind: 'empty' });
    expect(pass.proofread).not.toHaveBeenCalled();
    expect(annotations.show).not.toHaveBeenCalled();
  });
});

describe('DraftEditUseCase.run: a finding keeps its own occurrence in the live text (PR #171 F-03)', () => {
  const TWICE = 'Alice saw teh rabbit. Elsewhere teh bird sang.';
  const FIRST_TEH: ProofreadFinding = { anchor: { quote: 'teh', before: 'Alice saw', after: 'rabbit.' }, category: 'spelling', replacement: 'the', explanation: 'Typo.' };
  const ONCE = 'Alice saw teh rabbit.';
  const ONLY_TEH: ProofreadFinding = { anchor: { quote: 'teh' }, category: 'spelling', replacement: 'the', explanation: 'Typo.' };
  const mdTarget = (text: string) => target({ text, languageId: 'markdown' });

  it('control: a harmless prefix moves the flag with its text', async () => {
    const live = { version: 2, text: `One day, ${ONCE}`, languageId: 'markdown', edits: [[{ offset: 0, length: 0, text: 'One day, ' }]] };
    const { useCase, shown } = setup({ result: read(ONLY_TEH), live });
    const outcome = await useCase.run(mdTarget(ONCE), FLAG);

    expect(shown[0].annotations.map((annotation) => [annotation.start, annotation.end])).toEqual([[19, 22]]);
    expect(outcome).toMatchObject({ flagged: 1, dropped: NONE });
  });

  it('drops the finding when the writer corrected its occurrence, never moving it to the other one', async () => {
    const at = TWICE.indexOf('teh');
    const live = { version: 2, text: TWICE.replace('teh', 'the'), languageId: 'markdown', edits: [[{ offset: at, length: 3, text: 'the' }]] };
    const { useCase, shown } = setup({ result: read(FIRST_TEH), live });
    const outcome = await useCase.run(mdTarget(TWICE), FLAG);

    expect(shown[0].annotations).toEqual([]);
    expect(outcome).toMatchObject({ flagged: 0, dropped: { ...NONE, stale: 1 } });
  });

  it('drops the finding when the writer fenced its text as code during the run', async () => {
    const fenced = `\`\`\`text\n${ONCE}\n\`\`\``;
    const live = {
      version: 3,
      text: fenced,
      languageId: 'markdown',
      edits: [[{ offset: 0, length: 0, text: '```text\n' }], [{ offset: '```text\n'.length + ONCE.length, length: 0, text: '\n```' }]]
    };
    const { useCase, shown } = setup({ result: read(ONLY_TEH), live });
    const outcome = await useCase.run(mdTarget(ONCE), FLAG);

    expect(shown[0].annotations).toEqual([]);
    expect(outcome).toMatchObject({ flagged: 0, dropped: { ...NONE, protected: 1 } });
  });

  it('never moves a corrected finding into an occurrence already inside code', async () => {
    const text = `${ONCE}\n\n\`\`\`text\nteh\n\`\`\``;
    const live = { version: 2, text: text.replace('teh', 'the'), languageId: 'markdown', edits: [[{ offset: text.indexOf('teh'), length: 3, text: 'the' }]] };
    const { useCase, shown, requests } = setup({ result: read(ONLY_TEH), live });
    const outcome = await useCase.run(mdTarget(text), FLAG);

    expect(requests[0].chunks.join('\n')).not.toContain('\nteh\n');
    expect(shown[0].annotations).toEqual([]);
    expect(outcome).toMatchObject({ flagged: 0, dropped: { ...NONE, stale: 1 } });
  });
});

describe('DraftEditUseCase.plan', () => {
  it('asks for confirmation only for a whole file over the threshold', () => {
    const { useCase } = setup();
    const long = 'Alice fell. '.repeat(Math.ceil(PROMPT_BUDGETS.proofread.confirmWholeFileWords / 2) + 1);
    const whole = useCase.plan(target({ text: long }));
    expect(whole.words).toBeGreaterThan(PROMPT_BUDGETS.proofread.confirmWholeFileWords);
    expect(whole).toMatchObject({ wholeFile: true, needsConfirmation: true, chunks: 1 });
    expect(useCase.plan(target({ text: long, range: { start: 0, end: long.length } })))
      .toMatchObject({ wholeFile: false, needsConfirmation: false });
    expect(useCase.plan(target())).toMatchObject({ wholeFile: true, needsConfirmation: false, chunks: 1 });
  });
});

describe('DraftEditUseCase.dismiss and clear', () => {
  it('withdraw one flag, a document\'s flags, or every document\'s', () => {
    const { useCase, annotations } = setup();
    useCase.dismiss(URI, 'proofread-3');
    useCase.clear(URI);
    useCase.clear();
    expect(annotations.remove).toHaveBeenCalledWith(URI, ['proofread-3']);
    expect(annotations.clear.mock.calls).toEqual([[URI], [undefined]]);
  });
});
