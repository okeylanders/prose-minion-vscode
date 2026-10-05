/**
 * VsCodeShellService - VS Code adapter for the `ShellService` port.
 *
 * Behavior-preserving pass-throughs over `vscode.window` / `vscode.env`. The
 * editor-column logic for `openFileInEditor({ beside: true })` (reuse column two,
 * else open beside the webview) and the operating-system reveal command stay
 * here: they are VS-Code-specific UI concerns, so they belong in the adapter,
 * not core.
 */
import * as vscode from 'vscode';
import { PickedFile, ShellService } from '@prose-minion/core';

/**
 * Where a "beside" file opens: the second column when an editor is already
 * showing (reuse it), else beside the webview. Never the group whose active
 * tab is a webview panel: with the manuscript in column one and the Workshop
 * in column two, "column two" would cover the Workshop the writer is using.
 */
function besideColumn(): vscode.ViewColumn {
  const activeGroup = vscode.window.tabGroups.activeTabGroup;
  const webviewPanelIsActive = activeGroup.activeTab?.input instanceof vscode.TabInputWebview;
  const reuseSecondColumn = vscode.window.visibleTextEditors.length > 0
    && !(webviewPanelIsActive && activeGroup.viewColumn === vscode.ViewColumn.Two);
  return reuseSecondColumn ? vscode.ViewColumn.Two : vscode.ViewColumn.Beside;
}

export class VsCodeShellService implements ShellService {
  showInformationMessage(message: string, ...actions: string[]): Promise<string | undefined> {
    return Promise.resolve(vscode.window.showInformationMessage(message, ...actions));
  }

  showWarningMessage(message: string, ...actions: string[]): Promise<string | undefined> {
    return Promise.resolve(vscode.window.showWarningMessage(message, ...actions));
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
      await vscode.window.showTextDocument(document, { preview: false, viewColumn: besideColumn() });
    } else {
      await vscode.window.showTextDocument(uri, { preview: false });
    }
  }

  async revealFileInOS(filePath: string): Promise<void> {
    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(filePath));
  }

  async openFileInDefaultApp(filePath: string): Promise<void> {
    const opened = await vscode.env.openExternal(vscode.Uri.file(filePath));
    if (!opened) {
      throw new Error(`The host declined to open ${filePath} in its default application.`);
    }
  }
}
