/**
 * VsCodeShellService - VS Code adapter for the `ShellService` port.
 *
 * Behavior-preserving pass-throughs over `vscode.window` / `vscode.env`. The
 * editor-column logic for `openFileInEditor({ beside: true })` (reuse column two,
 * else open beside the webview) is moved here verbatim from UIHandler — it is a
 * VS-Code-specific editor-layout concern, so it belongs in the adapter, not core.
 */
import * as vscode from 'vscode';
import { PickedFile, ShellService } from '@prose-minion/core';

export class VsCodeShellService implements ShellService {
  showInformationMessage(message: string, ...actions: string[]): Promise<string | undefined> {
    return Promise.resolve(vscode.window.showInformationMessage(message, ...actions));
  }

  showModalInformationMessage(message: string, ...actions: string[]): Promise<string | undefined> {
    return Promise.resolve(vscode.window.showInformationMessage(message, { modal: true }, ...actions));
  }

  copyToClipboard(text: string): Promise<void> {
    return Promise.resolve(vscode.env.clipboard.writeText(text));
  }

  readClipboard(): Promise<string> {
    return Promise.resolve(vscode.env.clipboard.readText());
  }

  async pickFile(options?: { title?: string; filters?: Record<string, string[]> }): Promise<PickedFile | undefined> {
    const [chosen] = (await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFolders: false,
      openLabel: 'Pin',
      title: options?.title,
      filters: options?.filters
    })) ?? [];
    return chosen ? { fsPath: chosen.fsPath, uri: chosen.toString() } : undefined;
  }

  async openFileInEditor(filePath: string, options?: { beside?: boolean }): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    if (options?.beside) {
      const document = await vscode.workspace.openTextDocument(uri);
      // Reuse the second column if any editor is open, else open beside the webview.
      const targetColumn = vscode.window.visibleTextEditors.length > 0
        ? vscode.ViewColumn.Two
        : vscode.ViewColumn.Beside;
      await vscode.window.showTextDocument(document, { preview: false, viewColumn: targetColumn });
    } else {
      await vscode.window.showTextDocument(uri, { preview: false });
    }
  }
}
