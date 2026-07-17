/**
 * VsCodeEditorContext - VS Code adapter for the `EditorContext` port.
 *
 * Wraps `vscode.window.activeTextEditor`. Returns `undefined` when no editor is
 * active; otherwise bundles the selection text, ids, and workspace-relative path
 * so core never touches `vscode.Uri` or the editor object.
 */
import * as vscode from 'vscode';
import { ActiveSelectionInfo, EditorContext, toInclusiveLineRange } from '@prose-minion/core';

export class VsCodeEditorContext implements EditorContext {
  getActiveSelection(): ActiveSelectionInfo | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
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
}
