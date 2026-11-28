import * as vscode from 'vscode';
import { openTextTabUris } from './vscodeTextTabs';
import type { WorkshopHighlightDocuments } from '@prose-minion/core';

export class VsCodeWorkshopHighlightDocuments implements WorkshopHighlightDocuments {
  captureTabClosures() {
    // Authorization can recover a moved file. Track closures during this gesture and check the eventual target.
    const closed = new Set<string>();
    let previous = openTextTabUris();
    const changed = () => {
      const open = openTextTabUris();
      for (const uri of previous) {
        if (!open.has(uri)) { closed.add(uri); }
      }
      previous = open;
    };
    const tabs = vscode.window.tabGroups.onDidChangeTabs(changed);
    const groups = vscode.window.tabGroups.onDidChangeTabGroups(changed);
    return {
      current: (fsPath: string) => !closed.has(vscode.Uri.file(fsPath).toString()),
      dispose() { tabs.dispose(); groups.dispose(); }
    };
  }

  readOpen(fsPath: string) {
    const uri = vscode.Uri.file(fsPath).toString();
    if (!openTextTabUris().has(uri)) { return undefined; }
    const document = vscode.workspace.textDocuments.find(doc => !doc.isClosed && doc.uri.toString() === uri);
    return document && { uri, version: document.version, languageId: document.languageId, text: document.getText() };
  }

  async reveal(fsPath: string, current: () => boolean): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fsPath));
      if (!current() || document.isClosed) { return false; }
      await vscode.window.showTextDocument(document, { preview: true });
      return !document.isClosed;
    } catch {
      return false;
    }
  }
}
