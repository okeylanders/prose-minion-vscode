/**
 * PR #172 F-02, through the production `VsCodeDocumentEditor`,
 * `VsCodeIssueAnnotator`, `DraftEditApplier` and `DraftEditUseCase`: a review
 * belongs to one lifetime of its document.
 *
 * VS Code is a controlled double built from its source (1.82.0 and main):
 * - Refactor Preview holds `workspace.applyEdit` until the writer acts. Apply
 *   writes the ticked entries if the document's version has not moved; a
 *   language change does not move it.
 * - A language change fires the document's close event (then open), leaving
 *   the same document open (`extHostDocuments.$acceptModelLanguageChanged`).
 * - `refactorPreview.discard` settles a held preview with nothing applied
 *   (`BulkEditPane.discard`), and does nothing when none is held.
 *
 * Text is public-domain *Alice*; nothing reaches a provider.
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
  let session: { edit: unknown; settle: (applied: boolean) => void; done: boolean } | undefined;
  const preview = {
    hold: (edit: unknown) => new Promise<boolean>((settle) => {
      session = { edit, settle, done: false };
    }),
    held: () => (session && !session.done ? session : undefined),
    discard: () => {
      if (session && !session.done) {
        session.done = true;
        session.settle(false);
      }
    }
  };
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
    commands: {
      executeCommand: jest.fn(async (command: string) => {
        if (command === 'refactorPreview.discard') {
          preview.discard();
        }
      })
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
    mockHost: { changes, closes, diagnostics, preview }
  };
}, { virtual: true });

jest.mock('@prose-minion/core', () => ({
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  shiftRanges: jest.requireActual('@/utils/draftEdit/shiftRanges').shiftRanges,
  DraftEditUseCase: jest.requireActual('@/application/services/draftEdit/DraftEditUseCase').DraftEditUseCase,
  DraftEditApplier: jest.requireActual('@/application/services/draftEdit/DraftEditApplier').DraftEditApplier
}));

import * as vscode from 'vscode';
import { DraftEditApplier, DraftEditUseCase, type DraftEditOutcome, type DraftEditQuickFixOutcome } from '@prose-minion/core';
import { REFACTOR_PREVIEW_DISCARD_COMMAND, VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';
import { VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';

interface RecordedEdit {
  replacements: Array<{ range: { start: { offset: number }; end: { offset: number } }; newText: string; metadata?: { needsConfirmation?: boolean } }>;
}
interface HeldPreview {
  edit: RecordedEdit;
  settle(applied: boolean): void;
  done: boolean;
}
interface MockHost {
  changes: { fire(event: unknown): void };
  closes: { fire(event: unknown): void };
  diagnostics: Map<string, Array<{ range: { start: { offset: number }; end: { offset: number } } }>>;
  preview: { hold(edit: unknown): Promise<boolean>; held(): HeldPreview | undefined };
}
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
type Finding = { anchor: { quote: string }; category: 'spelling' | 'tense'; replacement: string; explanation: string };

const host = (vscode as unknown as { mockHost: MockHost }).mockHost;
const workspace = vscode.workspace as unknown as { textDocuments: FakeDocument[]; applyEdit: jest.Mock };
const commands = vscode.commands as unknown as { executeCommand: jest.Mock };
const URI = 'file:///workspace/chapter-01.md';
const TEXT = 'Alice was begining to get vrey tired of sitting by her sister, who is reading.';
const FINDINGS: Finding[] = [
  { anchor: { quote: 'begining' }, category: 'spelling', replacement: 'beginning', explanation: 'A typo.' },
  { anchor: { quote: 'vrey' }, category: 'spelling', replacement: 'very', explanation: 'A typo.' },
  { anchor: { quote: 'is reading' }, category: 'tense', replacement: 'was reading', explanation: 'Past tense.' }
];

function openDocument(text: string, languageId: string): FakeDocument {
  const document: FakeDocument = {
    uri: { toString: () => URI },
    version: 1,
    languageId,
    isClosed: false,
    text,
    getText: () => document.text,
    positionAt: (offset) => ({ offset }),
    offsetAt: (position) => position.offset
  };
  workspace.textDocuments.push(document);
  return document;
}

/** VS Code writing the preview's entries as one change, at an unmoved version: what its Apply does. */
function write(document: FakeDocument, edit: RecordedEdit): void {
  const changes = edit.replacements.map((each) => ({ offset: each.range.start.offset, length: each.range.end.offset - each.range.start.offset, text: each.newText }));
  for (const each of [...changes].sort((a, b) => b.offset - a.offset)) {
    document.text = document.text.slice(0, each.offset) + each.text + document.text.slice(each.offset + each.length);
  }
  document.version += 1;
  host.changes.fire({ document, contentChanges: changes.map((each) => ({ rangeOffset: each.offset, rangeLength: each.length, text: each.text })) });
}

/** The writer ticks the file and presses Apply, as VS Code permits at an unmoved version; nothing happens once the preview has gone. */
function writerApplies(document: FakeDocument): boolean {
  const held = host.preview.held();
  if (!held) {
    return false;
  }
  held.done = true;
  write(document, held.edit);
  held.settle(true);
  return true;
}

/** VS Code changing a document's language: close (then open) for the same document, its version unmoved. */
function changeLanguage(document: FakeDocument, languageId: string): void {
  document.languageId = languageId;
  host.closes.fire(document);
}

