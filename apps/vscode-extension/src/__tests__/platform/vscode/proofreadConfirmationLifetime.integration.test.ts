/**
 * PR #183 F-02: a long-file Proofread is watched from the writer's gesture,
 * through its confirmation, not from after it. Through the production
 * Proofread commands, `DraftEditUseCase`, `DraftEditApplier`,
 * `VsCodeDocumentEditor` and `VsCodeIssueAnnotator`. VS Code is a controlled
 * double: open documents, their change and close events, `applyEdit` and a
 * diagnostic collection. The Proofread pass is a stand-in; nothing reaches a
 * provider.
 *
 * While the confirmation is open the writer closes and reopens the document
 * (the same URI, version and language), or VS Code changes its language
 * (a close and an open of the same document). Either ends the gesture's
 * lifetime, so nothing is sent, flagged or written. No Refactor Preview is
 * opened: this is not the accepted #172 limit.
 *
 * Text is synthetic, around *Alice*.
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
    readonly replacements: Array<{ range: Range; newText: string }> = [];
    replace(_uri: unknown, range: Range, newText: string): void {
      this.replacements.push({ range, newText });
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

// The whole core barrel cannot load under jest (an ESM dependency), so the
// runtime values the commands, the adapters and this test use are required from their modules.
jest.mock('@prose-minion/core', () => ({
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  DRAFT_EDIT_PASS_POLICIES: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_PASS_POLICIES,
  isProofreadSpellingConvention: jest.requireActual('@/domain/models/DraftEdit').isProofreadSpellingConvention,
  reasoningLevelOf: jest.requireActual('@/domain/models/ReasoningLevel').reasoningLevelOf,
  proofreadWordList: jest.requireActual('@/utils/proofread/proofreadWordList').proofreadWordList,
  describeDraftEditOutcome: jest.requireActual('@/application/services/draftEdit/draftEditSummary').describeDraftEditOutcome,
  describeQuickFixOutcome: jest.requireActual('@/application/services/draftEdit/draftEditSummary').describeQuickFixOutcome,
  shiftRanges: jest.requireActual('@/utils/draftEdit/shiftRanges').shiftRanges,
  DraftEditUseCase: jest.requireActual('@/application/services/draftEdit/DraftEditUseCase').DraftEditUseCase,
  DraftEditApplier: jest.requireActual('@/application/services/draftEdit/DraftEditApplier').DraftEditApplier
}));

import * as vscode from 'vscode';
import { DraftEditApplier, DraftEditUseCase } from '@prose-minion/core';
import { proofreadAndFix, proofreadAndFlag, type ProofreadCommandHost } from '@app/application/commands/proofreadCommands';
import { VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';
import { VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';

type ProofreadPassPort = ConstructorParameters<typeof DraftEditUseCase>[0];
type ProofreadRunRequest = Parameters<ProofreadPassPort['proofread']>[0];
type ProofreadRunResult = Awaited<ReturnType<ProofreadPassPort['proofread']>>;

interface MockHost {
  changes: { fire(event: unknown): void };
  closes: { fire(event: unknown): void };
  diagnostics: Map<string, Array<{ range: { start: { offset: number }; end: { offset: number } } }>>;
}
interface RecordedEdit {
  replacements: Array<{ range: { start: { offset: number }; end: { offset: number } }; newText: string }>;
}

const host = (vscode as unknown as { mockHost: MockHost }).mockHost;
const workspace = vscode.workspace as unknown as { textDocuments: FakeDocument[]; applyEdit: jest.Mock };
const URI = 'file:///workspace/chapter-01.md';
const OPENING = 'Alice saw teh rabbit.';
/** 20,004 words: past the long-file threshold (15,000), so the command asks first; every case below needs it to. */
const TEXT = [OPENING, ...Array.from({ length: 4_000 }, () => 'Alice fell down the hole.')].join('\n\n');
const TEH = { anchor: { quote: 'teh', before: 'Alice saw', after: 'rabbit.' }, category: 'spelling' as const, replacement: 'the', explanation: 'A typo.' };

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

