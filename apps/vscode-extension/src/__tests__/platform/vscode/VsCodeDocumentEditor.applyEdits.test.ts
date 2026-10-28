/**
 * `VsCodeDocumentEditor.applyEdits` (Draft Edit Slice 2; ADR 2026-10-21 D3):
 * one `WorkspaceEdit` for the open document at the version the edits were
 * placed in, never saved. VS Code is a controlled double; what its
 * `workspace.applyEdit` resolves to in each case was read from VS Code's
 * source (the ADR's Slice 2 amendment), and is what the double returns.
 * A held review (a promise this test settles) is VS Code's Refactor Preview
 * waiting on the writer. The adapter never ends one: VS Code's Discard ends
 * whichever preview is shown (PR #172 F-02, F-06).
 *
 * Text is synthetic, around *Alice*.
 */

/* eslint-disable @typescript-eslint/naming-convention -- the double mirrors VS Code's own API names. */
jest.mock('vscode', () => {
  const listeners = () => ({ event: () => ({ dispose: () => undefined }) });
  const closeListeners = new Set<(document: unknown) => void>();
  class Range {
    constructor(readonly start: { offset: number }, readonly end: { offset: number }) {}
  }
  class WorkspaceEdit {
    readonly replacements: Array<{ uri: unknown; range: Range; newText: string; metadata?: unknown }> = [];
    replace(uri: unknown, range: Range, newText: string, metadata?: unknown): void {
      this.replacements.push({ uri, range, newText, ...(metadata !== undefined ? { metadata } : {}) });
    }
  }
  return {
    workspace: {
      textDocuments: [] as unknown[],
      onDidChangeTextDocument: listeners().event,
      onDidCloseTextDocument: (listener: (document: unknown) => void) => {
        closeListeners.add(listener);
        return { dispose: () => closeListeners.delete(listener) };
      },
      applyEdit: jest.fn()
    },
    commands: { executeCommand: jest.fn() },
    Range,
    WorkspaceEdit,
    /** VS Code firing a document's close event, as it does on a close and on a language change. */
    mockClose: (document: unknown) => closeListeners.forEach((listener) => listener(document))
  };
}, { virtual: true });

import * as vscode from 'vscode';
import type { DocumentTextEdit } from '@prose-minion/core';
import { VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';

interface FakeDocument {
  uri: { scheme: string; authority: string; query: string; toString(): string };
  version: number;
  isClosed: boolean;
  save: jest.Mock;
  positionAt(offset: number): { offset: number };
}

interface RecordedEdit {
  replacements: Array<{ uri: unknown; range: { start: { offset: number }; end: { offset: number } }; newText: string; metadata?: unknown }>;
}

const workspace = vscode.workspace as unknown as { textDocuments: FakeDocument[]; applyEdit: jest.Mock };
const commands = vscode.commands as unknown as { executeCommand: jest.Mock };
const fireClose = (vscode as unknown as { mockClose(document: unknown): void }).mockClose;
const URI = 'file:///workspace/chapter-01.md';
const EDITS: DocumentTextEdit[] = [
  { start: 6, end: 9, newText: 'was', label: 'Proofread: spelling', description: 'A typo.' },
  { start: 20, end: 25, newText: 'tired', label: 'Proofread: spelling' }
];

function open(version = 4): FakeDocument {
  const document: FakeDocument = {
    uri: { scheme: 'file', authority: '', query: '', toString: () => URI },
    version,
    isClosed: false,
    save: jest.fn(),
    positionAt: (offset: number) => ({ offset })
  };
  workspace.textDocuments = [document];
  return document;
}

function recorded(): RecordedEdit {
  return workspace.applyEdit.mock.calls[0][0] as RecordedEdit;
}

describe('VsCodeDocumentEditor.applyEdits', () => {
  let editor: VsCodeDocumentEditor;
  let log: { appendLine: jest.Mock; show: jest.Mock; clear: jest.Mock };

  beforeEach(() => {
    workspace.applyEdit.mockReset();
    commands.executeCommand.mockReset();
    workspace.textDocuments = [];
    log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    editor = new VsCodeDocumentEditor(log);
  });

  afterEach(() => editor.dispose());

  it('makes one WorkspaceEdit of the edits, each marked for review with its label and note', async () => {
    const document = open();
    workspace.applyEdit.mockResolvedValue(true);

    expect(await editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' })).toEqual({ kind: 'submitted' });
    expect(workspace.applyEdit).toHaveBeenCalledTimes(1);
    expect(recorded().replacements).toEqual([
      {
        uri: document.uri,
        range: { start: { offset: 6 }, end: { offset: 9 } },
        newText: 'was',
        metadata: { needsConfirmation: true, label: 'Proofread: spelling', description: 'A typo.' }
      },
      {
        uri: document.uri,
        range: { start: { offset: 20 }, end: { offset: 25 } },
        newText: 'tired',
        metadata: { needsConfirmation: true, label: 'Proofread: spelling' }
      }
    ]);
    expect(document.save).not.toHaveBeenCalled();
  });

  it('applies directly without review metadata, and never saves', async () => {
    const document = open();
    workspace.applyEdit.mockResolvedValue(true);

    expect(await editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'direct' })).toEqual({ kind: 'submitted' });
    expect(recorded().replacements.map((each) => each.metadata)).toEqual([undefined, undefined]);
    expect(document.save).not.toHaveBeenCalled();
  });

  it('refuses a document that is not open, or has moved, without asking VS Code', async () => {
    expect(await editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'direct' })).toEqual({ kind: 'closed' });
    open(5);
    expect(await editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'direct' })).toEqual({ kind: 'stale' });
    open(4).isClosed = true;
    expect(await editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'direct' })).toEqual({ kind: 'closed' });
    expect(workspace.applyEdit).not.toHaveBeenCalled();
  });

  it('reads a discarded preview as declined', async () => {
    open();
    workspace.applyEdit.mockResolvedValue(false);

    expect(await editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' })).toEqual({ kind: 'declined' });
  });

  it('reads a refusal after the buffer moved as stale, in review or not', async () => {
    const document = open();
    workspace.applyEdit.mockImplementation(async () => {
      document.version = 5; // the writer typed while the preview was open, or just before VS Code applied it
      return false;
    });

    expect(await editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' })).toEqual({ kind: 'stale' });
    document.version = 4;
    expect(await editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'direct' })).toEqual({ kind: 'stale' });
  });

  it('reads a refusal after the document closed as closed', async () => {
    const document = open();
    workspace.applyEdit.mockImplementation(async () => {
      document.isClosed = true;
      return false;
    });

    expect(await editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' })).toEqual({ kind: 'closed' });
  });

  it('reports a direct edit VS Code refused, or one that threw, as failed', async () => {
    open();
    workspace.applyEdit.mockResolvedValueOnce(false);
    expect(await editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'direct' }))
      .toEqual({ kind: 'failed', message: 'The editor did not apply the change.' });

    workspace.applyEdit.mockRejectedValueOnce(new Error('overlapping ranges'));
    expect(await editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'direct' }))
      .toEqual({ kind: 'failed', message: 'overlapping ranges' });
  });
});

