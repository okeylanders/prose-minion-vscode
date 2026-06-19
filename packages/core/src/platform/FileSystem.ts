/**
 * FileSystem - platform port for byte-level file I/O on string paths
 * (ADR 2026-06-16).
 *
 * A `vscode`-free interface so the file-access layer can be reused across
 * runtimes:
 *   - VS Code adapter  = `VsCodeFileSystem`, a pass-through over
 *     `vscode.workspace.fs` + `vscode.Uri.file()` (see `src/platform/vscode/`).
 *     Backing it with `workspace.fs` (NOT Node `fs`) preserves virtual/remote-FS
 *     support that Node would silently drop.
 *   - Desktop adapter  = a Node-`fs` adapter conforming to this shape.
 *
 * The interface mirrors `vscode.workspace.fs`'s SHAPE on plain string paths so
 * consumer logic barely changes. The numeric `FileType` values EXACTLY match
 * `vscode.FileType`, so `readDirectory` tuples and `stat().type` comparisons are
 * byte-compatible with the prior inline vscode calls.
 *
 * Semantics callers rely on (the VS Code adapter backs these with
 * `vscode.workspace.fs`; a future Node-fs adapter MUST replicate them):
 *   - `writeFile` auto-creates parent directories (mkdir -p before write).
 *     `vscode.workspace.fs.writeFile` does NOT do this on its own, so the adapter
 *     `createDirectory`s the parent first to honor this contract.
 *   - `stat` / `readFile` THROW on a missing path; callers catch for existence.
 *   - `createDirectory` is recursive and idempotent.
 */

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export interface FileStat {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;
}

export interface FileSystem {
  /** Read a file's bytes. Throws if missing (mirrors workspace.fs). */
  readFile(path: string): Promise<Uint8Array>;
  /** Write bytes, creating parent directories as needed (workspace.fs semantics). */
  writeFile(path: string, data: Uint8Array): Promise<void>;
  /** List a directory as [name, type] tuples. */
  readDirectory(path: string): Promise<Array<[string, FileType]>>;
  /** Stat a path. Throws if missing (callers catch for existence checks). */
  stat(path: string): Promise<FileStat>;
  /** Create a directory (recursive, idempotent — workspace.fs semantics). */
  createDirectory(path: string): Promise<void>;
}
