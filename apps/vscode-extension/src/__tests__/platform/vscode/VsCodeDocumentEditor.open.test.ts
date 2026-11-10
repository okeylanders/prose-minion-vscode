/**
 * `VsCodeDocumentEditor.open` and `reveal` (persona file edits, ADR
 * 2026-11-05 D6): open loads a buffer through `openTextDocument` without
 * showing it; reveal shows a document in a preview tab without focus, only
 * when no visible editor shows it. VS Code is a controlled double. *Alice*.
 */

/* eslint-disable @typescript-eslint/naming-convention -- the double mirrors VS Code's own API names. */
jest.mock('vscode', () => {
  const listeners = () => ({ event: () => ({ dispose: () => undefined }) });
  return {
    workspace: {
      textDocuments: [] as unknown[],
      onDidChangeTextDocument: listeners().event,
      onDidCloseTextDocument: listeners().event,
      openTextDocument: jest.fn()
    },
    window: {
      visibleTextEditors: [] as unknown[],
      showTextDocument: jest.fn(async () => undefined)
    },
    Uri: { parse: (value: string) => ({ toString: () => value }) }
  };
}, { virtual: true });

import * as vscode from 'vscode';
import { VsCodeDocumentEditor } from '@app/platform/vscode/VsCodeDocumentEditor';

const URI = 'file:///workspace/characters/alice.md';

interface FakeDocument {
  uri: { toString(): string };
  version: number;
  isClosed: boolean;
  languageId: string;
  getText(): string;
  save: jest.Mock;
}

const workspace = vscode.workspace as unknown as { textDocuments: FakeDocument[]; openTextDocument: jest.Mock };
const window = vscode.window as unknown as { visibleTextEditors: Array<{ document: FakeDocument }>; showTextDocument: jest.Mock };

function document(): FakeDocument {
  return { uri: { toString: () => URI }, version: 3, isClosed: false, languageId: 'markdown', getText: () => 'Alice is curious.', save: jest.fn() };
}

describe('VsCodeDocumentEditor.open', () => {
  beforeEach(() => {
    workspace.textDocuments = [];
    workspace.openTextDocument.mockReset();
    window.visibleTextEditors = [];
    window.showTextDocument.mockClear();
  });

  it('loads the buffer without showing it, and reads it live', async () => {
    const loaded = document();
    workspace.openTextDocument.mockResolvedValue(loaded);
    const editor = new VsCodeDocumentEditor({ appendLine: jest.fn() } as never);
    await expect(editor.open(URI)).resolves.toEqual({ uri: URI, version: 3, text: 'Alice is curious.', languageId: 'markdown' });
    expect(window.showTextDocument).not.toHaveBeenCalled();
    expect(loaded.save).not.toHaveBeenCalled();
  });

  it('answers undefined when the host cannot load it as text', async () => {
    workspace.openTextDocument.mockRejectedValue(new Error('binary'));
    const editor = new VsCodeDocumentEditor({ appendLine: jest.fn() } as never);
    await expect(editor.open(URI)).resolves.toBeUndefined();
  });
});

describe('VsCodeDocumentEditor.peek', () => {
  it('reads an open document and loads nothing', async () => {
    workspace.openTextDocument.mockReset();
    const editor = new VsCodeDocumentEditor({ appendLine: jest.fn() } as never);
    workspace.textDocuments = [];
    expect(editor.peek(URI)).toBeUndefined();
    workspace.textDocuments = [document()];
    expect(editor.peek(URI)).toEqual({ uri: URI, version: 3, text: 'Alice is curious.', languageId: 'markdown' });
    expect(workspace.openTextDocument).not.toHaveBeenCalled();
  });
});

describe('VsCodeDocumentEditor.reveal', () => {
  beforeEach(() => {
    window.visibleTextEditors = [];
    window.showTextDocument.mockClear();
  });

  it('shows a hidden document in a preview tab without taking focus', async () => {
    const hidden = document();
    workspace.textDocuments = [hidden];
    const editor = new VsCodeDocumentEditor({ appendLine: jest.fn() } as never);
    await expect(editor.reveal(URI)).resolves.toBe(true);
    expect(window.showTextDocument).toHaveBeenCalledWith(hidden, { preview: true, preserveFocus: true });
  });

  it('leaves a visible document where it is, and shows nothing for one not open', async () => {
    const shown = document();
    workspace.textDocuments = [shown];
    window.visibleTextEditors = [{ document: shown }];
    const editor = new VsCodeDocumentEditor({ appendLine: jest.fn() } as never);
    await expect(editor.reveal(URI)).resolves.toBe(false);
    workspace.textDocuments = [];
    await expect(editor.reveal(URI)).resolves.toBe(false);
    expect(window.showTextDocument).not.toHaveBeenCalled();
  });
});