/**
 * VS Code's preview commits inside `applyEdit`, and a language change moves no
 * version, so VS Code would apply a held review to a document that now reads
 * otherwise. The adapter discards it when the document's lifetime ends
 * (PR #172 F-02).
 */
/**
 * A held review whose document closes or changes language: VS Code would
 * still apply it, and its Discard would end whichever preview is shown, so
 * the adapter sends nothing (PR #172 F-02, F-06).
 */
describe('VsCodeDocumentEditor.applyEdits: a held review whose document\'s lifetime ends', () => {
  let editor: VsCodeDocumentEditor;
  let log: { appendLine: jest.Mock; show: jest.Mock; clear: jest.Mock };
  let settle: (applied: boolean) => void;

  beforeEach(() => {
    workspace.applyEdit.mockReset();
    commands.executeCommand.mockReset();
    workspace.textDocuments = [];
    log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    editor = new VsCodeDocumentEditor(log);
    workspace.applyEdit.mockImplementation(() => new Promise<boolean>((resolve) => { settle = resolve; }));
  });

  afterEach(() => editor.dispose());

  const held = () => new Promise((resolve) => setImmediate(resolve));

  it('sends no command, logs it, and answers closed when the writer then discards, even though the document stayed open at its version', async () => {
    const document = open();
    const answer = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' });
    await held();

    fireClose(document); // A language change: VS Code fires close, then open, for the same document.
    settle(false);

    await expect(answer).resolves.toEqual({ kind: 'closed' });
    expect(commands.executeCommand).not.toHaveBeenCalled();
    expect(log.appendLine).toHaveBeenCalledWith(
      '[DraftEdit] A document under review closed or changed language: its Refactor Preview stays open, and Apply would still write'
    );
  });

  it('the accepted limit: an Apply after the change still lands, and is reported as submitted', async () => {
    const document = open();
    const answer = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' });
    await held();

    document.isClosed = true;
    fireClose(document);
    settle(true);

    await expect(answer).resolves.toEqual({ kind: 'submitted' });
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('logs nothing for another document\'s close, a direct apply, or a review that settled first', async () => {
    const document = open();
    const answer = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' });
    await held();
    fireClose({ uri: { scheme: 'file', authority: '', query: '', toString: () => 'file:///workspace/chapter-02.md' } });
    settle(true);
    await expect(answer).resolves.toEqual({ kind: 'submitted' });

    const direct = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'direct' });
    await held();
    fireClose(document);
    settle(true);
    await expect(direct).resolves.toEqual({ kind: 'submitted' });

    expect(log.appendLine).not.toHaveBeenCalled();
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });
});
