/**
 * VsCodeEditorContext - VS Code adapter for the `EditorContext` port.
 *
 * Wraps `vscode.window.activeTextEditor`, with one deliberate wrinkle: when a
 * webview PANEL holds focus (the Workshop editor tab), VS Code reports NO
 * active text editor — the panel is the active editor. A paste into the
 * Workshop's excerpt box would therefore never see the selection it was
 * copied from. So this adapter remembers the most recent real editor
 * selection (editor-area editors only — `viewColumn` filters out output and
 * debug consoles) and serves it whenever no text editor is focused.
 *
 * Serving a remembered selection is safe for verification flows because the
 * consumer compares EXACTLY: a stale selection that doesn't match the pasted
 * text verifies nothing. Returns `undefined` only when there is no active
 * editor AND nothing was ever selected.
 */
import * as vscode from 'vscode';
import { ActiveSelectionInfo, EditorContext, toInclusiveLineRange } from '@prose-minion/core';

function selectionInfo(editor: vscode.TextEditor): ActiveSelectionInfo {
  const selection = editor.selection;
  const text = editor.document.getText(selection);
  const isEmpty = selection.isEmpty || text.length === 0;
  const lineRange = isEmpty
    ? undefined
    : toInclusiveLineRange({
        startLine: selection.start.line,
        endLine: selection.end.line,
        endCharacter: selection.end.character
      });
  return {
    text,
    isEmpty,
    uriString: editor.document.uri.toString(),
    fsPath: editor.document.uri.fsPath,
    relativePath: vscode.workspace.asRelativePath(editor.document.uri, false),
    startLine: lineRange?.startLine,
    endLine: lineRange?.endLine,
  };
}

export class VsCodeEditorContext implements EditorContext, vscode.Disposable {
  private lastSelection?: ActiveSelectionInfo;
  private readonly subscription: vscode.Disposable;

  constructor() {
    const active = vscode.window.activeTextEditor;
    if (active && active.viewColumn !== undefined) {
      const seed = selectionInfo(active);
      if (!seed.isEmpty) {
        this.lastSelection = seed;
      }
    }
    this.subscription = vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor.viewColumn === undefined) {
        return; // output channels / debug console — not writer selections
      }
      const info = selectionInfo(event.textEditor);
      if (!info.isEmpty) {
        this.lastSelection = info;
      }
    });
  }

  getActiveSelection(): ActiveSelectionInfo | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      return selectionInfo(editor);
    }
    // No focused text editor (a webview panel is active): fall back to the
    // last real selection so paste-verification can still compare against it.
    return this.lastSelection;
  }

  dispose(): void {
    this.subscription.dispose();
  }
}
