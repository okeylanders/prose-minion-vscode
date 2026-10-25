/**
 * `VsCodeDocumentEditor.applyEdits` (Draft Edit Slice 2; ADR 2026-10-21 D3):
 * one `WorkspaceEdit` for the open document at the version the edits were
 * placed in, never saved. VS Code is a controlled double; what its
 * `workspace.applyEdit` resolves to in each case was read from VS Code's
 * source (the ADR's Slice 2 amendment), and is what the double returns.
 * A held review (a promise this test settles) is VS Code's Refactor Preview
 * waiting on the writer; its Discard command settles it `false`, as VS Code's
 * `BulkEditPane.discard` does (PR #172 F-02). A preview holds the pane once
 * its copy of the document opens, as VS Code's preview models do (F-06).
 *
 * Text is synthetic, around *Alice*.
 */

/* eslint-disable @typescript-eslint/naming-convention -- the double mirrors VS Code's own API names. */
jest.mock('vscode', () => {
  const listeners = () => ({ event: () => ({ dispose: () => undefined }) });
  const closeListeners = new Set<(document: unknown) => void>();
  const openListeners = new Set<(document: unknown) => void>();
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
      onDidOpenTextDocument: (listener: (document: unknown) => void) => {
        openListeners.add(listener);
        return { dispose: () => openListeners.delete(listener) };
      },
      onDidCloseTextDocument: (listener: (document: unknown) => void) => {
        closeListeners.add(listener);
        return { dispose: () => closeListeners.delete(listener) };
      },
      applyEdit: jest.fn()
    },
    commands: { executeCommand: jest.fn() },
    Uri: { parse: (value: string) => ({ toString: () => value }) },
    Range,
    WorkspaceEdit,
    /** VS Code firing a document's close event, as it does on a close and on a language change. */
    mockClose: (document: unknown) => closeListeners.forEach((listener) => listener(document)),
    mockOpen: (document: unknown) => openListeners.forEach((listener) => listener(document))
  };
}, { virtual: true });

import * as vscode from 'vscode';
import type { DocumentTextEdit } from '@prose-minion/core';
import { REFACTOR_PREVIEW_DISCARD_COMMAND, VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';

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
const fireOpen = (vscode as unknown as { mockOpen(document: unknown): void }).mockOpen;
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
describe('VsCodeDocumentEditor.applyEdits: a held review ends with its document', () => {
  let editor: VsCodeDocumentEditor;
  let log: { appendLine: jest.Mock; show: jest.Mock; clear: jest.Mock };
  let settle: (applied: boolean) => void;
  let shown: unknown;

  /** VS Code's copy of `file` in preview `instance`: once it opens, that preview holds the pane. */
  const previewOf = (instance: string, file = URI) => ({
    uri: { scheme: 'vscode-bulkeditpreview', authority: instance, query: file, toString: () => `vscode-bulkeditpreview://${instance}/x?${file}` }
  });
  const show = (instance: string, file = URI) => {
    shown = previewOf(instance, file);
    fireOpen(shown);
  };

  beforeEach(() => {
    workspace.applyEdit.mockReset();
    commands.executeCommand.mockReset();
    workspace.textDocuments = [];
    shown = undefined;
    log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    editor = new VsCodeDocumentEditor(log);
    workspace.applyEdit.mockImplementation(() => new Promise<boolean>((resolve) => { settle = resolve; }));
    // VS Code's Discard settles the preview holding the pane with nothing applied, and closes its copy.
    commands.executeCommand.mockImplementation(async (command: string) => {
      if (command === REFACTOR_PREVIEW_DISCARD_COMMAND) {
        settle(false);
        fireClose(shown);
      }
    });
  });

  afterEach(() => editor.dispose());

  const held = () => new Promise((resolve) => setImmediate(resolve));

  it('discards it when the document closes while its preview holds the pane, and answers closed', async () => {
    const document = open();
    const answer = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' });
    await held();
    show('ours');

    document.isClosed = true;
    fireClose(document);

    expect(commands.executeCommand).toHaveBeenCalledTimes(1);
    expect(commands.executeCommand).toHaveBeenCalledWith(REFACTOR_PREVIEW_DISCARD_COMMAND);
    await expect(answer).resolves.toEqual({ kind: 'closed' });
    expect(log.appendLine).toHaveBeenCalledWith(expect.stringContaining('discarding its Refactor Preview'));
  });

  it('discards it on a language change, which leaves the document open at its version, and answers closed', async () => {
    const document = open();
    const answer = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' });
    await held();
    show('ours');

    fireClose(document); // VS Code fires close, then open, for the same document; its version does not move.

    expect(commands.executeCommand).toHaveBeenCalledWith(REFACTOR_PREVIEW_DISCARD_COMMAND);
    await expect(answer).resolves.toEqual({ kind: 'closed' });
  });

  it('discards it when its preview opens after the document closed: VS Code was still opening it, or asking to replace another', async () => {
    const document = open();
    const answer = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' });
    await held();

    fireClose(document);
    expect(commands.executeCommand).not.toHaveBeenCalled();
    show('ours');

    expect(commands.executeCommand).toHaveBeenCalledTimes(1);
    await expect(answer).resolves.toEqual({ kind: 'closed' });
  });

  describe('never discards a preview it does not own (PR #172 F-06)', () => {
    it('while another preview, already open when it asked, holds the pane, even one of the same document', async () => {
      const document = open();
      show('theirs', 'file:///workspace/notes.md');
      fireOpen(previewOf('mine-before', URI));
      const answer = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' });
      await held();

      fireClose(document); // VS Code is still asking whether this review may replace the one shown.
      settle(false); // The writer said no.

      await expect(answer).resolves.toEqual({ kind: 'closed' });
      expect(commands.executeCommand).not.toHaveBeenCalled();
    });

    it('when the only new preview covers another document too', async () => {
      const document = open();
      const answer = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' });
      await held();
      fireOpen(previewOf('several', URI));
      fireOpen(previewOf('several', 'file:///workspace/notes.md'));

      fireClose(document);
      settle(false);

      await expect(answer).resolves.toEqual({ kind: 'closed' });
      expect(commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  it('leaves it alone when another document closes', async () => {
    open();
    const answer = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' });
    await held();
    show('ours');

    fireClose({ uri: { scheme: 'file', authority: '', query: '', toString: () => 'file:///workspace/chapter-02.md' } });
    settle(true);

    await expect(answer).resolves.toEqual({ kind: 'submitted' });
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('sends nothing for a direct apply, or once the review settled, so no empty preview panel opens', async () => {
    const document = open();
    const direct = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'direct' });
    await held();
    fireClose(document);
    settle(true);
    await expect(direct).resolves.toEqual({ kind: 'submitted' });

    const reviewed = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' });
    await held();
    show('ours');
    settle(true);
    await expect(reviewed).resolves.toEqual({ kind: 'submitted' });
    fireClose(document);

    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('logs a discard VS Code refuses, and still answers closed when the review ends', async () => {
    const document = open();
    commands.executeCommand.mockRejectedValue(new Error('command not found'));
    const answer = editor.applyEdits(URI, EDITS, { expectedVersion: 4, review: 'preview' });
    await held();
    show('ours');

    fireClose(document);
    await held();
    settle(false); // the writer discarded it themselves

    await expect(answer).resolves.toEqual({ kind: 'closed' });
    expect(log.appendLine).toHaveBeenCalledWith('[DraftEdit] Refactor Preview was not discarded: command not found');
  });
});
