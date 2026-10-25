/**
 * Proofread and Fix (Draft Edit Slice 2; ADR 2026-10-21 D4, D7), through the
 * real applier, anchoring and guard, on a document that moves as VS Code's
 * does. The model is a stub; text is public-domain *Alice*, seeded with
 * errors.
 *
 * - The safe fixes land in one change; judgment calls are only ever flagged.
 * - Whatever the writer does in review (tick some, discard, edit), every fix
 *   that did not land is flagged where its text stands after, and a fix whose
 *   text they changed is left as they wrote it.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { DraftEditUseCase, type ProofreadPassPort } from '@/application/services/draftEdit/DraftEditUseCase';
import type { DraftEditOutcome, DraftEditPass } from '@/domain/models/DraftEdit';
import type { ProofreadFinding } from '@/domain/models/ProofreadIssue';
import type { ProofreadRunResult } from '@services/proofread/ProofreadService';
import {
  FakeAnnotations,
  FakeDocuments,
  applyTicked,
  decline,
  firstThen,
  writerTypes,
  type HostBehavior
} from '@/__tests__/application/services/draftEdit/fakeDocuments';

const TEXT = 'Alice was begining to get vrey tired of sitting by her sister on the bank, '
  + 'and once or twice she peeped into the book her sister is reading.';

const BEGINING: ProofreadFinding = { anchor: { quote: 'begining' }, category: 'spelling', replacement: 'beginning', explanation: 'A typo.' };
const VREY: ProofreadFinding = { anchor: { quote: 'vrey' }, category: 'spelling', replacement: 'very', explanation: 'A typo.' };
const IS_READING: ProofreadFinding = { anchor: { quote: 'is reading' }, category: 'tense', replacement: 'was reading', explanation: 'The narration is past tense.' };

const PREVIEW: DraftEditPass = { kind: 'proofread', output: 'fix', review: 'preview' };
const DIRECT: DraftEditPass = { kind: 'proofread', output: 'fix', review: 'direct' };

function read(...findings: ProofreadFinding[]): ProofreadRunResult {
  return { kind: 'completed', chunks: [{ kind: 'read', findings, malformed: 0 }] };
}

function setup(host?: HostBehavior, result: ProofreadRunResult | Promise<ProofreadRunResult> = read(BEGINING, VREY, IS_READING)) {
  const document = new FakeDocuments(TEXT, undefined, 'markdown', 7, host);
  const annotations = new FakeAnnotations(document);
  const pass: ProofreadPassPort = { proofread: jest.fn(async () => result) };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const useCase = new DraftEditUseCase(pass, document, annotations, new DraftEditApplier(document), log);
  const onReview = jest.fn();
  const run = (fix: DraftEditPass = PREVIEW) => useCase.run(
    { uri: document.uri, version: document.version, text: document.text, languageId: 'markdown', relativePath: 'chapter-01.md' },
    fix,
    undefined,
    { onReview }
  );
  return { document, annotations, useCase, run, onReview };
}

function completed(outcome: DraftEditOutcome): Extract<DraftEditOutcome, { kind: 'completed' }> {
  if (outcome.kind !== 'completed') {
    throw new Error(`expected a completed run, got ${outcome.kind}`);
  }
  return outcome;
}

describe('DraftEditUseCase.run: Proofread and Fix', () => {
  it('applies the safe fixes in one change and flags the judgment call, never applying it', async () => {
    const { document, annotations, run, onReview } = setup();
    const outcome = completed(await run());

    expect(document.applyCalls).toHaveLength(1);
    expect(document.applyCalls[0].edits.map((edit) => [edit.newText, edit.label])).toEqual([
      ['beginning', 'Proofread: spelling'],
      ['very', 'Proofread: spelling']
    ]);
    expect(document.text).toBe(TEXT.replace('begining', 'beginning').replace('vrey', 'very'));
    expect(annotations.flaggedText()).toEqual(['is reading']);
    expect(annotations.shows[0].version).toBe(document.version);
    expect(outcome.fix).toEqual({ review: 'preview', answer: 'submitted', applied: 2, notApplied: 0, unknown: 0 });
    expect(outcome).toMatchObject({ flagged: 1, judgmentCalls: 1 });
    expect(onReview).toHaveBeenCalledWith(2);
  });

  it('flags a fix the writer left unticked, on its text as it stands after the others landed', async () => {
    const { document, annotations, run } = setup(applyTicked((edit) => edit.newText === 'beginning'));
    const outcome = completed(await run());

    expect(document.text).toContain('beginning to get vrey tired');
    expect(annotations.flaggedText()).toEqual(['vrey', 'is reading']);
    // Still Proofread's own fix, so its quick fix is the preferred one.
    expect(annotations.shown[0].fix).toEqual({ replacement: 'very', preferred: true });
    expect(outcome.fix).toMatchObject({ answer: 'submitted', applied: 1, notApplied: 1 });
    expect(outcome.flagged).toBe(2);
  });

  it('flags every fix when the writer discards the preview, and changes nothing', async () => {
    const { document, annotations, run } = setup(decline);
    const outcome = completed(await run());

    expect(document.text).toBe(TEXT);
    expect(annotations.flaggedText()).toEqual(['begining', 'vrey', 'is reading']);
    expect(outcome.fix).toMatchObject({ answer: 'declined', applied: 0, notApplied: 2 });
  });

  it('leaves a fix the writer rewrote during review as they wrote it, and flags the rest after their edit', async () => {
    const { document, annotations, run } = setup(writerTypes([
      { offset: 0, length: 0, text: 'Poor ' },
      { offset: TEXT.indexOf('vrey'), length: 4, text: 'so' }
    ]));
    const outcome = completed(await run());

    expect(document.text.startsWith('Poor Alice was begining to get so tired')).toBe(true);
    expect(annotations.flaggedText()).toEqual(['begining', 'is reading']);
    expect(outcome.fix).toMatchObject({ answer: 'stale', applied: 0, notApplied: 1, unknown: 1 });
    expect(document.applyCalls).toHaveLength(1);
  });

  it('applies directly without review when the writer chose it, and never says it is reviewing', async () => {
    const { document, run, onReview } = setup();
    const outcome = completed(await run(DIRECT));

    expect(document.applyCalls[0].review).toBe('direct');
    expect(onReview).not.toHaveBeenCalled();
    expect(outcome.fix).toMatchObject({ review: 'direct', answer: 'submitted', applied: 2 });
  });

  it('follows the writer\'s edits during the model call before fixing', async () => {
    let release: (result: ProofreadRunResult) => void = () => undefined;
    const held = new Promise<ProofreadRunResult>((resolve) => { release = resolve; });
    const { document, annotations, run } = setup(undefined, held);
    const pending = run();
    document.edit([{ offset: 0, length: 0, text: 'Poor ' }]);
    release(read(BEGINING, VREY, IS_READING));
    const outcome = completed(await pending);

    expect(document.applyCalls[0].expectedVersion).toBe(8);
    expect(document.text.startsWith('Poor Alice was beginning to get very tired')).toBe(true);
    expect(annotations.flaggedText()).toEqual(['is reading']);
    expect(outcome.fix).toMatchObject({ applied: 2 });
  });

  it('asks nothing of the editor when there is nothing safe to fix', async () => {
    const { document, annotations, run } = setup(undefined, read(IS_READING));
    const outcome = completed(await run());

    expect(document.applyCalls).toEqual([]);
    expect(annotations.flaggedText()).toEqual(['is reading']);
    expect(outcome.fix).toEqual({ review: 'preview', answer: 'none', applied: 0, notApplied: 0, unknown: 0 });
  });

  it('flags a "fix" that would add markup, rather than applying it', async () => {
    const backtick: ProofreadFinding = { anchor: { quote: 'the bank' }, category: 'punctuation', replacement: 'the `bank', explanation: 'Unclear.' };
    const { document, annotations, run } = setup(undefined, read(backtick, VREY));
    const outcome = completed(await run());

    expect(document.applyCalls[0].edits.map((edit) => edit.newText)).toEqual(['very']);
    expect(annotations.flaggedText()).toEqual(['the bank']);
    expect(annotations.shown[0].fix).toEqual({ replacement: 'the `bank', preferred: false });
    expect(outcome.fix).toMatchObject({ applied: 1 });
  });

  it('shows nothing when the document closes during review', async () => {
    const { annotations, run } = setup((_edits, _review, document) => {
      document.close();
      return { kind: 'declined' };
    });

    expect(await run()).toMatchObject({ kind: 'closed' });
    expect(annotations.shows).toEqual([]);
  });

  it('refuses a second run on the document while one is in review', async () => {
    let finish: () => void = () => undefined;
    const { run } = setup((_edits, _review) => new Promise((resolve) => {
      finish = () => resolve({ kind: 'declined' });
    }));
    const first = run();
    await new Promise((resolve) => setImmediate(resolve));

    expect(await run()).toEqual({ kind: 'busy' });
    finish();
    expect((await first).kind).toBe('completed');
  });
});

describe('DraftEditUseCase: a direct fix the writer fences as it goes out (PR #172 F-01)', () => {
  it('writes nothing into the new code, and counts the fix as protected', async () => {
    const sentence = 'Alice saw teh rabbit.';
    const teh: ProofreadFinding = { anchor: { quote: 'teh' }, category: 'spelling', replacement: 'the', explanation: 'A typo.' };
    const document = new FakeDocuments(sentence, undefined, 'markdown', 3, firstThen(writerTypes([
      { offset: 0, length: 0, text: '```text\n' },
      { offset: sentence.length, length: 0, text: '\n```' }
    ]), () => ({ kind: 'submitted' })));
    const annotations = new FakeAnnotations(document);
    const pass: ProofreadPassPort = { proofread: jest.fn(async (): Promise<ProofreadRunResult> => read(teh)) };
    const useCase = new DraftEditUseCase(pass, document, annotations, new DraftEditApplier(document), { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });
    const outcome = completed(await useCase.run({ uri: document.uri, version: 3, text: sentence, languageId: 'markdown', relativePath: 'a.md' }, DIRECT));

    expect(document.text).toBe('```text\nAlice saw teh rabbit.\n```');
    expect(document.applyCalls).toHaveLength(1);
    expect(outcome.fix).toMatchObject({ answer: 'stale', applied: 0 });
    expect(outcome.dropped.protected).toBe(1);
    expect(annotations.flaggedText()).toEqual([]);
  });
});


describe('DraftEditUseCase: fixes that would change the Markdown structure (PR #172 F-03)', () => {
  function run(text: string, findings: ProofreadFinding[], pass: DraftEditPass = PREVIEW) {
    const document = new FakeDocuments(text, undefined, 'markdown', 2);
    const annotations = new FakeAnnotations(document);
    const proofread: ProofreadPassPort = { proofread: jest.fn(async (): Promise<ProofreadRunResult> => read(...findings)) };
    const useCase = new DraftEditUseCase(proofread, document, annotations, new DraftEditApplier(document), { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });
    const target = () => ({ uri: document.uri, version: document.version, text: document.text, languageId: 'markdown', relativePath: 'a.md' });
    return { document, annotations, useCase, outcome: useCase.run(target(), pass) };
  }

  it('flags a spacing fix that would make a tag of prose, and never writes it', async () => {
    const tag: ProofreadFinding = { anchor: { quote: '< Rabbit >' }, category: 'spacing', replacement: '<Rabbit>', explanation: 'Extra spaces.' };
    const { document, annotations, outcome } = run('Alice wrote < Rabbit > in her notebook.', [tag]);

    expect((await outcome)).toMatchObject({ kind: 'completed', flagged: 1, fix: { answer: 'none', applied: 0 } });
    expect(document.applyCalls).toEqual([]);
    expect(annotations.flaggedText()).toEqual(['< Rabbit >']);
    expect(annotations.shown[0].fix).toEqual({ replacement: '<Rabbit>', preferred: false });
  });

  it('applies the spelling fix, and flags the spacing fix that would have fenced it as code', async () => {
    const text = '` ``text\nAlice saw teh rabbit.';
    const fence: ProofreadFinding = { anchor: { quote: '` ``' }, category: 'spacing', replacement: '```', explanation: 'Stray space.' };
    const teh: ProofreadFinding = { anchor: { quote: 'teh' }, category: 'spelling', replacement: 'the', explanation: 'A typo.' };
    const { document, annotations, outcome } = run(text, [fence, teh], DIRECT);

    expect(await outcome).toMatchObject({ kind: 'completed', flagged: 1, fix: { answer: 'submitted', applied: 1 } });
    expect(document.text).toBe('` ``text\nAlice saw the rabbit.');
    expect(annotations.flaggedText()).toEqual(['` ``']);
  });

  it('never offers such a fix to Fix all after a Flag run', async () => {
    const tag: ProofreadFinding = { anchor: { quote: '< Rabbit >' }, category: 'spacing', replacement: '<Rabbit>', explanation: 'Extra spaces.' };
    const vrey: ProofreadFinding = { anchor: { quote: 'vrey' }, category: 'spelling', replacement: 'very', explanation: 'A typo.' };
    const { document, useCase, outcome } = run('Alice wrote < Rabbit > in her vrey neat notebook.', [tag, vrey], { kind: 'proofread', output: 'flag' });
    await outcome;

    expect(await useCase.applyShown(document.snapshot(), 'all-fixes', 'direct')).toMatchObject({ kind: 'done', applied: 1 });
    expect(document.text).toBe('Alice wrote < Rabbit > in her very neat notebook.');
  });
});
