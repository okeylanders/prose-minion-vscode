/**
 * The quick fixes (Draft Edit Slice 2; ADR 2026-10-21 D6, D7): *Replace
 * with '…'* and *Fix all* name shown flags by id, ask the annotator where
 * they sit now, and write through the applier. They never write from a stale
 * range. Text is public-domain *Alice*, seeded with errors.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { DraftEditUseCase, type ProofreadPassPort } from '@/application/services/draftEdit/DraftEditUseCase';
import type { ProofreadFinding } from '@/domain/models/ProofreadIssue';
import type { ProofreadRunResult } from '@services/proofread/ProofreadService';
import { FakeAnnotations, FakeDocuments, writerTypes, type HostBehavior } from '@/__tests__/application/services/draftEdit/fakeDocuments';

const TEXT = 'Alice was begining to get vrey tired of sitting by her sister on the bank, '
  + 'and once or twice she peeped into the book her sister is reading.';

const BEGINING: ProofreadFinding = { anchor: { quote: 'begining' }, category: 'spelling', replacement: 'beginning', explanation: 'A typo.' };
const VREY: ProofreadFinding = { anchor: { quote: 'vrey' }, category: 'spelling', replacement: 'very', explanation: 'A typo.' };
const IS_READING: ProofreadFinding = { anchor: { quote: 'is reading' }, category: 'tense', replacement: 'was reading', explanation: 'The narration is past tense.' };

async function flagged(findings: ProofreadFinding[] = [BEGINING, VREY, IS_READING], host?: HostBehavior) {
  const document = new FakeDocuments(TEXT, undefined, 'markdown', 2, host);
  const annotations = new FakeAnnotations(document);
  let pending: Promise<ProofreadRunResult> | undefined;
  const pass: ProofreadPassPort = {
    proofread: jest.fn(async (): Promise<ProofreadRunResult> => pending ?? { kind: 'completed', chunks: [{ kind: 'read', findings, malformed: 0 }] })
  };
  const useCase = new DraftEditUseCase(pass, document, annotations, new DraftEditApplier(document), { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });
  const target = () => ({ uri: document.uri, version: document.version, text: document.text, languageId: 'markdown', relativePath: 'chapter-01.md' });
  await useCase.run(target(), { kind: 'proofread', output: 'flag' });
  const idOf = (text: string) => annotations.shown.find((annotation) => document.text.slice(annotation.start, annotation.end) === text)!.id;
  const hold = (result: Promise<ProofreadRunResult>) => {
    pending = result;
  };
  return { document, annotations, useCase, target, idOf, hold, snapshot: () => document.snapshot() };
}

describe('DraftEditUseCase.applyShown: the quick fixes', () => {
  it('replaces one flag\'s text at once, and withdraws the flag', async () => {
    const { document, annotations, useCase, idOf, snapshot } = await flagged();
    const outcome = await useCase.applyShown(snapshot(), { issueIds: [idOf('vrey')] }, 'direct');

    expect(outcome).toMatchObject({ kind: 'done', answer: 'submitted', applied: 1, refused: 0 });
    expect(document.text).toContain('get very tired');
    expect(annotations.flaggedText()).toEqual(['begining', 'is reading']);
  });

  it('writes where the flag sits now, after the writer typed before it', async () => {
    const { document, useCase, idOf, snapshot } = await flagged();
    const id = idOf('vrey');
    document.edit([{ offset: 0, length: 0, text: 'Poor ' }]);

    expect(await useCase.applyShown(snapshot(), { issueIds: [id] }, 'direct')).toMatchObject({ applied: 1 });
    expect(document.text.startsWith('Poor Alice was begining to get very tired')).toBe(true);
  });

  it('writes nothing for a flag whose text the writer edited, since the flag is gone', async () => {
    const { document, useCase, idOf, snapshot } = await flagged();
    const id = idOf('vrey');
    document.edit([{ offset: TEXT.indexOf('vrey'), length: 4, text: 'so' }]);

    expect(await useCase.applyShown(snapshot(), { issueIds: [id] }, 'direct')).toEqual({ kind: 'nothing' });
    expect(document.applyCalls).toEqual([]);
  });

  it('writes nothing for a flag the writer dismissed', async () => {
    const { useCase, idOf, snapshot, document } = await flagged();
    const id = idOf('vrey');
    useCase.dismiss(document.uri, id);

    expect(await useCase.applyShown(snapshot(), { issueIds: [id] }, 'direct')).toEqual({ kind: 'nothing' });
  });

  it('fixes all of Proofread\'s own fixes in one reviewed change, never a judgment call', async () => {
    const { document, annotations, useCase, snapshot } = await flagged();
    const outcome = await useCase.applyShown(snapshot(), 'all-fixes', 'preview');

    expect(document.applyCalls).toHaveLength(1);
    expect(document.applyCalls[0]).toMatchObject({ review: 'preview' });
    expect(document.applyCalls[0].edits.map((edit) => edit.newText)).toEqual(['beginning', 'very']);
    expect(outcome).toMatchObject({ kind: 'done', answer: 'submitted', applied: 2 });
    expect(annotations.flaggedText()).toEqual(['is reading']);
  });

  it('applies a judgment call\'s suggestion only when the writer chooses that one', async () => {
    const { document, useCase, idOf, snapshot } = await flagged();

    expect(await useCase.applyShown(snapshot(), { issueIds: [idOf('is reading')] }, 'direct')).toMatchObject({ applied: 1 });
    expect(document.text.endsWith('her sister was reading.')).toBe(true);
  });

  it('refuses a suggestion that would change a line break, and keeps its flag', async () => {
    const split: ProofreadFinding = { anchor: { quote: 'is reading' }, category: 'tense', replacement: 'was\nreading', explanation: 'Past tense.' };
    const { document, annotations, useCase, idOf, snapshot } = await flagged([split]);
    const outcome = await useCase.applyShown(snapshot(), { issueIds: [idOf('is reading')] }, 'direct');

    expect(outcome).toMatchObject({ kind: 'done', answer: 'none', applied: 0, refused: 1 });
    expect(document.applyCalls).toEqual([]);
    expect(annotations.flaggedText()).toEqual(['is reading']);
  });

  it('refuses when the document moved since the action was offered', async () => {
    const { document, useCase, idOf, snapshot } = await flagged();
    const offered = snapshot();
    document.edit([{ offset: 0, length: 0, text: 'Poor ' }]);

    expect(await useCase.applyShown(offered, { issueIds: [idOf('vrey')] }, 'direct')).toEqual({ kind: 'changed' });
    expect(document.applyCalls).toEqual([]);
  });

  it('waits its turn behind a run on the same document', async () => {
    const { useCase, target, idOf, snapshot, hold } = await flagged();
    const id = idOf('vrey');
    let release: (result: ProofreadRunResult) => void = () => undefined;
    hold(new Promise((resolve) => { release = resolve; }));
    const run = useCase.run(target(), { kind: 'proofread', output: 'flag' });

    expect(await useCase.applyShown(snapshot(), { issueIds: [id] }, 'direct')).toEqual({ kind: 'busy' });
    release({ kind: 'completed', chunks: [{ kind: 'read', findings: [], malformed: 0 }] });
    await run;
  });

  it('forgets a document\'s flags when they are cleared', async () => {
    const { useCase, idOf, snapshot, document } = await flagged();
    const id = idOf('vrey');
    useCase.clear(document.uri);

    expect(await useCase.applyShown(snapshot(), { issueIds: [id] }, 'direct')).toEqual({ kind: 'nothing' });
  });
});

describe('Replace with, when the writer fences the flag as it goes in (PR #172 F-01)', () => {
  it('writes nothing into the new code', async () => {
    const { document, useCase, idOf, snapshot } = await flagged();
    const id = idOf('vrey');
    document.host = writerTypes([{ offset: 0, length: 0, text: '```text\n' }, { offset: document.text.length, length: 0, text: '\n```' }]);
    const pending = useCase.applyShown(snapshot(), { issueIds: [id] }, 'direct');
    document.host = () => ({ kind: 'submitted' });

    expect(await pending).toMatchObject({ kind: 'done', answer: 'stale', applied: 0, refused: 1 });
    expect(document.text).toContain('get vrey tired');
    expect(document.applyCalls).toHaveLength(1);
  });
});

