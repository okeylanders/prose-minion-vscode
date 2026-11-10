/**
 * FileEditAuthorityEpoch: a counter the host moves whenever what authorizes
 * a project file for an edit may have changed (ADR 2026-11-05 D7.6). That
 * is a workspace folder added, removed or reordered, or a change to the
 * `proseMinion` context-path settings that decide catalog membership.
 *
 * The file-edit gateway reads it once, when it re-authorizes an identity,
 * and again synchronously before every write attempt. A moved epoch refuses
 * the attempt without an await, so a root or membership change between
 * attempts never lets an edit through on stale authority.
 *
 * In VS Code this is `VsCodeFileEditAuthorityEpoch`, over
 * `workspace.onDidChangeWorkspaceFolders` and
 * `workspace.onDidChangeConfiguration`.
 */
export interface FileEditAuthorityEpoch {
  /** The current epoch; it only ever increases. */
  current(): number;
}
