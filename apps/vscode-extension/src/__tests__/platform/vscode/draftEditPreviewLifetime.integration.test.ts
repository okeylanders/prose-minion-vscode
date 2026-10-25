/**
 * PR #172 F-02 and F-06, through the production `VsCodeDocumentEditor`,
 * `VsCodeIssueAnnotator`, `DraftEditApplier` and `DraftEditUseCase`, on the
 * controlled VS Code of `refactorPreviewHost.ts`:
 * - F-02, the writer's accepted limit: VS Code's preview commits inside
 *   `applyEdit`, so an Apply after a close or a language change during
 *   review still writes. The run then reports the document closed and
 *   shows nothing, and the writer is asked to check a quick fix's file.
 * - F-06: nothing ends a preview on the writer's behalf. VS Code's Discard
 *   ends whichever preview is shown, and no public API ties a preview to
 *   the request that opened it, so Draft Edit sends no command at all.
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
import { DraftEditApplier, DraftEditUseCase, type DraftEditOutcome, type DraftEditQuickFixOutcome } from '@prose-minion/core';
import { VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';
import { VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';
import { reviewHarness, type FakeDocument } from '@app/__tests__/platform/vscode/refactorPreviewHost';

type Finding = { anchor: { quote: string }; category: 'spelling' | 'tense'; replacement: string; explanation: string };

const { host, commands, openDocument, writerApplies, changeLanguage, asked, reset } = reviewHarness(vscode);
const TEXT = 'Alice was begining to get vrey tired of sitting by her sister, who is reading.';
const FIXED = 'Alice was beginning to get very tired of sitting by her sister, who is reading.';
const SECOND = 'file:///workspace/chapter-02.md';
const NOTES = 'file:///workspace/notes.md';
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

const log = () => ({ appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });

/** One use case and annotator, as the extension has. */
function proofreader(findings: Finding[] = FINDINGS) {
  const pass = { proofread: jest.fn(async () => ({ kind: 'completed' as const, chunks: [{ kind: 'read' as const, findings, malformed: 0 }] })) };
  const documentEditor = new VsCodeDocumentEditor(log());
  const annotator = new VsCodeIssueAnnotator({ dismiss: 'dismiss', clear: 'clear', replace: 'replace', fixAll: 'fixAll' });
  const useCase = new DraftEditUseCase(pass, documentEditor, annotator, new DraftEditApplier(documentEditor), log());
  disposers.push(() => {
    documentEditor.dispose();
    annotator.dispose();
  });
  const snapshot = (document: FakeDocument) => ({ uri: document.uri.toString(), version: document.version, text: document.getText(), languageId: document.languageId });
  return {
    fix: (document: FakeDocument): Promise<DraftEditOutcome> =>
      useCase.run({ ...snapshot(document), relativePath: 'chapter.md' }, { kind: 'proofread', output: 'fix', review: 'preview' }),
    flag: (document: FakeDocument): Promise<DraftEditOutcome> =>
      useCase.run({ ...snapshot(document), relativePath: 'chapter.md' }, { kind: 'proofread', output: 'flag' }),
    fixAll: (document: FakeDocument): Promise<DraftEditQuickFixOutcome> => useCase.applyShown(snapshot(document), 'all-fixes', 'preview')
  };
}

const flaggedText = (document: FakeDocument) =>
  (host.diagnostics.get(document.uri.toString()) as Array<{ range: { start: { offset: number }; end: { offset: number } } }> | undefined ?? [])
    .map((diagnostic) => document.text.slice(diagnostic.range.start.offset, diagnostic.range.end.offset));

/** Another extension's preview holding the pane: of a file Proofread never touches, unless told. */
function anotherExtensionsPreview(file = NOTES): { settled(): boolean } {
  let settled = false;
  void host.pane.request({ files: [file], replacements: [] }).then(() => {
    settled = true;
  });
  return { settled: () => settled };
}

