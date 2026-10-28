/**
 * Proofread and Fix through the production `VsCodeDocumentEditor`,
 * `VsCodeIssueAnnotator`, `DraftEditApplier` and `DraftEditUseCase` (Draft
 * Edit Slice 2). VS Code is a controlled double whose `workspace.applyEdit`
 * changes the document and fires its change event as VS Code does; what it
 * answers in each case was read from VS Code's source (the ADR's Slice 2
 * amendment). Text is public-domain *Alice*; nothing reaches a provider.
 */

/* eslint-disable @typescript-eslint/naming-convention -- the double mirrors VS Code's own API names, and the mocked barrel's exports. */
jest.mock('vscode', () => {
  type Listener = (event: unknown) => void;
  const emitter = () => {
    const listeners = new Set<Listener>();
    return {
      event: (listener: Listener) => {
        listeners.add(listener);
        return { dispose: () => listeners.delete(listener) };
      },
      fire: (event: unknown) => listeners.forEach((listener) => listener(event))
    };
  };
  const changes = emitter();
  const closes = emitter();
  const diagnostics = new Map<string, unknown[]>();
  class Range {
    constructor(readonly start: { offset: number }, readonly end: { offset: number }) {}
  }
  class Diagnostic {
    source?: string;
    code?: unknown;
    constructor(readonly range: Range, readonly message: string, readonly severity: number) {}
  }
  class WorkspaceEdit {
    readonly replacements: Array<{ range: Range; newText: string; metadata?: { needsConfirmation?: boolean } }> = [];
    replace(_uri: unknown, range: Range, newText: string, metadata?: { needsConfirmation?: boolean }): void {
      this.replacements.push({ range, newText, ...(metadata ? { metadata } : {}) });
    }
  }
  return {
    workspace: {
      textDocuments: [] as unknown[],
      onDidChangeTextDocument: changes.event,
      onDidCloseTextDocument: closes.event,
      applyEdit: jest.fn()
    },
    languages: {
      createDiagnosticCollection: () => ({
        set: (uri: unknown, list: unknown[]) => diagnostics.set(String(uri), list),
        delete: (uri: unknown) => diagnostics.delete(String(uri)),
        clear: () => diagnostics.clear(),
        dispose: () => diagnostics.clear()
      }),
      registerCodeActionsProvider: () => ({ dispose: () => undefined })
    },
    Uri: { parse: (value: string) => ({ toString: () => value }) },
    Range,
    Diagnostic,
    WorkspaceEdit,
    DiagnosticSeverity: { Warning: 1, Information: 2 },
    CodeActionKind: { QuickFix: 'quickfix' },
    CodeAction: class {},
    mockHost: { changes, closes, diagnostics }
  };
}, { virtual: true });

jest.mock('@prose-minion/core', () => ({
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  shiftRanges: jest.requireActual('@/utils/draftEdit/shiftRanges').shiftRanges,
  DraftEditUseCase: jest.requireActual('@/application/services/draftEdit/DraftEditUseCase').DraftEditUseCase,
  DraftEditApplier: jest.requireActual('@/application/services/draftEdit/DraftEditApplier').DraftEditApplier
}));

