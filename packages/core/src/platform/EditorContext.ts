/**
 * EditorContext - platform port for reading the host's active text editor
 * (ADR 2026-06-16).
 *
 * A `vscode`-free interface so the "analyze the current selection" flows can be
 * reused across runtimes:
 *   - VS Code adapter  = `VsCodeEditorContext`, wrapping
 *     `vscode.window.activeTextEditor` (see `src/platform/vscode/`).
 *   - Desktop adapter  = a binding to the desktop app's own editor surface.
 *
 * This port has no FrameMinion analog (FrameMinion has no editor concept). It
 * backs the "Analyze with Prose Minion" context-menu command, the metrics
 * `selection`/`activeFile` source modes, and the webview's selection request.
 */

export interface ActiveSelectionInfo {
  /** Selected text (empty string when the selection is empty). */
  text: string;
  /** True when there is no non-empty selection (an editor is still open). */
  isEmpty: boolean;
  /** `document.uri.toString()` — opaque source id carried in payloads. */
  uriString: string;
  /** `document.uri.fsPath` — absolute path, for file resolution. */
  fsPath: string;
  /** `workspace.asRelativePath(uri, false)` — display/source path. */
  relativePath: string;
}

export interface EditorContext {
  /**
   * The active editor's current selection, or `undefined` when there is NO
   * active text editor. When an editor is open but nothing is selected, returns
   * info with `isEmpty: true` and `text: ''` (callers distinguish "no editor"
   * from "no selection").
   */
  getActiveSelection(): ActiveSelectionInfo | undefined;
}
