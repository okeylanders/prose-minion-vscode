/**
 * RefactorPreviews - which Refactor Preview holds VS Code's pane, as far as
 * the extension host can tell (PR #172 F-06).
 *
 * VS Code gives an extension no handle on a preview, and its Discard command
 * acts on whichever preview holds the pane. A request made while another
 * preview is shown first waits, in a modal dialog, for the writer to agree to
 * replace it (`bulkEdit.contribution.ts` `_previewEdit`). Only once it holds
 * the pane does the preview copy each file it edits into a model of its own
 * (`bulkEditPreview.ts` `_init`), and those models reach the extension host as
 * documents (`shouldSynchronizeModel` excludes only too-large and
 * simple-widget models). Their URIs are the preview's
 * (`bulkEditPreview.ts` `asPreviewUri`):
 * - the scheme is `vscode-bulkeditpreview` at 1.82.0 and
 *   `vscode-bulkeditpreview-editor` at main;
 * - the authority is the preview's own instance id;
 * - the query is the file's URI.
 *
 * A review holds the pane when a preview opened after it asked covers its
 * document and nothing else, since a review edits one document. Anything less
 * certain counts as not held, so a scheme VS Code renames only ever leaves a
 * review undiscarded. A preview of several files whose first model alone has
 * opened would pass for one file until its next model opens.
 */

export const REFACTOR_PREVIEW_SCHEMES: ReadonlySet<string> = new Set(['vscode-bulkeditpreview', 'vscode-bulkeditpreview-editor']);

/** A document's URI as the preview reads: `file` is the query, parsed and written back (`uri.toString()`). */
export interface PreviewDocumentUri {
  readonly scheme: string;
  readonly authority: string;
  readonly file: string | undefined;
}

export class RefactorPreviews {
  /** Each open preview's files, by its instance id. */
  private readonly files = new Map<string, Set<string>>();

  /** Follow a document that opened; true when it is a preview's copy of a file. */
  opened(uri: PreviewDocumentUri): boolean {
    if (!REFACTOR_PREVIEW_SCHEMES.has(uri.scheme) || uri.authority === '' || !uri.file) {
      return false;
    }
    const files = this.files.get(uri.authority) ?? new Set<string>();
    files.add(uri.file);
    this.files.set(uri.authority, files);
    return true;
  }

  closed(uri: PreviewDocumentUri): void {
    const files = REFACTOR_PREVIEW_SCHEMES.has(uri.scheme) && uri.file ? this.files.get(uri.authority) : undefined;
    if (files && uri.file) {
      files.delete(uri.file);
      if (files.size === 0) {
        this.files.delete(uri.authority);
      }
    }
  }

  /** The previews open now, so a review can tell later ones from them. */
  current(): ReadonlySet<string> {
    return new Set(this.files.keys());
  }

  /** Whether a preview opened since `before` covers `file` and nothing else. */
  holds(file: string, before: ReadonlySet<string>): boolean {
    for (const [instance, files] of this.files) {
      if (!before.has(instance) && files.size === 1 && files.has(file)) {
        return true;
      }
    }
    return false;
  }
}
