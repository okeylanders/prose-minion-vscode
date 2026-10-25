/**
 * VsCodeDocumentEditor - VS Code adapter for the `DocumentEditor` port
 * (ADR 2026-10-21 D3).
 *
 * A snapshot reads the live buffer: an open document as it stands, unsaved
 * edits included, or one loaded through `openTextDocument` without showing
 * it. It never reads the disk directly, so a dirty buffer is never mistaken
 * for its saved copy.
 */
import * as vscode from 'vscode';
import type { DocumentEditor, DocumentSnapshot } from '@prose-minion/core';

export class VsCodeDocumentEditor implements DocumentEditor {
  async snapshot(uri: string): Promise<DocumentSnapshot | undefined> {
    try {
      const open = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri);
      const document = open ?? await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
      return { uri, version: document.version, text: document.getText(), languageId: document.languageId };
    } catch {
      return undefined;
    }
  }
}
