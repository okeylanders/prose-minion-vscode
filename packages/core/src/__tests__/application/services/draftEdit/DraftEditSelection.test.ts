/**
 * A selection run replaces only its own flags (Draft Edit Slice 3; ADR
 * 2026-10-21 D7, amended 2026-10-26). The flags wholly outside the
 * selection, as the gesture read it, stay where they now sit, with their
 * ids and quick fixes; those it read again are replaced. A whole-file run
 * still replaces them all. The document and annotator behave as VS Code's
 * do (`fakeDocuments.ts`); text is public-domain *Alice*, seeded with errors.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { DraftEditUseCase, type ProofreadPassPort } from '@/application/services/draftEdit/DraftEditUseCase';
import type { ProofreadPass, TextRange } from '@/domain/models/DraftEdit';
import type { ProofreadFinding } from '@/domain/models/ProofreadIssue';
import type { ProofreadRunResult } from '@services/proofread/ProofreadService';
import { FakeAnnotations, FakeDocuments } from '@/__tests__/application/services/draftEdit/fakeDocuments';

const FIRST = 'Alice was begining to get vrey tired of sitting by her sister on the bank.';
const SECOND = 'Once or twice she peeped into the book her sister is reading, but it had no pictures or conversashions in it.';
const TEXT = `${FIRST}\n\n${SECOND}`;

const finding = (quote: string, category: ProofreadFinding['category'], replacement: string): ProofreadFinding =>
  ({ anchor: { quote }, category, replacement, explanation: 'A seeded error.' });
const BEGINING = finding('begining', 'spelling', 'beginning');
const VREY = finding('vrey', 'spelling', 'very');
const IS_READING = finding('is reading', 'tense', 'was reading');
const CONVERSASHIONS = finding('conversashions', 'spelling', 'conversations');

const FLAG: ProofreadPass = { kind: 'proofread', output: 'flag' };
const read = (...findings: ProofreadFinding[]): ProofreadRunResult => ({ kind: 'completed', chunks: [{ kind: 'read', findings, malformed: 0 }] });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function proofreader() {
  const document = new FakeDocuments(TEXT);
  const annotations = new FakeAnnotations(document);
  const replies: Array<ProofreadRunResult | Promise<ProofreadRunResult>> = [];
  const pass: ProofreadPassPort = { proofread: jest.fn(async () => replies.shift() ?? read()) };
  const useCase = new DraftEditUseCase(pass, document, annotations, new DraftEditApplier(document), { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });
  /** The gesture's read: the whole document, or a selection, by its text or its offsets. */
  const target = (selection?: string | TextRange) => {
    const range = typeof selection === 'string'
      ? { start: document.text.indexOf(selection), end: document.text.indexOf(selection) + selection.length }
      : selection;
    return { ...document.snapshot(), relativePath: 'chapter-01.md', ...(range ? { range } : {}) };
  };
  const flags = () => annotations.shown.map((annotation) => document.text.slice(annotation.start, annotation.end));
  const idOf = (text: string) => annotations.shown.find((annotation) => document.text.slice(annotation.start, annotation.end) === text)?.id;
  /** A whole-file Flag run's flags on the seeded errors. */
  const flagEverything = async () => {
    replies.push(read(BEGINING, VREY, IS_READING, CONVERSASHIONS));
    await useCase.run(target(), FLAG);
    expect(flags()).toEqual(['begining', 'vrey', 'is reading', 'conversashions']);
  };
  return { document, annotations, useCase, replies, target, flags, idOf, flagEverything };
}

