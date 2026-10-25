/**
 * DraftEditApplier (ADR 2026-10-21 D4): refuses what it must, asks the host
 * once, and reads what landed from the document, never from the host's
 * answer. Text is public-domain *Alice*.
 */
import { DraftEditApplier, type DraftEditEdit } from '@/application/services/draftEdit/DraftEditApplier';
import {
  FakeDocuments,
  applyAll,
  applyMinimal,
  applyTicked,
  decline,
  writerTypes
} from '@/__tests__/application/services/draftEdit/fakeDocuments';

const TEXT = 'Alice was begining to get vrey tired of sitting by her sister.';
const PROOFREAD = { allowsNewlineChanges: false, preservesMarkdownStructure: true };

function edit(id: string, original: string, replacement: string, text = TEXT, from = 0): DraftEditEdit {
  const start = text.indexOf(original, from);
  if (start < 0) {
    throw new Error(`no ${original}`);
  }
  return { id, start, end: start + original.length, original, replacement, label: 'Proofread: spelling' };
}

const CELL = '| Note |\n| --- |\n| Alice wrote < Rabbit > here. |\n';
const BEGINING = edit('a', 'begining', 'beginning');
const VREY = edit('b', 'vrey', 'very');

function setup(host = applyAll, text = TEXT) {
  const documents = new FakeDocuments(text, undefined, 'markdown', 3, host);
  return { documents, applier: new DraftEditApplier(documents) };
}

