/**
 * VsCodeFileSystem - VS Code adapter for the `FileSystem` port.
 *
 * Backed by `vscode.workspace.fs` + `vscode.Uri.file()`, NOT Node `fs`:
 * workspace.fs preserves virtual/remote-FS support that Node fs would silently
 * drop. Pure pass-throughs of the prior inline calls, on plain string paths.
 *
 * `writeFile` does MORE than the bare `workspace.fs` call: the port contract
 * promises mkdir-p, but `vscode.workspace.fs.writeFile` throws on a missing
 * parent — so this adapter `createDirectory`s the parent first (recursive +
 * idempotent). At every prior call site the parent already existed, so this is a
 * superset of the old behavior. `stat`/`readDirectory` map fields explicitly so
 * a future shape-drift is caught by the compiler instead of suppressed.
 */
import * as path from 'path';
import * as vscode from 'vscode';
import { FileStat, FileSystem, FileType } from '../FileSystem';

export class VsCodeFileSystem implements FileSystem {
  readFile(filePath: string): Promise<Uint8Array> {
    return Promise.resolve(vscode.workspace.fs.readFile(vscode.Uri.file(filePath)));
  }

  async writeFile(filePath: string, data: Uint8Array): Promise<void> {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(filePath)));
    await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), data);
  }

  async readDirectory(filePath: string): Promise<Array<[string, FileType]>> {
    const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(filePath));
    return entries.map(([name, type]): [string, FileType] => [name, type as number as FileType]);
  }

  async stat(filePath: string): Promise<FileStat> {
    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    return {
      type: stat.type as number as FileType,
      ctime: stat.ctime,
      mtime: stat.mtime,
      size: stat.size,
    };
  }

  createDirectory(filePath: string): Promise<void> {
    return Promise.resolve(vscode.workspace.fs.createDirectory(vscode.Uri.file(filePath)));
  }
}