import * as vscode from 'vscode';
import { DraftEditApplier, DraftEditUseCase, type DraftEditOutcome } from '@prose-minion/core';
import { VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';
import { VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';

/** A Proofread gesture begun and run at once, as one with nothing to confirm runs (PR #183 F-02). */
function proofreadNow(useCase: DraftEditUseCase, ...[target, pass]: Parameters<DraftEditUseCase['begin']>): ReturnType<DraftEditUseCase['run']> {
  const begun = useCase.begin(target, pass);
  return begun.kind === 'gesture' ? useCase.run(begun.gesture) : Promise.resolve(begun);
}

interface MockHost {
  changes: { fire(event: unknown): void };
  diagnostics: Map<string, Array<{ range: { start: { offset: number }; end: { offset: number } } }>>;
}
interface RecordedEdit {
  replacements: Array<{ range: { start: { offset: number }; end: { offset: number } }; newText: string; metadata?: { needsConfirmation?: boolean } }>;
}

const host = (vscode as unknown as { mockHost: MockHost }).mockHost;
const workspace = vscode.workspace as unknown as { textDocuments: FakeDocument[]; applyEdit: jest.Mock };
const URI = 'file:///workspace/chapter-01.md';
const TEXT = 'Alice was begining to get vrey tired of sitting by her sister, who is reading.';

interface FakeDocument {
  uri: { toString(): string };
  version: number;
  languageId: string;
  isClosed: boolean;
  text: string;
  getText(): string;
  positionAt(offset: number): { offset: number };
  offsetAt(position: { offset: number }): number;
}

function openDocument(): FakeDocument {
  const document: FakeDocument = {
    uri: { toString: () => URI },
    version: 1,
    languageId: 'markdown',
    isClosed: false,
    text: TEXT,
    getText: () => document.text,
    positionAt: (offset) => ({ offset }),
    offsetAt: (position) => position.offset
  };
  workspace.textDocuments.push(document);
  return document;
}

/** One change event, its changes in offsets of the text before it, as VS Code fires it. */
function change(document: FakeDocument, changes: Array<{ offset: number; length: number; text: string }>): void {
  for (const each of [...changes].sort((a, b) => b.offset - a.offset)) {
    document.text = document.text.slice(0, each.offset) + each.text + document.text.slice(each.offset + each.length);
  }
  document.version += 1;
  host.changes.fire({ document, contentChanges: changes.map((each) => ({ rangeOffset: each.offset, rangeLength: each.length, text: each.text })) });
}

/** VS Code applying the ticked entries of a `WorkspaceEdit` as one change. */
function apply(document: FakeDocument, edit: RecordedEdit, ticked: (newText: string) => boolean = () => true): boolean {
  const kept = edit.replacements.filter((each) => ticked(each.newText));
  if (kept.length === 0) {
    return false;
  }
  change(document, kept.map((each) => ({ offset: each.range.start.offset, length: each.range.end.offset - each.range.start.offset, text: each.newText })));
  return true;
}

const FINDINGS = [
  { anchor: { quote: 'begining' }, category: 'spelling' as const, replacement: 'beginning', explanation: 'A typo.' },
  { anchor: { quote: 'vrey' }, category: 'spelling' as const, replacement: 'very', explanation: 'A typo.' },
  { anchor: { quote: 'is reading' }, category: 'tense' as const, replacement: 'was reading', explanation: 'Past tense.' }
];

function proofreadAndFix(document: FakeDocument, review: 'preview' | 'direct'): { run: Promise<DraftEditOutcome>; dispose(): void } {
  const pass = { proofread: jest.fn(async () => ({ kind: 'completed' as const, chunks: [{ kind: 'read' as const, findings: FINDINGS, malformed: 0 }] })) };
  const documentEditor = new VsCodeDocumentEditor({ appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });
  const annotator = new VsCodeIssueAnnotator({ dismiss: 'dismiss', clear: 'clear', replace: 'replace', fixAll: 'fixAll' });
  const useCase = new DraftEditUseCase(pass, documentEditor, annotator, new DraftEditApplier(documentEditor), { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });
  const run = proofreadNow(
    useCase,
    { uri: URI, version: document.version, text: document.getText(), languageId: 'markdown', relativePath: 'chapter-01.md' },
    { kind: 'proofread', output: 'fix', review }
  );
  return { run, dispose: () => { documentEditor.dispose(); annotator.dispose(); } };
}

const flaggedText = (document: FakeDocument) =>
  (host.diagnostics.get(URI) ?? []).map((diagnostic) => document.text.slice(diagnostic.range.start.offset, diagnostic.range.end.offset));

describe('Proofread and Fix through the VS Code adapters (Draft Edit Slice 2)', () => {
  const disposers: Array<() => void> = [];
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
    workspace.textDocuments.splice(0);
    workspace.applyEdit.mockReset();
    host.diagnostics.clear();
  });

  it('applies the fixes directly as one change, and flags the judgment call where it stands after', async () => {
    const document = openDocument();
    workspace.applyEdit.mockImplementation(async (edit: RecordedEdit) => apply(document, edit));
    const fix = proofreadAndFix(document, 'direct');
    disposers.push(fix.dispose);

    await expect(fix.run).resolves.toMatchObject({ kind: 'completed', flagged: 1, fix: { answer: 'submitted', applied: 2 } });
    expect(workspace.applyEdit).toHaveBeenCalledTimes(1);
    expect(document.text).toBe('Alice was beginning to get very tired of sitting by her sister, who is reading.');
    expect(flaggedText(document)).toEqual(['is reading']);
  });

  it('marks every fix for review, and flags the one the writer left unticked', async () => {
    const document = openDocument();
    workspace.applyEdit.mockImplementation(async (edit: RecordedEdit) => apply(document, edit, (newText) => newText === 'very'));
    const fix = proofreadAndFix(document, 'preview');
    disposers.push(fix.dispose);

    await expect(fix.run).resolves.toMatchObject({ fix: { answer: 'submitted', applied: 1, notApplied: 1 } });
    const sent = workspace.applyEdit.mock.calls[0][0] as RecordedEdit;
    expect(sent.replacements.every((each) => each.metadata?.needsConfirmation === true)).toBe(true);
    expect(flaggedText(document)).toEqual(['begining', 'is reading']);
  });

  it('flags every fix when the preview is discarded', async () => {
    const document = openDocument();
    workspace.applyEdit.mockResolvedValue(false);
    const fix = proofreadAndFix(document, 'preview');
    disposers.push(fix.dispose);

    await expect(fix.run).resolves.toMatchObject({ fix: { answer: 'declined', notApplied: 2 } });
    expect(document.text).toBe(TEXT);
    expect(flaggedText(document)).toEqual(['begining', 'vrey', 'is reading']);
  });

  it('flags the fixes after the writer typed during review and VS Code refused it', async () => {
    const document = openDocument();
    workspace.applyEdit.mockImplementation(async () => {
      change(document, [{ offset: 0, length: 0, text: 'Poor ' }]);
      return false; // "Cannot apply refactoring because 'chapter-01.md' has changed in the meantime."
    });
    const fix = proofreadAndFix(document, 'preview');
    disposers.push(fix.dispose);

    await expect(fix.run).resolves.toMatchObject({ fix: { answer: 'stale', applied: 0, notApplied: 2 } });
    expect(flaggedText(document)).toEqual(['begining', 'vrey', 'is reading']);
  });
});
