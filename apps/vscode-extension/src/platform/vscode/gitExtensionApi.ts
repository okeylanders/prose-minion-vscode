/**
 * The few types of VS Code's built-in Git extension API (version 1) that
 * `VsCodeFileHistory` relies on (ADR 2026-11-19 D12). Copied, narrowed,
 * from VS Code's `extensions/git/src/api/git.d.ts` (MIT), since those
 * typings are not published as a package and are not in this repository.
 *
 * Relied on: `GitExtension.enabled` and `getAPI(1)`; `API.state`,
 * `onDidChangeState` and `getRepository`; `Repository.log({ path,
 * maxEntries })` (`hash`, `message`, `authorName`, `authorDate` only) and
 * `Repository.show(ref, path)`. Not relied on: `LogOptions.skip`, which the
 * 1.82 engine floor may not have, `range`, `follow`, `getCommit` and the
 * `diffWith*` family.
 */

import type * as vscode from 'vscode';

/** The extension's id, as VS Code ships it. */
export const GIT_EXTENSION_ID = 'vscode.git';

export type GitApiState = 'uninitialized' | 'initialized';

export interface GitCommit {
  readonly hash: string;
  readonly message: string;
  readonly authorDate?: Date;
  readonly authorName?: string;
}

export interface GitLogOptions {
  readonly maxEntries?: number;
  readonly path?: string;
}

export interface GitRepository {
  log(options?: GitLogOptions): Promise<GitCommit[]>;
  show(ref: string, path: string): Promise<string>;
}

export interface GitApi {
  readonly state: GitApiState;
  readonly onDidChangeState: vscode.Event<GitApiState>;
  getRepository(uri: vscode.Uri): GitRepository | null;
}

export interface GitExtension {
  /** False when the writer's `git.enabled` setting is off; `getAPI` then throws. */
  readonly enabled: boolean;
  getAPI(version: 1): GitApi;
}