describe('DraftEditApplier.apply', () => {
  it('makes every edit in one change, and reads each one as applied', async () => {
    const { documents, applier } = setup();
    const result = await applier.apply({ document: documents.snapshot(), edits: [VREY, BEGINING], review: 'preview', policy: PROOFREAD });

    expect(documents.applyCalls).toHaveLength(1);
    expect(documents.applyCalls[0]).toMatchObject({ expectedVersion: 3, review: 'preview' });
    expect(documents.applyCalls[0].edits.map((each) => each.newText)).toEqual(['beginning', 'very']);
    expect(result).toMatchObject({ outcome: 'submitted', applied: ['a', 'b'], notApplied: [], unknown: [], refused: [] });
    expect(result.settled?.snapshot.text).toBe('Alice was beginning to get very tired of sitting by her sister.');
    expect(result.settled?.edits).toHaveLength(1);
  });

  it('reads edits VS Code cut down to smaller ones as applied', async () => {
    const { documents, applier } = setup(applyMinimal);
    const result = await applier.apply({ document: documents.snapshot(), edits: [BEGINING, VREY], review: 'direct', policy: PROOFREAD });

    // The host inserted an "n" and turned "re" into "er"; the history gives them back as the edits they are.
    expect(result.settled?.edits[0]).toEqual([{ offset: 10, length: 8, text: 'beginning' }, { offset: 26, length: 4, text: 'very' }]);
    expect(result).toMatchObject({ outcome: 'submitted', applied: ['a', 'b'], unknown: [] });
  });

  it('reads the edits the writer left unticked as not applied, where they stand after', async () => {
    const { documents, applier } = setup(applyTicked((each) => each.newText === 'beginning'));
    const result = await applier.apply({ document: documents.snapshot(), edits: [BEGINING, VREY], review: 'preview', policy: PROOFREAD });
    const live = result.settled!.snapshot.text;

    expect(result).toMatchObject({ outcome: 'submitted', applied: ['a'], unknown: [] });
    expect(result.notApplied).toHaveLength(1);
    expect(live.slice(result.notApplied[0].start, result.notApplied[0].end)).toBe('vrey');
  });

  it('reads a discarded preview as nothing applied', async () => {
    const { documents, applier } = setup(decline);
    const result = await applier.apply({ document: documents.snapshot(), edits: [BEGINING, VREY], review: 'preview', policy: PROOFREAD });

    expect(result).toMatchObject({ outcome: 'declined', applied: [], unknown: [] });
    expect(result.notApplied.map((each) => [each.id, TEXT.slice(each.start, each.end)])).toEqual([['a', 'begining'], ['b', 'vrey']]);
  });

  it('never asks again after a review the writer edited through: what they touched is unknown, the rest still stands', async () => {
    // The writer rewrites inside `vrey` and adds a word at the start while the preview is open; VS Code refuses the review.
    const { documents, applier } = setup(writerTypes([
      { offset: 0, length: 0, text: 'Oh, ' },
      { offset: TEXT.indexOf('vrey') + 1, length: 2, text: 'ox' }
    ]));
    const result = await applier.apply({ document: documents.snapshot(), edits: [BEGINING, VREY], review: 'preview', policy: PROOFREAD });
    const live = result.settled!.snapshot.text;

    expect(documents.applyCalls).toHaveLength(1);
    expect(result).toMatchObject({ outcome: 'stale', applied: [], unknown: ['b'] });
    expect(result.notApplied.map((each) => live.slice(each.start, each.end))).toEqual(['begining']);
  });

  it('reads an edit the writer made by hand during review as applied, since its replacement stands there', async () => {
    const { documents, applier } = setup(writerTypes([{ offset: TEXT.indexOf('vrey') + 1, length: 2, text: 'er' }]));
    const result = await applier.apply({ document: documents.snapshot(), edits: [BEGINING, VREY], review: 'preview', policy: PROOFREAD });

    expect(result).toMatchObject({ outcome: 'stale', applied: ['b'], unknown: [] });
    expect(result.notApplied.map((each) => each.id)).toEqual(['a']);
  });

  it('follows a direct edit through what the writer typed as it went out, and asks once more', async () => {
    const { documents, applier } = setup(writerTypes([{ offset: 0, length: 0, text: 'Oh, ' }]));
    const pending = applier.apply({ document: documents.snapshot(), edits: [BEGINING, VREY], review: 'direct', policy: PROOFREAD });
    documents.host = applyAll; // the second ask finds the document still
    const result = await pending;

    expect(documents.applyCalls.map((call) => call.expectedVersion)).toEqual([3, 4]);
    expect(documents.applyCalls[1].edits.map((each) => [each.start, each.newText])).toEqual([[14, 'beginning'], [30, 'very']]);
    expect(result).toMatchObject({ outcome: 'submitted', applied: ['a', 'b'], unknown: [] });
    expect(result.settled?.snapshot.text).toBe('Oh, Alice was beginning to get very tired of sitting by her sister.');
    expect(result.settled?.edits).toHaveLength(2);
  });

  it('asks once more only for the edits the writer did not touch', async () => {
    const { documents, applier } = setup(writerTypes([{ offset: TEXT.indexOf('vrey'), length: 4, text: 'so' }]));
    const pending = applier.apply({ document: documents.snapshot(), edits: [BEGINING, VREY], review: 'direct', policy: PROOFREAD });
    documents.host = applyAll;
    const result = await pending;

    expect(documents.applyCalls[1].edits.map((each) => each.newText)).toEqual(['beginning']);
    expect(result).toMatchObject({ applied: ['a'], unknown: ['b'] });
  });

  it.each([
    ['its text is no longer the original', { ...VREY, original: 'very' }, 'changed', TEXT],
    ['it sits in code on the live text', edit('b', 'vrey', 'very', 'Alice was `vrey` tired.'), 'protected', 'Alice was `vrey` tired.'],
    ['it would change a line break', edit('b', 'vrey tired', 'very\ntired'), 'line-break', TEXT],
    ['it overlaps an earlier edit', edit('b', 'ing to', 'ing too'), 'overlapping', TEXT],
    ['it would make a tag of prose (PR #172 F-03)', edit('b', '< Rabbit >', '<Rabbit>', 'Alice wrote < Rabbit > here.'), 'markup', 'Alice wrote < Rabbit > here.'],
    ['it would make a tag in a table cell (F-03 re-review)', edit('b', '< Rabbit >', '<Rabbit>', CELL), 'markup', CELL]
  ])('refuses an edit when %s, and never sends it', async (_name, refusedEdit, reason, text) => {
    const { documents, applier } = setup(applyAll, text);
    const edits = text === TEXT ? [BEGINING, refusedEdit] : [refusedEdit];
    const result = await applier.apply({ document: documents.snapshot(), edits, review: 'direct', policy: PROOFREAD });

    expect(result.refused).toEqual([{ id: 'b', reason }]);
    expect(documents.applyCalls.flatMap((call) => call.edits).map((each) => each.newText)).not.toContain(refusedEdit.replacement);
  });

  it('asks the host nothing when every edit is refused', async () => {
    const { documents, applier } = setup();
    const result = await applier.apply({ document: documents.snapshot(), edits: [{ ...VREY, original: 'very' }], review: 'direct', policy: PROOFREAD });

    expect(documents.applyCalls).toEqual([]);
    expect(result).toMatchObject({ outcome: 'nothing', applied: [], refused: [{ id: 'b', reason: 'changed' }] });
  });

  it('allows a line-break change for a pass whose policy does', async () => {
    const { documents, applier } = setup();
    const result = await applier.apply({
      document: documents.snapshot(),
      edits: [edit('b', 'vrey tired', 'very\ntired')],
      review: 'direct',
      policy: { allowsNewlineChanges: true, preservesMarkdownStructure: true }
    });

    expect(result).toMatchObject({ applied: ['b'], refused: [] });
  });

  it('joins edits that touch into one, so each change the host makes is one edit\'s', async () => {
    const text = 'Alice said teh  word.';
    const teh = edit('a', 'teh', 'the', text);
    const spaces = edit('b', '  ', ' ', text);
    const { documents, applier } = setup(applyMinimal, text);
    const result = await applier.apply({ document: documents.snapshot(), edits: [teh, { ...spaces, label: 'Proofread: spacing' }], review: 'preview', policy: PROOFREAD });

    expect(documents.applyCalls[0].edits).toEqual([
      { start: 11, end: 16, newText: 'the ', label: 'Proofread: spelling · Proofread: spacing' }
    ]);
    expect(result).toMatchObject({ applied: ['a', 'b'] });
    expect(result.settled?.snapshot.text).toBe('Alice said the word.');
  });

  it('places each member of a joined edit that was not applied back on its own text', async () => {
    const text = 'Alice said teh  word.';
    const { documents, applier } = setup(decline, text);
    const result = await applier.apply({ document: documents.snapshot(), edits: [edit('a', 'teh', 'the', text), edit('b', '  ', ' ', text)], review: 'preview', policy: PROOFREAD });

    expect(result.notApplied.map((each) => [each.id, text.slice(each.start, each.end)])).toEqual([['a', 'teh'], ['b', '  ']]);
  });

  it('knows nothing of an edit whose document closed during review', async () => {
    const { documents, applier } = setup((_edits, _review, document) => {
      document.close();
      return { kind: 'declined' };
    });
    const result = await applier.apply({ document: documents.snapshot(), edits: [BEGINING, VREY], review: 'preview', policy: PROOFREAD });

    expect(result).toEqual({ outcome: 'closed', applied: [], notApplied: [], unknown: ['a', 'b'], refused: [] });
  });

  it('reports a direct edit the host refused, with its reason, leaving the text as it was', async () => {
    const { documents, applier } = setup(() => ({ kind: 'failed', message: 'The editor did not apply the change.' }));
    const result = await applier.apply({ document: documents.snapshot(), edits: [BEGINING], review: 'direct', policy: PROOFREAD });

    expect(result).toMatchObject({ outcome: 'failed', failure: 'The editor did not apply the change.', applied: [], notApplied: [{ id: 'a' }] });
  });

  it('refuses a document that moved before the edits were asked for', async () => {
    const { documents, applier } = setup();
    const document = documents.snapshot();
    documents.edit([{ offset: 0, length: 0, text: 'Oh, ' }]);
    const result = await applier.apply({ document, edits: [BEGINING], review: 'direct', policy: PROOFREAD });

    expect(documents.applyCalls).toEqual([]);
    expect(result).toEqual({ outcome: 'changed', applied: [], notApplied: [], unknown: ['a'], refused: [] });
  });
});