async function previewHeld(): Promise<void> {
  for (let turn = 0; turn < 50 && !host.preview.held(); turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  expect(host.preview.held()).toBeDefined();
}

function setup(document: FakeDocument, findings: Finding[]) {
  const pass = { proofread: jest.fn(async () => ({ kind: 'completed' as const, chunks: [{ kind: 'read' as const, findings, malformed: 0 }] })) };
  const documentEditor = new VsCodeDocumentEditor({ appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });
  const annotator = new VsCodeIssueAnnotator({ dismiss: 'dismiss', clear: 'clear', replace: 'replace', fixAll: 'fixAll' });
  const useCase = new DraftEditUseCase(pass, documentEditor, annotator, new DraftEditApplier(documentEditor), { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });
  const target = () => ({ uri: URI, version: document.version, text: document.getText(), languageId: document.languageId, relativePath: 'chapter-01.md' });
  return {
    fix: (): Promise<DraftEditOutcome> => useCase.run(target(), { kind: 'proofread', output: 'fix', review: 'preview' }),
    flag: (): Promise<DraftEditOutcome> => useCase.run(target(), { kind: 'proofread', output: 'flag' }),
    fixAll: (): Promise<DraftEditQuickFixOutcome> =>
      useCase.applyShown({ uri: URI, version: document.version, text: document.getText(), languageId: document.languageId }, 'all-fixes', 'preview'),
    dispose: () => {
      documentEditor.dispose();
      annotator.dispose();
    }
  };
}

const flaggedText = (document: FakeDocument) =>
  (host.diagnostics.get(URI) ?? []).map((diagnostic) => document.text.slice(diagnostic.range.start.offset, diagnostic.range.end.offset));

describe('A Proofread review ends with its document\'s lifetime (PR #172 F-02)', () => {
  const disposers: Array<() => void> = [];
  beforeEach(() => {
    workspace.applyEdit.mockImplementation((edit: RecordedEdit) => host.preview.hold(edit));
  });
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
    workspace.textDocuments.splice(0);
    workspace.applyEdit.mockReset();
    commands.executeCommand.mockClear();
    host.diagnostics.clear();
  });

  it('writes nothing when Markdown becomes JavaScript during review, even if the writer then presses Apply', async () => {
    const document = openDocument(TEXT, 'markdown');
    const proofread = setup(document, FINDINGS);
    disposers.push(proofread.dispose);
    const run = proofread.fix();
    await previewHeld();

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
      const proofread = setup(document, [teh]);
      disposers.push(proofread.dispose);
      const run = proofread.fix();
      await previewHeld();

      changeLanguage(document, 'markdown');
      const pressed = writerApplies(document);

      await expect(run).resolves.toMatchObject({ kind: 'closed' });
      expect(document.text).toBe(fenced);
      expect(pressed).toBe(false);
    });

    it('control: with no language change, the writer\'s Apply writes the fix', async () => {
      const document = openDocument(fenced, 'plaintext');
      const proofread = setup(document, [teh]);
      disposers.push(proofread.dispose);
      const run = proofread.fix();
      await previewHeld();

      expect(writerApplies(document)).toBe(true);

      await expect(run).resolves.toMatchObject({ kind: 'completed', fix: { answer: 'submitted', applied: 1 } });
      expect(document.text).toBe('~~~text\nAlice saw the rabbit.\n~~~\n');
      expect(commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  it('writes nothing when the document closes during review', async () => {
    const document = openDocument(TEXT, 'markdown');
    const proofread = setup(document, FINDINGS);
    disposers.push(proofread.dispose);
    const run = proofread.fix();
    await previewHeld();

    document.isClosed = true;
    host.closes.fire(document);
    const pressed = writerApplies(document);

    await expect(run).resolves.toMatchObject({ kind: 'closed' });
    expect(document.text).toBe(TEXT);
    expect(pressed).toBe(false);
  });

  it('writes nothing through Fix all when the language changes during its review', async () => {
    const document = openDocument(TEXT, 'markdown');
    const proofread = setup(document, FINDINGS);
    disposers.push(proofread.dispose);
    await expect(proofread.flag()).resolves.toMatchObject({ kind: 'completed', flagged: 3 });
    const fixAll = proofread.fixAll();
    await previewHeld();

    changeLanguage(document, 'javascript');
    const pressed = writerApplies(document);

    await expect(fixAll).resolves.toEqual({ kind: 'closed' });
    expect(document.text).toBe(TEXT);
    expect(pressed).toBe(false);
  });

  it('the stated limit: an Apply that lands before the close event reaches the extension host is reported closed, with nothing shown', async () => {
    const document = openDocument(TEXT, 'markdown');
    const proofread = setup(document, FINDINGS);
    disposers.push(proofread.dispose);
    const run = proofread.fix();
    await previewHeld();

    // In VS Code the language changed, then the writer pressed Apply, before the extension host heard of the change.
    const held = host.preview.held()!;
    held.done = true;
    write(document, held.edit);
    changeLanguage(document, 'javascript');
    held.settle(true);

    await expect(run).resolves.toMatchObject({ kind: 'closed' });
    expect(document.text).toBe('Alice was beginning to get very tired of sitting by her sister, who is reading.');
    expect(flaggedText(document)).toEqual([]);
  });
});
