/**
 * VsCodeEditorContext - VS Code adapter for the `EditorContext` port.
 *
 * Wraps `vscode.window.activeTextEditor`. Returns `undefined` when no editor is
 * active; otherwise bundles the selection text, ids, and workspace-relative path
 * so core never touches `vscode.Uri` or the editor object.
 */
import * as vscode from 'vscode';
import { ActiveSelectionInfo, EditorContext } from '../EditorContext';

export class VsCodeEditorContext implements EditorContext {
  getActiveSelection(): ActiveSelectionInfo | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    const selection = editor.selection;
    const text = editor.document.getText(selection);
    return {
      text,
      isEmpty: selection.isEmpty || text.length === 0,
      uriString: editor.document.uri.toString(),
      fsPath: editor.document.uri.fsPath,
      relativePath: vscode.workspace.asRelativePath(editor.document.uri, false),
    };
  }
}
