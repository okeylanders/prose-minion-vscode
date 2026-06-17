/**
 * Workspace - platform port for workspace-folder + extension-resource resolution
 * (ADR 2026-06-16).
 *
 * A `vscode`-free interface so the "where do I read/write files?" layer can be
 * reused across runtimes:
 *   - VS Code adapter  = `VsCodeWorkspace`, wrapping
 *     `vscode.workspace.workspaceFolders` / `asRelativePath` / `findFiles` + the
 *     extension URI (see `src/platform/vscode/`).
 *   - Desktop adapter  = an app-owned resolver (project root + app resources dir).
 *
 * The folder + glob methods are CALLED LIVE on each invocation — workspace
 * folders change at runtime — so the adapter must NOT cache them. `extensionPath`
 * is stable for the process lifetime and is exposed as a readonly property.
 *
 * `asRelativePath` and `findFiles` are Prose-Minion additions over FrameMinion's
 * Workspace port: the context/metrics resolvers discover reference files via
 * user-configured glob patterns and display them workspace-relative.
 */

export interface WorkspaceFolderInfo {
  /** Absolute filesystem path of the folder. */
  path: string;
  /** Display name. */
  name: string;
}

export interface Workspace {
  /** All open workspace folders as absolute paths (live; reflects current state). */
  workspaceFolders(): WorkspaceFolderInfo[];
  /** Extension install dir (bundled resources live under `<extensionPath>/resources`). */
  readonly extensionPath: string;
  /**
   * Compute a path relative to its containing workspace folder. Mirrors
   * `vscode.workspace.asRelativePath(path, includeWorkspaceFolder)`; defaults to
   * NOT including the folder name (the prior call sites all passed `false`).
   */
  asRelativePath(absolutePath: string, includeWorkspaceFolder?: boolean): string;
  /**
   * Glob-find files within one workspace folder. Returns matched ABSOLUTE paths.
   * Mirrors `findFiles(new RelativePattern(folderPath, includeGlob), excludeGlob)`.
   */
  findFiles(folderPath: string, includeGlob: string, excludeGlob?: string): Promise<string[]>;
}
