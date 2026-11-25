/**
 * VsCodeFileSystem - VS Code adapter for the `FileSystem` port.
 *
 * File operations go through `vscode.workspace.fs` for virtual/remote
 * providers. Local rolling claims can release their own token when VS Code closes
 * the RPC channel during window reload. The other methods are
 * pass-throughs of the prior inline calls, on plain string paths.
 *
 * CAVEAT (string-path port boundary): each call reconstructs a URI via
 * `vscode.Uri.file(path)`, which forces the `file:` scheme. So this faithfully
 * preserves behavior for `file://` workspaces (the norm), but a non-`file://`
 * path (e.g. a `vscode-vfs://` remote) is rebuilt as `file:` and effectively
 * degrades — the original scheme is lost on the `fsPath` round-trip. Promoting
 * full URI fidelity into the port is the documented fix if that ever matters
 * (see migration tech-debt notes).
 *
 * `writeFile` does MORE than the bare `workspace.fs` call: the port contract
 * promises mkdir-p, but `vscode.workspace.fs.writeFile` throws on a missing
 * parent — so this adapter `createDirectory`s the parent first (recursive +
 * idempotent). At every prior call site the parent already existed, so this is a
 * superset of the old behavior. `rename` and `delete` preserve the native
 * workspace filesystem operations so persistence can replace temp checkpoints
 * without a read/write/delete emulation. `stat`/`readDirectory` map fields
 * explicitly so a future shape-drift is caught by the compiler instead of
 * suppressed.
 */
import * as fs from 'node:fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { FileStat, FileSystem, FileType } from '@prose-minion/core';

export class VsCodeFileSystem implements FileSystem {
  prepareRollingClaimRelease(filePath: string, token: string): (() => boolean) | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (vscode.env?.remoteName || folders?.length !== 1 || !/^[a-f0-9-]{36}$/.test(token)) {
      return undefined;
    }
    const root = folders[0].uri;
    if (root.scheme !== 'file' || root.authority || path.dirname(filePath) !== path.join(root.fsPath, 'prose-minion', 'sessions') ||
        !/^current(?:-[a-f0-9-]{36})?\.json$/.test(path.basename(filePath))) {
      return undefined;
    }
    // The local renderer can close its filesystem RPC while deactivate is still awaiting this
    // writer. Verify the exact token exists on this host before choosing a native release.
    const lock = path.join(path.dirname(filePath), `.${path.basename(filePath)}.lock`);
    const own = path.join(lock, token);
    const marker = path.join(lock, `owner-${token}.json`);
    const ownsToken = () => fs.lstatSync(lock, { throwIfNoEntry: false })?.isDirectory() &&
      fs.lstatSync(marker, { throwIfNoEntry: false })?.isFile();
    try {
      if (!ownsToken()) { return undefined; }
    } catch {
      return undefined;
    }
    return () => {
      try {
        if (!ownsToken()) {
          return true; // Our token is gone. Leave any successor alone.
        }
        // Rolling claims have an empty private folder. No recursive removals, even on a damaged lock.
        if (fs.lstatSync(own, { throwIfNoEntry: false })) { fs.rmdirSync(own); }
        fs.unlinkSync(marker);
        fs.rmdirSync(lock);
        return true;
      } catch {
        return false;
      }
    };
  }

  readFile(filePath: string): Promise<Uint8Array> {
    return Promise.resolve(vscode.workspace.fs.readFile(vscode.Uri.file(filePath)));
  }

  async writeFile(filePath: string, data: Uint8Array): Promise<void> {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(filePath)));
    await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), data);
  }

  rename(fromPath: string, toPath: string, options?: { overwrite?: boolean }): Promise<void> {
    return Promise.resolve(
      vscode.workspace.fs.rename(vscode.Uri.file(fromPath), vscode.Uri.file(toPath), {
        overwrite: options?.overwrite ?? false,
      })
    );
  }

  delete(filePath: string, options?: { recursive?: boolean }): Promise<void> {
    return Promise.resolve(
      vscode.workspace.fs.delete(vscode.Uri.file(filePath), {
        recursive: options?.recursive ?? false,
      })
    );
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
