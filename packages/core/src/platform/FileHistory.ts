/**
 * FileHistory - platform port for a file's version-control history (ADR
 * 2026-11-19 D11, D12). Read-only, and `vscode`-free.
 *
 * - VS Code adapter = `VsCodeFileHistory`, over the built-in Git
 *   extension's API (version 1): our code spawns no process.
 * - Another host (a console app) runs `git` itself, with fixed arguments,
 *   no shell, and only after its own workspace-trust check (D16).
 *
 * Commit ids reach `show` only as this port's own `log` returned them:
 * `FileHistoryCommitId` is a branded type, minted by `fileHistoryCommitId`
 * from a full hash, so a model's text cannot be passed on by accident (D14).
 * The diff is computed in core from two `show`s; no host diff tool runs.
 */

declare const fileHistoryCommitIdBrand: unique symbol;

/** A full commit hash as the host's log returned it: 40 lowercase hex, or 64 in a SHA-256 repository. */
export type FileHistoryCommitId = string & { readonly [fileHistoryCommitIdBrand]: true };

const FULL_COMMIT_ID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/** The id, if `value` is a full lowercase commit hash; otherwise undefined. */
export function fileHistoryCommitId(value: string): FileHistoryCommitId | undefined {
  return FULL_COMMIT_ID.test(value) ? value as FileHistoryCommitId : undefined;
}

export interface FileHistoryCommit {
  readonly id: FileHistoryCommitId;
  /** The author's date, ISO 8601, when the host knows it. */
  readonly authoredAt?: string;
  /** The author's name, as the repository records it. Writer data: never logged. */
  readonly author: string;
  /** The message's first line. Writer data: never logged. */
  readonly subject: string;
}

/** Why the host could not answer, in closed words; core says each in host words. */
export type FileHistoryUnavailableReason =
  | 'no-git'
  | 'git-disabled'
  | 'not-ready'
  | 'not-a-repository'
  | 'not-tracked'
  | 'failed';

export type FileHistoryLog =
  | { readonly kind: 'log'; readonly commits: readonly FileHistoryCommit[] }
  | { readonly kind: 'unavailable'; readonly reason: FileHistoryUnavailableReason };

export type FileHistoryShow =
  | { readonly kind: 'text'; readonly text: string }
  /** The file did not exist at that commit. */
  | { readonly kind: 'absent' }
  | { readonly kind: 'unavailable'; readonly reason: FileHistoryUnavailableReason };

export interface FileHistory {
  /** The newest `limit` commits that touched the file, newest first. Renames are not followed. */
  log(fsPath: string, limit: number): Promise<FileHistoryLog>;
  /** The file's text at a full commit id the log returned. */
  show(fsPath: string, commit: FileHistoryCommitId): Promise<FileHistoryShow>;
}
