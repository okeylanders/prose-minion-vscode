/**
 * VsCodeFileHistory - VS Code adapter for the `FileHistory` port (ADR
 * 2026-11-19 D12), over the built-in Git extension's API (`vscode.git`,
 * `getAPI(1)`). Our code spawns no process: git runs as VS Code runs it,
 * with the writer's `git.path` and the repositories VS Code already found
 * (multi-root and submodules are the extension's).
 *
 * - **No `extensionDependencies`.** Declaring `vscode.git` would refuse to
 *   activate Prose Minion where the Git extension is disabled; instead each
 *   call checks, and answers `no-git` or `git-disabled`.
 * - **An uninitialized API is waited for** at most `gitReadyMs`, then
 *   `not-ready`.
 * - **`show` is given only a full hash,** which core took from this
 *   adapter's own `log` (the branded `FileHistoryCommitId`). An error naming
 *   a missing path is `absent`; any other is `failed`.
 * - **The log does not follow renames** (`git log -- path`): the stated limit.
 * - **Workspace trust is the boundary** (D16): the extension declares no
 *   support for untrusted workspaces, so neither it nor the Git extension
 *   runs in Restricted Mode. The Git extension's `show` reads a blob with
 *   `git show --textconv`, so a repository's text conversion can run here,
 *   as it does for VS Code's own file views; diff drivers and external diff
 *   tools never do, since the diff is core's.
 *
 * Nothing is logged: a failure is returned as a closed reason, never with
 * git's message, which may name the file.
 */

import * as vscode from 'vscode';
import {
  fileHistoryCommitId,
  WORKSHOP_HISTORY_GIT_READY_MS,
  type FileHistory,
  type FileHistoryCommit,
  type FileHistoryCommitId,
  type FileHistoryLog,
  type FileHistoryShow,
  type FileHistoryUnavailableReason
} from '@prose-minion/core';
import { GIT_EXTENSION_ID, type GitApi, type GitExtension, type GitRepository } from '@app/platform/vscode/gitExtensionApi';

/** Git's words when a path is not in a commit: `does not exist in` and `exists on disk, but not in`. */
const MISSING_PATH = /does not exist in|exists on disk, but not in|path .* does not exist/i;

type Opened = { readonly repository: GitRepository } | { readonly unavailable: FileHistoryUnavailableReason };

export class VsCodeFileHistory implements FileHistory {
  constructor(private readonly readyMs: number = WORKSHOP_HISTORY_GIT_READY_MS) {}

  async log(fsPath: string, limit: number): Promise<FileHistoryLog> {
    const opened = await this.repositoryFor(fsPath);
    if ('unavailable' in opened) {
      return { kind: 'unavailable', reason: opened.unavailable };
    }
    try {
      const commits = await opened.repository.log({ path: fsPath, maxEntries: limit });
      return { kind: 'log', commits: commits.flatMap((commit) => this.commitOf(commit)) };
    } catch {
      return { kind: 'unavailable', reason: 'failed' };
    }
  }

  async show(fsPath: string, commit: FileHistoryCommitId): Promise<FileHistoryShow> {
    const opened = await this.repositoryFor(fsPath);
    if ('unavailable' in opened) {
      return { kind: 'unavailable', reason: opened.unavailable };
    }
    try {
      return { kind: 'text', text: await opened.repository.show(commit, fsPath) };
    } catch (error) {
      return MISSING_PATH.test(gitErrorText(error)) ? { kind: 'absent' } : { kind: 'unavailable', reason: 'failed' };
    }
  }

  private commitOf(commit: { hash: string; message: string; authorDate?: Date; authorName?: string }): FileHistoryCommit[] {
    const id = fileHistoryCommitId(commit.hash.toLowerCase());
    if (!id) {
      return [];
    }
    const date = commit.authorDate instanceof Date && !Number.isNaN(commit.authorDate.getTime())
      ? commit.authorDate.toISOString()
      : undefined;
    return [{
      id,
      ...(date ? { authoredAt: date } : {}),
      author: commit.authorName ?? '',
      subject: (commit.message ?? '').split(/\r?\n/, 1)[0] ?? ''
    }];
  }

  private async repositoryFor(fsPath: string): Promise<Opened> {
    const extension = vscode.extensions.getExtension<GitExtension>(GIT_EXTENSION_ID);
    if (!extension) {
      return { unavailable: 'no-git' };
    }
    let git: GitExtension;
    try {
      git = extension.isActive ? extension.exports : await extension.activate();
    } catch {
      return { unavailable: 'no-git' };
    }
    if (!git?.enabled) {
      return { unavailable: 'git-disabled' };
    }
    let api: GitApi;
    try {
      api = git.getAPI(1);
    } catch {
      return { unavailable: 'git-disabled' };
    }
    if (!(await this.ready(api))) {
      return { unavailable: 'not-ready' };
    }
    const repository = api.getRepository(vscode.Uri.file(fsPath));
    return repository ? { repository } : { unavailable: 'not-a-repository' };
  }

  /** Whether the API is initialized, waiting at most `readyMs` for it. */
  private ready(api: GitApi): Promise<boolean> {
    if (api.state === 'initialized') {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        listener.dispose();
        resolve(false);
      }, this.readyMs);
      const listener = api.onDidChangeState((state) => {
        if (state === 'initialized') {
          clearTimeout(timer);
          listener.dispose();
          resolve(true);
        }
      });
    });
  }
}

function gitErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error);
  }
  const record = error as { message?: unknown; stderr?: unknown };
  return [record.message, record.stderr].filter((part): part is string => typeof part === 'string').join('\n');
}
