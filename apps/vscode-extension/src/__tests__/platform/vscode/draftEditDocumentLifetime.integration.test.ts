/**
 * PR #171 F-03 and F-04, through the production `VsCodeDocumentEditor`,
 * `VsCodeIssueAnnotator` and `DraftEditUseCase`. VS Code is a controlled
 * double: open documents, their change and close events, and a diagnostic
 * collection. The Proofread pass is held until the test releases it, so the
 * writer can edit, close or reopen the document while the model "works".
 *
 * - A document closed during the run shows nothing and is never reopened.
 * - A document closed and opened again shows nothing, even at the same
 *   version: it is another lifetime.
 * - A language change (VS Code closes and reopens the same document) ends
 *   the run's lifetime too.
 * - An edit moves a flag with its text; correcting a finding's occurrence
 *   drops it rather than moving it to another occurrence.
 *
 * Text is synthetic, around *Alice*; nothing reaches a provider.
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
  return {
    workspace: {
      textDocuments: [] as unknown[],
      onDidChangeTextDocument: changes.event,
      onDidCloseTextDocument: closes.event,
      openTextDocument: jest.fn(async () => {
        throw new Error('a closed document must not be reopened');
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
    DiagnosticSeverity: { Warning: 1, Information: 2 },
    CodeActionKind: { QuickFix: 'quickfix' },
    CodeAction: class {},
    mockHost: { changes, closes, diagnostics }
  };
}, { virtual: true });

// The whole core barrel cannot load under jest (an ESM dependency), so the
// runtime values the adapters and this test use are required from their modules.
jest.mock('@prose-minion/core', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked barrel's export name.
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  shiftRanges: jest.requireActual('@/utils/draftEdit/shiftRanges').shiftRanges,
  DraftEditUseCase: jest.requireActual('@/application/services/draftEdit/DraftEditUseCase').DraftEditUseCase
}));

import * as vscode from 'vscode';
import { DraftEditUseCase, type DraftEditOutcome, type DraftEditTarget } from '@prose-minion/core';
import { VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';
import { VsCodeIssueAnnotator } from '@app/platform/vscode/VsCodeIssueAnnotator';

interface MockHost {
  changes: { fire(event: unknown): void };
  closes: { fire(event: unknown): void };
  diagnostics: Map<string, Array<{ range: { start: { offset: number }; end: { offset: number } } }>>;
}

const host = (vscode as unknown as { mockHost: MockHost }).mockHost;
const workspace = vscode.workspace as unknown as { textDocuments: FakeDocument[]; openTextDocument: jest.Mock };
const URI = 'file:///workspace/chapter-01.md';

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

function edit(document: FakeDocument, offset: number, length: number, text: string): void {
  document.text = document.text.slice(0, offset) + text + document.text.slice(offset + length);
  document.version += 1;
  host.changes.fire({ document, contentChanges: [{ rangeOffset: offset, rangeLength: length, text }] });
}

function close(document: FakeDocument): void {
  document.isClosed = true;
  workspace.textDocuments.splice(workspace.textDocuments.indexOf(document), 1);
  host.closes.fire(document);
}

const TEH = { anchor: { quote: 'teh', before: 'Alice saw', after: 'rabbit.' }, category: 'spelling' as const, replacement: 'the', explanation: 'Typo.' };

function start(document: FakeDocument) {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const pass = {
    proofread: jest.fn(async () => {
      await held;
      return { kind: 'completed' as const, chunks: [{ kind: 'read' as const, findings: [TEH], malformed: 0 }] };
    })
  };
  const documentEditor = new VsCodeDocumentEditor();
  const annotator = new VsCodeIssueAnnotator({ dismiss: 'dismiss', clear: 'clear' });
  const useCase = new DraftEditUseCase(pass, documentEditor, annotator, { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() });
  const target: DraftEditTarget = { uri: URI, version: document.version, text: document.getText(), languageId: document.languageId, relativePath: 'chapter-01.md' };
  const run: Promise<DraftEditOutcome> = useCase.run(target, { kind: 'proofread', output: 'flag' });
  return {
    run,
    release,
    dispose: () => {
      documentEditor.dispose();
      annotator.dispose();
    }
  };
}

const flagged = () => (host.diagnostics.get(URI) ?? []).map((diagnostic) => [diagnostic.range.start.offset, diagnostic.range.end.offset]);

describe('a Proofread run and its document\'s lifetime (PR #171 F-04)', () => {
  const disposers: Array<() => void> = [];
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
    workspace.textDocuments.splice(0);
    workspace.openTextDocument.mockClear();
    host.diagnostics.clear();
  });

  it('control: with the document left open, the flag is drawn on its text', async () => {
    openDocument('Alice saw teh rabbit.');
    const run = start(workspace.textDocuments[0]);
    disposers.push(run.dispose);
    run.release();

    await expect(run.run).resolves.toMatchObject({ kind: 'completed', flagged: 1 });
    expect(flagged()).toEqual([[10, 13]]);
  });

  it('shows nothing, and never reopens the document, when it closed during the run', async () => {
    const document = openDocument('Alice saw teh rabbit.');
    const run = start(document);
    disposers.push(run.dispose);
    close(document);
    run.release();

    await expect(run.run).resolves.toEqual({ kind: 'closed', rejectedChunks: { saved: 0, unsaved: 0 } });
    expect(workspace.openTextDocument).not.toHaveBeenCalled();
    expect(flagged()).toEqual([]);
  });

  it('shows nothing on a document closed and opened again, even at the same version', async () => {
    const document = openDocument('Alice saw teh rabbit.');
    const run = start(document);
    disposers.push(run.dispose);
    close(document);
    openDocument('0123456789NOT A TYPO.', 1);
    run.release();

    await expect(run.run).resolves.toMatchObject({ kind: 'closed' });
    expect(flagged()).toEqual([]);
  });

  it('shows nothing after a language change, which VS Code makes as a close and an open of the same document', async () => {
    const document = openDocument('Alice saw teh rabbit.');
    const run = start(document);
    disposers.push(run.dispose);
    host.closes.fire(document);
    document.languageId = 'plaintext';
    run.release();

    await expect(run.run).resolves.toMatchObject({ kind: 'closed' });
    expect(flagged()).toEqual([]);
  });
});

describe('a Proofread run follows the writer\'s edits in the adapter (PR #171 F-03)', () => {
  const disposers: Array<() => void> = [];
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
    workspace.textDocuments.splice(0);
    host.diagnostics.clear();
  });

  it('moves the flag with its text when the writer types before it', async () => {
    const document = openDocument('Alice saw teh rabbit.');
    const run = start(document);
    disposers.push(run.dispose);
    edit(document, 0, 0, 'One day, ');
    run.release();

    await expect(run.run).resolves.toMatchObject({ kind: 'completed', flagged: 1, dropped: { stale: 0 } });
    expect(flagged()).toEqual([[19, 22]]);
  });

  it('drops the finding when the writer corrected it, never flagging the other occurrence', async () => {
    const text = 'Alice saw teh rabbit. Elsewhere teh bird sang.';
    const document = openDocument(text);
    const run = start(document);
    disposers.push(run.dispose);
    edit(document, text.indexOf('teh'), 3, 'the');
    run.release();

    await expect(run.run).resolves.toMatchObject({ kind: 'completed', flagged: 0, dropped: { stale: 1 } });
    expect(flagged()).toEqual([]);
  });
});