describe('A selection run replaces only its own flags (Slice 3)', () => {
  it('keeps the flags outside the selection, with their ids, and replaces those it read again', async () => {
    const proofread = proofreader();
    await proofread.flagEverything();
    const kept = [proofread.idOf('begining'), proofread.idOf('vrey')];
    const reread = proofread.idOf('is reading');

    proofread.replies.push(read(IS_READING, CONVERSASHIONS));
    const outcome = await proofread.useCase.run(proofread.target(SECOND), FLAG);

    expect(proofread.flags()).toEqual(['begining', 'vrey', 'is reading', 'conversashions']);
    expect([proofread.idOf('begining'), proofread.idOf('vrey')]).toEqual(kept);
    expect(proofread.idOf('is reading')).not.toBe(reread);
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 2, kept: 2 });
  });

  it('replaces a flag that crosses the selection\'s edge, since the run read part of it', async () => {
    const proofread = proofreader();
    await proofread.flagEverything();

    const outcome = await proofread.useCase.run(proofread.target({ start: TEXT.indexOf('vrey') + 2, end: TEXT.length }), FLAG);

    expect(proofread.flags()).toEqual(['begining']);
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 0, kept: 1 });
  });

  it('keeps them where the writer\'s typing during the run moved them, and their quick fixes still land', async () => {
    const proofread = proofreader();
    await proofread.flagEverything();
    const reply = deferred<ProofreadRunResult>();
    proofread.replies.push(reply.promise);

    const run = proofread.useCase.run(proofread.target(SECOND), FLAG);
    proofread.document.edit([{ offset: 0, length: 0, text: 'Poor ' }]);
    reply.resolve(read(CONVERSASHIONS));
    await run;

    expect(proofread.flags()).toEqual(['begining', 'vrey', 'conversashions']);
    const fixed = await proofread.useCase.applyShown(proofread.document.snapshot(), { issueIds: [proofread.idOf('vrey')!] }, 'direct');
    expect(fixed).toMatchObject({ kind: 'done', applied: 1 });
    expect(proofread.document.text.startsWith('Poor Alice was begining to get very tired')).toBe(true);
    expect(proofread.flags()).toEqual(['begining', 'conversashions']);
  });

  it.each<[string, (proofread: ReturnType<typeof proofreader>) => void, string[]]>([
    ['dismissed', (proofread) => proofread.useCase.dismiss(proofread.document.uri, proofread.idOf('begining')!), ['vrey', 'conversashions']],
    ['edited', (proofread) => proofread.document.edit([{ offset: TEXT.indexOf('vrey'), length: 4, text: 'so' }]), ['begining', 'conversashions']],
    ['cleared', (proofread) => proofread.useCase.clear(proofread.document.uri), ['conversashions']]
  ])('does not bring back a flag the writer %s during the run', async (_act, act, expected) => {
    const proofread = proofreader();
    await proofread.flagEverything();
    const reply = deferred<ProofreadRunResult>();
    proofread.replies.push(reply.promise);

    const run = proofread.useCase.run(proofread.target(SECOND), FLAG);
    act(proofread);
    reply.resolve(read(CONVERSASHIONS));
    const outcome = await run;

    expect(proofread.flags()).toEqual(expected);
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1 });
  });

  it('control: a whole-file run still replaces every flag', async () => {
    const proofread = proofreader();
    await proofread.flagEverything();

    proofread.replies.push(read(CONVERSASHIONS));
    const outcome = await proofread.useCase.run(proofread.target(), FLAG);

    expect(proofread.flags()).toEqual(['conversashions']);
    expect(outcome).not.toHaveProperty('kept');
  });

  it('keeps the flags outside a selection Fix run, moved past the fixes it made', async () => {
    const proofread = proofreader();
    await proofread.flagEverything();

    proofread.replies.push(read(BEGINING, VREY));
    const outcome = await proofread.useCase.run(proofread.target(FIRST), { kind: 'proofread', output: 'fix', review: 'direct' });

    expect(proofread.document.text.startsWith('Alice was beginning to get very tired')).toBe(true);
    expect(proofread.flags()).toEqual(['is reading', 'conversashions']);
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 0, kept: 2, fix: { answer: 'submitted', applied: 2 } });

    const fixAll = await proofread.useCase.applyShown(proofread.document.snapshot(), 'all-fixes', 'direct');
    expect(fixAll).toMatchObject({ kind: 'done', applied: 1 });
    expect(proofread.document.text.endsWith('pictures or conversations in it.')).toBe(true);
    expect(proofread.flags()).toEqual(['is reading']);
  });
});
