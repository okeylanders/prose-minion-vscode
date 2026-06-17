/**
 * VsCodeWorkspace - VS Code adapter for the `Workspace` port.
 *
 * Folder/glob/relative-path readers delegate to `vscode.workspace.*` fresh on
 * each call so they reflect runtime `onDidChangeWorkspaceFolders` changes (no
 * folder cache). `extensionPath` is captured once from the extension URI the
 * composition root injects.
 */
import * as vscode from 'vscode';
import { Workspace, WorkspaceFolderInfo } from '../Workspace';

export class VsCodeWorkspace implements Workspace {
  constructor(private readonly extensionUri: vscode.Uri) {}

  get extensionPath(): string {
    return this.extensionUri.fsPath;
  }

  workspaceFolders(): WorkspaceFolderInfo[] {
    return (vscode.workspace.workspaceFolders ?? []).map((folder) => ({
      path: folder.uri.fsPath,
      name: folder.name,
    }));
  }

  // NOTE: `Uri.file()` forces the `file:` scheme on the string-path boundary, so
  // a non-`file://` workspace degrades here (the original scheme is not
  // recoverable from `fsPath`). Faithful for `file://` workspaces (the norm).
  asRelativePath(absolutePath: string, includeWorkspaceFolder = false): string {
    return vscode.workspace.asRelativePath(vscode.Uri.file(absolutePath), includeWorkspaceFolder);
  }

  async findFiles(folderPath: string, includeGlob: string, excludeGlob?: string): Promise<string[]> {
    const pattern = new vscode.RelativePattern(vscode.Uri.file(folderPath), includeGlob);
    const uris = await vscode.workspace.findFiles(pattern, excludeGlob);
    return uris.map((uri) => uri.fsPath);
  }
}