function openDocument(text: string, version = 1, languageId = 'markdown'): FakeDocument {
  const document: FakeDocument = {
    uri: { toString: () => URI },
    version,
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

function change(document: FakeDocument, offset: number, length: number, text: string): void {
  document.text = document.text.slice(0, offset) + text + document.text.slice(offset + length);
  document.version += 1;
  host.changes.fire({ document, contentChanges: [{ rangeOffset: offset, rangeLength: length, text }] });
}

function close(document: FakeDocument): void {
  document.isClosed = true;
  workspace.textDocuments.splice(workspace.textDocuments.indexOf(document), 1);
  host.closes.fire(document);
}

/** VS Code applying a direct `WorkspaceEdit` to the open document as one change. */
function applyDirect(edit: RecordedEdit): boolean {
  const document = workspace.textDocuments[0];
  for (const each of [...edit.replacements].sort((a, b) => b.range.start.offset - a.range.start.offset)) {
    change(document, each.range.start.offset, each.range.end.offset - each.range.start.offset, each.newText);
  }
  return true;
}

function setup(options: { fixReview?: 'preview' | 'apply'; whileConfirming?: () => void; confirm?: boolean } = {}) {
  const pass = {
    proofread: jest.fn(async (request: ProofreadRunRequest): Promise<ProofreadRunResult> => ({
      kind: 'completed',
      chunks: request.chunks.map((_, index) => ({ kind: 'read' as const, findings: index === 0 ? [TEH] : [], malformed: 0 }))
    }))
  };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const documentEditor = new VsCodeDocumentEditor(log);
  const annotator = new VsCodeIssueAnnotator({ dismiss: 'dismiss', clear: 'clear', replace: 'replace', fixAll: 'fixAll' });
  const useCase = new DraftEditUseCase(pass, documentEditor, annotator, new DraftEditApplier(documentEditor), log);
  const commandHost = {
    activeEditor: () => {
      const document = workspace.textDocuments[0];
      return document && { uri: URI, version: document.version, text: document.getText(), languageId: document.languageId, label: 'chapter-01.md' };
    },
    document: () => undefined,
    fixReview: () => options.fixReview ?? 'preview',
    spellingConvention: () => undefined,
    wordList: () => undefined,
    proofreadReasoning: () => undefined,
    confirm: jest.fn(async () => {
      options.whileConfirming?.();
      return options.confirm ?? true;
    }),
    withProgress: async <T>(_title: string, task: (signal: AbortSignal, report: (message: string) => void) => Promise<T>) => task(new AbortController().signal, () => undefined),
    showInformation: jest.fn(async () => undefined),
    showWarning: jest.fn(async () => undefined),
    executeCommand: jest.fn()
  } satisfies ProofreadCommandHost;
  return {
    pass,
    useCase,
    commandHost,
    dispose: () => {
      documentEditor.dispose();
      annotator.dispose();
    }
  };
}

const flagged = () => (host.diagnostics.get(URI) ?? []).map((diagnostic) => [diagnostic.range.start.offset, diagnostic.range.end.offset]);
const TEH_AT = [OPENING.indexOf('teh'), OPENING.indexOf('teh') + 3];

describe('a long-file Proofread and its document\'s lifetime through the confirmation (PR #183 F-02)', () => {
  const disposers: Array<() => void> = [];
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
    workspace.textDocuments.splice(0);
    workspace.applyEdit.mockReset();
    host.diagnostics.clear();
  });

  it('control: confirmed with the document left as it was, the run reads it once and flags it', async () => {
    openDocument(TEXT);
    const run = setup();
    disposers.push(run.dispose);

    await expect(proofreadAndFlag(run.commandHost, run.useCase)).resolves.toMatchObject({ kind: 'ran', outcome: { kind: 'completed', flagged: 1 } });
    expect(run.commandHost.confirm).toHaveBeenCalledTimes(1);
    expect(run.pass.proofread).toHaveBeenCalledTimes(1);
    expect(flagged()).toEqual([TEH_AT]);
  });

  it('sends and flags nothing when the document closed and opened again, at the same URI, version and language', async () => {
    const document = openDocument(TEXT);
    const run = setup({
      whileConfirming: () => {
        close(document);
        openDocument(TEXT);
      }
    });
    disposers.push(run.dispose);

    await expect(proofreadAndFlag(run.commandHost, run.useCase)).resolves.toEqual({ kind: 'ran', outcome: { kind: 'changed' } });
    expect(run.pass.proofread).not.toHaveBeenCalled();
    expect(flagged()).toEqual([]);
    expect(run.commandHost.showWarning).toHaveBeenCalledWith('chapter-01.md changed before Proofread could start, so nothing was sent. Run it again.');
  });

  it('sends and flags nothing when VS Code changed the document\'s language from Markdown, at the same version', async () => {
    const document = openDocument(TEXT);
    const run = setup({
      whileConfirming: () => {
        host.closes.fire(document);
        document.languageId = 'typescript';
      }
    });
    disposers.push(run.dispose);

    await expect(proofreadAndFlag(run.commandHost, run.useCase)).resolves.toEqual({ kind: 'ran', outcome: { kind: 'changed' } });
    expect(run.pass.proofread).not.toHaveBeenCalled();
    expect(flagged()).toEqual([]);
  });

  it('writes nothing in a direct Fix after the same language change', async () => {
    const document = openDocument(TEXT);
    workspace.applyEdit.mockImplementation(async (edit: RecordedEdit) => applyDirect(edit));
    const run = setup({
      fixReview: 'apply',
      whileConfirming: () => {
        host.closes.fire(document);
        document.languageId = 'typescript';
      }
    });
    disposers.push(run.dispose);

    await expect(proofreadAndFix(run.commandHost, run.useCase)).resolves.toEqual({ kind: 'ran', outcome: { kind: 'changed' } });
    expect(run.pass.proofread).not.toHaveBeenCalled();
    expect(workspace.applyEdit).not.toHaveBeenCalled();
    expect(document.text).toBe(TEXT);
    expect(flagged()).toEqual([]);
  });

  it('control: a direct Fix confirmed with the document left as it was writes the fix', async () => {
    const document = openDocument(TEXT);
    workspace.applyEdit.mockImplementation(async (edit: RecordedEdit) => applyDirect(edit));
    const run = setup({ fixReview: 'apply' });
    disposers.push(run.dispose);

    await expect(proofreadAndFix(run.commandHost, run.useCase)).resolves.toMatchObject({ kind: 'ran', outcome: { kind: 'completed', fix: { applied: 1 } } });
    expect(workspace.applyEdit).toHaveBeenCalledTimes(1);
    expect(document.text.startsWith('Alice saw the rabbit.')).toBe(true);
  });

  it('follows an edit the writer made while confirming, as it follows one made while the model works', async () => {
    const document = openDocument(TEXT);
    const run = setup({ whileConfirming: () => change(document, 0, 0, 'One day, ') });
    disposers.push(run.dispose);

    await expect(proofreadAndFlag(run.commandHost, run.useCase)).resolves.toMatchObject({ kind: 'ran', outcome: { kind: 'completed', flagged: 1 } });
    expect(flagged()).toEqual([TEH_AT.map((offset) => offset + 'One day, '.length)]);
  });

  it('sends nothing when declined, and lets the next gesture begin', async () => {
    openDocument(TEXT);
    const declined = setup({ confirm: false });
    disposers.push(declined.dispose);

    await expect(proofreadAndFlag(declined.commandHost, declined.useCase)).resolves.toEqual({ kind: 'declined' });
    expect(declined.pass.proofread).not.toHaveBeenCalled();
    declined.commandHost.confirm.mockImplementation(async () => true);
    await expect(proofreadAndFlag(declined.commandHost, declined.useCase)).resolves.toMatchObject({ kind: 'ran', outcome: { kind: 'completed' } });
  });
});
