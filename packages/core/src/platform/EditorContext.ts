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
  /**
   * 1-based inclusive selection lines (Sprint 12 provenance). Optional at this
   * boundary: a non-editor host may not have line positions; adapters that do
   * must normalize through `toInclusiveLineRange` so every host reports the
   * same range for the same selection. Absent when `isEmpty`.
   */
  startLine?: number;
  endLine?: number;
}

/** 1-based inclusive line range, as carried by selection provenance. */
export interface SelectionLineRange {
  startLine: number;
  endLine: number;
}

/**
 * Normalize a zero-based host-editor selection into the 1-based INCLUSIVE
 * range provenance carries. A selection ending at character 0 of a later line
 * contains no text from that line, so the range honestly stops on the
 * previous one.
 */
export function toInclusiveLineRange(input: {
  /** Zero-based line the selection starts on. */
  startLine: number;
  /** Zero-based line the selection ends on. */
  endLine: number;
  /** Zero-based character offset of the selection end within its line. */
  endCharacter: number;
}): SelectionLineRange {
  const endsAtLineStart = input.endCharacter === 0 && input.endLine > input.startLine;
  return {
    startLine: input.startLine + 1,
    endLine: endsAtLineStart ? input.endLine : input.endLine + 1
  };
}

export interface EditorContext {
  /**
   * The active editor's current selection. When an editor is open but nothing
   * is selected, returns info with `isEmpty: true` and `text: ''` (callers
   * distinguish "no editor" from "no selection").
   *
   * When NO text editor is focused — e.g. a webview panel like the Workshop
   * tab holds focus — adapters SHOULD fall back to the most recent real
   * editor selection rather than returning `undefined` (Sprint 12): paste
   * verification compares exactly, so a remembered selection that doesn't
   * match the pasted text verifies nothing, and one that does is precisely
   * the provenance being claimed. Returns `undefined` only when there is no
   * active editor and no remembered selection.
   */
  getActiveSelection(): ActiveSelectionInfo | undefined;
}
