/**
 * ShellService - platform port for host "shell" operations that are NOT file I/O
 * (those use the FileSystem port). ADR 2026-06-16.
 *
 * A `vscode`-free interface so host interactions can be reused across runtimes:
 *   - VS Code adapter  = `VsCodeShellService`, a behavior-preserving pass-through
 *     over `vscode.window` / `vscode.env` (see `src/platform/vscode/`).
 *   - Desktop adapter  = an app-owned shell (`dialog.*`, `clipboard.*`) conforming
 *     to this shape.
 *
 * Scoped to exactly what Prose Minion's core uses: notifications (incl. a modal
 * Yes/No confirm), clipboard read+write, and opening a saved/reference file in an
 * editor. The editor-column logic for "open beside the webview" lives in the VS
 * Code adapter, not in core.
 */

export interface ShellService {
  /** Non-modal notification with optional action buttons; resolves to the chosen action or undefined. */
  showInformationMessage(message: string, ...actions: string[]): Promise<string | undefined>;
  /** Modal (blocking) confirm with optional action buttons; resolves to the chosen action or undefined. */
  showModalInformationMessage(message: string, ...actions: string[]): Promise<string | undefined>;
  copyToClipboard(text: string): Promise<void>;
  readClipboard(): Promise<string>;
  /**
   * Open a file in an editor tab. With `{ beside: true }` the file opens in the
   * second editor column (or beside the webview on first open) — preserving
   * UIHandler's guide/docs/resource viewing behavior. Without it, the file opens
   * in the active column (the saved-report behavior).
   */
  openFileInEditor(filePath: string, options?: { beside?: boolean }): Promise<void>;
}
