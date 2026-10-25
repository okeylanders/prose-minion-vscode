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
 *
 * `applyEdits` (Slice 2) checks the version synchronously, then makes one
 * `WorkspaceEdit` (one undo step), and never saves. For review, each entry
 * carries `needsConfirmation`, which is how an extension opens Refactor
 * Preview; VS Code lists such entries unchecked, so nothing changes until the
 * writer ticks them. What `workspace.applyEdit` resolves to, read from VS
 * Code's source at 1.82.0 and at main (ADR 2026-10-21, Slice 2 amendment):
 * - `true` when any edit was applied, the writer's ticked subset included;
 * - `false` when the preview was discarded, when the buffer changed while it
 *   was open (VS Code refuses: "has changed in the meantime"), or when the
 *   buffer moved after this check (each edit carries the document's version,
 *   and VS Code refuses a stale one).
 * So `false` is told apart by the version, and only the applier's watch shows
 * which edits landed: VS Code may split an edit into smaller ones first.
 */
import * as vscode from 'vscode';
import type {
  DocumentApplyOutcome,
  DocumentEditor,
  DocumentEditReview,
  DocumentTextChange,
  DocumentTextEdit,
  DocumentWatch,
  DocumentWatchResult
} from '@prose-minion/core';

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

  async applyEdits(
    uri: string,
    edits: readonly DocumentTextEdit[],
    options: { readonly expectedVersion: number; readonly review: DocumentEditReview }
  ): Promise<DocumentApplyOutcome> {
    const document = vscode.workspace.textDocuments.find((each) => each.uri.toString() === uri);
    if (!document || document.isClosed) {
      return { kind: 'closed' };
    }
    if (document.version !== options.expectedVersion) {
      return { kind: 'stale' };
    }
    const change = new vscode.WorkspaceEdit();
    for (const edit of edits) {
      const range = new vscode.Range(document.positionAt(edit.start), document.positionAt(edit.end));
      if (options.review === 'preview') {
        change.replace(document.uri, range, edit.newText, {
          needsConfirmation: true,
          label: edit.label,
          ...(edit.description !== undefined ? { description: edit.description } : {})
        });
      } else {
        change.replace(document.uri, range, edit.newText);
      }
    }
    let applied: boolean;
    try {
      applied = await vscode.workspace.applyEdit(change);
    } catch (error) {
      return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
    }
    if (applied) {
      return { kind: 'submitted' };
    }
    if (document.isClosed) {
      return { kind: 'closed' };
    }
    if (document.version !== options.expectedVersion) {
      return { kind: 'stale' };
    }
    return options.review === 'preview'
      ? { kind: 'declined' }
      : { kind: 'failed', message: 'The editor did not apply the change.' };
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
