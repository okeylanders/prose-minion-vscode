import * as vscode from 'vscode';
import type { WorkshopHighlightDocuments } from '@prose-minion/core';

export class VsCodeWorkshopHighlightDocuments implements WorkshopHighlightDocuments {
  readOpen(fsPath: string) {
    const uri = vscode.Uri.file(fsPath).toString();
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
