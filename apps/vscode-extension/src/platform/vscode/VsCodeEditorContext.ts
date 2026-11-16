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
 *
 * Selected Text (ADR 2026-11-14 D10) needs the opposite of a memory: what is
 * selected *now*. `currentSelection()` reads the last focused editor-area
 * editor live, so a deselect reports empty and a closed document reports
 * nothing, and `onDidChangeSelection` fires, raw, whenever that answer may
 * have changed. `getActiveSelection()` and its remembered selection are
 * untouched; its callers' paste verification depends on them.
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
  /** The last editor-area text editor that had focus; a webview tab taking focus leaves it standing. */
  private lastEditor?: vscode.TextEditor;
  private readonly selectionListeners = new Set<() => void>();
  private readonly subscriptions: vscode.Disposable[];

  constructor() {
    const active = vscode.window.activeTextEditor;
    if (active && active.viewColumn !== undefined) {
      this.lastEditor = active;
      const seed = selectionInfo(active);
      if (!seed.isEmpty) {
        this.lastSelection = seed;
      }
    }
    this.subscriptions = [
      vscode.window.onDidChangeTextEditorSelection((event) => {
        if (event.textEditor.viewColumn === undefined) {
          return; // output channels / debug console — not writer selections
        }
        const info = selectionInfo(event.textEditor);
        if (!info.isEmpty) {
          this.lastSelection = info;
        }
        // A selection made in the focused editor makes it the last focused one, even if no focus event was seen.
        if (event.textEditor === vscode.window.activeTextEditor) {
          this.lastEditor = event.textEditor;
        }
        if (event.textEditor === this.lastEditor) {
          this.fireSelectionChanged();
        }
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        // `undefined` is a webview or nothing taking focus: the last text editor stands.
        if (!editor || editor.viewColumn === undefined || editor === this.lastEditor) {
          return;
        }
        this.lastEditor = editor;
        this.fireSelectionChanged();
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (this.lastEditor && event.document === this.lastEditor.document) {
          this.fireSelectionChanged();
        }
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        if (this.lastEditor && document === this.lastEditor.document) {
          this.lastEditor = undefined;
          this.fireSelectionChanged();
        }
      })
    ];
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

  currentSelection(): ActiveSelectionInfo | undefined {
    const editor = this.lastEditor;
    // A closed document counts as nothing, whether or not its close event has been seen yet.
    if (!editor || editor.document.isClosed) {
      return undefined;
    }
    return selectionInfo(editor);
  }

  onDidChangeSelection(listener: () => void): { dispose(): void } {
    this.selectionListeners.add(listener);
    return { dispose: () => { this.selectionListeners.delete(listener); } };
  }

  private fireSelectionChanged(): void {
    for (const listener of Array.from(this.selectionListeners)) {
      try {
        listener();
      } catch {
        // A listener's failure is its own; the editor's events never depend on one.
      }
    }
  }

  dispose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.selectionListeners.clear();
  }
}
