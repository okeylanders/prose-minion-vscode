/**
 * PR #172 F-02 and F-06, through the production `VsCodeDocumentEditor`,
 * `VsCodeIssueAnnotator`, `DraftEditApplier` and `DraftEditUseCase`, on the
 * controlled VS Code of `refactorPreviewHost.ts`:
 * - F-02: a held review is discarded, best effort, when its document's
 *   lifetime ends. The writer accepted the gap that leaves; one case pins it.
 * - F-06: the discard never ends a preview the review does not own: another
 *   extension's, or another chapter's, shown while this review waits to
 *   replace it.
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
import { REFACTOR_PREVIEW_DISCARD_COMMAND, VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';
import { VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';
import { reviewHarness, type FakeDocument } from '@app/__tests__/platform/vscode/refactorPreviewHost';

type Finding = { anchor: { quote: string }; category: 'spelling' | 'tense'; replacement: string; explanation: string };

const { host, commands, openDocument, write, writerApplies, changeLanguage, asked, reset } = reviewHarness(vscode);
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

/** Another extension's preview, of a file Proofread never touches, holding the pane. */
function anotherExtensionsPreview(): { settled(): boolean } {
  let settled = false;
  void host.pane.request({ files: [NOTES], replacements: [] }).then(() => {
    settled = true;
  });
  return { settled: () => settled };
}

describe('A held review is discarded, best effort, when its document\'s lifetime ends (PR #172 F-02)', () => {
  it('writes nothing when Markdown becomes JavaScript during review, even if the writer then presses Apply', async () => {
    const document = openDocument(TEXT, 'markdown');
    const run = proofreader().fix(document);
    await asked();

    changeLanguage(document, 'javascript');
    const pressed = writerApplies(document);

    await expect(run).resolves.toMatchObject({ kind: 'closed' });
    expect(document.text).toBe(TEXT);
    expect(pressed).toBe(false);
    expect(commands.executeCommand).toHaveBeenCalledWith(REFACTOR_PREVIEW_DISCARD_COMMAND);
    expect(flaggedText(document)).toEqual([]);
  });

  describe('plain text whose fence becomes code when it turns Markdown', () => {
    const fenced = '~~~text\nAlice saw teh rabbit.\n~~~\n';
    const teh: Finding = { anchor: { quote: 'teh' }, category: 'spelling', replacement: 'the', explanation: 'A typo.' };

    it('writes nothing into the fence', async () => {
      const document = openDocument(fenced, 'plaintext');
      const run = proofreader([teh]).fix(document);
      await asked();

      changeLanguage(document, 'markdown');
      const pressed = writerApplies(document);

      await expect(run).resolves.toMatchObject({ kind: 'closed' });
      expect(document.text).toBe(fenced);
      expect(pressed).toBe(false);
    });

    it('control: with no language change, the writer\'s Apply writes the fix', async () => {
      const document = openDocument(fenced, 'plaintext');
      const run = proofreader([teh]).fix(document);
      await asked();

      expect(writerApplies(document)).toBe(true);

      await expect(run).resolves.toMatchObject({ kind: 'completed', fix: { answer: 'submitted', applied: 1 } });
      expect(document.text).toBe('~~~text\nAlice saw the rabbit.\n~~~\n');
      expect(commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  it('writes nothing when the document closes during review', async () => {
    const document = openDocument(TEXT, 'markdown');
    const run = proofreader().fix(document);
    await asked();

    document.isClosed = true;
    host.closes.fire(document);
    const pressed = writerApplies(document);

    await expect(run).resolves.toMatchObject({ kind: 'closed' });
    expect(document.text).toBe(TEXT);
    expect(pressed).toBe(false);
  });

  it('writes nothing through Fix all when the language changes during its review', async () => {
    const document = openDocument(TEXT, 'markdown');
    const proofread = proofreader();
    await expect(proofread.flag(document)).resolves.toMatchObject({ kind: 'completed', flagged: 3 });
    const fixAll = proofread.fixAll(document);
    await asked();

    changeLanguage(document, 'javascript');
    const pressed = writerApplies(document);

    await expect(fixAll).resolves.toEqual({ kind: 'closed' });
    expect(document.text).toBe(TEXT);
    expect(pressed).toBe(false);
  });

  it('the stated limit: an Apply that lands before the close event reaches the extension host is reported closed, with nothing shown', async () => {
    const document = openDocument(TEXT, 'markdown');
    const run = proofreader().fix(document);
    const shown = await asked();

    // In VS Code the language changed, then the writer pressed Apply, before the extension host heard of the change:
    // the pane is already free when the discard arrives.
    host.pane.current = undefined;
    shown.done = true;
    changeLanguage(document, 'javascript');
    write(document, shown.edit);
    host.pane.release(shown);
    shown.settle(true);

    await expect(run).resolves.toMatchObject({ kind: 'closed' });
    expect(document.text).toBe(FIXED);
    expect(flaggedText(document)).toEqual([]);
  });
});

describe('The discard never ends a preview the review does not own (PR #172 F-06)', () => {
  it('leaves another extension\'s preview, shown while the review waits to replace it, when the review\'s document changes language', async () => {
    const theirs = anotherExtensionsPreview();
    const document = openDocument(TEXT, 'markdown');
    const run = proofreader().fix(document);
    await asked('waiting');

    changeLanguage(document, 'javascript');

    expect(commands.executeCommand).not.toHaveBeenCalled();
    expect(host.pane.current?.edit.files).toEqual([NOTES]);
    host.pane.refuse(); // The writer keeps the preview shown.
    await expect(run).resolves.toMatchObject({ kind: 'closed' });
    expect(theirs.settled()).toBe(false);
    expect(document.text).toBe(TEXT);
  });

  it('leaves another chapter\'s review shown, and its fixes still go in when the writer applies them', async () => {
    const first = openDocument(TEXT, 'markdown');
    const second = openDocument(TEXT, 'markdown', SECOND);
    const proofread = proofreader();
    const firstRun = proofread.fix(first);
    await asked();
    const secondRun = proofread.fix(second);
    await asked('waiting');

    changeLanguage(second, 'javascript');

    expect(commands.executeCommand).not.toHaveBeenCalled();
    host.pane.refuse();
    await expect(secondRun).resolves.toMatchObject({ kind: 'closed' });
    expect(writerApplies(first)).toBe(true);
    await expect(firstRun).resolves.toMatchObject({ kind: 'completed', fix: { answer: 'submitted', applied: 2 } });
    expect([first.text, second.text]).toEqual([FIXED, TEXT]);
  });

  it('discards the review as its preview opens, if the writer then lets it replace the one shown', async () => {
    const theirs = anotherExtensionsPreview();
    const document = openDocument(TEXT, 'markdown');
    const run = proofreader().fix(document);
    await asked('waiting');
    changeLanguage(document, 'javascript');

    host.pane.replace(); // The writer chose to replace theirs; ours then holds the pane, for a lifetime that has ended.
    const pressed = writerApplies(document);

    await expect(run).resolves.toMatchObject({ kind: 'closed' });
    expect(commands.executeCommand).toHaveBeenCalledTimes(1);
    expect(pressed).toBe(false);
    expect(document.text).toBe(TEXT);
    expect(theirs.settled()).toBe(true);
  });
});
