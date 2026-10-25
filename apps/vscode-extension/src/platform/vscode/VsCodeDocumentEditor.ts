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
 *
 * A review should end when its document's lifetime does (PR #172 F-02). The
 * preview commits inside `applyEdit`, with no hook between the writer's Apply
 * and the write, and a language change moves no version, so VS Code itself
 * would apply the review to the document as it now reads. As a best-effort
 * mitigation, not a barrier, a held review whose document closes (which a
 * language change fires too) is ended with VS Code's own Discard
 * (`refactorPreview.discard`): nothing is written, and the answer is
 * `closed`.
 *
 * Discard acts on whichever preview holds the pane, so it is sent only once
 * the review's own preview holds it (`RefactorPreviews`, PR #172 F-06): at the
 * close if it already does, or when it opens after the close. A preview of
 * another review, another document or another extension is never discarded,
 * even while this review waits for VS Code's "Another refactoring is being
 * previewed" dialog; that preview's reviewer chose to replace it or not.
 *
 * The limit the writer accepted and the ADR states: the discard is sent when
 * the event reaches the extension host, so an Apply the writer makes before
 * then still lands, and the run reports the document closed and shows
 * nothing.
 */
import * as vscode from 'vscode';
import type {
  DocumentApplyOutcome,
  DocumentEditor,
  DocumentEditReview,
  DocumentTextChange,
  DocumentTextEdit,
  DocumentWatch,
  DocumentWatchResult,
  LogSink
} from '@prose-minion/core';
import { REFACTOR_PREVIEW_SCHEMES, RefactorPreviews, type PreviewDocumentUri } from './RefactorPreviews';

/** The command behind Refactor Preview's Discard button (`bulkEdit.contribution.ts`, at 1.82.0 and at main). */
export const REFACTOR_PREVIEW_DISCARD_COMMAND = 'refactorPreview.discard';

interface WatchState {
  readonly uri: string;
  readonly document: vscode.TextDocument;
  readonly edits: DocumentTextChange[][];
  closed: boolean;
}

/** A review VS Code is holding inside `applyEdit`. */
interface HeldReview {
  readonly uri: string;
  /** The previews open when it asked: none of them is its own. */
  readonly before: ReadonlySet<string>;
  /** Its document closed, reopened or changed language while it was held. */
  ended: boolean;
  discarded: boolean;
}

/** A document's URI as `RefactorPreviews` reads it; only a preview's copy names a file. */
function previewUriOf(document: vscode.TextDocument): PreviewDocumentUri {
  const { scheme, authority, query } = document.uri;
  if (!REFACTOR_PREVIEW_SCHEMES.has(scheme) || query === '') {
    return { scheme, authority, file: undefined };
  }
  try {
    return { scheme, authority, file: vscode.Uri.parse(query, true).toString() };
  } catch {
    return { scheme, authority, file: undefined };
  }
}

export class VsCodeDocumentEditor implements DocumentEditor, vscode.Disposable {
  private readonly watches = new Set<WatchState>();
  private readonly reviews = new Set<HeldReview>();
  private readonly previews = new RefactorPreviews();
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly log: LogSink) {
    vscode.workspace.textDocuments.forEach((document) => this.previews.opened(previewUriOf(document)));
    this.subscriptions = [
      vscode.workspace.onDidChangeTextDocument((event) => this.record(event)),
      vscode.workspace.onDidOpenTextDocument((document) => this.open(document)),
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
    const review: HeldReview | undefined = options.review === 'preview'
      ? { uri, before: this.previews.current(), ended: false, discarded: false }
      : undefined;
    if (review) {
      this.reviews.add(review);
    }
    let applied: boolean;
    try {
      applied = await vscode.workspace.applyEdit(change);
    } catch (error) {
      return { kind: 'failed', message: error instanceof Error ? error.message : String(error) };
    } finally {
      if (review) {
        this.reviews.delete(review);
      }
    }
    if (applied) {
      return { kind: 'submitted' };
    }
    if (document.isClosed || review?.ended) {
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
    this.reviews.clear();
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

  private open(document: vscode.TextDocument): void {
    if (this.previews.opened(previewUriOf(document))) {
      // A review whose document closed while VS Code was still opening its preview, or asking to replace another.
      this.discardHeld();
    }
  }

  private close(document: vscode.TextDocument): void {
    this.previews.closed(previewUriOf(document));
    const uri = document.uri.toString();
    for (const state of this.watches) {
      if (state.uri === uri) {
        state.closed = true;
      }
    }
    for (const review of this.reviews) {
      if (review.uri === uri) {
        review.ended = true;
      }
    }
    this.discardHeld();
  }

  /**
   * End, as its Discard button does, an ended review whose own preview holds
   * the pane. Never sent otherwise: Discard would end another's preview, or,
   * with none open, open an empty Refactor Preview panel.
   */
  private discardHeld(): void {
    const review = [...this.reviews].find((each) => each.ended && !each.discarded && this.previews.holds(each.uri, each.before));
    if (!review) {
      return;
    }
    review.discarded = true;
    this.log.appendLine('[DraftEdit] A document under review closed or changed language: discarding its Refactor Preview');
    Promise.resolve(vscode.commands.executeCommand(REFACTOR_PREVIEW_DISCARD_COMMAND)).catch((error: unknown) => {
      this.log.appendLine(`[DraftEdit] Refactor Preview was not discarded: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
}
