/**
 * A selection run replaces only its own flags (Draft Edit Slice 3; ADR
 * 2026-10-21 D7, amended 2026-10-26), through the production
 * `VsCodeIssueAnnotator`, `VsCodeDocumentEditor`, `DraftEditApplier` and
 * `DraftEditUseCase`, on the controlled VS Code of `refactorPreviewHost.ts`.
 * The diagnostics outside the selection stay on their text while the writer
 * types during the run; those inside it are replaced.
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

type Finding = { anchor: { quote: string }; category: 'spelling' | 'tense'; replacement: string; explanation: string };
type Reply = { kind: 'completed'; chunks: Array<{ kind: 'read'; findings: Finding[]; malformed: number }> };

const { host, openDocument, write, reset } = reviewHarness(vscode);
const TEXT = 'Alice was begining to get vrey tired of sitting by her sister, who is reading.';
const FINDINGS: Finding[] = [
  { anchor: { quote: 'begining' }, category: 'spelling', replacement: 'beginning', explanation: 'A typo.' },
  { anchor: { quote: 'vrey' }, category: 'spelling', replacement: 'very', explanation: 'A typo.' },
  { anchor: { quote: 'is reading' }, category: 'tense', replacement: 'was reading', explanation: 'Past tense.' }
];

const disposers: Array<() => void> = [];
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  reset();
});

const read = (findings: Finding[]): Reply => ({ kind: 'completed', chunks: [{ kind: 'read', findings, malformed: 0 }] });

const flaggedText = (document: FakeDocument) =>
  (host.diagnostics.get(document.uri.toString()) as Array<{ range: { start: { offset: number }; end: { offset: number } } }> | undefined ?? [])
    .map((diagnostic) => document.text.slice(diagnostic.range.start.offset, diagnostic.range.end.offset));

describe('A selection run through the production adapters (Slice 3)', () => {
  it('keeps the diagnostics outside the selection where the writer\'s typing moved them, and replaces those inside', async () => {
    const replies: Array<Reply | Promise<Reply>> = [read(FINDINGS)];
    const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    const documentEditor = new VsCodeDocumentEditor(log);
    const annotator = new VsCodeIssueAnnotator({ dismiss: 'dismiss', clear: 'clear', replace: 'replace', fixAll: 'fixAll' });
    const useCase = new DraftEditUseCase({ proofread: jest.fn(async () => replies.shift()!) }, documentEditor, annotator, new DraftEditApplier(documentEditor), log);
    disposers.push(() => {
      documentEditor.dispose();
      annotator.dispose();
    });
    const document = openDocument(TEXT, 'markdown');
    const target = (range?: { start: number; end: number }) => ({
      uri: document.uri.toString(), version: document.version, text: document.getText(), languageId: 'markdown', relativePath: 'chapter.md',
      ...(range ? { range } : {})
    });
    await proofreadNow(useCase, target(), { kind: 'proofread', output: 'flag' });
    expect(flaggedText(document)).toEqual(['begining', 'vrey', 'is reading']);

    let answer!: (reply: Reply) => void;
    replies.push(new Promise<Reply>((settle) => {
      answer = settle;
    }));
    const run = proofreadNow(useCase, target({ start: TEXT.indexOf('who is reading'), end: TEXT.length }), { kind: 'proofread', output: 'flag' });
    write(document, { files: [], replacements: [{ range: { start: { offset: 0 }, end: { offset: 0 } }, newText: 'Poor ' }] });
    answer(read([]));

    await expect(run).resolves.toMatchObject({ kind: 'completed', flagged: 0, kept: 2 });
    expect(document.text.startsWith('Poor Alice')).toBe(true);
    expect(flaggedText(document)).toEqual(['begining', 'vrey']);
  });
});
