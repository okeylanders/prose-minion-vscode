/**
 * The editor's current selection in VS Code (ADR 2026-11-14 D10):
 * `currentSelection()` reads the last focused editor live, so a deselect
 * reports empty and a closed document reports nothing, and
 * `onDidChangeSelection` fires when that answer may have changed. The
 * remembered selection `getActiveSelection()` serves is untouched.
 */
jest.mock('vscode', () => {
  const channel = <T>() => {
    const listeners = new Set<(event: T) => void>();
    return {
      on: (listener: (event: T) => void) => {
        listeners.add(listener);
        return { dispose: () => listeners.delete(listener) };
      },
      fire: (event: T) => listeners.forEach((listener) => listener(event)),
      size: () => listeners.size
    };
  };
  const selection = channel<unknown>();
  const activeEditor = channel<unknown>();
  const documentChanged = channel<unknown>();
  const documentClosed = channel<unknown>();
  return {
    window: {
      activeTextEditor: undefined as unknown,
      onDidChangeTextEditorSelection: selection.on,
      onDidChangeActiveTextEditor: activeEditor.on
    },
    workspace: {
      asRelativePath: (uri: { path: string }) => uri.path.replace(/^\/novel\//, ''),
      onDidChangeTextDocument: documentChanged.on,
      onDidCloseTextDocument: documentClosed.on
    },
    mock: { selection, activeEditor, documentChanged, documentClosed }
  };
}, { virtual: true });

// The adapter reaches the core barrel for one pure function; the whole barrel
// cannot load under jest, so that module is required directly.
jest.mock('@prose-minion/core', () => ({
  toInclusiveLineRange: jest.requireActual('@/platform/EditorContext').toInclusiveLineRange
}));

import * as vscode from 'vscode';
import { VsCodeEditorContext } from '@app/platform/vscode/VsCodeEditorContext';

interface Channel { fire(event: unknown): void; size(): number }
const host = vscode as unknown as {
  window: { activeTextEditor: unknown };
  mock: { selection: Channel; activeEditor: Channel; documentChanged: Channel; documentClosed: Channel };
};

const ALICE_LINES = [
  'The Caterpillar and Alice looked at each other for some time in silence.',
  'At last the Caterpillar took the hookah out of its mouth.',
  'It addressed her in a languid, sleepy voice.'
];

interface FakeEditor {
  viewColumn: number | undefined;
  document: { uri: { path: string; fsPath: string; toString(): string }; isClosed: boolean; lines: string[]; getText(range: FakeSelection): string };
  selection: FakeSelection;
}
interface FakeSelection {
  start: { line: number; character: number };
  end: { line: number; character: number };
  isEmpty: boolean;
}

const range = (startLine: number, endLine: number): FakeSelection => ({
  start: { line: startLine, character: 0 },
  end: { line: endLine, character: 999 },
  isEmpty: false
});
const caret = (line: number): FakeSelection => ({
  start: { line, character: 0 },
  end: { line, character: 0 },
  isEmpty: true
});

function editorOf(path: string, selection: FakeSelection, area: 'editor' | 'panel' = 'editor'): FakeEditor {
  const viewColumn = area === 'editor' ? 1 : undefined;
  const document: FakeEditor['document'] = {
    uri: { path, fsPath: path, toString: () => `file://${path}` },
    isClosed: false,
    lines: [...ALICE_LINES],
    getText: (asked) => (asked.isEmpty ? '' : document.lines.slice(asked.start.line, asked.end.line + 1).join('\n'))
  };
  return { viewColumn, document, selection };
}

function focus(editor: FakeEditor | undefined): void {
  host.window.activeTextEditor = editor;
  host.mock.activeEditor.fire(editor);
}

function select(editor: FakeEditor, selection: FakeSelection): void {
  editor.selection = selection;
  host.mock.selection.fire({ textEditor: editor });
}

describe('VsCodeEditorContext.currentSelection', () => {
  let context: VsCodeEditorContext;
  let fired: number;

  const start = (active?: FakeEditor): void => {
    host.window.activeTextEditor = active;
    context = new VsCodeEditorContext();
    fired = 0;
    context.onDidChangeSelection(() => { fired += 1; });
  };

  afterEach(() => {
    context.dispose();
    host.window.activeTextEditor = undefined;
  });

  it('reports nothing before any text editor has had focus', () => {
    start();
    expect(context.currentSelection()).toBeUndefined();
  });

  it('reads the focused editor at construction, with its lines', () => {
    start(editorOf('/novel/alice-ch3.md', range(0, 1)));
    expect(context.currentSelection()).toEqual(expect.objectContaining({
      text: ALICE_LINES.slice(0, 2).join('\n'),
      isEmpty: false,
      relativePath: 'alice-ch3.md',
      startLine: 1,
      endLine: 2
    }));
  });

  it('reports a deselect as empty, while the remembered selection still stands', () => {
    const editor = editorOf('/novel/alice-ch3.md', range(0, 1));
    start(editor);
    select(editor, caret(2));
    expect(fired).toBe(1);
    expect(context.currentSelection()).toEqual(expect.objectContaining({ isEmpty: true, text: '' }));
    // The Workshop tab takes focus: VS Code reports no active text editor.
    focus(undefined);
    expect(context.currentSelection()).toEqual(expect.objectContaining({ isEmpty: true }));
    // The legacy memory is untouched: its paste verification compares exactly.
    expect(context.getActiveSelection()).toEqual(expect.objectContaining({ isEmpty: false, startLine: 1, endLine: 2 }));
  });

  it('keeps the last focused editor when a webview takes focus, and fires nothing for that', () => {
    const editor = editorOf('/novel/alice-ch3.md', range(1, 1));
    start(editor);
    focus(undefined);
    expect(fired).toBe(0);
    expect(context.currentSelection()).toEqual(expect.objectContaining({ text: ALICE_LINES[1], startLine: 2, endLine: 2 }));
  });

  it('follows focus to another editor and fires', () => {
    const first = editorOf('/novel/alice-ch3.md', range(0, 0));
    const second = editorOf('/novel/alice-ch4.md', range(2, 2));
    start(first);
    focus(second);
    expect(fired).toBe(1);
    expect(context.currentSelection()).toEqual(expect.objectContaining({ relativePath: 'alice-ch4.md', text: ALICE_LINES[2] }));
  });

  it('fires on an edit inside the selection, and reads the edited text', () => {
    const editor = editorOf('/novel/alice-ch3.md', range(1, 1));
    start(editor);
    editor.document.lines[1] = 'At last the Caterpillar put the hookah down.';
    host.mock.documentChanged.fire({ document: editor.document });
    expect(fired).toBe(1);
    expect(context.currentSelection()?.text).toBe('At last the Caterpillar put the hookah down.');
  });

  it('ignores an edit to another document', () => {
    const editor = editorOf('/novel/alice-ch3.md', range(1, 1));
    start(editor);
    host.mock.documentChanged.fire({ document: editorOf('/novel/alice-ch4.md', caret(0)).document });
    expect(fired).toBe(0);
  });

  it('reports nothing once its document has closed, and fires', () => {
    const editor = editorOf('/novel/alice-ch3.md', range(0, 2));
    start(editor);
    focus(undefined);
    editor.document.isClosed = true;
    // Closed counts as nothing even before the close event arrives.
    expect(context.currentSelection()).toBeUndefined();
    host.mock.documentClosed.fire(editor.document);
    expect(fired).toBe(1);
    expect(context.currentSelection()).toBeUndefined();
  });

  it('ignores editors outside the editor area', () => {
    const editor = editorOf('/novel/alice-ch3.md', range(0, 0));
    const output = editorOf('/output', range(0, 1), 'panel');
    start(editor);
    focus(output);
    select(output, range(0, 2));
    expect(fired).toBe(0);
    expect(context.currentSelection()).toEqual(expect.objectContaining({ relativePath: 'alice-ch3.md' }));
  });

  it('stops listening on dispose, to VS Code and for its own listeners', () => {
    const editor = editorOf('/novel/alice-ch3.md', range(0, 0));
    start(editor);
    const subscription = context.onDidChangeSelection(() => { fired += 100; });
    subscription.dispose();
    select(editor, range(1, 1));
    expect(fired).toBe(1);
    context.dispose();
    expect(host.mock.selection.size()).toBe(0);
    expect(host.mock.activeEditor.size()).toBe(0);
    expect(host.mock.documentChanged.size()).toBe(0);
    expect(host.mock.documentClosed.size()).toBe(0);
  });
});
