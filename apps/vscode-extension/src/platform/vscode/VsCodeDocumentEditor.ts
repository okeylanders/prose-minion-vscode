/**
 * VsCodeDocumentEditor - VS Code adapter for the `DocumentEditor` port
 * (ADR 2026-10-21 D3).
 *
 * A watch follows one lifetime of an open document: it collects each change
 * event's `contentChanges` (offsets in the text before that event), and it
 * ends as `closed` on the document's close event. VS Code closes a document
 * and opens it again when its language changes, and a reopened document is a
 * new object whose versions start over, so neither a URI nor a version
 * identifies a lifetime (PR #171 F-04). A closed document is never reopened
 * to read it: only open documents are watched.
 *
 * Snapshots read the live buffer, unsaved edits included, never the disk.
 */
import * as vscode from 'vscode';
import type { DocumentEditor, DocumentTextChange, DocumentWatch, DocumentWatchResult } from '@prose-minion/core';

interface WatchState {
  readonly uri: string;
  readonly document: vscode.TextDocument;
  readonly edits: DocumentTextChange[][];
  closed: boolean;
}

export class VsCodeDocumentEditor implements DocumentEditor, vscode.Disposable {
  private readonly watches = new Set<WatchState>();
  private readonly subscriptions: vscode.Disposable[];

  constructor() {
    this.subscriptions = [
      vscode.workspace.onDidChangeTextDocument((event) => this.record(event)),
      vscode.workspace.onDidCloseTextDocument((document) => this.close(document))
    ];
  }

  watch(uri: string, version: number): DocumentWatch | undefined {
    const document = vscode.workspace.textDocuments.find((each) => each.uri.toString() === uri);
    if (!document || document.isClosed || document.version !== version) {
      return undefined;
    }
    const state: WatchState = { uri, document, edits: [], closed: false };
    this.watches.add(state);
    const end = () => {
      this.watches.delete(state);
    };
    return {
      settle: (): DocumentWatchResult => {
        end();
        if (state.closed || document.isClosed) {
          return { kind: 'closed' };
        }
        return {
          kind: 'open',
          snapshot: { uri, version: document.version, text: document.getText(), languageId: document.languageId },
          edits: state.edits
        };
      },
      dispose: end
    };
  }

  dispose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.watches.clear();
  }

  private record(event: vscode.TextDocumentChangeEvent): void {
    if (event.contentChanges.length === 0) {
      return;
    }
    const uri = event.document.uri.toString();
    const changes = event.contentChanges.map((change) => ({ offset: change.rangeOffset, length: change.rangeLength, text: change.text }));
    for (const state of this.watches) {
      if (state.uri === uri) {
        state.edits.push(changes);
      }
    }
  }

  private close(document: vscode.TextDocument): void {
    const uri = document.uri.toString();
    for (const state of this.watches) {
      if (state.uri === uri) {
        state.closed = true;
      }
    }
  }
}
