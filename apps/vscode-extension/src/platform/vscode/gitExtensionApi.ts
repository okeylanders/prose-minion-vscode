/**
 * The few types of VS Code's built-in Git extension API (version 1) that
 * `VsCodeFileHistory` relies on (ADR 2026-11-19 D12). Copied, narrowed,
 * from VS Code's `extensions/git/src/api/git.d.ts` (MIT), since those
 * typings are not published as a package and are not in this repository.
 *
 * Relied on: `GitExtension.enabled` and `getAPI(1)`; `API.state`,
 * `onDidChangeState` and `getRepository`; `Repository.rootUri`;
 * `Repository.log({ path, maxEntries })` (`hash`, `message`, `authorName`,
 * `authorDate` only), whose `path` VS Code passes to git verbatim after
 * `--`, so a literal pathspec stays literal; `Repository.buffer(ref, path)`
 * (raw bytes, so core decodes every side alike); and
 * `Repository.getObjectDetails(treeish, path)` (the blob's size, before
 * fetching it). Each has been in the API since well before the 1.82 floor.
 * Not relied on: `show`, which decodes with VS Code's own encoding
 * detection, `LogOptions.skip`, which the floor may not have, `range`,
 * `follow`, `getCommit` and the `diffWith*` family.
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

export interface GitObjectDetails {
  readonly mode: string;
  readonly object: string;
  readonly size: number;
}

export interface GitRepository {
  readonly rootUri: vscode.Uri;
  log(options?: GitLogOptions): Promise<GitCommit[]>;
  buffer(ref: string, path: string): Promise<Uint8Array>;
  getObjectDetails(treeish: string, path: string): Promise<GitObjectDetails>;
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