/**
 * PR #172 F-01: a direct apply the writer typed through is asked again only
 * after every rule is checked again against the document as it now stands:
 * the text it would fix may now be code, or a link's target.
 */
describe('DraftEditApplier.apply: the direct retry checks again', () => {
  const SENTENCE = 'Alice saw teh rabbit.';
  const TEH = edit('a', 'teh', 'the', SENTENCE);
  const at = SENTENCE.indexOf('teh');

  it.each([
    ['fences it as code', [{ offset: 0, length: 0, text: '```text\n' }, { offset: SENTENCE.length, length: 0, text: '\n```' }]],
    ['makes it inline code', [{ offset: at, length: 0, text: '`' }, { offset: at + 3, length: 0, text: '`' }]],
    ['makes it a link target', [{ offset: at, length: 0, text: '[x](' }, { offset: at + 3, length: 0, text: ')' }]]
  ])('refuses the retry when the writer %s as the edit goes out, and writes nothing', async (_name, typed) => {
    const { documents, applier } = setup(writerTypes(typed), SENTENCE);
    const pending = applier.apply({ document: documents.snapshot(), edits: [TEH], review: 'direct', policy: PROOFREAD });
    documents.host = applyAll;
    const result = await pending;
    const live = documents.text;

    expect(documents.applyCalls).toHaveLength(1);
    expect(live).toContain('teh');
    expect(result).toMatchObject({ outcome: 'stale', applied: [], notApplied: [], unknown: [], refused: [{ id: 'a', reason: 'protected' }] });
  });

  it('control: a harmless prefix is followed, checked, and asked once more', async () => {
    const { documents, applier } = setup(writerTypes([{ offset: 0, length: 0, text: 'Then ' }]), SENTENCE);
    const pending = applier.apply({ document: documents.snapshot(), edits: [TEH], review: 'direct', policy: PROOFREAD });
    documents.host = applyAll;

    expect(await pending).toMatchObject({ outcome: 'submitted', applied: ['a'], refused: [] });
    expect(documents.text).toBe('Then Alice saw the rabbit.');
  });

  it('control: a reviewed apply never asks again, so a fence the writer typed during review is left alone', async () => {
    const { documents, applier } = setup(writerTypes([{ offset: 0, length: 0, text: '```text\n' }, { offset: SENTENCE.length, length: 0, text: '\n```' }]), SENTENCE);
    const result = await applier.apply({ document: documents.snapshot(), edits: [TEH], review: 'preview', policy: PROOFREAD });

    expect(documents.applyCalls).toHaveLength(1);
    expect(documents.text).toContain('teh');
    expect(result).toMatchObject({ outcome: 'stale', applied: [], refused: [] });
  });
});

