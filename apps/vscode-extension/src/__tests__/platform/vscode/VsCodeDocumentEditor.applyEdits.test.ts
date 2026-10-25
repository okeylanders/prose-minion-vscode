/**
 * `VsCodeDocumentEditor.applyEdits` (Draft Edit Slice 2; ADR 2026-10-21 D3):
 * one `WorkspaceEdit` for the open document at the version the edits were
 * placed in, never saved. VS Code is a controlled double; what its
 * `workspace.applyEdit` resolves to in each case was read from VS Code's
 * source (the ADR's Slice 2 amendment), and is what the double returns.
 *
 * Text is synthetic, around *Alice*.
 */

/* eslint-disable @typescript-eslint/naming-convention -- the double mirrors VS Code's own API names. */
jest.mock('vscode', () => {
  const listeners = () => ({ event: () => ({ dispose: () => undefined }) });
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
      onDidCloseTextDocument: listeners().event,
      applyEdit: jest.fn()
    },
    Range,
    WorkspaceEdit
  };
}, { virtual: true });

import * as vscode from 'vscode';
import type { DocumentTextEdit } from '@prose-minion/core';
import { VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';

interface FakeDocument {
  uri: { toString(): string };
  version: number;
  isClosed: boolean;
  save: jest.Mock;
  positionAt(offset: number): { offset: number };
}

interface RecordedEdit {
  replacements: Array<{ uri: unknown; range: { start: { offset: number }; end: { offset: number } }; newText: string; metadata?: unknown }>;
}

const workspace = vscode.workspace as unknown as { textDocuments: FakeDocument[]; applyEdit: jest.Mock };
const URI = 'file:///workspace/chapter-01.md';
const EDITS: DocumentTextEdit[] = [
  { start: 6, end: 9, newText: 'was', label: 'Proofread: spelling', description: 'A typo.' },
  { start: 20, end: 25, newText: 'tired', label: 'Proofread: spelling' }
];

function open(version = 4): FakeDocument {
  const document: FakeDocument = {
    uri: { toString: () => URI },
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

  beforeEach(() => {
    workspace.applyEdit.mockReset();
    workspace.textDocuments = [];
    editor = new VsCodeDocumentEditor();
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
