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
 * Yes/No confirm), clipboard read+write, opening a saved/reference file in an
 * editor, and a single-file open dialog (the Workshop's "Pin from file…" seam,
 * ADR 2026-07-03 Sprint 3), and revealing a user-owned session file in the
 * host OS. The editor-column logic for "open beside the webview" and the
 * operating-system reveal command live in the VS Code adapter, not in core.
 */

/** Result of a file-picker dialog: the chosen file, in both path and URI form. */
export interface PickedFile {
  /** Absolute filesystem path (feeds the FileSystem port). */
  fsPath: string;
  /** URI string (e.g. `file:///…`) for provenance display/linking. */
  uri: string;
}

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
  /**
   * Reveal a user-owned file in the host operating system's file browser.
   * This is intentionally distinct from `openFileInEditor`: Session Browser's
   * “Reveal file” action should show the inspectable JSON on disk, not open it
   * as an editor document.
   */
  revealFileInOS(filePath: string): Promise<void>;
  /**
   * Open the host's single-file picker. Resolves to the chosen file, or
   * undefined when the user dismisses the dialog (dismissal is not an error).
   * `filters` maps display names to extension lists, mirroring
   * `vscode.OpenDialogOptions.filters`.
   */
  pickFile(options?: { title?: string; filters?: Record<string, string[]> }): Promise<PickedFile | undefined>;
}
