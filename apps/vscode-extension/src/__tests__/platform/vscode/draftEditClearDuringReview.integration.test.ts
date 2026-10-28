/**
 * PR #172 F-05, through the production `VsCodeDocumentEditor`,
 * `VsCodeIssueAnnotator`, `DraftEditApplier` and `DraftEditUseCase`, on the
 * controlled VS Code of `refactorPreviewHost.ts`: a Clear made while a Fix
 * all is held in review stays cleared when the writer applies it, in that
 * document and no other.
 *
 * Text is public-domain *Alice*; nothing reaches a provider.
 */

jest.mock('vscode', () => jest.requireActual('@app/__tests__/platform/vscode/refactorPreviewHost').createVsCodeDouble(), { virtual: true });

/* eslint-disable @typescript-eslint/naming-convention -- the mocked barrel's exports. */
jest.mock('@prose-minion/core', () => ({
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  shiftRanges: jest.requireActual('@/utils/draftEdit/shiftRanges').shiftRanges,
  DraftEditUseCase: jest.requireActual('@/application/services/draftEdit/DraftEditUseCase').DraftEditUseCase,
  DraftEditApplier: jest.requireActual('@/application/services/draftEdit/DraftEditApplier').DraftEditApplier
}));
/* eslint-enable @typescript-eslint/naming-convention */

import * as vscode from 'vscode';
import { DraftEditApplier, DraftEditUseCase } from '@prose-minion/core';
import { VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';
import { VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';
import { reviewHarness, type FakeDocument } from '@app/__tests__/platform/vscode/refactorPreviewHost';

/** A Proofread gesture begun and run at once, as one with nothing to confirm runs (PR #183 F-02). */
function proofreadNow(useCase: DraftEditUseCase, ...[target, pass]: Parameters<DraftEditUseCase['begin']>): ReturnType<DraftEditUseCase['run']> {
  const begun = useCase.begin(target, pass);
  return begun.kind === 'gesture' ? useCase.run(begun.gesture) : Promise.resolve(begun);
}

const { host, openDocument, writerApplies, asked, reset } = reviewHarness(vscode);
const TEXT = 'Alice was begining to get vrey tired of sitting by her sister, who is reading.';
const OTHER = 'file:///workspace/chapter-02.md';
const FINDINGS = [
  { anchor: { quote: 'begining' }, category: 'spelling' as const, replacement: 'beginning', explanation: 'A typo.' },
  { anchor: { quote: 'vrey' }, category: 'spelling' as const, replacement: 'very', explanation: 'A typo.' },
  { anchor: { quote: 'is reading' }, category: 'tense' as const, replacement: 'was reading', explanation: 'Past tense.' }
];

const disposers: Array<() => void> = [];
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  reset();
});

const log = () => ({ appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });

/** One use case and annotator, as the extension has, with two chapters flagged and the first's Fix all held in review. */
async function twoFlaggedChapters() {
  const first = openDocument(TEXT, 'markdown');
  const second = openDocument(TEXT, 'markdown', OTHER);
  const pass = { proofread: jest.fn(async () => ({ kind: 'completed' as const, chunks: [{ kind: 'read' as const, findings: FINDINGS, malformed: 0 }] })) };
  const documentEditor = new VsCodeDocumentEditor(log());
  const annotator = new VsCodeIssueAnnotator({ dismiss: 'dismiss', clear: 'clear', replace: 'replace', fixAll: 'fixAll' });
  const useCase = new DraftEditUseCase(pass, documentEditor, annotator, new DraftEditApplier(documentEditor), log());
  disposers.push(() => {
    documentEditor.dispose();
    annotator.dispose();
  });
  const snapshot = (document: FakeDocument) => ({ uri: document.uri.toString(), version: document.version, text: document.getText(), languageId: 'markdown' });
  for (const document of [first, second]) {
    await proofreadNow(useCase, { ...snapshot(document), relativePath: 'chapter.md' }, { kind: 'proofread', output: 'flag' });
  }
  const flags = (document: FakeDocument) =>
    (host.diagnostics.get(document.uri.toString()) as Array<{ range: { start: { offset: number }; end: { offset: number } } }> | undefined ?? [])
      .map((diagnostic) => document.text.slice(diagnostic.range.start.offset, diagnostic.range.end.offset));
  expect([flags(first), flags(second)]).toEqual([['begining', 'vrey', 'is reading'], ['begining', 'vrey', 'is reading']]);
  const fixAll = useCase.applyShown(snapshot(first), 'all-fixes', 'preview');
  await asked();
  return { first, second, useCase, fixAll, flags };
}

describe('A Clear while a Fix all is held in review stays cleared (PR #172 F-05)', () => {
  it('keeps the first chapter cleared, and leaves the other chapter\'s flags alone', async () => {
    const { first, second, useCase, fixAll, flags } = await twoFlaggedChapters();

    useCase.clear(first.uri.toString());
    expect(writerApplies(first)).toBe(true);

    await expect(fixAll).resolves.toMatchObject({ kind: 'done', applied: 2 });
    expect(flags(first)).toEqual([]);
    expect(flags(second)).toEqual(['begining', 'vrey', 'is reading']);
  });

  it('keeps every chapter cleared by Clear all', async () => {
    const { first, second, useCase, fixAll, flags } = await twoFlaggedChapters();

    useCase.clear();
    expect(writerApplies(first)).toBe(true);

    await expect(fixAll).resolves.toMatchObject({ kind: 'done', applied: 2 });
    expect([flags(first), flags(second)]).toEqual([[], []]);
  });

  it('control: clearing the other chapter still shows the first one\'s untouched flag again', async () => {
    const { first, second, useCase, fixAll, flags } = await twoFlaggedChapters();

    useCase.clear(OTHER);
    expect(writerApplies(first)).toBe(true);

    await expect(fixAll).resolves.toMatchObject({ kind: 'done', applied: 2 });
    expect(flags(first)).toEqual(['is reading']);
    expect(flags(second)).toEqual([]);
  });
});