describe('The accepted limit: an Apply after the document\'s lifetime ends during review still writes (PR #172 F-02)', () => {
  it('writes the fixes when Markdown becomes JavaScript during review and the writer then presses Apply, and shows nothing', async () => {
    const document = openDocument(TEXT, 'markdown');
    const run = proofreader().fix(document);
    await asked();

    changeLanguage(document, 'javascript');
    expect(writerApplies(document)).toBe(true);

    await expect(run).resolves.toMatchObject({ kind: 'closed' });
    expect(document.text).toBe(FIXED);
    expect(flaggedText(document)).toEqual([]);
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('reports a Fix all whose document changed language during review as closed', async () => {
    const document = openDocument(TEXT, 'markdown');
    const proofread = proofreader();
    await expect(proofread.flag(document)).resolves.toMatchObject({ kind: 'completed', flagged: 3 });
    const fixAll = proofread.fixAll(document);
    await asked();

    changeLanguage(document, 'javascript');
    expect(writerApplies(document)).toBe(true);

    await expect(fixAll).resolves.toEqual({ kind: 'closed' });
    expect(document.text).toBe(FIXED);
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('control: with no change, the writer\'s Apply writes the fixes and the tense flag stays on its text', async () => {
    const document = openDocument(TEXT, 'markdown');
    const run = proofreader().fix(document);
    await asked();

    expect(writerApplies(document)).toBe(true);

    await expect(run).resolves.toMatchObject({ kind: 'completed', fix: { answer: 'submitted', applied: 2 } });
    expect(flaggedText(document)).toEqual(['is reading']);
  });
});

describe('Nothing ends a preview on the writer\'s behalf (PR #172 F-06)', () => {
  it('leaves another extension\'s preview shown while the review waits, and the writer\'s refusal leaves the review closed', async () => {
    const theirs = anotherExtensionsPreview();
    const document = openDocument(TEXT, 'markdown');
    const run = proofreader().fix(document);
    await asked('waiting');

    changeLanguage(document, 'javascript');
    host.pane.refuse();

    await expect(run).resolves.toMatchObject({ kind: 'closed' });
    expect(commands.executeCommand).not.toHaveBeenCalled();
    expect(host.pane.current?.edit.files).toEqual([NOTES]);
    expect(theirs.settled()).toBe(false);
    expect(document.text).toBe(TEXT);
  });

  it.each(['before', 'after'])(
    'leaves another extension\'s preview of the same document, whose copy arrives late, when the review\'s document changes language %s it (the re-review\'s witness)',
    async (order) => {
      const document = openDocument(TEXT, 'markdown');
      const theirs = anotherExtensionsPreview(document.uri.toString());
      const run = proofreader().fix(document);
      await asked('waiting');
      const theirCopy = () => host.opens.fire({
        uri: { scheme: 'vscode-bulkeditpreview', authority: 'theirs', query: document.uri.toString(), toString: () => 'vscode-bulkeditpreview://theirs/x' }
      });

      if (order === 'before') {
        changeLanguage(document, 'javascript');
        theirCopy();
      } else {
        theirCopy();
        changeLanguage(document, 'javascript');
      }
      host.pane.refuse();

      await expect(run).resolves.toMatchObject({ kind: 'closed' });
      expect(commands.executeCommand).not.toHaveBeenCalled();
      expect(theirs.settled()).toBe(false);
      expect(document.text).toBe(TEXT);
    }
  );

  it('leaves another chapter\'s review shown, and its fixes still go in when the writer applies them', async () => {
    const first = openDocument(TEXT, 'markdown');
    const second = openDocument(TEXT, 'markdown', SECOND);
    const proofread = proofreader();
    const firstRun = proofread.fix(first);
    await asked();
    const secondRun = proofread.fix(second);
    await asked('waiting');

    changeLanguage(second, 'javascript');
    host.pane.refuse();

    await expect(secondRun).resolves.toMatchObject({ kind: 'closed' });
    expect(writerApplies(first)).toBe(true);
    await expect(firstRun).resolves.toMatchObject({ kind: 'completed', fix: { answer: 'submitted', applied: 2 } });
    expect([first.text, second.text]).toEqual([FIXED, TEXT]);
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });
});
